/** Data and layout helpers of the storage card. Sizes are in gigabytes. */
import { colorOf } from '../Graph/graphModel';

/** How the card draws its bar, chosen with `bar` in the config: a matrix of dots or solid blocks. */
export const STORAGE_BARS = ['dots', 'solid'];

/** Shown until the card is given its own data: a 4 TB home server volume. */
export const SAMPLE_STORAGE = {
    total: 4000,
    categories: [
        { name: 'Media', size: 1480 },
        { name: 'Backups', size: 620 },
        { name: 'Photos', size: 410 },
        { name: 'VMs', size: 240 },
        { name: 'Documents', size: 160 },
        { name: 'Downloads', size: 190 },
        { name: 'Apps', size: 95 },
        { name: 'System', size: 58 },
    ],
};

/**
 * Turns a color from the config into a CSS color, the same way the graph card does: a name such as
 * `blue` becomes the theme's token, so it follows light and dark, in the graph card's order when
 * none is set; anything else is used as given.
 * @param {string|undefined} color - The configured color.
 * @param {number} index - The category's position, which picks a color when none is set.
 * @returns {string} A CSS color.
 */
export function categoryColor(color, index) {
    if (typeof color === 'string' && /^(cyan|gray)$/i.test(color)) return `var(--system-${color.toLowerCase()})`;
    return colorOf(color, index);
}

/**
 * The size the card is shown at.
 * @param {Object} config - Card configuration.
 * @returns {'half'|'1'|'2'|'3'} Half height, or the number of columns.
 */
export function storageSize(config) {
    if (config.tileSize === 'half') return 'half';
    return String(Math.min(3, Math.max(1, Number(config.colSpan) || 1)));
}

/**
 * @typedef {Object} StorageCategory
 * @property {string} name
 * @property {number} size - Gigabytes.
 * @property {string} color - CSS color.
 * @property {number} share - Part of the total, 0 to 1.
 * @property {string} [description] - A line about what it holds, shown while it is pointed at.
 */

/**
 * Reads the card's storage data: the total and what each category takes.
 * @param {{total?: number, categories?: Array<{name?: string, size?: number, color?: string, description?: string}>, updated?: string|number}} [data] - The card's `data`; the sample without categories.
 * @returns {{total: number, used: number, free: number, percent: number, categories: StorageCategory[], updated?: string}} The volume.
 */
export function storageModel(data) {
    const source = data?.categories?.length ? data : SAMPLE_STORAGE;
    const categories = source.categories
        .map((c, i) => ({
            name: String(c.name || `Category ${i + 1}`),
            ...(c.description ? { description: String(c.description) } : {}),
            size: Math.max(0, Number(c.size) || 0),
            color: categoryColor(c.color, i),
        }))
        .filter(c => c.size > 0);
    const used = categories.reduce((sum, c) => sum + c.size, 0);
    const total = Math.max(Number(source.total) || 0, used, 1);
    return {
        total,
        used,
        free: total - used,
        percent: Math.round((used / total) * 100),
        categories: categories.map(c => ({ ...c, share: c.size / total })),
        updated: readTime(source.updated),
    };
}

/**
 * Formats a size, in terabytes from 1000 GB on.
 * @param {number} gb - Gigabytes.
 * @returns {string} For example `357.8 GB`, `95 GB` or `1.48 TB`.
 */
export function formatSize(gb) {
    if (gb >= 1000) return `${(gb / 1000).toFixed(gb >= 10000 ? 1 : 2).replace(/\.?0+$/, '')} TB`;
    if (gb >= 100) return `${Math.round(gb)} GB`;
    return `${(Math.round(gb * 10) / 10).toString()} GB`;
}

/**
 * Splits a number of columns between sizes by the largest remainder, so the parts add up and every
 * size above zero gets at least one column while there are columns left.
 * @param {number[]} sizes - The sizes, in order.
 * @param {number} total - What all columns stand for.
 * @param {number} columns - Columns to split.
 * @returns {number[]} Columns of each size.
 */
export function allocateColumns(sizes, total, columns) {
    if (columns <= 0 || total <= 0) return sizes.map(() => 0);
    const exact = sizes.map(s => (s / total) * columns);
    const counts = exact.map(e => Math.floor(e));
    let left = Math.min(columns, Math.round(exact.reduce((a, b) => a + b, 0))) - counts.reduce((a, b) => a + b, 0);
    const order = exact.map((e, i) => i).sort((a, b) => (exact[b] - counts[b]) - (exact[a] - counts[a]));
    for (const i of order) {
        if (left <= 0) break;
        counts[i] += 1;
        left -= 1;
    }
    // A category too small for a column still shows as one, taken from the largest
    sizes.forEach((s, i) => {
        if (s > 0 && counts[i] === 0) {
            const largest = counts.indexOf(Math.max(...counts));
            if (counts[largest] > 1) {
                counts[largest] -= 1;
                counts[i] = 1;
            }
        }
    });
    return counts;
}

/**
 * The categories a legend has room for, largest first; the rest are put together as `Other`.
 * @param {StorageCategory[]} categories - All categories.
 * @param {number} max - Entries the legend has room for.
 * @returns {Array<StorageCategory & {members?: string[]}>} At most `max` entries; `Other` lists the categories it
 *   stands for in `members`.
 */
export function legendItems(categories, max) {
    const sorted = [...categories].sort((a, b) => b.size - a.size);
    if (sorted.length <= max) return sorted;
    const rest = sorted.slice(max - 1);
    const size = rest.reduce((sum, c) => sum + c.size, 0);
    return [
        ...sorted.slice(0, max - 1),
        { name: 'Other', size, color: 'var(--system-gray)', share: rest.reduce((sum, c) => sum + c.share, 0), members: rest.map(c => c.name) },
    ];
}

/**
 * The category that takes the most space.
 * @param {StorageCategory[]} categories - All categories.
 * @returns {StorageCategory|undefined} The largest, if there are any.
 */
export function largestCategory(categories) {
    return categories.reduce((max, c) => (!max || c.size > max.size ? c : max), undefined);
}

/**
 * A repeatable number between 0 and 1 for a dot, so lit dots stay put between renders.
 * @param {number} seed - Different per category.
 * @param {number} x - Column.
 * @param {number} y - Row.
 * @returns {number} 0 to 1.
 */
export function dotNoise(seed, x, y) {
    let h = Math.imul((seed + 0x9e3779b9) | 0, 0x85ebca6b);
    h ^= Math.imul((x + 0x632be5ab) | 0, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h ^= Math.imul((y + 0x7f4a7c15) | 0, 0x27d4eb2f);
    h = Math.imul(h ^ (h >>> 13), 0x165667b1);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/**
 * Reads a point in time given as an ISO date, Unix seconds (as Prometheus reports them) or
 * milliseconds.
 * @param {string|number|null|undefined} value - The time.
 * @returns {string|undefined} The time as an ISO date, or undefined when it isn't one.
 */
export function readTime(value) {
    if (value == null || value === '') return undefined;
    const n = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : NaN;
    const date = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Tells whether a card's data is older than it should be.
 * @param {string|undefined} updated - When the data was last updated, as an ISO date.
 * @param {number} staleAfter - Minutes after which it counts as stale.
 * @param {Date} [now] - The current time.
 * @returns {boolean} True when it is known and older than that.
 */
export function isStale(updated, staleAfter, now = new Date()) {
    if (!updated || !(staleAfter > 0)) return false;
    return now.getTime() - new Date(updated).getTime() > staleAfter * 60000;
}

/** Narrowest list column, in pixels, and the gap between columns (as in the CSS). */
const COLUMN_MIN = 180;
const COLUMN_GAP = 28;

/**
 * How many list columns fit: those of the card's size, fewer when the list is narrower than they need.
 * @param {number} width - The list's width in pixels; 0 before it is measured.
 * @param {number} columns - Columns at the card's size.
 * @returns {number} The columns.
 */
export const columnsFor = (width, columns) => (width > 0
    ? Math.max(1, Math.min(columns, Math.floor((width + COLUMN_GAP) / (COLUMN_MIN + COLUMN_GAP))))
    : columns);

/**
 * Formats a category's share of the volume, as `<1%` when it rounds to nothing.
 * @param {number} share - The share, 0 to 1.
 * @returns {string} For example `37%` or `<1%`.
 */
export const formatShare = (share) => (share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`);
