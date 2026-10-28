import { getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

const TORRENT_FIELDS = [
    'id', 'name', 'leftUntilDone', 'percentDone', 'totalSize', 'downloadedEver',
    'rateDownload', 'rateUpload', 'uploadRatio', 'isFinished', 'isStalled', 'status',
    'error', 'errorString',
];

/**
 * Formats bytes into a human-readable string (GB, MB, KB).
 * @param {number} bytes - Size in bytes.
 * @returns {string} Formatted string.
 */
export function formatBytes(bytes) {
    if (bytes == null) return '';
    const abs = Math.abs(bytes);
    if (abs >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    if (abs >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
    if (abs >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
    return bytes + ' B';
}

/**
 * Formats seconds into a short duration string (e.g. "1h 20m").
 * @param {number} s - Seconds.
 * @returns {string} Formatted duration.
 */
function secondsToHuman(s) {
    if (s == null || s <= 0) return '0s';
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = Math.floor(s % 60);
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

/**
 * Returns the RPC endpoint for a configured URL, appending `/transmission/rpc`
 * when only a host is given.
 * @param {string} url - Configured Transmission URL.
 * @returns {string} RPC URL.
 */
export function toRpcUrl(url) {
    try {
        const u = new URL(url);
        if (!u.pathname.includes('/transmission')) {
            u.pathname = u.pathname.replace(/\/$/, '') + '/transmission/rpc';
        }
        return u.toString();
    } catch {
        throw new HttpError(503, `Invalid Transmission URL: ${url}`);
    }
}

/**
 * Calls Transmission's `torrent-get` RPC, handling the session-id handshake
 * (HTTP 409) and optional basic auth.
 * @returns {Promise<Object>} The RPC response body.
 */
async function callTransmission() {
    const { url, username, password } = getServiceConfig('transmission', {
        url: { env: ['TRANSMISSION_URL'], default: 'http://localhost:9091/transmission/rpc' },
        username: { env: ['TRANSMISSION_USERNAME'] },
        password: { env: ['TRANSMISSION_PASSWORD'] },
    }, { cardType: 'transmission' });

    const headers = { 'Content-Type': 'application/json' };
    if (username) {
        headers.Authorization = `Basic ${Buffer.from(`${username}:${password || ''}`).toString('base64')}`;
    }
    const body = JSON.stringify({ method: 'torrent-get', arguments: { fields: TORRENT_FIELDS } });
    const rpcUrl = toRpcUrl(url);

    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(rpcUrl, { method: 'POST', headers, body });
        if (res.status === 409) {
            headers['X-Transmission-Session-Id'] = res.headers.get('x-transmission-session-id');
            continue;
        }
        if (!res.ok) throw await upstreamError('Transmission', res);
        return res.json();
    }
    throw new HttpError(502, 'Failed to obtain Transmission session id');
}

/**
 * Maps raw Transmission torrents to the shape used by the frontend and sums totals.
 * @param {Array<Object>} torrents - Raw torrent objects.
 * @returns {{torrents: Array<Object>, totalRateDown: number, totalRateUp: number, totalCount: number}}
 */
export function mapTorrents(torrents = []) {
    return {
        torrents: torrents.map(t => ({
            id: t.id,
            name: t.name,
            left_until_done: secondsToHuman(t.leftUntilDone),
            progress: Math.round((t.percentDone || 0) * 100),
            size: formatBytes(t.totalSize),
            downloaded: formatBytes(t.downloadedEver),
            speedDown: formatBytes(t.rateDownload) + '/s',
            speedUp: formatBytes(t.rateUpload) + '/s',
            ratio: Number((t.uploadRatio || 0).toFixed(2)),
            isFinished: !!t.isFinished,
            isStalled: !!t.isStalled,
            status: t.status,
            error: t.error ? (t.errorString || 'Unknown error') : null,
        })),
        totalRateDown: torrents.reduce((s, t) => s + (t.rateDownload || 0), 0),
        totalRateUp: torrents.reduce((s, t) => s + (t.rateUpload || 0), 0),
        totalCount: torrents.length,
    };
}

/**
 * Returns the current torrents and transfer totals.
 * @returns {Promise<Object>} Mapped torrents and totals.
 */
export async function handleTransmissionRequest() {
    const rpc = await callTransmission();
    return mapTorrents(rpc.arguments?.torrents);
}
