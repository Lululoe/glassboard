import express from 'express';
import { HttpError } from '../errors.js';
import { demoKioskAvatar, isDemoMode } from '../services/demo.js';
import { fetchArtwork, fetchKioskAvatar } from '../services/homeassistant.js';
import { getBaseConfig } from '../config.js';
import { installPreview, previewPlugin, previewUpdate, removePlugin } from '../plugins/installer.js';
import { pluginsDir } from '../plugins/loader.js';
import { GLASSBOARD_VERSION } from '../plugins/version.js';
import { demoHandlers, plugins, serviceHandlers } from '../services/index.js';
import logger from '../logger.js';
import { assertEditable, editingBlocked, hasEditKey } from '../editAccess.js';
import { mdiNames, mdiSvg } from '../services/mdi.js';

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

/**
 * The profile picture of whoever is logged in on the kiosk tablet, for the bubble in the header.
 * `404` when nobody is logged in or they have no picture, so the bubble shows their initial.
 */
router.get('/ha/kiosk-avatar', async (req, res, next) => {
    try {
        const avatar = isDemoMode() ? demoKioskAvatar() : await fetchKioskAvatar();
        if (!avatar) {
            res.status(404).set('Cache-Control', 'no-store').end();
            return;
        }
        res.set({ 'Content-Type': avatar.contentType, 'Cache-Control': 'private, max-age=300' }).send(avatar.body);
    } catch (err) {
        next(err);
    }
});

/** The names of all Material Design Icons, for the card editor's icon search. */
router.get('/icons/mdi', async (req, res, next) => {
    try {
        res.set('Cache-Control', 'public, max-age=604800').json({ names: await mdiNames() });
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

/**
 * The service endpoint takes only a JSON POST body, never URL parameters. Some services change
 * things (lights, thermostats, media players), and a browser sends a GET, or a form POST, to any
 * address another site puts in the page; a cross-site JSON POST needs CORS, which isn't enabled.
 */
router.post('/', async (req, res, next) => {
    try {
        if (!req.is('application/json')) throw new HttpError(415, 'Send the request as JSON');
        const params = { ...req.body };
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

/**
 * Why plugins can't be installed from the settings window, or null when they can. Installing
 * runs code from the internet on the server, with access to every credential, and the dashboard
 * has no login, so it is off until config.yaml turns it on along with editing, and each change
 * needs the edit password too.
 * @returns {string|null} The reason.
 */
function installBlocked() {
    const config = getBaseConfig();
    const editing = editingBlocked();
    if (editing) return editing;
    if (config.plugins?.install !== true) return 'Installing plugins is off; set plugins.install: true in config.yaml.';
    return null;
}

/**
 * Throws unless plugins can be installed from the settings window and the request carries the
 * edit key.
 * @param {import('express').Request} req - The request.
 */
function assertInstallAllowed(req) {
    assertEditable(req);
    const reason = installBlocked();
    if (reason) throw new HttpError(403, reason);
}

/**
 * The plugins the server has set up, the services and routes each adds, those that failed and
 * why, and whether plugins can be installed from the settings window. Credentials are never
 * part of it.
 */
router.get('/plugins', (req, res) => {
    const blocked = installBlocked();
    res.set('Cache-Control', 'no-store').json({
        version: GLASSBOARD_VERSION,
        plugins: plugins.plugins,
        failed: plugins.failed,
        // Where the folder is on the server only goes to those who can edit
        install: { allowed: !blocked, reason: blocked, folder: hasEditKey(req) ? pluginsDir() : null },
    });
});

/**
 * Runs a plugin change asked for from the settings window: JSON only, like the service
 * endpoint, so another site can't send it.
 * @param {(body: Object) => Promise<Object>} change - The change.
 * @returns {import('express').RequestHandler} The route.
 */
const pluginChange = (change) => async (req, res, next) => {
    try {
        if (!req.is('application/json')) throw new HttpError(415, 'Send the request as JSON');
        assertInstallAllowed(req);
        res.json(await change(req.body || {}));
    } catch (err) {
        next(err);
    }
};

/**
 * `POST /api/plugins/preview` with `{ source }` (a GitHub repository) or `{ id }` (an installed
 * plugin, for its newest release): downloads and checks the plugin without installing it, and
 * answers what it is, for the settings window to show before installing.
 */
router.post('/plugins/preview', pluginChange(async ({ source, id }) => (id !== undefined
    ? previewUpdate(String(id), { host: plugins })
    : previewPlugin(String(source || ''), { host: plugins }))));

/** `POST /api/plugins/install` with `{ preview }`: installs the plugin a preview showed. */
router.post('/plugins/install', pluginChange(async ({ preview }) => {
    const result = await installPreview(String(preview || ''), { host: plugins });
    const { id, version, source } = result.plugin;
    logger.warn(`Plugin ${id} ${version} ${result.updated ? 'updated' : 'installed'} from ${source?.url} at ${source?.ref} (${source?.commit || 'unknown commit'}), sha256 ${source?.sha256}`);
    return result;
}));

/** `POST /api/plugins/remove` with `{ id }`: removes a plugin from the plugins folder. */
router.post('/plugins/remove', pluginChange(async ({ id }) => {
    const result = await removePlugin(String(id || ''), { host: plugins });
    logger.warn(`Plugin ${id} removed`);
    return result;
}));

// Routes of plugins under /api/plugins/<id>/, for what a JSON service can't answer, such as
// images. Looked up for each request, so installed and removed plugins take effect at once.
router.use('/plugins/:id', (req, res, next) => {
    const found = plugins.routers.find(r => r.id === req.params.id);
    if (!found) return next();
    return found.router(req, res, next);
});

router.use((req, res, next) => {
    next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
});

export default router;
