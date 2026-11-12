import express from 'express';
import fs from 'fs';
import { z } from 'zod';
import { getBaseConfig, getConfig, getSanitizedConfig, loadConfig, onConfigChange, restoreSecrets } from '../config.js';
import { HttpError } from '../errors.js';
import {
    IMAGE_TYPES, MAX_IMAGE_BYTES, backgroundImagePath, downloadBackgroundImage, pruneBackgroundImages,
    saveBackgroundImage, sniffImageType,
} from '../backgrounds.js';
import {
    buildLayout, deepEqual, gridPages, pageKey, readLayout, readLayoutBackup, resetLayout, restoreLayout, stripTemplates,
    writeLayout,
} from '../layout.js';
import {
    ALIGNMENTS, CONDITION_OPERATORS, HEADER_AUTO_HIDE, ENTITY_ID, LAYOUTS, LINE_TYPES, MAX_TEXT_LENGTH, MAX_WIDGETS, MIN_TEMPLATE_REFRESH, STYLES,
    WIDGET_TYPES, isHeaderColor,
} from '../../shared/pageHeader.js';
import logger from '../logger.js';
import { flattenCards } from '../../shared/containerCards.js';
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

/** A page background: a color its gradient is made from, or a picture (a web or uploaded URL). */
const background = z.object({
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    image: z.string().max(2000).regex(/^(https?:\/\/|\/)/).optional(),
    dim: z.number().min(0).max(0.8).optional(),
}).refine(b => Boolean(b.color) !== Boolean(b.image), 'needs either a color or a picture');

/** A single page's background: its own, or `{ theme: true }` for the theme's gradient on that page. */
const pageBackground = z.union([background, z.object({ theme: z.literal(true) })]);

/**
 * A line of the page header as the browser saves it. There is no `template`: the object drops
 * unknown keys, so template texts sent by the browser are never stored. A template line keeps
 * the template written for it in config.yaml.
 */
const headerLine = z.union([z.literal(false), z.object({
    type: z.enum(LINE_TYPES),
    format: z.string().max(100).optional(),
    text: z.string().max(MAX_TEXT_LENGTH).optional(),
    refresh: z.number().min(MIN_TEMPLATE_REFRESH).max(86400).optional(),
    color: z.string().max(100).refine(isHeaderColor, 'is not a color').optional(),
})]);

/**
 * A page header widget as the browser saves it. Its entities become readable by the browser,
 * like those of cards added in the browser.
 */
const headerWidget = z.object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/i),
    type: z.enum(WIDGET_TYPES),
    entity_id: z.string().regex(ENTITY_ID).max(255),
    entity_id2: z.string().regex(ENTITY_ID).max(255).optional(),
    name: z.string().trim().max(60).optional(),
    icon: z.string().max(500).optional(),
    color: z.string().max(100).refine(isHeaderColor, 'is not a color').optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    condition: z.object({
        operator: z.enum(CONDITION_OPERATORS),
        value: z.union([z.string().max(100), z.number().finite()]),
    }).optional(),
});

/** A page header as the browser saves it: on with the defaults, off, or its options. */
const pageHeader = z.union([z.boolean(), z.object({
    enabled: z.boolean().optional(),
    align: z.enum(ALIGNMENTS).optional(),
    layout: z.enum(LAYOUTS).optional(),
    style: z.enum(STYLES).optional(),
    locale: z.string().trim().min(1).max(35).optional(),
    title: headerLine.optional(),
    subtitle: headerLine.optional(),
    widgets: z.array(headerWidget).max(MAX_WIDGETS).optional(),
})]);

const layoutBody = z.object({
    pages: z.record(z.string(), z.array(layoutCard).max(500)),
    launcher: z.looseObject({
        apps: z.array(launcherItem).max(500).optional(),
        links: z.array(launcherItem).max(500).optional(),
        links_title: z.string().optional(),
    }).optional(),
    iconBackgrounds: z.array(z.string().max(2000)).max(200).optional(),
    background: background.nullable().optional(),
    addedPages: z.array(z.object({
        id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,47}$/),
        name: z.string().trim().min(1).max(60).optional(),
    })).max(50).optional(),
    pageBackgrounds: z.record(z.string(), pageBackground.nullable()).optional(),
    pageHeader: pageHeader.nullable().optional(),
    pageHeaders: z.record(z.string(), pageHeader.nullable()).optional(),
    headerAutoHide: z.enum(HEADER_AUTO_HIDE).nullable().optional(),
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
 * The header menu, icon background presets, page background and page header are optional; left out,
 * the saved ones are kept. A `null` background or page header goes back to the one in config.yaml.
 * Page header templates are never taken from the browser, only from config.yaml.
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
        const previous = readLayout();
        const addedPages = parsed.data.addedPages ?? previous.addedPages ?? [];

        // Added pages need ids that no page of config.yaml (iframe pages included) or other added page uses
        const baseKeys = new Set((Array.isArray(getBaseConfig().pages) ? getBaseConfig().pages : [{ id: 'default' }])
            .map((page, index) => pageKey(page, index)));
        const addedKeys = new Set();
        addedPages.forEach(page => {
            if (baseKeys.has(page.id) || addedKeys.has(page.id)) throw new HttpError(400, `Page id "${page.id}" is already used`);
            addedKeys.add(page.id);
        });

        const missing = [...basePages.map(p => p.key), ...addedKeys].find(key => !Object.hasOwn(sent, key));
        if (missing) throw new HttpError(400, `Missing page: ${missing}`);
        const unknown = Object.keys(sent).find(key => !basePages.some(p => p.key === key) && !addedKeys.has(key));
        if (unknown) throw new HttpError(400, `Unknown page: ${unknown}`);

        const seen = new Set();
        flattenCards(Object.values(sent).flat()).forEach(card => {
            if (seen.has(String(card.id))) throw new HttpError(400, `Duplicate card id "${card.id}"`);
            seen.add(String(card.id));
        });

        // Restore secrets from the card as the server currently has it (config.yaml or layout.yaml)
        const current = new Map(gridPages(getConfig()).flatMap(p => p.cards).map(c => [String(c.id), c]));
        const pages = Object.fromEntries(Object.entries(sent).map(([key, cards]) => [
            key,
            cards.map(card => restoreSecrets(card, current.get(String(card.id)))),
        ]));

        const launcher = parsed.data.launcher
            ? restoreSecrets(parsed.data.launcher, getConfig().launcher)
            : previous.launcher;
        // Page backgrounds are stored where they differ from config.yaml; null clears one set there
        const baseBackgrounds = new Map(gridPages(getBaseConfig()).map(p => [p.key, getBaseConfig().pages?.[p.index]?.background]));
        const pageKeys = new Set([...basePages.map(p => p.key), ...addedKeys]);
        const sentPageBackgrounds = parsed.data.pageBackgrounds ?? previous.pageBackgrounds ?? {};
        const unknownBackground = Object.keys(sentPageBackgrounds).find(key => !pageKeys.has(key));
        if (parsed.data.pageBackgrounds && unknownBackground) throw new HttpError(400, `Unknown page: ${unknownBackground}`);
        const pageBackgrounds = Object.fromEntries(Object.entries(sentPageBackgrounds)
            .filter(([key]) => pageKeys.has(key))
            .filter(([key, value]) => !deepEqual(value ?? undefined, baseBackgrounds.get(key)))
            .filter(([key, value]) => value !== null || baseBackgrounds.get(key) !== undefined));

        // Page headers too, compared without templates, which only config.yaml has
        const baseHeaders = new Map(gridPages(getBaseConfig()).map(p => [p.key, stripTemplates(getBaseConfig().pages?.[p.index]?.pageHeader)]));
        const sentPageHeaders = parsed.data.pageHeaders ?? previous.pageHeaders ?? {};
        const unknownHeader = Object.keys(sentPageHeaders).find(key => !pageKeys.has(key));
        if (parsed.data.pageHeaders && unknownHeader) throw new HttpError(400, `Unknown page: ${unknownHeader}`);
        const pageHeaders = Object.fromEntries(Object.entries(sentPageHeaders)
            .filter(([key]) => pageKeys.has(key))
            .filter(([key, value]) => !deepEqual(value ?? undefined, baseHeaders.get(key)))
            .filter(([key, value]) => value !== null || baseHeaders.get(key) !== undefined));
        const sentHeader = parsed.data.pageHeader;
        const header = sentHeader === undefined ? previous.pageHeader : sentHeader ?? undefined;
        const baseHeader = stripTemplates(getBaseConfig().pageHeader);

        // When the header bar hides itself; null goes back to config.yaml
        const sentAutoHide = parsed.data.headerAutoHide;
        const autoHide = sentAutoHide === undefined ? previous.headerAutoHide : sentAutoHide ?? undefined;

        const sentBackground = parsed.data.background;
        const pageBackground = sentBackground === undefined ? previous.background : sentBackground ?? undefined;
        writeLayout({
            ...buildLayout(basePages, pages),
            launcher: deepEqual(launcher, getBaseConfig().launcher) ? undefined : launcher,
            iconBackgrounds: parsed.data.iconBackgrounds ?? previous.iconBackgrounds,
            background: pageBackground && !deepEqual(pageBackground, getBaseConfig().background) ? pageBackground : undefined,
            addedPages,
            pageBackgrounds,
            pageHeader: header === undefined || deepEqual(header, baseHeader) ? undefined : header,
            pageHeaders,
            headerAutoHide: autoHide === (getBaseConfig().headerAutoHide ?? 'never') ? undefined : autoHide,
        });
        // A reset keeps a copy of the layout it removed, so its pictures stay until that copy is gone
        const backup = readLayoutBackup();
        pruneBackgroundImages([
            pageBackground, getBaseConfig().background, backup?.background,
            ...Object.values(pageBackgrounds), ...baseBackgrounds.values(), ...Object.values(backup?.pageBackgrounds || {}),
        ].map(b => b?.image));
        logger.info('Saved dashboard layout');
        loadConfig();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/**
 * Stores a picture for the page background, sent as the raw request body. The picture is only
 * used once a layout that refers to its URL is saved; unused pictures are removed on the next save.
 */
router.post(
    '/background',
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
    (req, res, next) => {
        try {
            assertEditable();
            const type = Buffer.isBuffer(req.body) ? sniffImageType(req.body) : null;
            if (!type) throw new HttpError(400, 'Send a JPEG, PNG, WebP, GIF or AVIF picture');
            const url = saveBackgroundImage(req.body, type);
            logger.info('Stored a background picture');
            res.json({ url });
        } catch (err) {
            next(err);
        }
    },
);

/**
 * Downloads a picture from a web address (`{ url }`) and stores it like an uploaded one, so the
 * dashboard doesn't depend on the other site. Answers the URL it is served at.
 */
router.post('/background/download', async (req, res, next) => {
    try {
        assertEditable();
        const url = typeof req.body?.url === 'string' ? req.body.url : '';
        try {
            res.json({ url: await downloadBackgroundImage(url) });
            logger.info('Downloaded a background picture');
        } catch (err) {
            throw new HttpError(err.status || 502, err.message);
        }
    } catch (err) {
        next(err);
    }
});

/** Serves an uploaded background picture. Names are content hashes, so they can be cached for good. */
router.get('/background/:name', (req, res) => {
    const file = backgroundImagePath(req.params.name);
    if (!file || !fs.existsSync(file)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable').sendFile(file);
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
