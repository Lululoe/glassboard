import express from 'express';
import { getSanitizedConfig, onConfigChange } from '../config.js';
import { isDemoMode } from '../services/demo.js';

const KEEP_ALIVE_INTERVAL = 30 * 1000;

const router = express.Router();

router.get('/', (req, res) => {
    // `demo` also reflects GLASSBOARD_DEMO, so the header can label simulated data
    res.set('Cache-Control', 'no-store').json({ ...getSanitizedConfig(), demo: isDemoMode() });
});

/**
 * Server-sent events stream that emits a `config` event whenever the config files change,
 * so open dashboards can reload their configuration.
 */
router.get('/events', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');

    const unsubscribe = onConfigChange(version => res.write(`event: config\ndata: ${version}\n\n`));
    const keepAlive = setInterval(() => res.write(': ping\n\n'), KEEP_ALIVE_INTERVAL);

    req.on('close', () => {
        unsubscribe();
        clearInterval(keepAlive);
    });
});

export default router;
