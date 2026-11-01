/** Usage from which a bar warns, then signals a problem. Red only ever means a problem. */
const WARN_FROM = 75;
const HIGH_FROM = 90;

/**
 * Tells how serious a usage is.
 * @param {number} percent - The usage from 0 to 100.
 * @returns {'normal'|'warn'|'high'} The level.
 */
export function usageLevel(percent) {
    if (percent >= HIGH_FROM) return 'high';
    return percent >= WARN_FROM ? 'warn' : 'normal';
}
