import express from 'express';
import { HttpError } from '../errors.js';
import { demoHandlers, isDemoMode } from '../services/demo.js';
import { fetchArtwork } from '../services/homeassistant.js';
import { serviceHandlers } from '../services/index.js';

const router = express.Router();

/**
 * Artwork of a Home Assistant media player on a media player card. Demo mode has none,
 * so the card shows its generated artwork.
 */
router.get('/ha/artwork', async (req, res, next) => {
    try {
        const entityId = String(req.query.entity_id || '');
        if (!entityId) throw new HttpError(400, 'entity_id is required');
        const art = isDemoMode() ? null : await fetchArtwork(entityId);
        if (!art) {
            res.status(404).set('Cache-Control', 'no-store').end();
            return;
        }
        res.set({ 'Content-Type': art.contentType, 'Cache-Control': 'private, max-age=300' }).send(art.body);
    } catch (err) {
        next(err);
    }
});

router.all('/', async (req, res, next) => {
    try {
        const params = { ...req.query, ...req.body };
        const { service } = params;

        if (!service) throw new HttpError(400, 'Service parameter required');
        // In demo mode every service answers with simulated data instead of calling a backend
        const handlers = isDemoMode() ? demoHandlers : serviceHandlers;
        if (!Object.hasOwn(handlers, service)) throw new HttpError(404, `Unknown service: ${service}`);

        res.json(await handlers[service](params));
    } catch (err) {
        next(err);
    }
});

router.use((req, res, next) => {
    next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
});

export default router;
