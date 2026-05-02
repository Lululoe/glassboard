import express from 'express';
import { getConfigTransmissionUrl } from '../config.js';
import { callTransmission, mapTorrents } from '../transmissionApi.js';




/**
 * Handles Transmission requests.
 * @param {Object} params - Request parameters (unused for now but consistent signature)
 */
export async function handleTransmissionRequest() {
    const transmissionUrl = getConfigTransmissionUrl();
    const rpc = await callTransmission(transmissionUrl);
    const torrents = (rpc.arguments && rpc.arguments.torrents) || [];
    const { mapped, totalRateDown, totalRateUp, totalCount } = mapTorrents(torrents);
    return { torrents: mapped, totalRateDown, totalRateUp, totalCount };
}

// Keep router for backward compatibility or direct access if needed, 
// but fundamentally we will switch server.js to use the handler.
// For now, we removing the default export of Router or making it use the handler.
// But to strictly follow plan: "Export the logic as a function... instead of just an Express router"

const router = express.Router();
router.get('/', async (req, res, next) => {
    try {
        const result = await handleTransmissionRequest();
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
