import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { MANIFEST_FILE, PLUGIN_ID, readManifest } from './manifest.js';

/** File in a plugin's folder recording where it was installed from. */
export const SOURCE_FILE = '.glassboard-source.json';

/**
 * The folder plugins are installed in: `PLUGINS_DIR`, or `plugins` in the working directory
 * (`/app/plugins` in Docker, to be mounted as a volume).
 * @returns {string} Absolute path.
 */
export function pluginsDir() {
    return path.resolve(process.cwd(), process.env.PLUGINS_DIR || 'plugins');
}

/** @type {Map<string, string>} Plugin id to the folder its browser files are served from */
const assetDirs = new Map();

/**
 * The folder whose files are served at `/_plugins/<id>/`, for a plugin that is loaded.
 * @param {string} id - The plugin.
 * @returns {string|undefined} Absolute path.
 */
export function assetsDirFor(id) {
    return assetDirs.get(id);
}

/**
 * Where a plugin was installed from, if it was installed from the settings window.
 * @param {string} dir - The plugin's folder.
 * @returns {{url: string, ref?: string, installedAt?: string}|null} The source.
 */
export function readSource(dir) {
    try {
        const source = JSON.parse(fs.readFileSync(path.join(dir, SOURCE_FILE), 'utf-8'));
        return source && typeof source.url === 'string' ? source : null;
    } catch {
        return null;
    }
}

/**
 * The URL a plugin's browser file is served at. The version and the file's time are part of
 * it, so a browser loads the new file after an update.
 * @param {string} id - The plugin.
 * @param {string} assetsDir - Its served folder.
 * @param {string|undefined} file - The file, relative to that folder.
 * @param {string} version - The plugin's version.
 * @returns {string|null} The URL, or null without a file.
 */
function assetUrl(id, assetsDir, file, version) {
    if (!file) return null;
    const stamp = Math.round(fs.statSync(path.join(assetsDir, file)).mtimeMs);
    const encoded = file.split(/[\\/]/).map(encodeURIComponent).join('/');
    return `/_plugins/${id}/${encoded}?v=${encodeURIComponent(version)}-${stamp}`;
}

/**
 * Reads a plugin from its folder: checks its manifest and imports its server part.
 * @param {string} dir - The plugin's folder.
 * @returns {Promise<import('./host.js').ServerPlugin & {assetsDir: string}>} The plugin, with what
 *   the plugins list says about it in `meta`.
 * @throws {Error} When the manifest is wrong or the server part can't be imported.
 */
export async function readPluginFolder(dir) {
    const manifest = readManifest(dir);
    const folder = path.basename(dir);
    if (folder !== manifest.id) throw new Error(`The folder is named ${folder}, but the plugin's id is ${manifest.id}`);

    let setup = () => ({});
    if (manifest.server) {
        // A new URL for each load, so a plugin updated while the server runs is imported again
        const file = path.join(dir, manifest.server);
        const url = `${pathToFileURL(file).href}?v=${Math.round(fs.statSync(file).mtimeMs)}-${Date.now()}`;
        let mod;
        try {
            mod = await import(url);
        } catch (err) {
            throw new Error(`${manifest.server} could not be loaded: ${err instanceof Error ? err.message : err}`);
        }
        const found = mod.default?.setup ?? mod.setup ?? (typeof mod.default === 'function' ? mod.default : undefined);
        if (typeof found !== 'function') throw new Error(`${manifest.server} exports no setup function`);
        setup = found;
    }

    const assetsDir = path.join(dir, manifest.assets);
    return {
        id: manifest.id,
        setup,
        assetsDir,
        meta: {
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            repository: manifest.repository,
            external: true,
            hasServer: Boolean(manifest.server),
            client: assetUrl(manifest.id, assetsDir, manifest.client, manifest.version),
            style: assetUrl(manifest.id, assetsDir, manifest.style, manifest.version),
            source: readSource(dir),
        },
    };
}

/**
 * The plugin folders in the plugins folder, skipping hidden ones (installs in progress).
 * @param {string} [dir] - The plugins folder.
 * @returns {string[]} Absolute paths, sorted by name.
 */
export function listPluginFolders(dir = pluginsDir()) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => path.join(dir, entry.name))
        .sort();
}

/**
 * Loads one plugin folder into the host. A plugin that can't be read is listed as failed.
 * @param {import('./host.js').PluginHost} host - The plugin host.
 * @param {string} dir - The plugin's folder.
 * @returns {Promise<boolean>} Whether it loaded.
 */
export async function loadPluginFolder(host, dir) {
    const folder = path.basename(dir);
    let plugin;
    try {
        plugin = await readPluginFolder(dir);
    } catch (err) {
        // Name it by its id when the manifest says one, else by its folder
        let id = folder;
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), 'utf-8'));
            if (typeof raw?.id === 'string' && PLUGIN_ID.test(raw.id)) id = raw.id;
        } catch { /* the folder name will do */ }
        host.fail(id, err instanceof Error ? err : new Error(String(err)), { external: true, source: readSource(dir) });
        return false;
    }
    host.add([plugin]);
    if (!host.ids.includes(plugin.id)) return false;
    assetDirs.set(plugin.id, plugin.assetsDir);
    return true;
}

/**
 * Takes a plugin from the plugins folder out of the host and stops serving its files.
 * @param {import('./host.js').PluginHost} host - The plugin host.
 * @param {string} id - The plugin.
 */
export function unloadPlugin(host, id) {
    host.remove(id);
    assetDirs.delete(id);
}

/**
 * Loads every plugin in the plugins folder, after the built-in ones. Plugins that fail are
 * listed as failed; none of them stops the server from starting.
 * @param {import('./host.js').PluginHost} host - The plugin host.
 * @param {string} [dir] - The plugins folder.
 * @returns {Promise<void>}
 */
export async function loadExternalPlugins(host, dir = pluginsDir()) {
    for (const folder of listPluginFolders(dir)) {
        await loadPluginFolder(host, folder);
    }
}
