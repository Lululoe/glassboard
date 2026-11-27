import { useSyncExternalStore } from 'react';

/**
 * The card types the dashboard knows, filled by plugins. Every card, built in or not, is
 * registered the same way: a plugin's `register` function receives the plugin API and calls
 * `registerCard` for each card type it adds.
 *
 * Built-in cards are registered when `src/features/registry.js` is first imported. Later on
 * plugins may be loaded at runtime, so components that list card types read them with
 * `useCardTypes`, which updates when a card type is added.
 */

/**
 * @typedef {Object} CardDefinition
 * @property {import('react').ComponentType<{config: Object, globalConfig: Object}>} Component - The card.
 * @property {string} name - Name shown when adding a card.
 * @property {string} description - One line about what the card shows.
 * @property {string} icon - Icon for the add-card list (`lu-` Lucide name or `mdi:` name).
 * @property {string[]} [sizes] - Sizes edit mode offers, from `quarter`, `half`, `1`, `2`, `3`
 *   (columns). Defaults to `1`, `2` and `3`. A size set in config.yaml is always rendered.
 * @property {Object} [defaults] - Properties of a newly added card, besides `id` and `type`.
 * @property {import('react').ComponentType<{config: Object, onChange: (config: Object) => void, globalConfig?: Object}>} [Editor]
 *   - Settings form shown in the card editor. Without one the card is edited as YAML only.
 * @property {boolean} [rows] - The card can be more than one row tall (`rowSpan`, 1 to 3). Its height is
 *   then set in the Layout tab and by dragging the resize handle down.
 * @property {boolean} [headerIcon] - The card has a header whose icon reads `icon`, `iconColor`
 *   and `iconBackground`. The card editor then shows the real card and edits that icon.
 * @property {{Stage: import('react').ComponentType<Object>, Inspector: import('react').ComponentType<Object>, split?: boolean}} [stage]
 *   - Arranges the card's own items directly on it, with the settings of the selected one.
 */

/**
 * @typedef {Omit<CardDefinition, 'Component'> & {plugin: string}} CardInfo
 *   What edit mode knows about a card type, and the plugin that added it.
 */

/**
 * @typedef {Object} PluginApi
 * @property {(type: string, definition: CardDefinition) => void} registerCard - Adds a card type.
 */

/**
 * @typedef {Object} GlassboardPlugin
 * @property {string} id - Unique id, lowercase letters, digits and dashes.
 * @property {string} name - Name of the plugin.
 * @property {(api: PluginApi) => void} register - Registers the plugin's cards.
 */

const TYPE = /^[a-z][a-z0-9_-]*$/;
const PLUGIN_ID = /^[a-z][a-z0-9-]*$/;

/** @type {Map<string, {Component: CardDefinition['Component'], info: CardInfo}>} */
const cards = new Map();
/** @type {Map<string, GlassboardPlugin>} */
const plugins = new Map();
const listeners = new Set();
/** Plugins that come with Glassboard. */
const builtIn = new Set();
/** @type {Object<string, CardInfo>} */
let snapshot = {};
/** @type {PluginInfo[]} */
let pluginSnapshot = [];
/** Whether plugins from the plugins folder are still loading. */
let pending = false;

/**
 * Plugins that failed to register, by id, and why.
 * @type {Map<string, PluginFailure>}
 */
const failures = new Map();
/** @type {PluginFailure[]} */
let failureSnapshot = [];

/**
 * @typedef {Object} PluginFailure
 * @property {string} id - The plugin's id, or `(no id)`.
 * @property {string} [name] - Its name, if it has one.
 * @property {string} error - Why it wasn't loaded.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 */

/**
 * Lists a plugin that couldn't be loaded at all, such as one whose file failed to import.
 * @param {string} id - The plugin.
 * @param {string} error - Why.
 * @param {string} [name] - Its name.
 */
export function recordPluginFailure(id, error, name) {
    failures.set(id, { id, name, error, builtIn: false });
    changed();
}

/**
 * Takes a plugin and its card types away, as when it is removed in the settings window.
 * Cards of those types then show that their plugin isn't installed.
 * @param {string} id - The plugin.
 * @returns {boolean} Whether it was registered or had failed.
 */
export function unregisterPlugin(id) {
    if (builtIn.has(id)) return false;
    const known = plugins.has(id) || failures.has(id);
    [...cards].filter(([, card]) => card.info.plugin === id).forEach(([type]) => cards.delete(type));
    plugins.delete(id);
    failures.delete(id);
    changed();
    return known;
}

/**
 * Says whether plugins from the plugins folder are still loading. Until they are, a card
 * whose type isn't known yet waits instead of saying its plugin isn't installed.
 * @param {boolean} value - Whether they are loading.
 */
export function setPluginsPending(value) {
    if (pending === value) return;
    pending = value;
    changed();
}

/**
 * Whether plugins from the plugins folder are still loading.
 * @returns {boolean} True while they load.
 */
export const getPluginsPending = () => pending;

/**
 * Whether plugins from the plugins folder are still loading, updated when they finish.
 * @returns {boolean} True while they load.
 */
export function usePluginsPending() {
    return useSyncExternalStore(subscribe, getPluginsPending);
}

/**
 * @typedef {Object} PluginInfo
 * @property {string} id - The plugin's id.
 * @property {string} name - Its name.
 * @property {string[]} cards - The card types it registered, in order.
 * @property {boolean} builtIn - Whether it comes with Glassboard.
 */

function changed() {
    snapshot = Object.fromEntries([...cards].map(([type, card]) => [type, card.info]));
    pluginSnapshot = [...plugins.values()].map(plugin => ({
        id: plugin.id,
        name: plugin.name || plugin.id,
        cards: [...cards].filter(([, card]) => card.info.plugin === plugin.id).map(([type]) => type),
        builtIn: builtIn.has(plugin.id),
    }));
    failureSnapshot = [...failures.values()];
    listeners.forEach(listener => listener());
}

/**
 * Adds a card type for a plugin.
 * @param {string} pluginId - The plugin adding it.
 * @param {string} type - Card type used in config.yaml, lowercase.
 * @param {CardDefinition} definition - The card and how edit mode shows it.
 */
function registerCard(pluginId, type, definition) {
    if (typeof type !== 'string' || !TYPE.test(type)) {
        throw new Error(`Plugin ${pluginId}: card type "${type}" must be lowercase letters, digits, - or _`);
    }
    if (cards.has(type)) {
        throw new Error(`Plugin ${pluginId}: card type "${type}" is already registered by ${cards.get(type).info.plugin}`);
    }
    if (!definition || typeof definition !== 'object') throw new Error(`Plugin ${pluginId}: card type "${type}" has no definition`);
    const { Component, ...info } = definition;
    if (!Component || (typeof Component !== 'function' && typeof Component !== 'object')) {
        throw new Error(`Plugin ${pluginId}: card type "${type}" has no Component`);
    }
    if (!info.name || !info.icon) throw new Error(`Plugin ${pluginId}: card type "${type}" needs a name and an icon`);
    cards.set(type, { Component, info: { ...info, plugin: pluginId } });
}

/**
 * Registers a plugin and the card types it adds. A plugin whose cards can't be registered
 * adds none of them.
 * @param {GlassboardPlugin} plugin - The plugin.
 * @param {Object} [options]
 * @param {boolean} [options.replace=false] - Replace a plugin with the same id and its card
 *   types instead of failing, as when hot module reloading runs the registration again.
 * @param {boolean} [options.builtIn=false] - The plugin comes with Glassboard.
 */
export function registerPlugin(plugin, { replace = false, builtIn: isBuiltIn = false } = {}) {
    const id = plugin?.id;
    if (typeof id !== 'string' || !PLUGIN_ID.test(id)) throw new Error(`Invalid plugin id: ${id}`);
    if (plugins.has(id) && !replace) throw new Error(`Plugin ${id} is already registered`);
    if (typeof plugin.register !== 'function') throw new Error(`Plugin ${id} has no register function`);

    const previous = [...cards].filter(([, card]) => card.info.plugin === id);
    previous.forEach(([type]) => cards.delete(type));
    const added = [];
    try {
        plugin.register({
            registerCard: (type, definition) => {
                registerCard(id, type, definition);
                added.push(type);
            },
        });
    } catch (err) {
        added.forEach(type => cards.delete(type));
        previous.forEach(([type, card]) => cards.set(type, card));
        throw err;
    }
    plugins.set(id, plugin);
    failures.delete(id);
    if (isBuiltIn) builtIn.add(id);
    else builtIn.delete(id);
    changed();
}

/**
 * Registers plugins, skipping any that fail: a bad plugin is logged and listed by
 * `getPluginFailures` instead of stopping the dashboard, and adds none of its cards.
 * @param {GlassboardPlugin[]} list - The plugins, in order.
 * @param {Object} [options] - As for `registerPlugin`.
 * @param {boolean} [options.replace]
 * @param {boolean} [options.builtIn]
 */
export function loadPlugins(list, options = {}) {
    const seen = new Set();
    list.forEach((plugin) => {
        try {
            // Replacing is for hot reloading; two plugins in one list with the same id still clash
            if (seen.has(plugin?.id)) throw new Error(`Plugin ${plugin.id} is already registered`);
            seen.add(plugin?.id);
            registerPlugin(plugin, options);
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            const id = typeof plugin?.id === 'string' && plugin.id ? plugin.id : '(no id)';
            console.error(`Plugin ${id} was not loaded: ${error}`);
            // A plugin that reuses the id of a loaded one is listed apart from it
            const key = plugins.has(id) ? `${id} (duplicate)` : id;
            failures.set(key, { id: key, name: typeof plugin?.name === 'string' ? plugin.name : undefined, error, builtIn: Boolean(options.builtIn) });
            changed();
        }
    });
}

/**
 * Plugins that failed to register, and why.
 * @returns {PluginFailure[]} The failures, in order. The list is replaced when it changes.
 */
export function getPluginFailures() {
    return failureSnapshot;
}

/**
 * Plugins that failed to register, updated when one fails.
 * @returns {PluginFailure[]} The failures, in order.
 */
export function usePluginFailures() {
    return useSyncExternalStore(subscribe, getPluginFailures);
}

/**
 * Normalizes a card type from the config.
 * @param {*} type - Card type from the config (case-insensitive).
 * @returns {string} The lowercase type.
 */
const keyOf = (type) => String(type || '').toLowerCase();

/**
 * Returns what edit mode knows about a card type.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {CardInfo|undefined} The type's info, or undefined for unknown types.
 */
export function getCardInfo(type) {
    return cards.get(keyOf(type))?.info;
}

/**
 * Returns the sizes a card type supports in edit mode.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {string[]|undefined} Supported sizes, or undefined for the default set.
 */
export function getCardSizes(type) {
    return getCardInfo(type)?.sizes;
}

/**
 * Looks up the component for a card type.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {CardDefinition['Component']|null} The card component, or null if unknown.
 */
export function getCardComponent(type) {
    return cards.get(keyOf(type))?.Component ?? null;
}

/**
 * Returns every registered card type with its info, in the order they were registered.
 * @returns {Object<string, CardInfo>} Card info keyed by type. The object is replaced when a
 *   card type is added, so it can be compared by identity.
 */
export function getCardTypes() {
    return snapshot;
}

/**
 * Calls a listener whenever card types are added.
 * @param {() => void} listener - Called after a change.
 * @returns {() => void} Removes the listener.
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Every registered card type with its info, updated when a plugin adds card types.
 * @returns {Object<string, CardInfo>} Card info keyed by type.
 */
export function useCardTypes() {
    return useSyncExternalStore(subscribe, getCardTypes);
}

/**
 * The ids of the registered plugins.
 * @returns {string[]} Plugin ids, in the order they were registered.
 */
export function getPluginIds() {
    return [...plugins.keys()];
}

/**
 * The registered plugins with their card types.
 * @returns {PluginInfo[]} The plugins, in the order they were registered. The list is replaced
 *   when a plugin is added, so it can be compared by identity.
 */
export function getPlugins() {
    return pluginSnapshot;
}

/**
 * The registered plugins with their card types, updated when a plugin is added.
 * @returns {PluginInfo[]} The plugins, in the order they were registered.
 */
export function usePlugins() {
    return useSyncExternalStore(subscribe, getPlugins);
}
