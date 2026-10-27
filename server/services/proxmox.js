import { Agent, fetch as undiciFetch } from 'undici';
import { getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

/**
 * Interprets booleans that may arrive as strings from YAML or environment variables.
 * @param {*} value - Raw value.
 * @returns {boolean} True for true, 'true', '1' or 'yes'.
 */
function isTruthy(value) {
    return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

/**
 * Returns all VMs and LXC containers with resource usage percentages.
 * TLS certificates are not verified unless `verifyTls` is enabled, since most
 * Proxmox installs use self-signed certificates.
 * @returns {Promise<{nodes: Array<Object>, summary: Object}>} Guests and a running/total summary.
 */
export async function handleProxmoxRequest() {
    const config = getServiceConfig('proxmox', {
        url: { env: ['PROXMOX_URL'] },
        tokenId: { env: ['PROXMOX_TOKEN_ID'], aliases: ['token_id'] },
        secret: { env: ['PROXMOX_SECRET', 'PROXMOX_TOKEN_SECRET'], aliases: ['tokenSecret', 'token_secret'] },
        verifyTls: { env: ['PROXMOX_VERIFY_TLS'], aliases: ['verify_tls'], default: false },
    }, { cardType: 'proxmox' });

    if (!config.url || !config.tokenId || !config.secret) {
        throw new HttpError(503, 'Proxmox not configured (url, tokenId and secret are required)');
    }

    const apiUrl = `${config.url.replace(/\/$/, '')}/api2/json/cluster/resources`;
    const options = { headers: { Authorization: `PVEAPIToken=${config.tokenId}=${config.secret}` } };
    const response = isTruthy(config.verifyTls)
        ? await fetch(apiUrl, options)
        : await undiciFetch(apiUrl, { ...options, dispatcher: insecureAgent });

    if (!response.ok) throw await upstreamError('Proxmox', response);

    const { data = [] } = await response.json();
    const percent = (used, max) => (used && max ? (used / max) * 100 : 0);

    // For guests, `cpu` is the fraction (0-1) of the guest's allocated CPUs.
    const nodes = data
        .filter(item => item.type === 'qemu' || item.type === 'lxc')
        .map(item => ({
            id: item.vmid,
            name: item.name,
            type: item.type === 'qemu' ? 'vm' : 'lxc',
            status: item.status,
            cpu: (item.cpu || 0) * 100,
            ram: percent(item.mem, item.maxmem),
            disk: percent(item.disk, item.maxdisk),
        }));

    const running = nodes.filter(n => n.status === 'running');
    const summary = {
        running: running.length,
        total: nodes.length,
        cpuAvg: running.length ? Math.round(running.reduce((acc, n) => acc + n.cpu, 0) / running.length) : 0,
    };

    return { nodes, summary };
}
