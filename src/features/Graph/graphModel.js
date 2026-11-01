/**
 * Shared helpers of the graph card: ranges, colors, axes and number formatting.
 */

export const DEFAULT_RANGES = ['24h', '7d', '30d'];
export const MAX_SENSORS = 8;

/** Default colors, in order; a sensor can pick one by name or set any CSS color. */
const NAMED_COLORS = {
    blue: 'var(--system-blue)',
    orange: 'var(--system-orange)',
    green: 'var(--system-green)',
    purple: 'var(--system-purple)',
    teal: 'var(--system-teal)',
    pink: 'var(--system-pink)',
    // Darker in light mode, where the system yellow is hard to read on white
    yellow: 'var(--graph-yellow)',
    red: 'var(--system-red)',
    indigo: 'var(--system-indigo)',
};
const PALETTE = Object.keys(NAMED_COLORS).slice(0, 8);

/**
 * The color of a sensor: its own, by name (`yellow`) or as CSS, else the next default.
 * @param {string|null|undefined} color - The configured color.
 * @param {number} index - The sensor's position on the card.
 * @returns {string} A CSS color.
 */
export const colorOf = (color, index) => {
    if (typeof color === 'string' && color) return NAMED_COLORS[color.toLowerCase()] || color;
    return NAMED_COLORS[PALETTE[index % PALETTE.length]];
};

/**
 * Parses a time range like `24h`, `7d` or `2w`.
 * @param {*} range - The range.
 * @returns {number|null} Hours, or null when it isn't a valid range.
 */
export function hoursOf(range) {
    const m = /^(\d+)([hdw])$/.exec(String(range).trim().toLowerCase());
    if (!m) return null;
    const hours = Number(m[1]) * { h: 1, d: 24, w: 168 }[m[2]];
    return hours > 0 && hours <= 366 * 24 ? hours : null;
}

/**
 * The ranges a card offers, like the server reads them: `ranges` (default 24h, 7d, 30d), or
 * with `ranges: false` no selector and the single `range`.
 * @param {Object} config - The card config.
 * @returns {{ranges: string[], selector: boolean}} The ranges and whether to show the selector.
 */
export function graphRanges(config) {
    const selector = config.ranges !== false;
    const listed = Array.isArray(config.ranges) ? config.ranges.filter(r => hoursOf(r)) : [];
    if (!selector) return { ranges: [hoursOf(config.range) ? config.range : '24h'], selector };
    return { ranges: listed.length ? listed : DEFAULT_RANGES, selector };
}

/** Short label of a range for the selector, e.g. `24H`. */
export const rangeLabel = (range) => String(range).toUpperCase();

/** Long label of a range, e.g. `Last 24 hours`. */
export function longLabel(range) {
    const m = /^(\d+)([hdw])$/.exec(String(range).toLowerCase());
    if (!m) return String(range);
    const unit = { h: 'hour', d: 'day', w: 'week' }[m[2]];
    return `Last ${m[1]} ${unit}${Number(m[1]) === 1 ? '' : 's'}`;
}

/** Units of meters, whose bars add up (stacking is on by default for them). */
const METER_UNITS = ['wh', 'kwh', 'mwh', 'gwh', 'j', 'kj', 'mj', 'gj', 'm³', 'l', 'gal', 'ft³', 'ccf'];

/**
 * Whether bars stack: as set in the config, else when every sensor measures energy, gas or
 * water in the same unit.
 * @param {Object} config - The card config.
 * @param {Array<{unit: string}>} series - The sensors.
 * @returns {boolean} True to stack.
 */
export function shouldStack(config, series) {
    const units = new Set(series.map(s => s.unit));
    if (units.size !== 1) return false;
    if (typeof config.stack === 'boolean') return config.stack;
    return METER_UNITS.includes(String(series[0]?.unit).toLowerCase());
}

/**
 * Formats a value with its unit, with fewer decimals for larger numbers.
 * @param {number|null} value - The value.
 * @param {string} unit - Its unit.
 * @param {number} [fixedDigits] - Decimals to show instead of choosing by size.
 * @returns {string} E.g. `21.5°C`, `48%`, `3.2 kWh`, `0.04 kWh`, or `–` without a value.
 */
export function formatValue(value, unit, fixedDigits) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '–';
    const abs = Math.abs(value);
    const digits = fixedDigits ?? (abs >= 100 ? 0 : abs >= 1 || abs === 0 ? 1 : 2);
    const text = value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (!unit) return text;
    return /^[°%]/.test(unit) ? `${text}${unit}` : `${text} ${unit}`;
}

/** Rounds up to 1, 2, 2.5 or 5 times a power of ten. */
function nice(value) {
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)));
    return [1, 2, 2.5, 5, 10].map(k => k * magnitude).find(k => k >= value) || 10 * magnitude;
}

/**
 * A rounded axis range that holds the values: from zero for bars and meters, close around the
 * values for measurements like temperatures.
 * @param {number} min - Smallest value.
 * @param {number} max - Largest value.
 * @param {boolean} fromZero - Whether the axis starts at zero.
 * @returns {[number, number]} Bottom and top of the axis.
 */
export function niceRange(min, max, fromZero) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (fromZero) return [Math.min(0, min), max > 0 ? nice(max * 1.05) : 1];
    const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 0.5);
    const step = nice((max - min + pad * 2) / 2);
    // Values that are never negative (power, humidity, CO₂) keep the axis at zero or above
    const lo = Math.max(min >= 0 ? 0 : -Infinity, Math.floor((min - pad) / step) * step);
    const hi = Math.max(lo + step * 2, Math.ceil((max + pad) / step) * step);
    return [lo, hi];
}

const time = (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const day = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Labels of a point or bar for the tooltip.
 * @param {number} start - Its start in ms.
 * @param {number} minutes - Length of the periods.
 * @param {number} hours - The time range.
 * @param {'line'|'bar'} type - The chart.
 * @returns {string} E.g. `14:30`, `Sat 1 Nov 14:00`, `14:00–15:00` or `Sat 1 Nov`.
 */
export function pointLabel(start, minutes, hours, type) {
    if (minutes >= 1440) return day(start);
    if (type === 'bar') return `${hours > 24 ? `${day(start)} ` : ''}${time(start)}–${time(start + minutes * 60000)}`;
    return hours > 24 ? `${day(start)} ${time(start)}` : time(start);
}

/**
 * Labels under the chart, from the start of the range to now, on period boundaries.
 * @param {number[]} times - Start of each period in ms.
 * @param {number} hours - The time range.
 * @param {number} [count=5] - How many labels (at least 2).
 * @returns {string[]} The labels; the last is `Now`.
 */
export function axisLabels(times, hours, count = 5) {
    const last = Math.max(1, count - 1);
    return Array.from({ length: last + 1 }, (_, i) => {
        if (i === last) return 'Now';
        const t = times[Math.round(((times.length - 1) * i) / last)];
        if (hours <= 36) return time(t);
        if (hours <= 240) return new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
        return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    });
}

/** Sum of the numbers in a list, ignoring missing values. */
export const sumOf = (values) => values.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);

/**
 * Change from one value to another in whole percent.
 * @param {number} value - The new value.
 * @param {number} before - The value to compare with.
 * @returns {number|null} The change, or null when there's nothing to compare with.
 */
export const percentChange = (value, before) => (before > 0 ? Math.round((value / before - 1) * 100) : null);

/** A change as text, e.g. `+12%` or `−3%`; empty without one. */
export const signedPercent = (pct) => (pct === null ? '' : `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`);

/**
 * Totals of the week comparison: per day (14 days, the last is today) and per week.
 * @param {Array<{values: Array<number|null>}>} parts - The sensors that add up.
 * @returns {{totals: number[], thisWeek: number, lastWeek: number, change: number|null}} The totals.
 */
export function weekTotals(parts) {
    const totals = Array.from({ length: 14 }, (_, i) => sumOf(parts.map(s => s.values[i])));
    const thisWeek = sumOf(totals.slice(7));
    const lastWeek = sumOf(totals.slice(0, 7));
    return { totals, thisWeek, lastWeek, change: percentChange(thisWeek, lastWeek) };
}

/**
 * Name of a day in the week comparison.
 * @param {number} start - The day's start in ms.
 * @param {number} index - Its position (0-13; 13 is today).
 * @returns {string} `Today`, `Wed` or `Last Wed`.
 */
export function weekDayName(start, index) {
    if (index === 13) return 'Today';
    const name = new Date(start).toLocaleDateString(undefined, { weekday: 'short' });
    return index < 7 ? `Last ${name}` : name;
}

/**
 * Inline styles with CSS custom properties, e.g. `{ '--c': color }`.
 * @param {Object<string, string|number>} styles - The styles.
 * @returns {import('react').CSSProperties} The same object, typed for React.
 */
export const cssVars = (styles) => /** @type {import('react').CSSProperties} */ (styles);
