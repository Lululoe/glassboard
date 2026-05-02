import express from 'express';
import { handleTransmissionRequest } from './transmission.js';
import { handleMediaRequest } from './media.js';
import { handleHaRequest, handleWeatherRequest } from './homeassistant.js';
import { handleServerStatsRequest } from './serverstats.js';
import { handleProxmoxRequest } from './proxmox.js';
import { handleGitRequest } from './git.js';

const router = express.Router();

router.all('/', async (req, res, next) => {
    try {
        const body = req.body || {};
        const query = req.query || {};

        // Determine service from body or query (preference to body for POST, query for GET, but check both)
        const service = body.service || query.service;

        if (!service) {
            return res.status(400).json({ error: 'Service parameter required' });
        }

        let result;

        switch (service) {
            case 'transmission':
                result = await handleTransmissionRequest(body);
                break;
            case 'media':

                result = await handleMediaRequest({ ...query, ...body });
                break;
            case 'homeassistant': {
                const haEndpoint = body.endpoint || query.endpoint;
                if (!haEndpoint) {
                    throw new Error('Home Assistant service requires endpoint parameter');
                }
                result = await handleHaRequest(haEndpoint, { ...query, ...body });
                break;
            }
            case 'weather':
                result = await handleWeatherRequest({ ...query, ...body });
                break;
            case 'serverstats':
                result = await handleServerStatsRequest({ ...query, ...body });
                break;
            case 'proxmox':
                result = await handleProxmoxRequest();
                break;
            case 'git':
                result = await handleGitRequest({ ...query, ...body });
                break;
            default:
                res.status(404);
                throw new Error(`Unknown service: ${service}`);
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
