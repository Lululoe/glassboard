import { findCard, getAllCards } from '../config.js';
import { HttpError } from '../errors.js';
import { getEntityState, haRequest } from './homeassistant.js';

const STEM = /^[a-z0-9_]+$/;
const ENTITY = /^[a-z_]+\.[\w-]+$/;
const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const AMS_TRAYS = [1, 2, 3, 4];
const EXTERNAL_SPOOL = 'sensor.external_spool_external_spool';
const UNAVAILABLE = new Set(['unavailable', 'unknown', 'none', '']);
// Older versions of the integration named its buttons `..._pause_printing`
const BUTTONS = { pause: ['pause', 'pause_printing'], resume: ['resume', 'resume_printing'], stop: ['stop', 'stop_printing'] };
const MINUTES_PER_UNIT = { h: 60, min: 1, s: 1 / 60 };

const stem = (value) => (typeof value === 'string' && STEM.test(value) ? value : null);

/**
 * The settings of a printer card, with invalid values left out.
 * @param {Object} card - A `printer` card.
 * @returns {{printer: string|null, ams: string|null, name: string|null, trays: string[]}}
 *   Entity id stems of the printer and its AMS, the name, and the listed spools.
 */
export function printerSettings(card) {
    return {
        printer: stem(card?.printer),
        ams: card?.ams === undefined ? 'ams' : stem(card.ams),
        name: typeof card?.name === 'string' ? card.name : null,
        trays: (Array.isArray(card?.trays) ? card.trays : [])
            .map(t => (typeof t === 'string' ? t : t?.entity_id))
            .filter(id => typeof id === 'string' && ENTITY.test(id)),
    };
}

/**
 * The Home Assistant entities a printer is read from, named after the Bambu Lab integration's.
 * @param {ReturnType<typeof printerSettings>} settings - The card's settings.
 * @returns {{sensors: Object<string, string>, buttons: Object<string, string[]>, light: string, humidity: string|null, spools: string[], external: string|null}}
 *   The entity ids.
 */
function printerEntities({ printer, ams, trays }) {
    const sensor = (name) => `sensor.${printer}_${name}`;
    return {
        sensors: {
            status: sensor('print_status'),
            stage: sensor('current_stage'),
            job: sensor('task_name'),
            progress: sensor('print_progress'),
            layer: sensor('current_layer'),
            totalLayers: sensor('total_layer_count'),
            remaining: sensor('remaining_time'),
            endTime: sensor('end_time'),
            weight: sensor('print_weight'),
            length: sensor('print_length'),
            nozzle: sensor('nozzle_temperature'),
            nozzleTarget: sensor('nozzle_target_temperature'),
            bed: sensor('bed_temperature'),
            bedTarget: sensor('bed_target_temperature'),
            chamber: sensor('chamber_temperature'),
            printerName: sensor('printer_name'),
            online: `binary_sensor.${printer}_online`,
            printError: `binary_sensor.${printer}_print_error`,
            hms: `binary_sensor.${printer}_hms_errors`,
        },
        buttons: Object.fromEntries(Object.entries(BUTTONS).map(([action, names]) => [action, names.map(n => `button.${printer}_${n}`)])),
        light: `light.${printer}_chamber_light`,
        humidity: ams ? `sensor.${ams}_humidity` : null,
        spools: trays.length > 0 ? trays : ams ? AMS_TRAYS.map(n => `sensor.${ams}_tray_${n}`) : [],
        external: trays.length > 0 ? null : EXTERNAL_SPOOL,
    };
}

/** Every entity on printer cards; their states may be read like other card entities. */
export function getPrinterEntityIds() {
    const ids = new Set();
    getAllCards().filter(card => card.type === 'printer').forEach(card => {
        const settings = printerSettings(card);
        if (!settings.printer) return;
        const e = printerEntities(settings);
        [...Object.values(e.sensors), ...Object.values(e.buttons).flat(), e.light, e.humidity, ...e.spools, e.external]
            .forEach(id => id && ids.add(id));
    });
    return ids;
}

/**
 * Finds a printer card's settings.
 * @param {*} cardId - The card id.
 * @returns {ReturnType<typeof printerSettings>} Its settings.
 * @throws {HttpError} 403 for anything that isn't a printer card with a printer set.
 */
export function printerOf(cardId) {
    const card = findCard(cardId);
    const settings = card?.type === 'printer' ? printerSettings(card) : null;
    if (!settings?.printer) throw new HttpError(403, `Not a printer card: ${cardId}`);
    return settings;
}

/**
 * Whether a state holds a value.
 * @param {Object|null|undefined} state - An entity state.
 * @returns {boolean} False for missing and unavailable entities.
 */
const available = (state) => Boolean(state) && !UNAVAILABLE.has(String(state.state).toLowerCase());

/**
 * Whether a button can be pressed. Its state is when it was last pressed, so a button that
 * never was reads `unknown`.
 * @param {Object|null|undefined} state - The button's state.
 * @returns {boolean} False for missing and unavailable buttons.
 */
const pressable = (state) => Boolean(state) && state.state !== 'unavailable';

const numberOf = (state) => {
    if (!available(state)) return null;
    const n = Number(state.state);
    return Number.isFinite(n) ? n : null;
};

const textOf = (state) => (available(state) ? String(state.state) : null);

/**
 * Time left in minutes; the integration's unit has changed between versions.
 * @param {Object|null} state - The remaining time sensor.
 * @returns {number|null} Minutes left.
 */
function minutesLeft(state) {
    const n = numberOf(state);
    if (n === null) return null;
    return Math.round(n * (MINUTES_PER_UNIT[state.attributes?.unit_of_measurement] ?? 1));
}

/**
 * Why a print stopped, from the printer's error sensors.
 * @param {Object|null} printError - The print error sensor.
 * @param {Object|null} hms - The HMS errors sensor.
 * @returns {string|null} The first message.
 */
function errorMessage(printError, hms) {
    if (printError?.state === 'on' && printError.attributes?.error) return String(printError.attributes.error);
    if (hms?.state !== 'on') return null;
    const key = Object.keys(hms.attributes || {}).find(k => /-Error$/.test(k));
    return key ? String(hms.attributes[key]) : null;
}

/**
 * A loaded spool, as the card shows it.
 * @param {Object|null} state - The tray or external spool sensor.
 * @param {string} entityId - Its entity id.
 * @returns {Object} `entity_id`, `slot`, `name`, `color`, `active` and `empty`.
 */
function spoolOf(state, entityId) {
    const a = state?.attributes || {};
    return {
        entity_id: entityId,
        slot: a.friendly_name || entityId,
        name: textOf(state),
        color: COLOR.test(a.color) ? a.color : null,
        active: a.active === true,
        empty: !available(state) || a.empty === true,
    };
}

/**
 * Loads what a printer card shows.
 * @param {Object} params - `card_id`.
 * @returns {Promise<Object>} The printer's status, job, temperatures, spools and controls.
 */
export async function printerData(params) {
    const settings = printerOf(params.card_id);
    const e = printerEntities(settings);
    const ids = [...new Set([...Object.values(e.sensors), ...Object.values(e.buttons).flat(), e.light, e.humidity, ...e.spools, e.external].filter(Boolean))];
    const loaded = await Promise.all(ids.map(id => getEntityState(id).catch(() => null)));
    const states = Object.fromEntries(ids.map((id, i) => [id, loaded[i]]));
    const s = Object.fromEntries(Object.entries(e.sensors).map(([key, id]) => [key, states[id]]));

    const online = s.online?.state !== 'off';
    const external = e.external ? spoolOf(states[e.external], e.external) : null;
    const light = states[e.light];
    return {
        name: settings.name || textOf(s.printerName) || settings.printer.toUpperCase(),
        status: online ? textOf(s.status) || 'offline' : 'offline',
        stage: textOf(s.stage),
        job: textOf(s.job),
        progress: numberOf(s.progress),
        layer: numberOf(s.layer),
        totalLayers: numberOf(s.totalLayers),
        remaining: minutesLeft(s.remaining),
        endTime: textOf(s.endTime),
        changedAt: s.status?.last_changed || null,
        weight: numberOf(s.weight),
        length: numberOf(s.length),
        error: errorMessage(s.printError, s.hms),
        nozzle: { value: numberOf(s.nozzle), target: numberOf(s.nozzleTarget) },
        bed: { value: numberOf(s.bed), target: numberOf(s.bedTarget) },
        chamber: numberOf(s.chamber),
        humidity: e.humidity ? numberOf(states[e.humidity]) : null,
        spools: [
            ...e.spools.map(id => spoolOf(states[id], id)),
            // Only worth a place on the card while something is loaded there
            ...(external && !external.empty ? [external] : []),
        ],
        controls: Object.fromEntries(Object.entries(e.buttons).map(([action, names]) => [action, names.some(id => pressable(states[id]))])),
        light: available(light) ? light.state : null,
    };
}

/**
 * Pauses, resumes or stops a print, or switches the chamber light.
 * @param {Object} params - `card_id` and `action` (`pause`, `resume`, `stop`, `light_on` or `light_off`).
 * @returns {Promise<*>} Home Assistant's response.
 * @throws {HttpError} 400 for unknown actions, 409 when the printer has no such button.
 */
export async function printerAction(params) {
    const e = printerEntities(printerOf(params.card_id));
    const { action } = params;
    if (action === 'light_on' || action === 'light_off') {
        return haRequest(`/services/light/${action === 'light_on' ? 'turn_on' : 'turn_off'}`, {
            method: 'POST',
            body: JSON.stringify({ entity_id: e.light }),
        });
    }
    if (!Object.hasOwn(e.buttons, String(action))) throw new HttpError(400, `Unknown printer action: ${action}`);
    const states = await Promise.all(e.buttons[action].map(id => getEntityState(id).catch(() => null)));
    const entityId = e.buttons[action].find((_, i) => pressable(states[i]));
    if (!entityId) throw new HttpError(409, `The printer has no ${action} button`);
    return haRequest('/services/button/press', { method: 'POST', body: JSON.stringify({ entity_id: entityId }) });
}
