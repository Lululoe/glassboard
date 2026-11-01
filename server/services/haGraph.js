import { findCard, getAllCards } from '../config.js';
import { HttpError } from '../errors.js';
import { getEntityState, haRequest, liveCommand } from './homeassistant.js';

/** Sensors a graph card shows; further ones are ignored. */
export const MAX_SENSORS = 8;
export const DEFAULT_RANGES = ['24h', '7d', '30d'];
const MAX_HOURS = 366 * 24;
const CACHE_MS = 30000;
const SLOT_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

/**
 * Parses a time range like `24h`, `7d` or `2w`.
 * @param {*} range - The range.
 * @returns {number|null} Hours, or null when it isn't a valid range.
 */
export function hoursOf(range) {
    const m = /^(\d+)([hdw])$/.exec(String(range).trim().toLowerCase());
    if (!m) return null;
    const hours = Number(m[1]) * { h: 1, d: 24, w: 168 }[m[2]];
    return hours > 0 && hours <= MAX_HOURS ? hours : null;
}

/**
 * The settings of a graph card, with defaults.
 * @param {Object} card - The card config.
 * @returns {{chart: 'line'|'bar'|'week', ranges: string[], selector: boolean,
 *   entities: Array<{entity_id: string, name?: string, color?: string}>}} The settings.
 */
export function graphSettings(card) {
    const chart = ['line', 'bar', 'week'].includes(card.chart) ? card.chart : 'line';
    const listed = Array.isArray(card.ranges) ? card.ranges.filter(r => hoursOf(r)) : [];
    // `ranges: false` turns the selector off and shows `range`
    const selector = card.ranges !== false;
    const ranges = selector ? (listed.length ? listed : DEFAULT_RANGES) : [hoursOf(card.range) ? card.range : '24h'];
    const entities = (Array.isArray(card.entities) ? card.entities : [])
        .map(e => (typeof e === 'string' ? { entity_id: e } : e))
        .filter(e => e && typeof e.entity_id === 'string' && /^[a-z_]+\.[\w-]+$/.test(e.entity_id))
        .slice(0, MAX_SENSORS);
    return { chart, ranges, selector, entities };
}

/** Entity ids on graph cards; their states may be read like other card entities. */
export function getGraphEntityIds() {
    const ids = new Set();
    getAllCards().forEach(card => {
        if (card.type === 'graph') graphSettings(card).entities.forEach(e => ids.add(e.entity_id));
    });
    return ids;
}

/**
 * Start of the period of local time that contains `t`.
 * @param {number} t - Time in ms.
 * @param {number} minutes - Period length; 1440 means a calendar day.
 * @returns {number} The period's start in ms.
 */
function floorTo(t, minutes) {
    const d = new Date(t);
    if (minutes >= 1440) {
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
    const dayMinutes = d.getHours() * 60 + d.getMinutes();
    d.setHours(0, Math.floor(dayMinutes / minutes) * minutes, 0, 0);
    return d.getTime();
}

/**
 * Consecutive periods of local time ending with the current one, which ends now.
 * @param {number} count - How many periods.
 * @param {number} minutes - Period length; 1440 is a calendar day (so days stay whole across DST).
 * @param {number} now - The current time in ms.
 * @returns {Array<{start: number, end: number}>} The periods.
 */
export function makeBuckets(count, minutes, now) {
    const last = floorTo(now, minutes);
    const starts = Array.from({ length: count }, (_, i) => {
        const back = count - 1 - i;
        if (minutes < 1440) return last - back * minutes * 60000;
        const d = new Date(last);
        d.setDate(d.getDate() - back);
        return d.getTime();
    });
    return starts.map((start, i) => ({ start, end: i + 1 < count ? starts[i + 1] : now }));
}

/**
 * How a chart divides its time range: short periods for lines (at most 200 points), hours
 * or days for bars, and the last 14 days for the week comparison.
 * @param {'line'|'bar'|'week'} chart - The chart.
 * @param {number} hours - The time range.
 * @returns {{count: number, minutes: number}} Number and length of the periods.
 */
export function slotsFor(chart, hours) {
    if (chart === 'week') return { count: 14, minutes: 1440 };
    if (chart === 'bar') return hours <= 48 ? { count: hours, minutes: 60 } : { count: Math.ceil(hours / 24), minutes: 1440 };
    const minutes = SLOT_MINUTES.find(m => (hours * 60) / m <= 200) || 1440;
    return { count: Math.ceil((hours * 60) / minutes), minutes };
}

const toNumber = (state) => {
    const n = Number(state);
    return state === '' || state === null || !Number.isFinite(n) ? null : n;
};

/**
 * Turns state changes into a value per period.
 * - `mean`: time-weighted average (the state holds until it changes),
 * - `increase`: how much a meter went up, counting a drop as a reset to zero,
 * - `delta`: how much a total changed, up or down.
 * @param {Array<{t: number, v: number|null}>} samples - State changes, oldest first, starting
 *   with the state at the range's start.
 * @param {Array<{start: number, end: number}>} buckets - The periods.
 * @param {'mean'|'increase'|'delta'} kind - How to combine them.
 * @returns {Array<number|null>} A value per period; null without data.
 */
export function aggregate(samples, buckets, kind) {
    return buckets.map(({ start, end }) => {
        // The state at the start of the period, and the changes during it
        let before = null;
        const inside = [];
        samples.forEach(s => {
            if (s.t <= start) before = s;
            else if (s.t < end) inside.push(s);
        });
        if (kind === 'mean') {
            let area = 0;
            let time = 0;
            let current = before;
            let from = start;
            [...inside, { t: end, v: null, stop: true }].forEach(s => {
                if (current && current.v !== null) {
                    area += current.v * (s.t - from);
                    time += s.t - from;
                }
                from = s.t;
                current = s;
            });
            return time > 0 ? area / time : null;
        }
        let prev = before?.v ?? null;
        let total = 0;
        let seen = prev !== null;
        inside.forEach(s => {
            if (s.v === null) return;
            if (prev !== null) {
                const d = s.v - prev;
                total += kind === 'increase' && d < 0 ? s.v : d;
            }
            prev = s.v;
            seen = true;
        });
        return seen ? total : null;
    });
}

/**
 * Loads state changes over REST, for all entities in one request.
 * @param {string[]} ids - Entity ids.
 * @param {number} start - Start in ms.
 * @param {number} end - End in ms.
 * @returns {Promise<Object<string, Array<{t: number, v: number|null}>>>} Samples per entity.
 */
async function loadHistory(ids, start, end) {
    const query = `filter_entity_id=${ids.map(encodeURIComponent).join(',')}&end_time=${encodeURIComponent(new Date(end).toISOString())}&minimal_response&no_attributes`;
    const result = await haRequest(`/history/period/${encodeURIComponent(new Date(start).toISOString())}?${query}`);
    const byId = {};
    (Array.isArray(result) ? result : []).forEach(list => {
        if (!Array.isArray(list) || !list[0]?.entity_id) return;
        byId[list[0].entity_id] = list.map(s => ({ t: Date.parse(s.last_changed || s.last_updated), v: toNumber(s.state) }))
            .filter(s => Number.isFinite(s.t));
    });
    return byId;
}

/**
 * Loads long-term statistics, which Home Assistant keeps for sensors with a state class: a
 * mean per period for measurements and a change per period for meters. Only the websocket
 * API offers them.
 * @param {string[]} ids - Entity ids.
 * @param {number} start - Start in ms.
 * @param {number} end - End in ms.
 * @param {number} minutes - Period length (5, 60 or 1440).
 * @returns {Promise<{meta: Object<string, Object>, rows: Object<string, Array<Object>>}|null>}
 *   Metadata and rows per statistic, or null without the live connection.
 */
async function loadStatistics(ids, start, end, minutes) {
    try {
        const [meta, rows] = await Promise.all([
            liveCommand({ type: 'recorder/get_statistics_metadata', statistic_ids: ids }),
            liveCommand({
                type: 'recorder/statistics_during_period',
                start_time: new Date(start).toISOString(),
                end_time: new Date(end).toISOString(),
                statistic_ids: ids,
                period: minutes >= 1440 ? 'day' : minutes >= 60 ? 'hour' : '5minute',
                types: ['mean', 'change'],
            }),
        ]);
        if (!meta || !rows) return null;
        return { meta: Object.fromEntries(meta.map(m => [m.statistic_id, m])), rows };
    } catch {
        return null;
    }
}

/**
 * Combines statistics rows into the chart's periods.
 * @param {Array<Object>} rows - Rows with `start` (ms), `mean` and `change`.
 * @param {Array<{start: number, end: number}>} buckets - The periods.
 * @param {'mean'|'change'} field - Which value to use.
 * @returns {Array<number|null>} A value per period.
 */
export function bucketStatistics(rows, buckets, field) {
    return buckets.map(({ start, end }, i) => {
        const until = i + 1 < buckets.length ? buckets[i + 1].start : Infinity;
        const values = rows.filter(r => r.start >= start && r.start < Math.max(end, until) && Number.isFinite(r[field])).map(r => r[field]);
        if (values.length === 0) return null;
        const total = values.reduce((a, b) => a + b, 0);
        return field === 'change' ? total : total / values.length;
    });
}

const cache = new Map();

/** Clears cached graph data. Intended for tests. */
export function resetGraphCache() {
    cache.clear();
}

/**
 * Loads the data of a graph card: one value per period for each of its sensors, from Home
 * Assistant's statistics where it keeps them and from the state history otherwise.
 * @param {Object} params - `card_id` and, for line and bar charts, `range` (one of the card's ranges).
 * @param {number} [now=Date.now()] - The current time (for tests).
 * @returns {Promise<Object>} `{ chart, range, minutes, times, series }`; each series has
 *   `entity_id`, `name`, `unit`, `color`, `kind`, `current` and `values`.
 */
export async function graphData(params, now = Date.now()) {
    const card = findCard(params.card_id);
    if (!card || card.type !== 'graph') throw new HttpError(403, `Not a graph card: ${params.card_id}`);
    const settings = graphSettings(card);
    if (settings.entities.length === 0) throw new HttpError(400, 'The graph card has no sensors');
    const range = settings.chart === 'week' ? '14d' : (params.range || settings.ranges[0]);
    if (settings.chart !== 'week' && !settings.ranges.includes(range)) throw new HttpError(400, `Range not offered by this card: ${range}`);
    const hours = settings.chart === 'week' ? 14 * 24 : hoursOf(range);

    const key = `${card.id}|${range}|${JSON.stringify(settings)}`;
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS) return hit.promise;
    const promise = buildGraph(settings, range, hours, now);
    cache.set(key, { at: now, promise });
    promise.catch(() => cache.delete(key));
    return promise;
}

async function buildGraph(settings, range, hours, now) {
    const { chart, entities } = settings;
    const { count, minutes } = slotsFor(chart, hours);
    const buckets = makeBuckets(count, minutes, now);
    const start = buckets[0].start;
    const ids = entities.map(e => e.entity_id);
    const states = await Promise.all(ids.map(id => getEntityState(id).catch(() => null)));

    // Lines up to two days use the detailed history; everything else prefers statistics
    const useStats = !(chart === 'line' && hours <= 48);
    const stats = useStats ? await loadStatistics(ids, start, now, minutes) : null;
    const series = entities.map((e, i) => {
        const state = states[i];
        const stateClass = state?.attributes?.state_class;
        const meter = chart !== 'line' && (stateClass === 'total_increasing' || stateClass === 'total');
        return {
            entity_id: e.entity_id,
            name: e.name || state?.attributes?.friendly_name || e.entity_id,
            unit: state?.attributes?.unit_of_measurement || '',
            color: typeof e.color === 'string' ? e.color : null,
            kind: meter ? 'change' : 'mean',
            current: toNumber(state?.state),
            values: null,
        };
    });
    series.forEach(s => {
        const meta = stats?.meta[s.entity_id];
        const rows = stats?.rows[s.entity_id];
        const usable = meta && Array.isArray(rows) && (s.kind === 'change' ? meta.has_sum : (meta.has_mean || meta.mean_type > 0));
        if (usable) s.values = bucketStatistics(rows, buckets, s.kind);
    });

    // History fills in sensors without statistics, and the newest periods, whose statistics
    // Home Assistant only compiles once they are over
    const from = new Map();
    series.forEach(s => {
        if (!s.values) {
            from.set(s.entity_id, 0);
            return;
        }
        let i = s.values.length;
        while (i > 0 && s.values[i - 1] === null) i--;
        if (i < s.values.length) from.set(s.entity_id, i);
    });
    if (from.size) {
        const first = Math.min(...from.values());
        const history = await loadHistory([...from.keys()], buckets[first].start, now);
        series.forEach((s, k) => {
            if (!from.has(s.entity_id)) return;
            const stateClass = states[k]?.attributes?.state_class;
            const kind = s.kind === 'mean' ? 'mean' : stateClass === 'total' ? 'delta' : 'increase';
            const i = from.get(s.entity_id);
            const filled = aggregate(history[s.entity_id] || [], buckets.slice(i), kind);
            s.values = [...(s.values || []).slice(0, i), ...filled];
        });
    }
    return { chart, range, minutes, times: buckets.map(b => b.start), end: now, series };
}
