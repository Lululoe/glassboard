import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import * as sdk from '../sdk';
import { listServerPlugins } from '../lib/api';
// The built-in plugins register first, so a plugin can't take their card types
import '../features/registry';
import { getPluginFailures, loadPlugins, recordPluginFailure, setPluginsPending, unregisterPlugin } from './registry';

/**
 * @typedef {Object} ExternalPluginSummary
 * @property {string} id - The plugin.
 * @property {string} [name] - Its name.
 * @property {string|null} [client] - URL of its browser module.
 * @property {string|null} [style] - URL of its stylesheet.
 */

/**
 * Shares the modules plugins import (`react`, `react/jsx-runtime`, `react-dom` and
 * `@glassboard/sdk`) with them. The page's import map points those imports at small modules
 * the server writes, which hand on what is put here, so plugins run on the page's React.
 */
export function shareModules() {
    globalThis.__glassboard = {
        modules: {
            react: React,
            'react/jsx-runtime': jsxRuntime,
            'react-dom': ReactDOM,
            '@glassboard/sdk': sdk,
        },
    };
}

/**
 * Adds or replaces a plugin's stylesheet.
 * @param {string} id - The plugin.
 * @param {string|null|undefined} href - Its stylesheet, or nothing to remove it.
 */
function setStyle(id, href) {
    document.querySelectorAll('link[data-glassboard-plugin]').forEach((link) => {
        if (link.getAttribute('data-glassboard-plugin') === id) link.remove();
    });
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-glassboard-plugin', id);
    document.head.appendChild(link);
}

/**
 * Loads the browser part of a plugin from the plugins folder: its stylesheet and its module,
 * whose default export is the plugin. A plugin that fails is listed in the settings window.
 * @param {ExternalPluginSummary} summary - The plugin, as the server lists it.
 * @param {Object} [options]
 * @param {boolean} [options.replace=false] - Replace a loaded version, as after an update.
 * @returns {Promise<boolean>} Whether it loaded.
 */
export async function loadExternalPlugin(summary, { replace = false } = {}) {
    const { id } = summary;
    setStyle(id, summary.style);
    if (!summary.client) return true;

    let mod;
    try {
        mod = await import(/* @vite-ignore */ summary.client);
    } catch (err) {
        recordPluginFailure(id, `Its browser file could not be loaded: ${err instanceof Error ? err.message : err}`, summary.name);
        return false;
    }
    const plugin = mod.default ?? mod.plugin;
    if (!plugin || typeof plugin !== 'object' || plugin.id !== id) {
        recordPluginFailure(id, `Its browser file must export a plugin with the id ${id} as default`, summary.name);
        return false;
    }
    loadPlugins([{ name: summary.name, ...plugin }], { replace });
    return !getPluginFailures().some(f => f.id === id);
}

/**
 * Takes a removed plugin's cards and stylesheet off the page.
 * @param {string} id - The plugin.
 */
export function unloadExternalPlugin(id) {
    unregisterPlugin(id);
    setStyle(id, null);
}

/**
 * Loads every plugin from the plugins folder that has a browser part. Until they have loaded,
 * cards of types not known yet wait instead of saying their plugin isn't installed.
 * @returns {Promise<void>}
 */
export async function loadExternalPlugins() {
    setPluginsPending(true);
    try {
        const { plugins } = await listServerPlugins();
        await Promise.all(plugins.filter(p => p.external && (p.client || p.style)).map(p => loadExternalPlugin(p)));
    } catch (err) {
        console.error('Plugins could not be loaded:', err);
    } finally {
        setPluginsPending(false);
    }
}
