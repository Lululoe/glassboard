import express from 'express';
import { HttpError } from '../errors.js';
import { serviceHandlers } from '../services/index.js';

const router = express.Router();

router.all('/', async (req, res, next) => {
    try {
        const params = { ...req.query, ...req.body };
        const { service } = params;

        if (!service) throw new HttpError(400, 'Service parameter required');
        if (!Object.hasOwn(serviceHandlers, service)) throw new HttpError(404, `Unknown service: ${service}`);

        res.json(await serviceHandlers[service](params));
    } catch (err) {
        next(err);
    }
});

router.use((req, res, next) => {
    next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
});

export default router;
