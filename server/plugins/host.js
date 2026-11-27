import express from 'express';
import { PLUGIN_ID } from './manifest.js';

/**
 * @typedef {(params: Object) => (Promise<*>|*)} ServiceHandler
 *   Answers a POST to `/api` with `{ service: <name>, ... }`. Receives the request body and
 *   returns JSON-serializable data; throws `HttpError` for errors the client should see.
 */

/**
 * @typedef {Object} PluginSetup
 * @property {Object<string, ServiceHandler>} [services] - Services the plugin adds, by name.
 * @property {Object<string, ServiceHandler>} [demo] - Simulated versions of those services for
 *   demo mode, by the same names. A service without one answers 503 in demo mode.
 * @property {(router: import('express').Router) => void} [routes] - Adds routes under
 *   `/api/plugins/<id>/`, for what a JSON service can't answer, such as images.
 */

/**
 * @typedef {Object} ServerPlugin
 * @property {string} id - Unique id, lowercase letters, digits and dashes; the same as the id
 *   of the plugin's cards in the frontend.
 * @property {(ctx: import('./context.js').PluginContext) => (PluginSetup|void)} setup - Sets the plugin up.
 * @property {Object} [meta] - What the plugins list says about it besides its services, such as
 *   the name, version and browser files of a plugin from the plugins folder.
 */

/**
 * @typedef {Object} PluginSummary
 * @property {string} id - The plugin.
 * @property {string[]} services - The services it adds.
 * @property {boolean} routes - Whether it adds routes under `/api/plugins/<id>/`.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 * Plugins from the plugins folder also have the fields of their `meta`.
 */

/**
 * @typedef {Object} PluginFailure
 * @property {string} id - The plugin, or `(no id)`.
 * @property {string} error - Why it was skipped.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 * Plugins from the plugins folder also have the fields of their `meta`.
 */

/**
 * @typedef {Object} PluginHost
 * @property {string[]} ids - The plugins that were set up.
 * @property {PluginSummary[]} plugins - What each of them adds, in order.
 * @property {PluginFailure[]} failed - Plugins that were skipped, and why.
 * @property {Object<string, ServiceHandler>} services - Every plugin's services.
 * @property {Object<string, ServiceHandler>} demo - Every plugin's demo services.
 * @property {Array<{id: string, router: import('express').Router}>} routers - Plugin routes.
 * @property {(plugins: ServerPlugin[], options?: {builtIn?: boolean}) => void} add - Sets more plugins up.
 * @property {(id: string) => boolean} remove - Takes a plugin and everything it added away, or
 *   forgets why it failed. Returns whether there was such a plugin.
 * @property {(id: string) => (PluginFailure|PluginSummary|undefined)} find - A plugin or failure by id.
 * @property {(id: string, error: Error, meta?: Object) => void} fail - Lists a plugin that couldn't
 *   even be read, such as one with a broken manifest.
 *
 * The lists and maps are changed in place, so code that holds them sees plugins added later.
 */

const SERVICE = /^[a-z][a-z0-9_-]*$/;

/**
 * Makes a handler always return a promise, so one that throws synchronously is still caught
 * by the API route.
 * @param {ServiceHandler} handler - The plugin's handler.
 * @returns {(params: Object) => Promise<*>} The same handler, async.
 */
const asAsync = (handler) => async (params) => handler(params);

/**
 * Checks a plugin's services or demo services.
 * @param {string} id - The plugin.
 * @param {string} kind - `services` or `demo`, for the error message.
 * @param {*} map - What its setup returned for them.
 * @returns {Array<[string, ServiceHandler]>} The entries.
 */
function entriesOf(id, kind, map) {
    if (map === undefined) return [];
    if (!map || typeof map !== 'object') throw new Error(`Plugin ${id}: ${kind} must be an object`);
    return Object.entries(map).map(([name, handler]) => {
        if (!SERVICE.test(name)) throw new Error(`Plugin ${id}: service name "${name}" must be lowercase letters, digits, - or _`);
        if (typeof handler !== 'function') throw new Error(`Plugin ${id}: ${kind}.${name} is not a function`);
        return [name, handler];
    });
}

/**
 * Removes the items of a list that match, in place.
 * @template T
 * @param {T[]} list - The list.
 * @param {(item: T) => boolean} match - Which items to remove.
 */
const removeWhere = (list, match) => {
    for (let i = list.length - 1; i >= 0; i -= 1) if (match(list[i])) list.splice(i, 1);
};

/**
 * Creates the registry of server plugins. A plugin that fails, by throwing in `setup` or
 * returning something invalid, is skipped and listed in `failed`, so a bad plugin never stops
 * the server from starting. It is checked completely before any of its services are added, and
 * what it registered through its context is undone, so it adds nothing.
 * @param {(id: string) => import('./context.js').PluginContext} createContext - The API each plugin receives.
 * @param {Object} [options]
 * @param {(id: string, error: Error) => void} [options.onError] - Called for each plugin that fails, to log it.
 * @returns {PluginHost} The registry, without plugins.
 */
export function createPluginHost(createContext, { onError } = {}) {
    /** @type {Object<string, string>} Service name to the plugin that adds it */
    const owners = {};
    /** @type {Map<string, import('./context.js').PluginContext>} */
    const contexts = new Map();

    /** @type {PluginHost} */
    const host = {
        ids: [],
        plugins: [],
        failed: [],
        services: {},
        demo: {},
        routers: [],
        add,
        remove,
        find: id => host.plugins.find(p => p.id === id) ?? host.failed.find(f => f.id === id),
        fail,
    };

    /**
     * Lists a plugin that couldn't be read.
     * @param {string} id - The plugin, or the name of its folder.
     * @param {Error} error - Why.
     * @param {Object} [meta] - What is known about it.
     */
    function fail(id, error, meta = {}) {
        removeWhere(host.failed, f => f.id === id);
        host.failed.push({ ...meta, id, error: error.message, builtIn: false });
        onError?.(id, error);
    }

    /**
     * Sets one plugin up.
     * @param {ServerPlugin} plugin - The plugin.
     * @param {boolean} builtIn - Whether it comes with Glassboard.
     */
    function addOne(plugin, builtIn) {
        const id = plugin?.id;
        const meta = plugin?.meta && typeof plugin.meta === 'object' ? plugin.meta : {};
        let ctx = null;
        try {
            if (typeof id !== 'string' || !PLUGIN_ID.test(id)) throw new Error(`Invalid plugin id: ${id}`);
            if (host.ids.includes(id)) throw new Error(`Plugin ${id} is already set up`);
            if (typeof plugin.setup !== 'function') throw new Error(`Plugin ${id} has no setup function`);

            ctx = createContext(id);
            const result = /** @type {PluginSetup & {then?: Function}} */ (plugin.setup(ctx) || {});
            if (typeof result.then === 'function') {
                // An async setup would add its services after the server answers requests
                Promise.resolve(result).catch(() => {});
                throw new Error(`Plugin ${id}: setup must return its services, not a promise`);
            }
            const services = entriesOf(id, 'services', result.services);
            const demo = entriesOf(id, 'demo', result.demo);
            services.forEach(([name]) => {
                if (owners[name]) throw new Error(`Plugin ${id}: service "${name}" is already added by ${owners[name]}`);
            });
            demo.forEach(([name]) => {
                if (!services.some(([own]) => own === name)) throw new Error(`Plugin ${id}: demo.${name} has no service of that name`);
            });
            let router = null;
            if (result.routes !== undefined) {
                if (typeof result.routes !== 'function') throw new Error(`Plugin ${id}: routes must be a function`);
                router = express.Router();
                result.routes(router);
            }

            removeWhere(host.failed, f => f.id === id);
            host.ids.push(id);
            host.plugins.push({ ...meta, id, services: services.map(([name]) => name), routes: Boolean(router), builtIn });
            contexts.set(id, ctx);
            services.forEach(([name, handler]) => {
                owners[name] = id;
                host.services[name] = asAsync(handler);
            });
            demo.forEach(([name, handler]) => { host.demo[name] = asAsync(handler); });
            if (router) host.routers.push({ id, router });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            ctx?.dispose?.();
            const failedId = typeof id === 'string' && id ? id : '(no id)';
            if (!host.ids.includes(failedId)) removeWhere(host.failed, f => f.id === failedId);
            host.failed.push({ ...meta, id: failedId, error: error.message, builtIn });
            onError?.(String(id), error);
        }
    }

    /**
     * Sets plugins up, in order.
     * @param {ServerPlugin[]} plugins - The plugins.
     * @param {{builtIn?: boolean}} [options] - `builtIn`: the plugins come with Glassboard.
     */
    function add(plugins, { builtIn = false } = {}) {
        plugins.forEach(plugin => addOne(plugin, builtIn));
    }

    /**
     * Takes a plugin and everything it added away, or forgets why it failed.
     * @param {string} id - The plugin.
     * @returns {boolean} Whether there was such a plugin.
     */
    function remove(id) {
        const known = host.ids.includes(id) || host.failed.some(f => f.id === id);
        Object.entries(owners).forEach(([name, owner]) => {
            if (owner !== id) return;
            delete owners[name];
            delete host.services[name];
            delete host.demo[name];
        });
        contexts.get(id)?.dispose?.();
        contexts.delete(id);
        removeWhere(host.ids, other => other === id);
        removeWhere(host.plugins, p => p.id === id);
        removeWhere(host.routers, r => r.id === id);
        removeWhere(host.failed, f => f.id === id);
        return known;
    }

    return host;
}

/**
 * Sets plugins up and collects what they add, as `createPluginHost` and `add` do.
 * @param {ServerPlugin[]} plugins - The plugins, in order.
 * @param {(id: string) => import('./context.js').PluginContext} createContext - The API each plugin receives.
 * @param {Object} [options]
 * @param {(id: string, error: Error) => void} [options.onError] - Called for each plugin that fails, to log it.
 * @param {boolean} [options.builtIn=false] - The plugins come with Glassboard.
 * @returns {PluginHost} What the plugins add, and those that failed.
 */
export function setupPlugins(plugins, createContext, { onError, builtIn = false } = {}) {
    const host = createPluginHost(createContext, { onError });
    host.add(plugins, { builtIn });
    return host;
}
