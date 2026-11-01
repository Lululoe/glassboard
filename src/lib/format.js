/** Formats shared by the cards, so the same kind of value reads the same everywhere. */

/** Gigabytes from which sizes are shown in terabytes. */
const TB_FROM = 1000;

/**
 * Formats a used and a total amount in one unit, chosen from the total.
 * @param {number} used - Used amount in gigabytes.
 * @param {number} total - Total amount in gigabytes.
 * @returns {string} For example `28.4 / 64 GB` or `1.2 / 1.9 TB`.
 */
export function formatUsage(used, total) {
    if (total >= TB_FROM) return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} TB`;
    return `${used} / ${total} GB`;
}

/**
 * Formats a point in time relative to now, in the browser's language.
 * @param {string} iso - The time as an ISO date string.
 * @param {Date} [now] - The current time.
 * @returns {string} For example `3 hours ago`, or the input when it isn't a date.
 */
export function formatRelativeTime(iso, now = new Date()) {
    const date = new Date(iso || NaN);
    if (Number.isNaN(date.getTime())) return iso || '';
    const minutes = Math.round((date.getTime() - now.getTime()) / 60000);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
    if (Math.abs(hours) < 24) return format.format(hours, 'hour');
    if (Math.abs(days) < 30) return format.format(days, 'day');
    return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/**
 * Formats a point in time in full, for tooltips next to a relative time.
 * @param {string} iso - The time as an ISO date string.
 * @returns {string|undefined} The date and time, or undefined when it isn't a date.
 */
export function formatFullTime(iso) {
    const date = new Date(iso || NaN);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
