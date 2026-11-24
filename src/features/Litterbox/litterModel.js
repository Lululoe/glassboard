/**
 * Litter-Robot status codes as words, with a level: `ok`, `busy`, `warn`, `bad` or `off`.
 * @type {Object<string, [string, string]>}
 */
export const STATUS_CODES = {
    rdy: ['Ready', 'ok'],
    ccp: ['Cleaning', 'busy'],
    ccc: ['Clean cycle done', 'ok'],
    cd: ['Cat inside', 'busy'],
    cst: ['Waiting to clean', 'busy'],
    ec: ['Emptying', 'busy'],
    br: ['Bonnet removed', 'bad'],
    csf: ['Cat sensor fault', 'bad'],
    csi: ['Cat sensor interrupted', 'warn'],
    scf: ['Cat sensor fault at startup', 'bad'],
    df1: ['Drawer almost full', 'warn'],
    df2: ['Drawer almost full', 'warn'],
    dfs: ['Drawer full', 'bad'],
    sdf: ['Drawer full', 'bad'],
    dhf: ['Dump and home position fault', 'bad'],
    dpf: ['Dump position fault', 'bad'],
    hpf: ['Home position fault', 'bad'],
    otf: ['Motor overload', 'bad'],
    pd: ['Pinch detected', 'bad'],
    spf: ['Pinch detected at startup', 'bad'],
    p: ['Paused', 'warn'],
    pwrd: ['Powering down', 'busy'],
    pwru: ['Powering up', 'busy'],
    off: ['Off', 'off'],
    offline: ['Offline', 'bad'],
};

/** What the robot's vacuum state means, for robots without a status sensor. */
const VACUUM_STATES = {
    docked: ['Ready', 'ok'],
    idle: ['Ready', 'ok'],
    cleaning: ['Cleaning', 'busy'],
    returning: ['Cleaning', 'busy'],
    paused: ['Paused', 'warn'],
    error: ['Error', 'bad'],
    unavailable: ['Unavailable', 'bad'],
    unknown: ['Unknown', 'warn'],
};

/** Colors for cats without their own, in order. */
export const CAT_COLORS = ['var(--system-orange)', 'var(--system-purple)', 'var(--system-teal)', 'var(--system-pink)', 'var(--system-green)', 'var(--system-blue)'];

/**
 * The robot's status in words and its level.
 * @param {Object} box - The litter box from the server.
 * @returns {{text: string, level: string}} E.g. `{ text: 'Ready', level: 'ok' }`.
 */
export function statusOf(box) {
    const code = String(box?.status || '').toLowerCase();
    const [text, level] = STATUS_CODES[code] || VACUUM_STATES[box?.state] || [box?.status || box?.state || 'Unknown', 'warn'];
    // Two cycles left and one cycle left say how long there is
    if (code === 'df1') return { text: `${text} · 2 cycles left`, level };
    if (code === 'df2') return { text: `${text} · 1 cycle left`, level };
    return { text, level };
}

/**
 * Whether the robot is busy, so a clean can't be started.
 * @param {Object} box - The litter box.
 * @returns {boolean} True while cleaning, emptying or a cat is inside.
 */
export const isBusy = (box) => statusOf(box).level === 'busy';

/**
 * The level of the waste drawer: orange from 70 %, red from 90 %.
 * @param {number|null} value - Fill in percent.
 * @returns {string} `''`, `warn` or `bad`.
 */
export const wasteLevel = (value) => (value === null || value === undefined ? '' : value >= 90 ? 'bad' : value >= 70 ? 'warn' : '');

/**
 * The level of the litter: orange at 40 % or less, red at 20 % or less.
 * @param {number|null} value - Litter in percent.
 * @returns {string} `''`, `warn` or `bad`.
 */
export const litterLevel = (value) => (value === null || value === undefined ? '' : value <= 20 ? 'bad' : value <= 40 ? 'warn' : '');

/**
 * The cats with a color each: their own, else one from CAT_COLORS.
 * @param {Array<Object>} cats - The cats from the server.
 * @returns {Array<Object>} The cats with `color` set.
 */
export const withColors = (cats) => (cats || []).map((c, i) => ({ ...c, color: c.color || CAT_COLORS[i % CAT_COLORS.length] }));

/**
 * Formats a weight with two decimals in the reader's locale.
 * @param {number|null} value - The weight.
 * @param {string} [unit] - Its unit, e.g. `kg`.
 * @returns {string} E.g. `5,06 kg`, or `–`.
 */
export function formatWeight(value, unit = '') {
    if (value === null || value === undefined || !Number.isFinite(value)) return '–';
    const text = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return unit ? `${text} ${unit}` : text;
}

/**
 * Formats a time of day as `HH:MM`.
 * @param {number|string|null} t - A time in ms or an ISO string.
 * @returns {string} The time, or `–`.
 */
export function formatTime(t) {
    const d = new Date(typeof t === 'string' ? Date.parse(t) : t ?? NaN);
    if (Number.isNaN(d.getTime())) return '–';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * The cat that was weighed last.
 * @param {Array<Object>} cats - The cats.
 * @returns {Object|null} The cat, or null when none has a weight.
 */
export function lastWeighed(cats) {
    const weighed = (cats || []).filter(c => c.weight !== null && c.weight !== undefined);
    if (weighed.length === 0) return null;
    return weighed.reduce((a, b) => ((Date.parse(b.weighed_at) || 0) > (Date.parse(a.weighed_at) || 0) ? b : a));
}

/**
 * All cats' visits today.
 * @param {Array<Object>} cats - The cats.
 * @returns {number|null} The sum, or null when no cat has a visits sensor.
 */
export function totalVisits(cats) {
    const counted = (cats || []).filter(c => c.visits !== null && c.visits !== undefined);
    return counted.length ? counted.reduce((sum, c) => sum + c.visits, 0) : null;
}

/**
 * The last visit of any cat today, from the history of today.
 * @param {Object|null} today - The `today` history (`cats: [{ index, visits: [ms] }]`).
 * @returns {{time: number, index: number}|null} Its time and the cat's index.
 */
export function lastVisit(today) {
    let last = null;
    (today?.cats || []).forEach(c => (c.visits || []).forEach(t => {
        if (!last || t > last.time) last = { time: t, index: c.index };
    }));
    return last;
}

/**
 * Where a time falls in its day, as a fraction.
 * @param {number} t - A time in ms.
 * @returns {number} 0 at midnight to 1 at the next.
 */
export function dayFraction(t) {
    const d = new Date(t);
    return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}

/**
 * The change between the first and last weight of a series.
 * @param {Array<{t: number, v: number}>} points - The weights, oldest first.
 * @returns {number|null} The change, or null with fewer than two points.
 */
export function weightChange(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    return points[points.length - 1].v - points[0].v;
}

/**
 * Formats a weight change with its sign.
 * @param {number|null} change - The change.
 * @param {string} [unit] - Its unit.
 * @returns {string} E.g. `+0,05 kg`, `−0,10 kg`, or an empty string.
 */
export function formatChange(change, unit = '') {
    if (change === null || !Number.isFinite(change)) return '';
    const sign = change < 0 ? '−' : '+';
    return `${sign}${formatWeight(Math.abs(change), unit)}`;
}
