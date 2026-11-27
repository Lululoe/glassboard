import { editFetch } from './editAccess';

/**
 * Error returned by the Glassboard API, carrying the HTTP status.
 */
export class ApiError extends Error {
    /**
     * @param {string} message - Error message from the server.
     * @param {number} status - HTTP status code.
     */
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

const inflight = new Map();

/**
 * Sends a request to the central `/api` endpoint.
 * @param {string} body - JSON request body.
 * @returns {Promise<*>} Parsed response data.
 */
async function post(body) {
    const res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
    return data;
}

/**
 * Calls a backend service through `/api`. Identical concurrent calls share one request,
 * so several cards of the same type only hit the backend once per poll.
 * @param {string} service - Service name registered on the server (e.g. 'proxmox').
 * @param {Object} [params] - Additional parameters for the service.
 * @returns {Promise<*>} The service's response data.
 */
export function callService(service, params = {}) {
    const body = JSON.stringify({ ...params, service });
    if (!inflight.has(body)) {
        inflight.set(body, post(body).finally(() => inflight.delete(body)));
    }
    return inflight.get(body);
}

/**
 * Sends a JSON request to a config endpoint and throws an ApiError when it fails.
 * @param {string} method - HTTP method.
 * @param {string} url - Endpoint URL.
 * @param {Object} [body] - JSON body.
 * @returns {Promise<*>} Parsed response data.
 */
async function send(method, url, body) {
    const res = await editFetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
    return data;
}

/**
 * Saves the dashboard as edited in the browser: every grid page's cards, in order, with their
 * full properties. The server stores what differs from config.yaml in layout.yaml.
 * @param {Object<string, Array<Object>>} pages - Cards per page key (page id, or index without one).
 * @param {{launcher?: Object, iconBackgrounds?: string[], background?: Object|null, addedPages?: Array<{id: string, name?: string}>, pageBackgrounds?: Object<string, Object|null>, pageHeader?: *, pageHeaders?: Object<string, *>, headerAutoHide?: string|null, sidebar?: Object|null}} [shared]
 *   - Header menu, icon background presets, page background (`null` for the one in config.yaml), the pages
 *   added in the browser, in order, each page's own background (`null` to show that of all pages), and the page
 *   header of all pages and of each page (`null` for the one in config.yaml), and the sidebar (`null` for the one in config.yaml).
 * @returns {Promise<*>} The server response.
 */
export function saveLayout(pages, shared = {}) {
    return send('PUT', '/api/config/layout', { pages, ...shared });
}

/**
 * Uploads a picture for the page background. It is used once a layout that refers to it is saved.
 * @param {Blob} file - A JPEG, PNG, WebP, GIF or AVIF picture.
 * @returns {Promise<string>} The URL the picture is served at.
 */
export async function uploadBackground(file) {
    const res = await editFetch('/api/config/background', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const message = res.status === 413 ? 'The picture is larger than 20 MB.' : data?.error || `Upload failed (${res.status})`;
        throw new ApiError(message, res.status);
    }
    return data.url;
}

/**
 * Has the server download a picture from the web and keep it like an uploaded one.
 * @param {string} url - The picture's http(s) address.
 * @returns {Promise<string>} The URL the stored picture is served at.
 */
export async function downloadBackground(url) {
    return (await send('POST', '/api/config/background/download', { url })).url;
}

/**
 * Undoes the last reset.
 * @returns {Promise<*>} The server response.
 */
export function restoreLayout() {
    return send('POST', '/api/config/layout/restore');
}

/**
 * Removes everything saved from the browser, so the dashboard goes back to config.yaml.
 * @returns {Promise<*>} The server response.
 */
export function resetLayout() {
    return send('DELETE', '/api/config/layout');
}

/**
 * Saves the kiosk mode options. They replace the `kiosk` of config.yaml.
 * @param {Object} kiosk - The options.
 * @returns {Promise<*>} The server response.
 */
export function saveKiosk(kiosk) {
    return send('PUT', '/api/config/kiosk', kiosk);
}

/**
 * Lists the Home Assistant entities the kiosk options pick from.
 * @returns {Promise<Array<{entity_id: string, name: string, device_class?: string, unit?: string}>>} The entities.
 */
export async function listKioskEntities() {
    return (await send('GET', '/api/config/entities')).entities;
}

/**
 * Lists every Home Assistant entity, by id and name, for the entity pickers of the editors.
 * Only works while editing is on.
 * @returns {Promise<Array<{entity_id: string, name: string, device_class?: string, unit?: string}>>} The entities.
 */
export async function listEntities() {
    return (await send('GET', '/api/config/entities?all=1')).entities;
}

/**
 * Lists the plugins the server has set up, with the services each adds, those that failed, and
 * whether plugins can be installed from the settings window.
 * @returns {Promise<{version: string, plugins: Array<Object>, failed: Array<Object>, install: {allowed: boolean, reason: string|null, folder: string}}>}
 *   The plugins, in order.
 */
export function listServerPlugins() {
    return send('GET', '/api/plugins');
}

/**
 * @typedef {Object} PluginPreview
 * @property {string} preview - Pass it to installPlugin.
 * @property {boolean} upToDate - The installed version is already this release.
 * @property {{id: string, name: string, version: string, description?: string, glassboard: string, hasServer: boolean, hasClient: boolean}} plugin
 *   - What the plugin says about itself.
 * @property {{url: string, owner: string, description?: string, stars?: number, createdAt?: string, pushedAt?: string, archived?: boolean, isNew?: boolean}} repository
 *   - What GitHub says about its repository.
 * @property {{ref: string, kind: 'asset'|'tarball', commit: string|null, url?: string, publishedAt?: string, notes?: string}} release
 *   - The release or branch it comes from.
 * @property {string} sha256 - Hash of the download.
 * @property {{version?: string, ref?: string, commit?: string|null, url?: string}|null} installed - The installed version, if any.
 */

/**
 * Downloads and checks a plugin without installing it: from a GitHub repository, or the newest
 * release of an installed plugin. Only works with `plugins.install: true`.
 * @param {{source: string}|{id: string}} what - The repository, or the plugin to update.
 * @returns {Promise<PluginPreview>} What would be installed.
 */
export function previewPlugin(what) {
    return send('POST', '/api/plugins/preview', what);
}

/**
 * Installs the plugin a preview showed.
 * @param {string} preview - The preview's id.
 * @returns {Promise<{plugin: Object, updated: boolean, restartRecommended: boolean}>} What was installed.
 */
export function installPlugin(preview) {
    return send('POST', '/api/plugins/install', { preview });
}

/**
 * Removes a plugin from the plugins folder.
 * @param {string} id - The plugin.
 * @returns {Promise<{restartRecommended: boolean}>} Whether Glassboard should restart.
 */
export function removePlugin(id) {
    return send('POST', '/api/plugins/remove', { id });
}
