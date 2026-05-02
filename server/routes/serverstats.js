import express from 'express';
import fetch from 'node-fetch';
import { getConfigGlancesUrl } from '../config.js';
import logger from '../logger.js';

/**
 * Handles Server Stats requests (Glances).
 * @param {Object} params - Request parameters (unused for now)
 */
export async function handleServerStatsRequest() {
    const baseUrl = getConfigGlancesUrl();
    const cleanUrl = baseUrl.replace(/\/$/, '');

    // Fetch from Glances API
    const response = await fetch(`${cleanUrl}/api/3/all`);

    if (!response.ok) {
        logger.error(`Glances returned ${response.status} ${response.statusText}`);
        throw new Error(`Glances returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform data
    const stats = {
        info: {
            hostname: data.system?.hostname || 'Unknown',
            ip: data.ip?.address || 'Unknown'
        },
        cpu: data.cpu?.total || 0,
        ram: {
            used: ((data.mem?.used || 0) / 1024 / 1024 / 1024).toFixed(1), // Bytes to GB
            total: ((data.mem?.total || 0) / 1024 / 1024 / 1024).toFixed(1)
        },
        storage: {
            used: 0,
            free: 0,
            total: 0
        },
        network: {
            in: 0,
            out: 0
        },
        temp: 0
    };

    // Storage: Look for mounted at '/' or first
    if (Array.isArray(data.fs)) {
        const root = data.fs.find(f => f.mnt_point === '/') || data.fs[0];
        if (root) {
            stats.storage.used = (root.used / 1024 / 1024 / 1024).toFixed(1);
            stats.storage.free = (root.free / 1024 / 1024 / 1024).toFixed(1);
            stats.storage.total = (root.size / 1024 / 1024 / 1024).toFixed(1);
        }
    }

    // Network: Sum Rx/Tx
    let totalRx = 0;
    let totalTx = 0;
    if (Array.isArray(data.network)) {
        data.network.forEach(iface => {
            totalRx += iface.rx || 0;
            totalTx += iface.tx || 0;
        });
    }
    stats.network.in = totalRx;
    stats.network.out = totalTx;

    // Temp: Find best sensor
    if (Array.isArray(data.sensors)) {
        // High preference for 'k10temp' or 'core'
        let tempSensor = data.sensors.find(s => s.label.toLowerCase().includes('package id'));
        if (!tempSensor) tempSensor = data.sensors.find(s => s.label.toLowerCase().includes('core'));
        if (!tempSensor) tempSensor = data.sensors.find(s => s.label.toLowerCase().includes('cpu'));
        if (!tempSensor) tempSensor = data.sensors[0];

        if (tempSensor) {
            stats.temp = tempSensor.value;
        }
    }

    return stats;
}

const router = express.Router();
router.get('/', async (req, res, next) => {
    try {
        const result = await handleServerStatsRequest(req.query);
        res.json(result);
    } catch (err) {
        logger.error(`ServerStats (Glances) Error: ${err.message}`);
        next(err);
    }
});

export default router;
