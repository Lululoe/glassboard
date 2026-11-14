/**
 * The sidebar's arrangement, as stored under `sidebar.items` in config.yaml or layout.yaml:
 * pages and folders in order, each with an optional icon. Pages that the list doesn't mention
 * follow at the end, so a dashboard needs no sidebar settings at all.
 *
 * @typedef {Object} IconFields
 * @property {string} [icon] - Icon reference, as for cards (`lu-House`, `mdi:sofa`, …).
 * @property {string} [iconColor] - Icon color.
 * @property {string} [iconBackground] - CSS background of the icon tile.
 *
 * @typedef {IconFields & {page: string}} PageEntry
 * @typedef {IconFields & {folder: string, name?: string, pages: PageEntry[]}} FolderEntry
 * @typedef {PageEntry|FolderEntry} Entry
 *
 * @typedef {{folder: string|null, index: number}} EntryPath - Where an entry is: at the top
 *   (`folder: null`) or in a folder, and its position there.
 */

/** Icon of a folder that has none of its own. */
export const FOLDER_ICON = 'lu-Folder';

/** Name of a new folder. */
export const NEW_FOLDER_NAME = 'Folder';

const ICON_KEYS = ['icon', 'iconColor', 'iconBackground'];

/**
 * Whether a value is a plain object.
 * @param {*} value - The value.
 * @returns {boolean} True for objects that are not arrays or null.
 */
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Copies the icon fields that are set.
 * @param {Object} entry - A stored entry.
 * @returns {IconFields} Its icon fields.
 */
function iconFields(entry) {
    return Object.fromEntries(ICON_KEYS.filter(k => typeof entry[k] === 'string' && entry[k]).map(k => [k, entry[k]]));
}

/**
 * Whether an entry is a folder.
 * @param {Entry} entry - The entry.
 * @returns {entry is FolderEntry} True for folders.
 */
export const isFolder = (entry) => typeof /** @type {FolderEntry} */ (entry).folder === 'string';

/**
 * Turns the stored arrangement into a complete, valid one for the pages there are: unknown
 * pages and pages mentioned twice are left out, folders without pages are dropped, and pages
 * that aren't mentioned are added at the end in the order of the dashboard.
 * @param {string[]} pageKeys - Keys of all pages, in dashboard order.
 * @param {*} items - The stored `sidebar.items`.
 * @returns {Entry[]} The arrangement.
 */
export function normalizeItems(pageKeys, items) {
    const known = new Set(pageKeys);
    const used = new Set();
    const folders = new Set();
    const page = (entry) => {
        const key = entry.page === undefined || entry.page === null ? '' : String(entry.page);
        if (!known.has(key) || used.has(key)) return null;
        used.add(key);
        return { page: key, ...iconFields(entry) };
    };

    const result = [];
    (Array.isArray(items) ? items : []).forEach((entry) => {
        if (!isObject(entry)) return;
        if (typeof entry.folder === 'string' && entry.folder && !folders.has(entry.folder)) {
            const pages = (Array.isArray(entry.pages) ? entry.pages : []).filter(isObject).map(page).filter(Boolean);
            if (pages.length === 0) return;
            folders.add(entry.folder);
            const name = typeof entry.name === 'string' ? entry.name.trim() : '';
            result.push({ folder: entry.folder, ...(name ? { name } : {}), ...iconFields(entry), pages });
            return;
        }
        const resolved = page(entry);
        if (resolved) result.push(resolved);
    });
    pageKeys.forEach(key => { if (!used.has(key)) result.push({ page: key }); });
    return result;
}

/**
 * Returns the list a path points into.
 * @param {Entry[]} items - The arrangement.
 * @param {string|null} folder - The folder's id, or null for the top.
 * @returns {Entry[]|null} The list, or null when there is no such folder.
 */
function listOf(items, folder) {
    if (folder === null) return items;
    const found = items.find(e => isFolder(e) && e.folder === folder);
    return found ? /** @type {FolderEntry} */ (found).pages : null;
}

/**
 * Returns the entry at a path.
 * @param {Entry[]} items - The arrangement.
 * @param {EntryPath} path - Where it is.
 * @returns {Entry|undefined} The entry.
 */
export function entryAt(items, path) {
    return listOf(items, path.folder)?.[path.index];
}

/**
 * Removes folders that have no pages left and opens up those with a single page, so a folder
 * always holds at least two.
 * @param {Entry[]} items - The arrangement.
 * @returns {Entry[]} The tidied arrangement.
 */
export function tidy(items) {
    return items.flatMap((entry) => {
        if (!isFolder(entry)) return /** @type {Entry[]} */ ([entry]);
        if (entry.pages.length === 0) return /** @type {Entry[]} */ ([]);
        if (entry.pages.length === 1) return /** @type {Entry[]} */ ([entry.pages[0]]);
        return /** @type {Entry[]} */ ([entry]);
    });
}

/**
 * Copies the arrangement deeply enough to change its lists.
 * @param {Entry[]} items - The arrangement.
 * @returns {Entry[]} The copy.
 */
const copy = (items) => items.map(e => (isFolder(e) ? { ...e, pages: [...e.pages] } : { ...e }));

/**
 * Moves an entry. A folder can only move at the top, since folders don't nest.
 * @param {Entry[]} items - The arrangement.
 * @param {EntryPath} from - Where the entry is.
 * @param {EntryPath} to - Where it goes; `index` counts without the entry itself.
 * @returns {Entry[]} The new arrangement, or the same one when the move isn't possible.
 */
export function moveEntry(items, from, to) {
    const entry = entryAt(items, from);
    if (!entry || (isFolder(entry) && to.folder !== null)) return items;
    const next = copy(items);
    const source = listOf(next, from.folder);
    source.splice(from.index, 1);
    const target = listOf(next, to.folder);
    if (!target) return items;
    target.splice(Math.max(0, Math.min(to.index, target.length)), 0, entry);
    return tidy(next);
}

/**
 * Drops a page onto an entry at the top: onto a folder it joins the folder at its end, onto
 * another page both become a new folder in that page's place.
 * @param {Entry[]} items - The arrangement.
 * @param {EntryPath} from - Where the dragged page is.
 * @param {number} target - Position of the entry it is dropped on, at the top.
 * @param {string} [folderId] - Id for a new folder; a new one is made when left out.
 * @returns {Entry[]} The new arrangement, or the same one when the drop isn't possible.
 */
export function mergeEntries(items, from, target, folderId) {
    const dragged = entryAt(items, from);
    const onto = items[target];
    if (!dragged || !onto || isFolder(dragged) || (from.folder === null && from.index === target)) return items;

    const next = copy(items);
    const marker = next[target];
    listOf(next, from.folder).splice(from.index, 1);
    const at = next.indexOf(marker);
    if (isFolder(marker)) {
        marker.pages.push(/** @type {PageEntry} */ (dragged));
    } else {
        const id = folderId || newFolderId(items);
        next.splice(at, 1, { folder: id, name: NEW_FOLDER_NAME, pages: [/** @type {PageEntry} */ (marker), /** @type {PageEntry} */ (dragged)] });
    }
    return tidy(next);
}

/**
 * Changes an entry's settings, such as its icon or a folder's name.
 * @param {Entry[]} items - The arrangement.
 * @param {EntryPath} path - Where it is.
 * @param {Entry} entry - The changed entry.
 * @returns {Entry[]} The new arrangement.
 */
export function replaceEntry(items, path, entry) {
    const next = copy(items);
    const list = listOf(next, path.folder);
    if (!list || !list[path.index]) return items;
    list[path.index] = entry;
    return next;
}

/**
 * Removes a folder and puts its pages at the top in its place.
 * @param {Entry[]} items - The arrangement.
 * @param {string} folder - The folder's id.
 * @returns {Entry[]} The new arrangement.
 */
export function ungroup(items, folder) {
    return items.flatMap(e => /** @type {Entry[]} */ (isFolder(e) && e.folder === folder ? e.pages : [e]));
}

/**
 * Makes an id for a folder that no other folder has.
 * @param {Entry[]} items - The arrangement.
 * @returns {string} The id, such as `folder-k3f9`.
 */
export function newFolderId(items) {
    const taken = new Set(items.filter(isFolder).map(e => /** @type {FolderEntry} */ (e).folder));
    for (;;) {
        const id = `folder-${Math.random().toString(36).slice(2, 6)}`;
        if (!taken.has(id)) return id;
    }
}

/**
 * Finds the path of the entry of a page.
 * @param {Entry[]} items - The arrangement.
 * @param {string} key - The page's key.
 * @returns {EntryPath|null} Where it is.
 */
export function pathOfPage(items, key) {
    for (let i = 0; i < items.length; i++) {
        const entry = items[i];
        if (isFolder(entry)) {
            const index = entry.pages.findIndex(p => p.page === key);
            if (index >= 0) return { folder: entry.folder, index };
        } else if (entry.page === key) {
            return { folder: null, index: i };
        }
    }
    return null;
}
