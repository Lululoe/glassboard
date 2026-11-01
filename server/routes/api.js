import express from 'express';
import { HttpError } from '../errors.js';
import { demoCameraImage, demoHandlers, isDemoMode } from '../services/demo.js';
import { fetchArtwork } from '../services/homeassistant.js';
import { fetchRobotImage } from '../services/haVacuum.js';
import { serviceHandlers } from '../services/index.js';
import { mdiSvg } from '../services/mdi.js';

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

/** The image of a robot's camera or map entity on a vacuum card; the token stays on the server. */
router.get('/ha/camera', async (req, res, next) => {
    try {
        const cardId = String(req.query.card_id || '');
        const entityId = String(req.query.entity_id || '');
        if (!cardId || !entityId) throw new HttpError(400, 'card_id and entity_id are required');
        const image = isDemoMode() ? demoCameraImage(cardId, entityId) : await fetchRobotImage(cardId, entityId);
        res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'no-store' }).send(image.body);
    } catch (err) {
        next(err);
    }
});

/** A Material Design Icon as SVG, e.g. `/api/icons/mdi/lightbulb-off.svg`. */
router.get('/icons/mdi/:file', async (req, res, next) => {
    try {
        const svg = await mdiSvg(String(req.params.file).replace(/\.svg$/, ''));
        if (!svg) throw new HttpError(404, `Unknown icon: ${req.params.file}`);
        // Icons never change for a given version of the package
        res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' }).send(svg);
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
