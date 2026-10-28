import express from 'express';
import { HttpError } from '../errors.js';
import { demoHandlers, isDemoMode } from '../services/demo.js';
import { serviceHandlers } from '../services/index.js';

const router = express.Router();

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
