import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';

const HEADER = [
    '# Written by Glassboard when you edit the dashboard in the browser.',
    '# It takes precedence over config.yaml: card order, sizes and visibility per page, cards',
    '# added or changed in the browser (under `config`), config.yaml cards that were removed, and',
    '# the header menu, icon background presets and page background when they were edited in the browser,',
    '# pages added in the browser (`addedPages`), backgrounds of single pages (`pageBackgrounds`), and the page',
    '# header of all pages (`pageHeader`) and of single pages (`pageHeaders`). Header templates are always taken',
    '# from config.yaml. `headerAutoHide` is when the header bar hides itself, `sidebar` the sidebar and its icons.',
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
 * @returns {{pages: Object<string, Array<Object>>, removed: Array<string|number>, launcher?: Object, iconBackgrounds?: string[], background?: Object, addedPages?: Array<{id: string, name?: string}>, pageBackgrounds?: Object<string, Object|null>, pageHeader?: *, pageHeaders?: Object<string, *>, headerAutoHide?: string, sidebar?: Object}} The overlay.
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
            ...(isPlainObject(data.launcher) ? { launcher: data.launcher } : {}),
            ...(Array.isArray(data.iconBackgrounds) ? { iconBackgrounds: data.iconBackgrounds } : {}),
            ...(isPlainObject(data.background) ? { background: data.background } : {}),
            ...(Array.isArray(data.addedPages) ? { addedPages: data.addedPages.filter(p => isPlainObject(p) && typeof p.id === 'string') } : {}),
            ...(isPlainObject(data.pageBackgrounds) ? { pageBackgrounds: data.pageBackgrounds } : {}),
            ...(isHeaderSetting(data.pageHeader) ? { pageHeader: stripTemplates(data.pageHeader) } : {}),
            ...(typeof data.headerAutoHide === 'string' ? { headerAutoHide: data.headerAutoHide } : {}),
            ...(isPlainObject(data.sidebar) ? { sidebar: data.sidebar } : {}),
            ...(isPlainObject(data.pageHeaders) ? {
                pageHeaders: Object.fromEntries(Object.entries(data.pageHeaders)
                    .filter(([, v]) => v === null || isHeaderSetting(v))
                    .map(([k, v]) => [k, stripTemplates(v)])),
            } : {}),
        };
    } catch (e) {
        logger.warn(`Error reading ${file}: ${e.message}`);
        return { pages: {}, removed: [] };
    }
}

/**
 * Writes the layout overlay in place. Renaming a temp file over it would fail when the file
 * is a Docker bind mount, so this overwrites the existing file instead.
 * @param {{pages: Object<string, Array<Object>>, removed: Array<string|number>, launcher?: Object, iconBackgrounds?: string[], background?: Object, addedPages?: Array<{id: string, name?: string}>, pageBackgrounds?: Object<string, Object|null>, pageHeader?: *, pageHeaders?: Object<string, *>, headerAutoHide?: string, sidebar?: Object}} layout - The overlay to store.
 */
export function writeLayout(layout) {
    const data = { pages: layout.pages };
    if (layout.removed.length > 0) data.removed = layout.removed;
    if (layout.launcher) data.launcher = layout.launcher;
    if (layout.iconBackgrounds?.length > 0) data.iconBackgrounds = layout.iconBackgrounds;
    if (layout.background) data.background = layout.background;
    if (layout.addedPages?.length > 0) data.addedPages = layout.addedPages;
    if (layout.pageBackgrounds && Object.keys(layout.pageBackgrounds).length > 0) data.pageBackgrounds = layout.pageBackgrounds;
    if (layout.pageHeader !== undefined) data.pageHeader = layout.pageHeader;
    if (layout.headerAutoHide) data.headerAutoHide = layout.headerAutoHide;
    if (layout.sidebar) data.sidebar = layout.sidebar;
    if (layout.pageHeaders && Object.keys(layout.pageHeaders).length > 0) data.pageHeaders = layout.pageHeaders;
    fs.writeFileSync(getLayoutPath(), HEADER + yaml.dump(data, { lineWidth: -1 }), 'utf8');
}

/**
 * Path of the copy kept by the last reset, next to the layout overlay.
 * @returns {string} Absolute path.
 */
function getBackupPath() {
    return `${getLayoutPath()}.bak`;
}

/**
 * Reads the copy of the layout overlay kept by the last reset.
 * @returns {Object|null} Its contents, or null when there is no readable copy.
 */
export function readLayoutBackup() {
    const file = getBackupPath();
    try {
        if (!fs.existsSync(file)) return null;
        const data = yaml.load(fs.readFileSync(file, 'utf8'));
        return isPlainObject(data) ? data : null;
    } catch {
        return null;
    }
}

/**
 * Puts back the layout overlay as it was before the last reset, and removes the copy.
 * @returns {boolean} Whether there was a copy to put back.
 */
export function restoreLayout() {
    const backup = getBackupPath();
    if (!fs.existsSync(backup)) return false;
    // Overwriting in place keeps a Docker bind mount intact
    fs.writeFileSync(getLayoutPath(), fs.readFileSync(backup));
    fs.rmSync(backup);
    return true;
}

/**
 * Removes the layout overlay, so the dashboard goes back to config.yaml. A copy is kept, so
 * the reset can be undone.
 * @returns {boolean} Whether there was an overlay to remove.
 */
export function resetLayout() {
    const file = getLayoutPath();
    if (!fs.existsSync(file)) return false;
    try {
        fs.copyFileSync(file, getBackupPath());
    } catch (e) {
        // A Docker setup may mount only the file itself; resetting still works, without undo
        logger.warn(`Could not back up ${file}: ${e.message}`);
    }
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
 * The header menu, icon background presets, page background and sidebar saved in the browser replace those of config.yaml,
 * and pages added in the browser follow the pages of config.yaml.
 * @param {Object} config - The merged configuration.
 * @param {{pages?: Object<string, Array<Object>>, removed?: Array<string|number>, launcher?: Object, iconBackgrounds?: string[], background?: Object, addedPages?: Array<{id: string, name?: string}>, pageBackgrounds?: Object<string, Object|null>, pageHeader?: *, pageHeaders?: Object<string, *>, headerAutoHide?: string, sidebar?: Object}} layout - The overlay.
 * @returns {Object} The configuration with the overlay applied.
 */
export function applyLayout(config, layout) {
    config = withAddedPages(config, layout?.addedPages);
    const shared = {
        ...(isPlainObject(layout?.launcher) ? { launcher: layout.launcher } : {}),
        ...(Array.isArray(layout?.iconBackgrounds) ? { iconBackgrounds: layout.iconBackgrounds } : {}),
        ...(isPlainObject(layout?.background) ? { background: layout.background } : {}),
        ...(typeof layout?.headerAutoHide === 'string' ? { headerAutoHide: layout.headerAutoHide } : {}),
        ...(isPlainObject(layout?.sidebar) ? { sidebar: layout.sidebar } : {}),
    };
    const withBackgrounds = withPageBackgrounds({ ...applyCards(config, layout), ...shared }, layout?.pageBackgrounds);
    return withPageHeaders(withBackgrounds, layout?.pageHeader, layout?.pageHeaders);
}

/** Header lines, the parts of a page header that can be templates. */
const HEADER_LINES = ['title', 'subtitle'];

/**
 * Whether a value is a page header setting: on or off, or its options.
 * @param {*} value - The value.
 * @returns {boolean} True for booleans and plain objects.
 */
const isHeaderSetting = (value) => typeof value === 'boolean' || isPlainObject(value);

/**
 * Returns a page header setting without template texts. Templates are only ever taken from
 * config.yaml, so none that came from the browser or layout.yaml can be rendered.
 * @param {*} header - The setting.
 * @returns {*} The setting without `template` on its lines; other values as they are.
 */
export function stripTemplates(header) {
    if (!isPlainObject(header)) return header;
    const result = { ...header };
    HEADER_LINES.forEach((line) => {
        if (isPlainObject(result[line])) {
            const { template: _template, ...rest } = result[line];
            result[line] = rest;
        }
    });
    return result;
}

/**
 * Gives the template lines of a header saved in the browser their template from config.yaml:
 * from the first source that has a template on the same line.
 * @param {*} header - The saved setting.
 * @param {Array<*>} sources - Header settings of config.yaml, most specific first.
 * @returns {*} The setting with templates.
 */
function withConfigTemplates(header, sources) {
    if (!isPlainObject(header)) return header;
    const result = stripTemplates(header);
    HEADER_LINES.forEach((line) => {
        if (!isPlainObject(result[line]) || result[line].type !== 'template') return;
        const template = sources.map(s => (isPlainObject(s) && isPlainObject(s[line]) ? s[line].template : undefined))
            .find(t => typeof t === 'string' && t);
        if (template) result[line] = { ...result[line], template };
    });
    return result;
}

/**
 * Returns the config with the page header saved in the browser: the one of all pages replaces
 * `pageHeader`, and one of a page replaces that page's `pageHeader` (`null` removes one set in
 * config.yaml, so the page follows all pages again). Template texts come from config.yaml only.
 * @param {Object} config - The configuration.
 * @param {*} header - The header of all pages, if it was saved.
 * @param {Object<string, *>|undefined} headers - Headers of single pages by page key.
 * @returns {Object} The configuration; the same object when nothing was saved.
 */
function withPageHeaders(config, header, headers) {
    const baseHeader = config.pageHeader;
    let result = config;
    if (isHeaderSetting(header)) result = { ...result, pageHeader: withConfigTemplates(header, [baseHeader]) };
    if (!isPlainObject(headers) || !Array.isArray(result.pages)) return result;
    return {
        ...result,
        pages: result.pages.map((page, index) => {
            const key = pageKey(page, index);
            if (!Object.hasOwn(headers, key)) return page;
            const { pageHeader: own, ...rest } = page;
            return isHeaderSetting(headers[key])
                ? { ...rest, pageHeader: withConfigTemplates(headers[key], [own, baseHeader]) }
                : rest;
        }),
    };
}

/**
 * Returns the config with the backgrounds of single pages saved in the browser. A background
 * replaces the page's `background`; `null` removes one set in config.yaml, so the page shows
 * the dashboard's background again.
 * @param {Object} config - The configuration.
 * @param {Object<string, Object|null>|undefined} backgrounds - Backgrounds by page key.
 * @returns {Object} The configuration; the same object when there are none.
 */
function withPageBackgrounds(config, backgrounds) {
    if (!isPlainObject(backgrounds) || !Array.isArray(config.pages)) return config;
    return {
        ...config,
        pages: config.pages.map((page, index) => {
            const key = pageKey(page, index);
            if (!Object.hasOwn(backgrounds, key)) return page;
            const { background: _background, ...rest } = page;
            return isPlainObject(backgrounds[key]) ? { ...rest, background: backgrounds[key] } : rest;
        }),
    };
}

/**
 * Returns the config with the pages added in the browser after its own pages. Each is a grid
 * page marked `addedInEditor`, without cards of its own; its cards come from the overlay. A
 * config with top-level `cards` becomes a `default` page followed by the added ones. Pages whose
 * id is already taken are left out.
 * @param {Object} config - The configuration.
 * @param {Array<{id: string, name?: string}>|undefined} added - The added pages, in order.
 * @returns {Object} The configuration with the pages; the same object when there are none.
 */
export function withAddedPages(config, added) {
    if (!Array.isArray(added) || added.length === 0) return config;
    const own = Array.isArray(config.pages)
        ? config.pages
        : [{ id: 'default', cards: Array.isArray(config.cards) ? config.cards : [] }];
    const taken = new Set(own.map((page, index) => pageKey(page, index)));
    const extra = added
        .filter(p => isPlainObject(p) && typeof p.id === 'string' && p.id && !taken.has(p.id) && taken.add(p.id))
        .map(p => ({ id: p.id, ...(typeof p.name === 'string' && p.name ? { name: p.name } : {}), cards: [], addedInEditor: true }));
    if (extra.length === 0) return config;
    const { cards: _cards, ...rest } = config;
    return { ...rest, pages: [...own, ...extra] };
}

/**
 * Applies the card part of the layout overlay.
 * @param {Object} config - The merged configuration.
 * @param {{pages?: Object<string, Array<Object>>, removed?: Array<string|number>}} layout - The overlay.
 * @returns {Object} The configuration with saved cards applied.
 */
function applyCards(config, layout) {
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
