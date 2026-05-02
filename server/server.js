import express from 'express';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

import logger from './logger.js';
import { loadConfig, watchConfig } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';

import configRoutes from './routes/config.js';
import centralRoutes from './routes/central.js';
// import haRoutes from './routes/homeassistant.js';
// import mediaRoutes from './routes/media.js';
// import transmissionRoutes from './routes/transmission.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
};

/**
 * Starts the Express server, initializes configuration, and sets up middleware/routes.
 */
async function start() {
  // 1. Initialize Config
  loadConfig();
  watchConfig();

  // 2. Setup Express
  const app = express();
  app.use(express.json());

  // 3. CORS Middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });

  // 4. Request Logging (Optional, kept minimal)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      logger.debug(`${req.method} ${req.path}`);
    }
    next();
  });

  // 5. Security: Block config.yaml
  app.use((req, res, next) => {
    if (req.path === '/config.yaml' || req.path.endsWith('/config.yaml')) {
      logger.warn(`Blocked access to config.yaml from ${req.ip}`);
      return res.status(403).send('Forbidden');
    }
    next();
  });

  // 6. Routes
  // 6. Routes
  app.use('/api/config', configRoutes);

  // Central API Endpoint
  app.use('/api', centralRoutes);

  // Legacy/Specific routes can be removed or kept for bw compat if needed.
  // The plan implies replacing them, but we can leave them if we want to be safe.
  // "Refactor backend to support central /api endpoint"
  // "Remove api/transmission and api/media distinct route mounts." (from plan)
  // So I will remove them.
  // app.use('/api/homeassistant', haRoutes);
  // app.use('/api/media', mediaRoutes);
  // app.use('/api/transmission', transmissionRoutes);

  // Health check
  app.get('/health', (req, res) => res.json({ ok: true }));

  // 7. Error Handling
  app.use(errorHandler);

  // 8. Frontend Serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    // Dev: Vite Middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: 'html' } });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        html = await vite.transformIndexHtml(url, html);


        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Prod: Static Files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      try {
        let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');



        res.set({ 'Content-Type': 'text/html' }).send(html);
      } catch (e) {
        logger.error('Failed to serve index.html', e);
        res.status(500).send('Internal Server Error');
      }
    });
  }

  // 9. Start Server
  app.listen(PORT, () => {
    logger.info(`App listening on http://localhost:${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  });
}

start().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

