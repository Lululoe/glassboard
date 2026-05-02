import { useState, useEffect } from 'react';

// Helpers and communication for Transmission proxy
/**
 * Fetches data from the Transmission API endpoint.
 * @param {string} [service='transmission'] - The Transmission service identifier.
 * @returns {Promise<Object>} The fetched transmission data.
 */
async function fetchTransmission(service = 'transmission') {
    const candidates = [
        '/api',
        (import.meta.env.VITE_TRANSMISSION_API || 'http://localhost:3001') + '/api'
    ];

    for (const url of candidates) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service }),
                cache: 'no-store'
            });
            if (!res.ok) continue;
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) continue;
            const json = await res.json();

            // map torrents to simplified shape
            const torrents = (json.torrents || []).map(t => {
                const state = determineState(t);
                return {
                    id: t.id,
                    name: t.name,
                    left_until_done: t.left_until_done || t.left_until_done || t.left_until_done, // pass-through or formatted by server
                    progress: typeof t.progress === 'number' ? t.progress : Number(t.progress) || 0,
                    size: t.size || '',
                    downloaded: t.downloaded || '',
                    speedDown: t.speedDown || '',
                    speedUp: t.speedUp || '',
                    ratio: t.ratio != null ? t.ratio : null,
                    state
                };
            });

            const totalRateDown = typeof json.totalRateDown === 'number' ? json.totalRateDown : 0;
            const totalRateUp = typeof json.totalRateUp === 'number' ? json.totalRateUp : 0;
            const totalCount = typeof json.totalCount === 'number' ? json.totalCount : torrents.length;

            return { torrents, totalRateDown, totalRateUp, totalCount };
        } catch {
            // try next
        }
    }
    throw new Error('Failed to fetch transmission data');
}

/**
 * Determines a simplified state string from a server-provided torrent object.
 * @param {Object} t - Torrent object.
 * @returns {string} The simplified state ('seeding', 'downloading', 'stopped', 'paused').
 */
export function determineState(t) {
    // Transmission status codes: 0=stopped, 1=check wait, 2=check, 3=download wait, 4=downloading, 5=seed wait, 6=seeding
    const st = t.status;
    if (t.isFinished || st === 6) return 'seeding';
    if (st === 4 || st === 3) return 'downloading';
    if (st === 0) return 'stopped';
    // fallback to paused for other states (including stalled)
    if (t.isStalled) return 'paused';
    return 'paused';
}

/**
 * Parses a formatted speed string back into a numeric bytes/s value.
 * @param {string|number} val - The speed value to parse.
 * @returns {number} The parsed speed in bytes.
 */
export function parseSpeed(val) {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    const m = String(val).trim().match(/^([0-9,.]+)\s*(B|KB|MB|GB)\/s$/i);
    if (!m) return 0;
    const num = Number(m[1].replace(/,/g, ''));
    const unit = m[2].toUpperCase();
    const mul = unit === 'GB' ? 1e9 : unit === 'MB' ? 1e6 : unit === 'KB' ? 1e3 : 1;
    return num * mul;
}

/**
 * Formats a numeric bytes/s speed into a human-readable string.
 * @param {number} n - Speed in bytes.
 * @returns {string} Formatted speed string (e.g. '1.50 MB/s').
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
 * Custom hook to fetch active torrents from Transmission.
 * @param {string} [service='transmission'] - Service name for API
 * @param {number} [interval=5000] - Polling interval in ms (default 5s)
 * @returns {Object} { torrents, totals, error }
 */
export const useTransmission = (service = 'transmission', interval = 5000) => {
    const [torrents, setTorrents] = useState([]);
    const [totals, setTotals] = useState({ totalDown: 0, totalUp: 0, count: 0 });
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            try {
                const json = await fetchTransmission(service);
                if (!mounted) return;
                setTorrents(json.torrents || []);
                setTotals({
                    totalDown: json.totalRateDown || 0,
                    totalUp: json.totalRateUp || 0,
                    count: json.totalCount || (json.torrents || []).length
                });
                setError(null);
            } catch (err) {
                console.warn('Transmission fetch failed:', err);
                if (!mounted) return;
                setError(String(err));
                setTorrents([]);
                setTotals({ totalDown: 0, totalUp: 0, count: 0 });
            }
        };

        run();
        const id = setInterval(run, interval);
        return () => { mounted = false; clearInterval(id); };
    }, [interval]);

    return { torrents, totals, error };
};
