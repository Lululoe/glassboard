import { icons as lucideIcons } from 'lucide-react';

const SELFHST_BASE = 'https://cdn.jsdelivr.net/gh/selfhst/icons@main';

/** @type {Object<string, Promise<Array<{ref: string, name: string, search: string}>>>} */
const loading = {};

/**
 * Makes a search term and icon names comparable: `Arrow Down` finds `arrow-down` and `ArrowDown`.
 * @param {string} text - The text.
 * @returns {string} Lowercase text without separators.
 */
const normalize = (text) => text.toLowerCase().replace(/[\s\-_]+/g, '');

/**
 * Finds the entries of a catalog that match a search.
 * @param {Array<{search: string}>} items - The catalog.
 * @param {string} query - The search term.
 * @returns {Array<Object>} The matching entries.
 */
export function searchCatalog(items, query) {
    const term = normalize(query);
    return term ? items.filter(item => item.search.includes(term)) : items;
}

/**
 * Turns a selfh.st index row into the references of its full-color and monochrome versions.
 * Monochrome needs an SVG: a few icons only have it as PNG, which can't take a color.
 * @param {Object} row - A row of the selfh.st index.
 * @returns {{ref: string, mono: (string|null), name: string, search: string}} The catalog entry.
 */
export function selfhstEntry(row) {
    const { Name: name, Reference: id } = row;
    return {
        ref: row.SVG === 'Yes' ? `sh-${id}` : `sh-${id}-png`,
        mono: row.SVG === 'Yes' && row.Light === 'Yes' ? `sh-${id}-light` : null,
        name,
        search: normalize(`${name} ${id} ${row.Tags || ''}`),
    };
}

/**
 * Finds the catalog entry a selfh.st reference belongs to, whichever version it is.
 * @param {Array<{ref: string, mono: (string|null)}>} items - The catalog.
 * @param {string} ref - The reference string.
 * @returns {Object|undefined} The entry.
 */
export const findSelfhst = (items, ref) => items.find(item => item.ref === ref || item.mono === ref);

/**
 * Fetches JSON and throws when the request fails.
 * @param {string} url - The address.
 * @returns {Promise<*>} The parsed response.
 */
async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
}

const loaders = {
    lucide: async () => Object.keys(lucideIcons).map(name => ({ ref: `lu-${name}`, name, search: normalize(name) })),
    mdi: async () => {
        const { names } = await getJson('/api/icons/mdi');
        return names.map(name => ({ ref: `mdi:${name}`, name, search: normalize(name) }));
    },
    selfhst: async () => {
        const rows = await getJson(`${SELFHST_BASE}/index.json`);
        return rows.map(selfhstEntry).sort((a, b) => a.name.localeCompare(b.name));
    },
};

/**
 * Loads a whole icon catalog once. A failed load is forgotten, so it can be retried.
 * @param {'lucide'|'mdi'|'selfhst'} tab - The catalog.
 * @returns {Promise<Array<{ref: string, name: string, search: string}>>} Its icons.
 */
export function loadCatalog(tab) {
    loading[tab] ??= loaders[tab]().catch((err) => {
        delete loading[tab];
        throw err;
    });
    return loading[tab];
}
