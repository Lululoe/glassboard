import { getConfig } from '../config.js';
import { HttpError } from '../errors.js';
import { KIOSK_ENTITY_FIELDS, TOGGLE_DOMAINS, normalizeKiosk } from '../../shared/kiosk.js';

/** Domains the kiosk options can list entities of, for picking them. */
export const LISTED_DOMAINS = [...new Set([
    'media_player', ...TOGGLE_DOMAINS, ...Object.values(KIOSK_ENTITY_FIELDS).flat(),
])];

/**
 * The kiosk settings of the current config.
 * @returns {ReturnType<typeof normalizeKiosk>} The settings.
 */
export const currentKiosk = () => normalizeKiosk(getConfig().kiosk);

/**
 * Validates a control center action and returns the Home Assistant service call for it. Only
 * the kiosk's own brightness and screen entities and its toggles can be changed.
 * - `brightness` with `value` (0–100, kept within the entity's min and max) sets the brightness.
 * - `screen` with `on` switches the screen.
 * - `toggle` with `entity_id` and `on` switches one of the toggles.
 * - `logout` presses the logout entity, logging out whoever is logged in on the tablet.
 * @param {Object} params - Request parameters.
 * @param {Object|null} [brightnessState] - The brightness entity's state, for its range.
 * @returns {{domain: string, service: string, body: Object}} The call to make.
 * @throws {HttpError} 403 when the entity is not set up for the kiosk, 400 for invalid values.
 */
export function kioskCall(params, brightnessState = null) {
    const kiosk = currentKiosk();
    const { action } = params;

    if (action === 'brightness') {
        const entityId = kiosk.brightness_entity;
        if (!entityId) throw new HttpError(403, 'No brightness entity is set up for the kiosk');
        const value = Number(params.value);
        if (!Number.isFinite(value) || value < 0 || value > 100) throw new HttpError(400, 'value must be between 0 and 100');
        const min = Number(brightnessState?.attributes?.min);
        const max = Number(brightnessState?.attributes?.max);
        const lo = Number.isFinite(min) ? min : 0;
        const hi = Number.isFinite(max) ? max : 100;
        const level = Math.round(Math.min(hi, Math.max(lo, value)));
        return { domain: entityId.split('.')[0], service: 'set_value', body: { entity_id: entityId, value: level } };
    }

    if (action === 'logout') {
        const entityId = kiosk.logout_entity;
        if (!entityId) throw new HttpError(403, 'No logout entity is set up for the kiosk');
        const domain = entityId.split('.')[0];
        return { domain, service: domain === 'script' ? 'turn_on' : 'press', body: { entity_id: entityId } };
    }

    if (typeof params.on !== 'boolean') throw new HttpError(400, 'on must be true or false');
    const service = params.on ? 'turn_on' : 'turn_off';

    if (action === 'screen') {
        if (!kiosk.screen_entity) throw new HttpError(403, 'No screen entity is set up for the kiosk');
        return { domain: 'homeassistant', service, body: { entity_id: kiosk.screen_entity } };
    }
    if (action === 'toggle') {
        const entityId = String(params.entity_id || '');
        if (!kiosk.toggles.includes(entityId)) throw new HttpError(403, `Entity not authorized: ${entityId}`);
        return { domain: 'homeassistant', service, body: { entity_id: entityId } };
    }
    throw new HttpError(400, `Unknown kiosk action: ${action}`);
}

/**
 * Lists the entities of the domains the kiosk options pick from, with the name and the details
 * the options filter by. Only ids, names, device classes and units: no states.
 * @param {Array<Object>} states - All states, as Home Assistant's `/api/states` returns them.
 * @param {string[]|null} [domains] - The domains listed; null lists every entity, for the entity pickers of cards.
 * @returns {Array<{entity_id: string, name: string, device_class?: string, unit?: string}>} The entities, by id.
 */
export function listedEntities(states, domains = LISTED_DOMAINS) {
    return (Array.isArray(states) ? states : [])
        .filter(s => typeof s?.entity_id === 'string' && (!domains || domains.includes(s.entity_id.split('.')[0])))
        .map(s => {
            const attributes = s.attributes || {};
            return {
                entity_id: s.entity_id,
                name: typeof attributes.friendly_name === 'string' ? attributes.friendly_name : s.entity_id,
                ...(typeof attributes.device_class === 'string' ? { device_class: attributes.device_class } : {}),
                ...(typeof attributes.unit_of_measurement === 'string' ? { unit: attributes.unit_of_measurement } : {}),
            };
        })
        .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

/**
 * The Home Assistant person id a name most likely belongs to, like `person.anna_maria` for
 * "Anna Maria".
 * @param {string} name - The name.
 * @returns {string} The entity id.
 */
export function personIdOf(name) {
    const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `person.${slug}`;
}

/**
 * Finds the Home Assistant person with a name: by display name, or by entity id.
 * @param {string} name - The name, as the kiosk's user entity reports it.
 * @param {Array<Object>} states - All states, as Home Assistant's `/api/states` returns them.
 * @returns {Object|null} The person's state, or null when nobody has that name.
 */
export function findPerson(name, states) {
    const wanted = name.trim().toLowerCase();
    const people = (Array.isArray(states) ? states : []).filter(s => typeof s?.entity_id === 'string' && s.entity_id.startsWith('person.'));
    return people.find(s => String(s.attributes?.friendly_name ?? '').trim().toLowerCase() === wanted)
        ?? people.find(s => s.entity_id === personIdOf(name))
        ?? null;
}
