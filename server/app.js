import express from 'express';
import fs from 'fs';
import path from 'path';

import logger from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/api.js';
import configRoutes from './routes/config.js';

const BLOCKED_PATH = /\.ya?ml$|(^|\/)\.env/i;

/**
 * Sends the user's custom stylesheet: `./custom.css` in the working directory (the path to
 * mount in Docker), then `custom.css` in the static directory, else an empty stylesheet so
 * the browser does not log a 404.
 * @param {string} staticDir - Directory the frontend is served from (`public` or `dist`).
 * @returns {import('express').RequestHandler} Route handler.
 */
function customCssHandler(staticDir) {
    const candidates = [path.resolve(process.cwd(), 'custom.css'), path.join(staticDir, 'custom.css')];
    return (req, res) => {
        const file = candidates.find(p => fs.existsSync(p));
        if (file) return res.sendFile(file);
        res.type('css').send('');
    };
}

/**
 * Adds the frontend: Vite middleware in development, the built `dist` folder in production.
 * @param {import('express').Express} app - The Express app.
 * @returns {Promise<void>}
 */
async function addFrontend(app) {
    if (process.env.NODE_ENV !== 'production') {
        app.get('/custom.css', customCssHandler(path.resolve(process.cwd(), 'public')));
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
        app.use(vite.middlewares);
        app.use('*', async (req, res, next) => {
            try {
                const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
                const html = await vite.transformIndexHtml(req.originalUrl, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
            } catch (e) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
        return;
    }

    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    app.get('/custom.css', customCssHandler(distPath));
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => res.type('html').send(indexHtml));
}

/**
 * Creates the Express application.
 * @param {Object} [options]
 * @param {boolean} [options.frontend=true] - Whether to serve the frontend (disabled in API tests).
 * @returns {Promise<import('express').Express>} The configured app.
 */
export async function createApp({ frontend = true } = {}) {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.use((req, res, next) => {
        if (BLOCKED_PATH.test(req.path)) {
            logger.warn(`Blocked access to ${req.path} from ${req.ip}`);
            return res.status(403).send('Forbidden');
        }
        if (req.path.startsWith('/api')) logger.debug(`${req.method} ${req.path}`);
        next();
    });

    app.get('/health', (req, res) => res.json({ ok: true }));
    app.use('/api/config', configRoutes);
    app.use('/api', apiRoutes);

    if (frontend) await addFrontend(app);

    app.use(errorHandler);
    return app;
}
