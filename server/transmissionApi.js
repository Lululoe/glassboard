import fetch from 'node-fetch';

const DEFAULT_URL = process.env.TRANSMISSION_URL || 'http://localhost:9091/transmission/rpc';

/**
 * Formats bytes into a human-readable string (GB, MB, KB).
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes == null) return '';
  const abs = Math.abs(bytes);
  if (abs >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (abs >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  if (abs >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
  return bytes + ' B';
}

/**
 * Formats seconds into a human-readable duration string (e.g. 1h 20m).
 * @param {number} s - Seconds
 * @returns {string} Formatted duration
 */
function secondsToHuman(s) {
  if (s == null || s === 0) return '0s';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = Math.floor(s % 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Performs a raw RPC call to the Transmission daemon.
 * Handles session ID management (CSRF protection) automatically.
 * @param {string} [overrideUrl] - Optional URL to override default
 * @returns {Promise<Object>} The JSON response from Transmission
 */
export async function callTransmission(overrideUrl) {
  const TRANSMISSION_URL = overrideUrl || DEFAULT_URL;

  // Ensure we call the RPC endpoint. Accept either a base URL or the full RPC path.
  let rpcUrl = TRANSMISSION_URL;
  try {
    const u = new URL(TRANSMISSION_URL);
    if (!u.pathname || !u.pathname.includes('/transmission')) {
      // append the rpc path if user provided base host (e.g. http://transmission.local:9091)
      u.pathname = (u.pathname === '/' ? '' : u.pathname) + '/transmission/rpc';
    }
    rpcUrl = u.toString();
  } catch {
    rpcUrl = TRANSMISSION_URL; // fallback to provided string
  }

  const body = JSON.stringify({
    method: 'torrent-get',
    arguments: {
      fields: [
        'id', 'name', 'leftUntilDone', 'percentDone', 'totalSize', 'downloadedEver',
        'rateDownload', 'rateUpload', 'uploadRatio', 'isFinished', 'isStalled', 'status'
      ]
    }
  });

  let headers = { 'Content-Type': 'application/json' };
  let session = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (session) headers['X-Transmission-Session-Id'] = session;
    const res = await fetch(rpcUrl, { method: 'POST', headers, body });
    if (res.status === 409) {
      session = res.headers.get('x-transmission-session-id');
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Transmission RPC error: ${res.status} ${txt}`);
    }
    return res.json();
  }
  throw new Error('Failed to obtain Transmission session id');
}

/**
 * Maps raw Transmission torrent data to a frontend-friendly format.
 * Calculates totals for rates and counts.
 * @param {Array} torrents - List of raw torrent objects
 * @returns {Object} { mapped: Array, totalRateDown: number, totalRateUp: number, totalCount: number }
 */
export function mapTorrents(torrents) {
  const mapped = (torrents || []).map(t => ({
    id: t.id,
    name: t.name,
    left_until_done: secondsToHuman(t.leftUntilDone),
    progress: Math.round((t.percentDone || 0) * 100),
    size: formatBytes(t.totalSize),
    downloaded: formatBytes(t.downloadedEver),
    speedDown: formatBytes(t.rateDownload) + '/s',
    speedUp: formatBytes(t.rateUpload) + '/s',
    ratio: Number(((t.uploadRatio || 0)).toFixed(2)),
    isFinished: !!t.isFinished,
    isStalled: !!t.isStalled,
    status: t.status
  }));

  const totalRateDown = (torrents || []).reduce((s, t) => s + (t.rateDownload || 0), 0);
  const totalRateUp = (torrents || []).reduce((s, t) => s + (t.rateUpload || 0), 0);
  const totalCount = (torrents || []).length;

  return { mapped, totalRateDown, totalRateUp, totalCount };
}
