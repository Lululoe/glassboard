import { findCard, getAllCards } from '../config.js';
import { HttpError } from '../errors.js';
import { getEntityState, haRequest } from './homeassistant.js';

/** Cats a litter box card shows; further ones are ignored. */
export const MAX_CATS = 6;
/** What the history endpoint can load. */
export const HISTORY_RANGES = ['today', 'week', 'weight'];
const ENTITY = /^[a-z_]+\.[\w-]+$/;
const validId = (id) => typeof id === 'string' && ENTITY.test(id);
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const WEIGHT_DAYS = 30;
const MAX_WEIGHT_POINTS = 120;
// History changes slowly; the card polls it, so a short cache keeps Home Assistant's recorder quiet
const HISTORY_CACHE_MS = { today: 30000, week: 5 * 60000, weight: 10 * 60000 };

/** Entity settings of a litter box card besides the robot itself, in the order the docs list them. */
export const LITTER_KEYS = ['status', 'waste', 'litter', 'last_seen', 'hopper', 'reset', 'clean_delay', 'globe_light', 'panel_lock', 'sleep_start', 'sleep_end', 'firmware'];

/**
 * The settings of a litter box card, with invalid entities left out.
 * @param {Object} card - A `litterbox` card.
 * @returns {Object} `entity_id`, `name`, one entity id (or null) per key of LITTER_KEYS, and
 *   `cats` (`name`, `weight`, `visits`, `color`).
 */
export function litterSettings(card) {
    const optional = (id) => (validId(id) ? id : null);
    const settings = {
        entity_id: optional(card?.entity_id),
        name: typeof card?.name === 'string' ? card.name : null,
    };
    LITTER_KEYS.forEach(key => { settings[key] = optional(card?.[key]); });
    settings.cats = (Array.isArray(card?.cats) ? card.cats : [])
        .filter(c => c && (validId(c.weight) || validId(c.visits)))
        .slice(0, MAX_CATS)
        .map((c, i) => ({
            name: typeof c.name === 'string' && c.name ? c.name : `Cat ${i + 1}`,
            weight: optional(c.weight),
            visits: optional(c.visits),
            color: typeof c.color === 'string' && c.color ? c.color : null,
        }));
    return settings;
}

/**
 * Every entity of a litter box's settings.
 * @param {Object} box - From litterSettings.
 * @returns {string[]} The entity ids.
 */
const entitiesOf = (box) => [box.entity_id, ...LITTER_KEYS.map(k => box[k]), ...box.cats.flatMap(c => [c.weight, c.visits])].filter(Boolean);

/** Every entity on litter box cards; their states may be read like other card entities. */
export function getLitterEntityIds() {
    const ids = new Set();
    getAllCards().forEach(card => {
        if (card?.type !== 'litterbox') return;
        const box = litterSettings(card);
        if (box.entity_id) entitiesOf(box).forEach(id => ids.add(id));
    });
    return ids;
}

/**
 * Finds a litter box card.
 * @param {*} cardId - The card id.
 * @returns {Object} Its settings.
 * @throws {HttpError} 403 for anything that isn't a litter box card with a robot.
 */
function lookUp(cardId) {
    const card = findCard(cardId);
    const box = card?.type === 'litterbox' ? litterSettings(card) : null;
    if (!box?.entity_id) throw new HttpError(403, `Not a litter box card: ${cardId}`);
    return box;
}

const toNumber = (v) => {
    const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
    return v === null || v === undefined || !Number.isFinite(n) ? null : n;
};
const known = (state) => (state && state.state !== 'unavailable' && state.state !== 'unknown' ? state.state : null);

/**
 * Loads what a litter box card shows.
 * @param {Object} params - `card_id`.
 * @param {(id: string) => Promise<Object|null>} [readState] - Reads a state (for tests).
 * @returns {Promise<Object>} The robot's state, levels, settings and cats.
 */
export async function litterData(params, readState = getEntityState) {
    const box = lookUp(params.card_id);
    const list = [...new Set(entitiesOf(box))];
    const loaded = await Promise.all(list.map(id => readState(id).catch(() => null)));
    const states = Object.fromEntries(list.map((id, i) => [id, loaded[i]]));
    const of = (key) => (box[key] ? states[box[key]] : null);
    const percent = (key) => {
        const n = toNumber(known(of(key)));
        return n === null ? null : Math.min(100, Math.max(0, n));
    };
    const select = (key) => {
        const s = of(key);
        if (!s) return null;
        return { value: known(s), options: Array.isArray(s.attributes?.options) ? s.attributes.options.map(String) : [] };
    };
    const main = states[box.entity_id];
    const lock = known(of('panel_lock'));
    const firmware = of('firmware');

    return {
        entity_id: box.entity_id,
        name: box.name || main?.attributes?.friendly_name || box.entity_id,
        state: main?.state ?? 'unavailable',
        status: known(of('status')),
        waste: percent('waste'),
        litter: percent('litter'),
        last_seen: known(of('last_seen')),
        hopper: known(of('hopper')),
        resettable: Boolean(box.reset),
        clean_delay: select('clean_delay'),
        globe_light: select('globe_light'),
        panel_lock: lock === null ? null : lock === 'on',
        sleep: box.sleep_start || box.sleep_end ? { start: known(of('sleep_start')), end: known(of('sleep_end')) } : null,
        firmware: firmware ? {
            update: known(firmware) === 'on',
            installed: firmware.attributes?.installed_version ?? null,
            latest: firmware.attributes?.latest_version ?? null,
        } : null,
        cats: box.cats.map((c, index) => {
            const weight = c.weight ? states[c.weight] : null;
            const visits = c.visits ? states[c.visits] : null;
            return {
                index,
                name: c.name,
                color: c.color,
                weight: toNumber(known(weight)),
                weight_unit: weight?.attributes?.unit_of_measurement || '',
                weighed_at: known(weight) !== null ? weight.last_changed || null : null,
                visits: toNumber(known(visits)),
            };
        }),
    };
}

/**
 * Loads number samples over REST, for all entities in one request.
 * @param {string[]} ids - Entity ids.
 * @param {number} start - Start in ms.
 * @param {number} end - End in ms.
 * @returns {Promise<Object<string, Array<{t: number, v: number}>>>} Samples per entity, oldest first.
 */
async function loadHistory(ids, start, end) {
    if (ids.length === 0) return {};
    const query = `filter_entity_id=${ids.map(encodeURIComponent).join(',')}&end_time=${encodeURIComponent(new Date(end).toISOString())}&minimal_response&no_attributes`;
    const result = await haRequest(`/history/period/${encodeURIComponent(new Date(start).toISOString())}?${query}`);
    const byId = {};
    (Array.isArray(result) ? result : []).forEach(list => {
        if (!Array.isArray(list) || !list[0]?.entity_id) return;
        byId[list[0].entity_id] = list
            .map(s => ({ t: Date.parse(s.last_changed || s.last_updated), v: toNumber(s.state) }))
            .filter(s => Number.isFinite(s.t) && s.v !== null)
            .sort((a, b) => a.t - b.t);
    });
    return byId;
}

/**
 * Start of the local day that contains `t`.
 * @param {number} t - A time in ms.
 * @returns {number} Local midnight in ms.
 */
export function dayStart(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Turns the samples of a "visits today" counter into the times of the visits: every step up is
 * one visit (or more, when it went up by more than one), and a drop is the counter's reset.
 * @param {Array<{t: number, v: number}>} samples - The counter's samples, oldest first.
 * @param {number} since - Only visits from this time on count.
 * @returns {number[]} The visit times in ms.
 */
export function visitTimes(samples, since) {
    const times = [];
    let prev = null;
    samples.forEach(({ t, v }) => {
        if (prev !== null && v > prev && t >= since) {
            for (let i = 0; i < Math.min(v - prev, 20); i++) times.push(t);
        }
        prev = v;
    });
    return times;
}

/**
 * The highest value of a "visits today" counter on each of the last days, today last.
 * @param {Array<{t: number, v: number}>} samples - The counter's samples, oldest first.
 * @param {number} now - The current time in ms.
 * @param {number} [days=7] - How many days.
 * @returns {number[]} Visits per day; 0 for a day without samples.
 */
export function visitsPerDay(samples, now, days = WEEK_DAYS) {
    const today = dayStart(now);
    return Array.from({ length: days }, (_, i) => {
        // Days are counted by calendar, so a day with a clock change is still one day
        const start = dayStart(today - (days - 1 - i) * DAY_MS + DAY_MS / 2);
        const end = i === days - 1 ? now + 1 : dayStart(start + DAY_MS + DAY_MS / 2);
        const inDay = samples.filter(s => s.t >= start && s.t < end).map(s => s.v);
        return inDay.length ? Math.max(0, ...inDay) : 0;
    });
}

/**
 * Thins samples to at most `max`, keeping the first and last.
 * @param {Array<{t: number, v: number}>} samples - The samples.
 * @param {number} max - The most to keep.
 * @returns {Array<{t: number, v: number}>} The samples to draw.
 */
export function thin(samples, max = MAX_WEIGHT_POINTS) {
    if (samples.length <= max) return samples;
    const step = (samples.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => samples[Math.round(i * step)]);
}

const historyCache = new Map();

/** Clears cached history. Intended for tests. */
export function resetLitterCache() {
    historyCache.clear();
}

/**
 * Loads the history a litter box card draws, per cat:
 * - `today`: the times of today's visits (`visits`, ms),
 * - `week`: visits on each of the last 7 days, today last (`days`, plus `start` of the first day),
 * - `weight`: the weight over the last 30 days (`points`, `{t, v}`).
 * @param {Object} params - `card_id` and `range`.
 * @param {number} [now] - The current time in ms (for tests).
 * @returns {Promise<Object>} `{ range, cats: [...] }`.
 */
export async function litterHistory(params, now = Date.now()) {
    const box = lookUp(params.card_id);
    const range = String(params.range || 'today');
    if (!HISTORY_RANGES.includes(range)) throw new HttpError(400, `Unknown range: ${range}`);
    const key = `${params.card_id}|${range}`;
    const hit = historyCache.get(key);
    if (hit && now - hit.at < HISTORY_CACHE_MS[range] && hit.at <= now) return hit.promise;

    const load = async () => {
        if (range === 'weight') {
            const ids = box.cats.map(c => c.weight).filter(Boolean);
            const history = await loadHistory(ids, now - WEIGHT_DAYS * DAY_MS, now);
            return { range, cats: box.cats.map((c, index) => ({ index, points: c.weight ? thin(history[c.weight] || []) : [] })) };
        }
        const ids = box.cats.map(c => c.visits).filter(Boolean);
        const start = range === 'today' ? dayStart(now) : dayStart(dayStart(now) - (WEEK_DAYS - 1) * DAY_MS + DAY_MS / 2);
        // A little before the start, so the first visit of the day counts from the counter's reset
        const history = await loadHistory(ids, start - 60 * 60 * 1000, now);
        if (range === 'today') {
            return { range, cats: box.cats.map((c, index) => ({ index, visits: c.visits ? visitTimes(history[c.visits] || [], start) : [] })) };
        }
        return { range, start, cats: box.cats.map((c, index) => ({ index, days: c.visits ? visitsPerDay(history[c.visits] || [], now) : Array(WEEK_DAYS).fill(0) })) };
    };

    const entry = { at: now, promise: load() };
    historyCache.set(key, entry);
    entry.promise.catch(() => historyCache.delete(key));
    return entry.promise;
}

/**
 * Validates a litter box action against the card and returns the Home Assistant service to call.
 * Only the card's robot and the entities set on the card can be used.
 * @param {Object} params - `card_id`, `action` and its value: `value` for `set_clean_delay`,
 *   `set_globe_light` (one of the select's options) and `set_panel_lock` (boolean).
 * @param {(id: string) => Promise<Object|null>} [readState] - Reads a state (for tests).
 * @returns {Promise<{domain: string, service: string, body: Object}>} The call.
 * @throws {HttpError} 403 for anything not on the card, 400 for invalid values.
 */
export async function litterCall(params, readState = getEntityState) {
    const box = lookUp(params.card_id);
    const { action } = params;
    if (action === 'clean') return { domain: 'vacuum', service: 'start', body: { entity_id: box.entity_id } };
    if (action === 'reset') {
        if (!box.reset) throw new HttpError(403, 'This litter box has no reset button');
        return { domain: 'button', service: 'press', body: { entity_id: box.reset } };
    }
    if (action === 'set_clean_delay' || action === 'set_globe_light') {
        const id = box[action === 'set_clean_delay' ? 'clean_delay' : 'globe_light'];
        if (!id) throw new HttpError(403, `This litter box has no ${action === 'set_clean_delay' ? 'clean delay' : 'globe light'} setting`);
        const state = await readState(id);
        const options = (state?.attributes?.options || []).map(String);
        if (!options.includes(String(params.value))) throw new HttpError(400, `Unknown option: ${params.value}`);
        return { domain: id.split('.')[0] === 'input_select' ? 'input_select' : 'select', service: 'select_option', body: { entity_id: id, option: String(params.value) } };
    }
    if (action === 'set_panel_lock') {
        if (!box.panel_lock) throw new HttpError(403, 'This litter box has no panel lock');
        if (typeof params.value !== 'boolean') throw new HttpError(400, 'value must be true or false');
        return { domain: 'homeassistant', service: params.value ? 'turn_on' : 'turn_off', body: { entity_id: box.panel_lock } };
    }
    throw new HttpError(400, `Unknown litter box action: ${action}`);
}

/**
 * Runs a litter box action (see litterCall).
 * @param {Object} params - The action.
 * @returns {Promise<*>} Home Assistant's response.
 */
export async function litterAction(params) {
    const { domain, service, body } = await litterCall(params);
    return haRequest(`/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify(body) });
}
