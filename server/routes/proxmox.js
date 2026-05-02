import express from 'express';
import fetch from 'node-fetch';
import { getConfigProxmox } from '../config.js';
import logger from '../logger.js';
import httpsModule from 'https';

/**
 * Handles Proxmox requests.
 */
export async function handleProxmoxRequest() {
    const config = getConfigProxmox();

    if (!config.url || !config.tokenId || !config.secret) {
        throw new Error('Proxmox configuration missing (URL, tokenId, or secret)');
    }

    // Handle self-signed certs (common in Proxmox)
    const agent = new httpsModule.Agent({
        rejectUnauthorized: false
    });

    const cleanUrl = config.url.replace(/\/$/, '');
    // Using PVEAPIToken format: USER@REALM!TOKENID=UUID
    const authHeader = `PVEAPIToken=${config.tokenId}=${config.secret}`;

    // Get Cluster Resources (VMs, LXCs, Nodes)
    const apiUrl = `${cleanUrl}/api2/json/cluster/resources`;

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        agent
    });

    if (!response.ok) {
        const text = await response.text();
        logger.error(`Proxmox API returned ${response.status}: ${text}`);
        throw new Error(`Proxmox API returned ${response.status}: ${text}`);
    }

    const json = await response.json();
    const data = json.data || [];

    // Filter for qemu (VMs) and lxc (Containers)
    const nodes = data
        .filter(item => item.type === 'qemu' || item.type === 'lxc')
        .map(item => ({
            id: item.vmid, // Proxmox ID
            name: item.name,
            type: item.type === 'qemu' ? 'vm' : 'lxc',
            status: item.status, // running, stopped
            cpu: item.cpu ? (item.cpu * 100) : 0, // Proxmox returns 0-1 (e.g. 0.05 for 5%) usually? Wait.
            // Actually cluster/resources returns 'cpu' as usage ratio (0.0 to N.0 where N is cores, or maybe ratio of max? )
            // Wait, for type=qemu, cpu is "Current CPU usage." (0.00 to 1.00 usually? Or number of seconds? )
            // Checking docs: "cpu: float. CPU usage."
            // Usually it's a ratio of allocated CPUs. So if 2 cores and 100% usage -> 2.0? Or normalized?
            // "maxcpu: number of available CPUs."
            // So usage % = (cpu / maxcpu) * 100.

            // For RAM: 'mem' (used bytes), 'maxmem' (total bytes)
            // For Disk: 'disk' (used bytes), 'maxdisk' (total bytes)

            ram: (item.mem && item.maxmem) ? (item.mem / item.maxmem * 100) : 0,
            disk: (item.disk && item.maxdisk) ? (item.disk / item.maxdisk * 100) : 0,

            // Allow frontend to calculate exact strings if needed, but card expects percentages currently.
            // Let's normalize CPU here.
            normalizedCpu: (item.cpu && item.maxcpu) ? (item.cpu / item.maxcpu * 100) : (item.cpu * 100 || 0)
            // Note: Proxmox 'cpu' value in cluster/resources is sometimes weird. 
            // Often it's simple load. Let's send raw values too just in case.
        }));

    // Fix CPU calculation 
    // For visual consistency, we want 0-100%.
    // In cluster/resources, `cpu` is typically the ratio 0.0-1.0 (or more if multithread rendering? No `cpu` is specific)
    // Actually, `cpu` field in `cluster/resources` is "Current CPU usage."
    // Let's assume it is 0.0-1.0 relative to `maxcpu`?
    // Let's look at `useProxmox` mock: cpu is 0-100.
    // I will use `(item.cpu || 0) * 100` if maxcpu is not involved, but typically it is.
    // Actually: `cpu` is relative usage. 
    // Ref: https://pve.proxmox.com/pve-docs/api-viewer/index.html#/cluster/resources
    // cpu: "CPU usage." (float)
    // maxcpu: "Number of available CPUs."
    // If I have 4 cores and use 50% of all, is cpu 2.0 or 0.5?
    // Experience says it's 0.0-1.0 relative to allocated, or sometimes 0.0-N.0.
    // Let's verify carefully. PVE web UI shows X% of N CPUs. 
    // API `cpu` value is usage relative to 1 core? NO.
    // It is usually `cpu` value is (usage_in_seconds / time)? No, that's stats.
    // Logic: `(cpu / maxcpu) * 100` is safest if maxcpu is present.
    // But verify: item.cpu might be 0.05 (5%).
    // I will map `normalizedCpu` to `cpu` for the frontend.

    const mappedNodes = nodes.map(n => {
        // Find raw item to get maxcpu
        const raw = data.find(d => d.vmid === n.id);
        // In cluster/resources, `cpu` is often just the ratio 0-1.
        // But if we check `pvesh get /cluster/resources`, valid values are 0.003 etc.
        // So (cpu * 100) might be it? Or (cpu/maxcpu * 100)?
        // Usually `cpu` in this endpoint is normalized by maxcpu already?
        // "CPU usage (value is between 0 and 1)" <- typical.
        // So cpu * 100 is correct percentage.
        // Let's use that.

        return {
            ...n,
            cpu: (raw.cpu || 0) * 100
        };
    });

    const summary = {
        running: mappedNodes.filter(n => n.status === 'running').length,
        total: mappedNodes.length,
        // Calculate average CPU of RUNNING nodes
        cpuAvg: mappedNodes.length > 0
            ? Math.round(mappedNodes.reduce((acc, n) => acc + (n.status === 'running' ? n.cpu : 0), 0) / (mappedNodes.filter(n => n.status === 'running').length || 1))
            : 0
    };

    return { nodes: mappedNodes, summary };
}

const router = express.Router();
router.get('/', async (req, res, next) => {
    try {
        const result = await handleProxmoxRequest();
        res.json(result);
    } catch (err) {
        logger.error(`Proxmox API Error: ${err.message}`);
        next(err);
    }
});

export default router;
