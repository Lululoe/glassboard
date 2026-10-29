import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';

const HEADER = [
    '# Written by Glassboard when you edit the dashboard in the browser.',
    '# It takes precedence over config.yaml: card order, sizes and visibility per page, cards',
    '# added or changed in the browser (under `config`), and config.yaml cards that were removed.',
    '# Delete this file to go back to the dashboard in config.yaml.',
    '',
].join('\n');

/** Card properties that describe where and how big a card is, rather than what it shows. */
export const LAYOUT_PROPS = ['colSpan', 'tileSize', 'hideOn'];

/**
 * Returns `true` for plain objects (not arrays, null or class instances).
 * @param {*} value - Value to test.
 * @returns {boolean} Whether the value is a plain object.
 */
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Path of the layout overlay file. `LAYOUT_FILE` overrides it, e.g. for Docker volumes.
 * @returns {string} Absolute path to layout.yaml.
 */
export function getLayoutPath() {
    return path.resolve(process.cwd(), process.env.LAYOUT_FILE || 'layout.yaml');
}

/**
 * Reads the layout overlay. A missing, empty or invalid file counts as no overrides.
 * @returns {{pages: Object<string, Array<Object>>, removed: Array<string|number>}} The overlay.
 */
export function readLayout() {
    const file = getLayoutPath();
    try {
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { pages: {}, removed: [] };
        /** @type {any} */
        const data = yaml.load(fs.readFileSync(file, 'utf8')) || {};
        return {
            pages: isPlainObject(data.pages) ? data.pages : {},
            removed: Array.isArray(data.removed) ? data.removed : [],
        };
    } catch (e) {
        logger.warn(`Error reading ${file}: ${e.message}`);
        return { pages: {}, removed: [] };
    }
}

/**
 * Writes the layout overlay in place. Renaming a temp file over it would fail when the file
 * is a Docker bind mount, so this overwrites the existing file instead.
 * @param {{pages: Object<string, Array<Object>>, removed: Array<string|number>}} layout - The overlay to store.
 */
export function writeLayout(layout) {
    const data = { pages: layout.pages };
    if (layout.removed.length > 0) data.removed = layout.removed;
    fs.writeFileSync(getLayoutPath(), HEADER + yaml.dump(data, { lineWidth: -1 }), 'utf8');
}

/**
 * Removes the layout overlay, so the dashboard goes back to config.yaml.
 * @returns {boolean} Whether there was an overlay to remove.
 */
export function resetLayout() {
    const file = getLayoutPath();
    if (!fs.existsSync(file)) return false;
    // Emptying instead of deleting keeps a Docker bind mount intact
    fs.writeFileSync(file, HEADER + 'pages: {}\n', 'utf8');
    return true;
}

/**
 * Returns the key a page is stored under: its id, or its position for pages without one.
 * Top-level `cards` (no `pages`) use the key `default`, like the frontend.
 * @param {Object} page - The page config.
 * @param {number} index - Position of the page.
 * @returns {string} The page key.
 */
export function pageKey(page, index) {
    return page?.id !== undefined ? String(page.id) : String(index);
}

/**
 * Lists the grid pages of a config with their keys. Iframe pages have no cards and are left out.
 * @param {Object} config - The configuration.
 * @returns {Array<{key: string, index: number, cards: Array<Object>}>} The grid pages.
 */
export function gridPages(config) {
    if (Array.isArray(config.pages)) {
        return config.pages
            .map((page, index) => ({ page, index }))
            .filter(({ page }) => page?.type !== 'iframe')
            .map(({ page, index }) => ({ key: pageKey(page, index), index, cards: Array.isArray(page.cards) ? page.cards : [] }));
    }
    return [{ key: 'default', index: -1, cards: Array.isArray(config.cards) ? config.cards : [] }];
}

/**
 * Builds a card from a layout entry: the browser-defined `config` if there is one, otherwise
 * the config.yaml card, with the entry's size and visibility applied.
 * @param {Object} entry - The layout entry.
 * @param {Object|undefined} base - The matching config.yaml card.
 * @returns {Object|null} The card, or null when the entry refers to a card that no longer exists.
 */
function buildCard(entry, base) {
    let card;
    if (isPlainObject(entry.config)) card = { ...entry.config, id: entry.id };
    else if (base) card = { ...base };
    else return null;

    if (entry.tileSize === 'half' || entry.tileSize === 'quarter') {
        card.tileSize = entry.tileSize;
    } else if (entry.colSpan) {
        delete card.tileSize;
        card.colSpan = entry.colSpan;
    }
    if (Array.isArray(entry.hideOn)) {
        if (entry.hideOn.length > 0) card.hideOn = entry.hideOn;
        else delete card.hideOn;
    }
    return card;
}

/**
 * Returns a copy of the config with the layout overlay applied. Pages with a saved layout
 * list their cards in saved order (cards may come from other pages); config.yaml cards not
 * mentioned anywhere stay on their own page, after the saved ones. Removed cards are left out.
 * @param {Object} config - The merged configuration.
 * @param {{pages?: Object<string, Array<Object>>, removed?: Array<string|number>}} layout - The overlay.
 * @returns {Object} The configuration with the overlay applied.
 */
export function applyLayout(config, layout) {
    const saved = isPlainObject(layout?.pages) ? layout.pages : {};
    const removed = new Set((layout?.removed || []).map(String));
    const pages = gridPages(config);
    if (Object.keys(saved).length === 0 && removed.size === 0) return config;

    const baseById = new Map();
    pages.forEach(p => p.cards.forEach(c => {
        if (c?.id !== undefined && !baseById.has(String(c.id))) baseById.set(String(c.id), c);
    }));

    const claimed = new Set();
    const resolved = new Map();
    pages.forEach(({ key }) => {
        if (!Array.isArray(saved[key])) return;
        const cards = [];
        saved[key].forEach(entry => {
            if (!isPlainObject(entry) || entry.id === undefined) return;
            const id = String(entry.id);
            if (claimed.has(id) || removed.has(id)) return;
            const card = buildCard(entry, baseById.get(id));
            if (!card) return;
            claimed.add(id);
            cards.push(card);
        });
        resolved.set(key, cards);
    });

    const finalCards = (key, cards) => [
        ...(resolved.get(key) || []),
        ...cards.filter(c => c?.id === undefined || (!claimed.has(String(c.id)) && !removed.has(String(c.id)))),
    ];

    if (!Array.isArray(config.pages)) return { ...config, cards: finalCards('default', pages[0].cards) };
    const byIndex = new Map(pages.map(p => [p.index, p]));
    return {
        ...config,
        pages: config.pages.map((page, index) => {
            const p = byIndex.get(index);
            return p ? { ...page, cards: finalCards(p.key, p.cards) } : page;
        }),
    };
}

/**
 * Compares two JSON-like values structurally, ignoring key order.
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {boolean} Whether they are equal.
 */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

/**
 * Returns a card's properties without its id and layout properties.
 * @param {Object} card - The card.
 * @returns {Object} The remaining properties.
 */
function contentOf(card) {
    const rest = { ...card };
    ['id', ...LAYOUT_PROPS].forEach(k => delete rest[k]);
    return rest;
}

/**
 * Turns the cards the browser sent for each page into layout entries. A card that matches its
 * config.yaml version (apart from size and visibility) is stored by id only; cards added or
 * changed in the browser keep their full properties under `config`. config.yaml cards that
 * are no longer on any page are listed as removed.
 * @param {Array<{key: string, cards: Array<Object>}>} basePages - Grid pages of config.yaml.
 * @param {Object<string, Array<Object>>} pages - The cards per page key, with secrets restored.
 * @returns {{pages: Object<string, Array<Object>>, removed: Array<string|number>}} The overlay to write.
 */
export function buildLayout(basePages, pages) {
    const baseById = new Map();
    basePages.forEach(p => p.cards.forEach(c => {
        if (c?.id !== undefined && !baseById.has(String(c.id))) baseById.set(String(c.id), c);
    }));

    const present = new Set();
    const result = {};
    Object.entries(pages).forEach(([key, cards]) => {
        result[key] = cards.map(card => {
            present.add(String(card.id));
            const base = baseById.get(String(card.id));
            const entry = { id: card.id };
            if (card.tileSize === 'half' || card.tileSize === 'quarter') entry.tileSize = card.tileSize;
            else entry.colSpan = card.colSpan || 1;
            if (Array.isArray(card.hideOn) && card.hideOn.length > 0) entry.hideOn = card.hideOn;
            else if (base?.hideOn) entry.hideOn = [];
            const content = contentOf(card);
            if (!base || !deepEqual(contentOf(base), content)) entry.config = content;
            return entry;
        });
    });

    const removed = [...baseById.entries()].filter(([id]) => !present.has(id)).map(([, c]) => c.id);
    return { pages: result, removed };
}
