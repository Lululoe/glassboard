import { getServiceConfig } from '../config.js';
import { upstreamError } from '../errors.js';

/**
 * Converts bytes to gigabytes rounded to one decimal.
 * @param {number} bytes - Size in bytes.
 * @returns {number} Size in GB.
 */
const toGb = (bytes) => Math.round(((bytes || 0) / 1024 ** 3) * 10) / 10;

/**
 * Picks the most representative CPU temperature sensor from Glances.
 * @param {Array<Object>} sensors - Glances sensor list.
 * @returns {Object|undefined} The chosen sensor.
 */
function pickTempSensor(sensors) {
    const byLabel = (needle) => sensors.find(s => (s.label || '').toLowerCase().includes(needle));
    return byLabel('package id') || byLabel('core') || byLabel('cpu') || sensors[0];
}

/**
 * Returns host metrics from the Glances API.
 * @returns {Promise<Object>} Hostname/IP, CPU %, RAM and storage in GB, network bytes and temperature.
 */
export async function handleServerStatsRequest() {
    const { url } = getServiceConfig('glances', {
        url: { env: ['GLANCES_URL'], default: 'http://localhost:61208' },
    });

    const response = await fetch(`${url.replace(/\/$/, '')}/api/3/all`);
    if (!response.ok) throw await upstreamError('Glances', response);
    const data = await response.json();

    const root = Array.isArray(data.fs) ? data.fs.find(f => f.mnt_point === '/') || data.fs[0] : null;
    const network = Array.isArray(data.network) ? data.network : [];
    const tempSensor = Array.isArray(data.sensors) ? pickTempSensor(data.sensors) : null;

    return {
        info: {
            hostname: data.system?.hostname || 'Unknown',
            ip: data.ip?.address || 'Unknown',
        },
        cpu: data.cpu?.total || 0,
        ram: { used: toGb(data.mem?.used), total: toGb(data.mem?.total) },
        storage: { used: toGb(root?.used), free: toGb(root?.free), total: toGb(root?.size) },
        network: {
            in: network.reduce((sum, iface) => sum + (iface.rx || 0), 0),
            out: network.reduce((sum, iface) => sum + (iface.tx || 0), 0),
        },
        temp: tempSensor?.value ?? 0,
    };
}
