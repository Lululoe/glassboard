import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

/**
 * Formats a date as YYYY-MM-DD in local time (toISOString would shift it to UTC).
 * @param {Date} d - The date.
 * @returns {string} Local date string.
 */
const toLocalISODate = (d) => [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
].join('-');

/**
 * Polls calendar events from Sonarr/Radarr for a date range.
 * @param {Date} start - First day of the range.
 * @param {Date} end - Day after the last day of the range.
 * @param {number} [interval=60000] - Polling interval in ms.
 * @returns {{events: Array<Object>, loading: boolean, error: string|null}}
 */
export const useMedia = (start, end, interval = 60000) => {
    const startStr = start ? toLocalISODate(start) : '';
    const endStr = end ? toLocalISODate(end) : '';

    const { data, loading, error } = usePolling(
        () => callService('media', { start: startStr, end: endStr }),
        { interval, enabled: Boolean(startStr && endStr), key: `${startStr}|${endStr}` }
    );

    return { events: data || [], loading, error };
};
