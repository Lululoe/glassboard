import { findCard, getAllCards } from '../config.js';
import { HttpError } from '../errors.js';
import { HISTORY_RANGES, LITTER_KEYS, dayStart, litterCall, litterData, litterSettings } from './haLitter.js';

/**
 * A simulated Litter-Robot for demo mode: the drawer fills up with each visit, a clean cycle
 * runs for a while after starting one, and each cat visits a few times a day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_MS = 25 * 1000;

/** Simulated cats, by position on the card: [weight in kg, visits per day, first visit hour]. */
const CAT_SEEDS = [[3.32, 4, 1.5], [5.06, 3, 3], [4.4, 3, 2], [3.9, 4, 4]];

const store = {
    waste: 46,
    cycleUntil: 0,
    clean_delay: '7',
    globe_light: 'on',
    panel_lock: false,
};

/**
 * The litter box entity roles of every litter box card, by entity id.
 * @returns {Map<string, {key: string, cat?: number}>} The role of each entity.
 */
function roles() {
    const map = new Map();
    getAllCards().forEach(card => {
        if (card?.type !== 'litterbox') return;
        const box = litterSettings(card);
        if (!box.entity_id) return;
        map.set(box.entity_id, { key: 'vacuum' });
        LITTER_KEYS.forEach(key => { if (box[key]) map.set(box[key], { key }); });
        box.cats.forEach((c, cat) => {
            if (c.weight) map.set(c.weight, { key: 'weight', cat });
            if (c.visits) map.set(c.visits, { key: 'visits', cat });
        });
    });
    return map;
}

/**
 * The visit times of a cat on the day starting at `day`, up to `now`.
 * @param {number} cat - The cat's position.
 * @param {number} day - Local midnight in ms.
 * @param {number} now - The current time in ms.
 * @returns {number[]} Visit times in ms.
 */
export function demoVisits(cat, day, now) {
    const [, perDay, first] = CAT_SEEDS[cat % CAT_SEEDS.length];
    const dayIndex = Math.round(day / DAY_MS);
    const count = perDay + ((dayIndex + cat) % 3 === 0 ? 1 : 0);
    const gap = (22 - first) / count;
    return Array.from({ length: count }, (_, i) => {
        const jitter = (((dayIndex * 7 + cat * 13 + i * 29) % 17) / 17 - 0.5) * gap * 0.6;
        return Math.round(day + (first + i * gap + jitter) * 60 * 60 * 1000);
    }).filter(t => t <= now);
}

/**
 * A cat's simulated weight at a time: a slow drift around its seed weight.
 * @param {number} cat - The cat's position.
 * @param {number} t - The time in ms.
 * @returns {number} The weight in kg.
 */
const weightAt = (cat, t) => {
    const [base] = CAT_SEEDS[cat % CAT_SEEDS.length];
    const days = t / DAY_MS;
    return Math.round((base + Math.sin(days / 9 + cat) * 0.06 + Math.sin(days * 1.7 + cat * 2) * 0.015) * 100) / 100;
};

/**
 * The simulated status code: cleaning for a while after a clean was started, else ready, or
 * drawer full when it is.
 * @param {number} now - The current time in ms.
 * @returns {string} The Litter-Robot status code.
 */
const statusCode = (now) => (now < store.cycleUntil ? 'ccp' : store.waste >= 100 ? 'dfs' : 'rdy');

/**
 * The state of an entity of a litter box card in demo mode.
 * @param {string} entityId - The entity.
 * @param {number} [now] - The current time in ms.
 * @returns {Object|null} Its state, or null when it isn't on a litter box card.
 */
export function demoLitterState(entityId, now = Date.now()) {
    const role = roles().get(entityId);
    if (!role) return null;
    const state = (value, attributes = {}, extra = {}) => ({ entity_id: entityId, state: String(value), attributes, ...extra });
    const today = dayStart(now);
    switch (role.key) {
        case 'vacuum': return state(now < store.cycleUntil ? 'cleaning' : 'docked', { friendly_name: 'Litter-Robot 4' });
        case 'status': return state(statusCode(now));
        case 'waste': return state(store.waste, { unit_of_measurement: '%' });
        case 'litter': return state(82, { unit_of_measurement: '%' });
        case 'last_seen': return state(new Date(now - 4 * 60 * 1000).toISOString(), { device_class: 'timestamp' });
        case 'hopper': return state('enabled');
        case 'reset': return state(new Date(now - 3 * DAY_MS).toISOString());
        case 'clean_delay': return state(store.clean_delay, { options: ['3', '7', '15'] });
        case 'globe_light': return state(store.globe_light, { options: ['off', 'on', 'auto'] });
        case 'panel_lock': return state(store.panel_lock ? 'on' : 'off');
        case 'sleep_start': return state(new Date(today + 23 * 60 * 60 * 1000).toISOString(), { device_class: 'timestamp' });
        case 'sleep_end': return state(new Date(today + 31 * 60 * 60 * 1000).toISOString(), { device_class: 'timestamp' });
        case 'firmware': return state('off', { installed_version: 'ESP: 1.1.75 / PIC: 10512.3', latest_version: 'ESP: 1.1.75 / PIC: 10512.3' });
        case 'weight': {
            const visits = [...demoVisits(role.cat, today - DAY_MS, now), ...demoVisits(role.cat, today, now)];
            const last = visits[visits.length - 1] ?? now - DAY_MS;
            return state(weightAt(role.cat, last).toFixed(2), { unit_of_measurement: 'kg' }, { last_changed: new Date(last).toISOString() });
        }
        case 'visits': return state(demoVisits(role.cat, today, now).length);
        default: return null;
    }
}

/**
 * What a litter box card shows, in demo mode.
 * @param {Object} params - `card_id`.
 * @returns {Promise<Object>} As litterData.
 */
export const demoLitterbox = (params) => litterData(params, async (id) => demoLitterState(id));

/**
 * The visit and weight history of a litter box card, in demo mode.
 * @param {Object} params - `card_id` and `range`.
 * @param {number} [now] - The current time in ms.
 * @returns {Object} As litterHistory.
 */
export function demoLitterHistory(params, now = Date.now()) {
    const card = findCard(params.card_id);
    if (card?.type !== 'litterbox') throw new HttpError(403, `Not a litter box card: ${params.card_id}`);
    const box = litterSettings(card);
    const range = String(params.range || 'today');
    if (!HISTORY_RANGES.includes(range)) throw new HttpError(400, `Unknown range: ${range}`);
    const today = dayStart(now);
    if (range === 'today') {
        return { range, cats: box.cats.map((c, index) => ({ index, visits: c.visits ? demoVisits(index, today, now) : [] })) };
    }
    if (range === 'week') {
        const start = dayStart(today - 6 * DAY_MS + DAY_MS / 2);
        const days = Array.from({ length: 7 }, (_, d) => dayStart(start + d * DAY_MS + DAY_MS / 2));
        return { range, start, cats: box.cats.map((c, index) => ({ index, days: days.map(day => (c.visits ? demoVisits(index, day, now).length : 0)) })) };
    }
    return {
        range,
        cats: box.cats.map((c, index) => ({
            index,
            points: c.weight ? Array.from({ length: 30 }, (_, d) => {
                const t = today - (29 - d) * DAY_MS + 9 * 60 * 60 * 1000;
                return { t, v: weightAt(index, t) };
            }).filter(p => p.t <= now) : [],
        })),
    };
}

/**
 * Runs a litter box action in demo mode, after the same checks as with Home Assistant.
 * @param {Object} params - The action (see litterCall).
 * @param {number} [now] - The current time in ms.
 * @returns {Promise<Array>} An empty list, like Home Assistant's service calls.
 */
export async function demoLitterAction(params, now = Date.now()) {
    const { domain, body } = await litterCall(params, async (id) => demoLitterState(id, now));
    if (params.action === 'clean') {
        store.cycleUntil = now + CYCLE_MS;
        store.waste = Math.min(100, store.waste + 2);
    } else if (params.action === 'reset') {
        store.waste = 0;
    } else if (domain === 'select' || domain === 'input_select') {
        store[params.action === 'set_clean_delay' ? 'clean_delay' : 'globe_light'] = body.option;
    } else if (params.action === 'set_panel_lock') {
        store.panel_lock = params.value;
    }
    return [];
}
