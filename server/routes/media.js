import express from 'express';
import { getMediaServices } from '../config.js';
import { fetchCalendar } from '../mediaApi.js';




/**
 * Handles Media requests (Calendar).
 * @param {Object} params - { start, end }
 */
export async function handleMediaRequest({ start, end }) {
    if (!start || !end) {
        const err = new Error('Start and end dates required');
        err.status = 400;
        throw err;
    }

    const services = getMediaServices();
    const promises = services.map(s =>
        fetchCalendar(s.type, s.url, s.apiKey, start, end)
    );

    const results = await Promise.all(promises);
    const allEvents = results.flat();
    allEvents.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    return allEvents;
}

const router = express.Router();

router.get('/calendar', async (req, res, next) => {
    try {
        const result = await handleMediaRequest(req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
