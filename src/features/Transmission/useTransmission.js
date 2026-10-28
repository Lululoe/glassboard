import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

/**
 * Derives a simplified state from a Transmission torrent.
 * Status codes: 0=stopped, 1=check wait, 2=check, 3=download wait, 4=downloading, 5=seed wait, 6=seeding.
 * A download is stalled when it has had no peer activity for a while; a stalled seed is
 * normal (nobody is downloading from it), so it stays 'seeding'.
 * @param {Object} t - Torrent object from the server.
 * @returns {'error'|'stalled'|'seeding'|'downloading'|'stopped'|'paused'} The simplified state.
 */
export function determineState(t) {
    if (t.error) return 'error';
    if (t.isFinished || t.status === 6) return 'seeding';
    if (t.status === 4 || t.status === 3) return t.isStalled ? 'stalled' : 'downloading';
    if (t.status === 0) return 'stopped';
    return 'paused';
}

/**
 * Formats a numeric bytes/s speed into a human-readable string.
 * @param {number} n - Speed in bytes per second.
 * @returns {string} Formatted speed (e.g. '1.50 MB/s').
 */
export function formatSpeed(n) {
    if (!n) return '0 B/s';
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + ' GB/s';
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + ' MB/s';
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + ' KB/s';
    return n + ' B/s';
}

/**
 * Polls active torrents and transfer totals from Transmission.
 * @param {number} [interval=5000] - Polling interval in milliseconds.
 * @returns {{torrents: Array<Object>, totals: {totalDown: number, totalUp: number, count: number}, error: string|null}}
 */
export const useTransmission = (interval = 5000) => {
    const { data, error } = usePolling(async () => {
        const json = await callService('transmission');
        const torrents = (json.torrents || []).map(t => ({ ...t, state: determineState(t) }));
        return {
            torrents,
            totals: {
                totalDown: json.totalRateDown || 0,
                totalUp: json.totalRateUp || 0,
                count: json.totalCount ?? torrents.length,
            },
        };
    }, { interval });

    return {
        torrents: data?.torrents || [],
        totals: data?.totals || { totalDown: 0, totalUp: 0, count: 0 },
        error,
    };
};
