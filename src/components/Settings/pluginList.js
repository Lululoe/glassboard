/**
 * Names of plugins that only run on the server, which have no name of their own.
 * @type {Object<string, string>}
 */
const SERVER_ONLY_NAMES = { core: 'Core' };

/**
 * @typedef {Object} PluginRow
 * @property {string} id - The plugin's id.
 * @property {string} name - Its name.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 * @property {string[]} cards - Its card types.
 * @property {string[]} services - The services it adds on the server.
 * @property {boolean} external - Whether it was added to the plugins folder, so it can be updated or removed.
 * @property {string} [version] - Its version, for plugins from the plugins folder.
 * @property {string} [description] - What it does.
 * @property {{url: string, ref?: string}|null} [source] - Where it was installed from.
 */

/**
 * Joins the plugins the browser registered with those the server set up: one row per plugin id,
 * with its cards from the one and its services from the other, in the browser's order and then
 * the server's.
 * @param {import('../../plugins/registry').PluginInfo[]} client - Plugins registered in the browser.
 * @param {Array<{id: string, services: string[], builtIn: boolean, name?: string, external?: boolean, version?: string, description?: string, source?: {url: string, ref?: string}|null}>} server
 *   - Plugins set up on the server.
 * @returns {PluginRow[]} The rows.
 */
export function mergePlugins(client, server) {
    /** @type {Map<string, PluginRow>} */
    const rows = new Map(client.map(p => [p.id, { id: p.id, name: p.name, builtIn: p.builtIn, cards: p.cards, services: [], external: false }]));
    server.forEach((p) => {
        const about = { external: Boolean(p.external), version: p.version, description: p.description, source: p.source ?? null };
        const row = rows.get(p.id);
        if (row) Object.assign(row, about, { services: p.services });
        else rows.set(p.id, { id: p.id, name: p.name || SERVER_ONLY_NAMES[p.id] || p.id, builtIn: p.builtIn, cards: [], services: p.services, ...about });
    });
    return [...rows.values()];
}

/**
 * @typedef {Object} PluginIssue
 * @property {string} id - The plugin's id.
 * @property {string} name - Its name, or its id when it has none.
 * @property {'browser'|'server'} where - Which part of it failed to load.
 * @property {string} error - Why.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 * @property {boolean} partly - Whether its other part did load, so it is also among the loaded plugins.
 * @property {boolean} external - Whether it is in the plugins folder, so it can be removed.
 */

/**
 * Lists every plugin that failed to load, in the browser first and then on the server, and
 * says which of them still loaded their other part.
 * @param {import('../../plugins/registry').PluginFailure[]} clientFailures - Failures in the browser.
 * @param {Array<{id: string, error: string, builtIn: boolean, external?: boolean}>} serverFailures - Failures on the server.
 * @param {PluginRow[]} rows - The plugins that loaded.
 * @returns {PluginIssue[]} The issues.
 */
export function pluginIssues(clientFailures, serverFailures, rows) {
    const loaded = new Map(rows.map(row => [row.id, row]));
    // A plugin that failed in both places has its name only from the browser
    const named = new Map(clientFailures.filter(f => f.name).map(f => [f.id, f.name]));
    // Only the server knows which plugins are in the plugins folder
    const externalFailures = new Set(serverFailures.filter(f => f.external).map(f => f.id));
    return [
        ...clientFailures.map(f => ({ ...f, where: /** @type {const} */ ('browser') })),
        ...serverFailures.map(f => ({ ...f, name: undefined, where: /** @type {const} */ ('server') })),
    ].map(f => ({
        id: f.id,
        name: f.name || loaded.get(f.id)?.name || named.get(f.id) || SERVER_ONLY_NAMES[f.id] || f.id,
        where: f.where,
        error: f.error,
        builtIn: f.builtIn,
        partly: loaded.has(f.id),
        external: Boolean(loaded.get(f.id)?.external || externalFailures.has(f.id)),
    }));
}
