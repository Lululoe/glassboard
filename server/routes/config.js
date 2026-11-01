import express from 'express';
import { z } from 'zod';
import { getBaseConfig, getConfig, getSanitizedConfig, loadConfig, onConfigChange, restoreSecrets } from '../config.js';
import { HttpError } from '../errors.js';
import { buildLayout, deepEqual, gridPages, readLayout, resetLayout, restoreLayout, writeLayout } from '../layout.js';
import logger from '../logger.js';
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

const layoutCard = z.looseObject({
    id: z.union([z.string().min(1), z.number()]),
    type: z.string().min(1),
    colSpan: z.number().int().min(1).max(3).optional(),
    tileSize: z.enum(['half', 'quarter']).optional(),
    hideOn: z.array(z.enum(['phone', 'tablet', 'desktop'])).optional(),
});

const launcherItem = z.looseObject({ name: z.string(), url: z.string() });

const layoutBody = z.object({
    pages: z.record(z.string(), z.array(layoutCard).max(500)),
    launcher: z.looseObject({
        apps: z.array(launcherItem).max(500).optional(),
        links: z.array(launcherItem).max(500).optional(),
        links_title: z.string().optional(),
    }).optional(),
    iconBackgrounds: z.array(z.string().max(2000)).max(200).optional(),
});

/**
 * Throws a 403 HttpError when editing is turned off in config.yaml.
 */
function assertEditable() {
    if (getBaseConfig().editable === false) throw new HttpError(403, 'Editing is disabled in config.yaml');
}

/**
 * Saves the whole dashboard as edited in the browser: the cards of every grid page, in order,
 * with their full properties. Every grid page must be included and every card id may appear
 * only once. Credential-like keys the browser never received are restored from the server's copy.
 * The header menu and icon background presets are optional; left out, the saved ones are kept.
 */
router.put('/layout', (req, res, next) => {
    try {
        assertEditable();
        const parsed = layoutBody.safeParse(req.body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new HttpError(400, `Invalid layout: ${issue.path.join('.')} ${issue.message}`.trim());
        }

        const basePages = gridPages(getBaseConfig());
        const sent = parsed.data.pages;
        const missing = basePages.find(p => !Object.hasOwn(sent, p.key));
        if (missing) throw new HttpError(400, `Missing page: ${missing.key}`);
        const unknown = Object.keys(sent).find(key => !basePages.some(p => p.key === key));
        if (unknown) throw new HttpError(400, `Unknown page: ${unknown}`);

        const seen = new Set();
        Object.values(sent).flat().forEach(card => {
            if (seen.has(String(card.id))) throw new HttpError(400, `Duplicate card id "${card.id}"`);
            seen.add(String(card.id));
        });

        // Restore secrets from the card as the server currently has it (config.yaml or layout.yaml)
        const current = new Map(gridPages(getConfig()).flatMap(p => p.cards).map(c => [String(c.id), c]));
        const pages = Object.fromEntries(Object.entries(sent).map(([key, cards]) => [
            key,
            cards.map(card => restoreSecrets(card, current.get(String(card.id)))),
        ]));

        const previous = readLayout();
        const launcher = parsed.data.launcher
            ? restoreSecrets(parsed.data.launcher, getConfig().launcher)
            : previous.launcher;
        writeLayout({
            ...buildLayout(basePages, pages),
            launcher: deepEqual(launcher, getBaseConfig().launcher) ? undefined : launcher,
            iconBackgrounds: parsed.data.iconBackgrounds ?? previous.iconBackgrounds,
        });
        logger.info('Saved dashboard layout');
        loadConfig();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/** Removes everything saved from the browser, so the dashboard goes back to config.yaml. */
router.delete('/layout', (req, res, next) => {
    try {
        assertEditable();
        if (resetLayout()) {
            logger.info('Reset dashboard layout');
            loadConfig();
        }
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/** Undoes the last reset, by putting back the layout it removed. */
router.post('/layout/restore', (req, res, next) => {
    try {
        assertEditable();
        if (!restoreLayout()) throw new HttpError(404, 'There is no reset to undo');
        logger.info('Restored dashboard layout');
        loadConfig();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
