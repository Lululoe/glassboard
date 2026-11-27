import { builtinServerPlugins } from '../plugins/builtin.js';
import { createPluginContext } from '../plugins/context.js';
import { createPluginHost } from '../plugins/host.js';
import { loadExternalPlugins, pluginsDir } from '../plugins/loader.js';
import logger from '../logger.js';

/**
 * Every server plugin: the ones built into Glassboard, then those in the plugins folder, set up
 * when the server starts. Plugins installed from the settings window are added while it runs.
 * A bad plugin is skipped; the dashboard starts without it and the settings window lists it.
 * To add a built-in service, implement a handler in this directory and add it to a plugin in
 * `server/plugins/builtin.js`.
 */
export const plugins = createPluginHost(createPluginContext, {
    onError: (id, err) => logger.error(`Plugin ${id} was not loaded: ${err.message}`),
});
plugins.add(builtinServerPlugins, { builtIn: true });
await loadExternalPlugins(plugins);
const external = plugins.plugins.filter(p => !p.builtIn);
if (external.length > 0) {
    // Plugins run with the server's access, including the credentials in services.yaml
    logger.warn(`Loaded plugins from ${pluginsDir()}: ${external.map(p => `${p.id} ${/** @type {Object} */ (p).version ?? ''}`.trim()).join(', ')}. Only install plugins you trust.`);
}

/**
 * Handlers for the `/api` endpoint, keyed by the `service` request parameter.
 * Each handler receives the merged query and body parameters and returns JSON-serializable data.
 * The object changes in place when plugins are installed or removed.
 * @type {Object<string, (params: Object) => Promise<*>>}
 */
export const serviceHandlers = plugins.services;

/**
 * Simulated handlers for demo mode, keyed like `serviceHandlers`.
 * @type {Object<string, (params: Object) => Promise<*>>}
 */
export const demoHandlers = plugins.demo;
