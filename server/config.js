import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';
import { validateConfig } from './configSchema.js';
import { applyLayout, getLayoutPath, readLayout } from './layout.js';

const configPath = path.resolve(process.cwd(), 'config.yaml');
const servicesPath = path.resolve(process.cwd(), 'services.yaml');
const themePath = path.resolve(process.cwd(), 'theme.yaml');
const defaultThemePath = path.resolve(process.cwd(), 'theme.example.yaml');

const SECRET_KEY = /^(api_?key|token|secret|token_?secret|token_?id|password|username)$/i;

let CONFIG = {};
let BASE_CONFIG = {};
let version = 0;
const listeners = new Set();

/**
 * Returns `true` for plain objects (not arrays, null or class instances).
 * @param {*} value - Value to test.
 * @returns {boolean} Whether the value is a plain object.
 */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merges `override` over `base` without mutating either argument.
 * Arrays and scalars in `override` replace the base value.
 * @param {Object} base - Base object.
 * @param {Object} override - Values that take precedence.
 * @returns {Object} A new merged object.
 */
export function deepMerge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override || {})) {
        result[key] = isPlainObject(value) && isPlainObject(base?.[key])
            ? deepMerge(base[key], value)
            : value;
    }
    return result;
}

/**
 * Builds a `services` config tree from `SERVICES__SECTION__KEY` environment variables.
 * Keys are lowercased, e.g. `SERVICES__SONARR__URL` becomes `services.sonarr.url`.
 * @returns {Object} Config fragment containing only `services`, or an empty object.
 */
function loadEnvConfig() {
    const services = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (!key.startsWith('SERVICES__')) continue;
        const parts = key.split('__').slice(1).map(p => p.toLowerCase());
        let current = services;
        parts.slice(0, -1).forEach(part => {
            if (!isPlainObject(current[part])) current[part] = {};
            current = current[part];
        });
        current[parts[parts.length - 1]] = value;
    }
    return Object.keys(services).length > 0 ? { services } : {};
}

/**
 * Reads and parses a YAML file, returning an empty object if it is missing or invalid.
 * @param {string} filePath - Absolute path to the YAML file.
 * @returns {Object} Parsed configuration object.
 */
function readYamlSafe(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        if (!fs.statSync(filePath).isFile()) {
            logger.warn(`Expected file at ${filePath} but found a directory.`);
            return {};
        }
        return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
    } catch (e) {
        logger.warn(`Error reading ${filePath}: ${e.message}`);
        return {};
    }
}

/**
 * Merges default themes from theme.yaml (or the bundled theme.example.yaml) with
 * theme overrides from config.yaml, matching themes by id.
 * @param {Array<Object>} defaults - Themes from the theme file.
 * @param {Array<Object>} overrides - Themes from config.yaml.
 * @returns {Array<Object>} Merged theme list.
 */
function mergeThemes(defaults = [], overrides = []) {
    const merged = defaults.map(theme => {
        const override = overrides.find(t => t.id === theme.id);
        return override ? deepMerge(theme, override) : theme;
    });
    overrides.forEach(theme => {
        if (!defaults.some(t => t.id === theme.id)) merged.push(theme);
    });
    return merged;
}

/**
 * Loads config.yaml, services.yaml, the theme file, `SERVICES__*` environment variables
 * and the layout.yaml overlay into the in-memory config, validates it and notifies
 * change listeners.
 */
export function loadConfig() {
    if (!fs.existsSync(configPath)) {
        logger.warn(`config.yaml not found at ${configPath}`);
    }

    const mainConfig = readYamlSafe(configPath);
    const servicesConfig = readYamlSafe(servicesPath);
    const themeConfig = readYamlSafe(fs.existsSync(themePath) ? themePath : defaultThemePath);

    let merged = deepMerge(mainConfig, servicesConfig);
    merged.themes = mergeThemes(themeConfig.themes, mainConfig.themes);
    merged = deepMerge(merged, loadEnvConfig());
    BASE_CONFIG = merged;
    merged = applyLayout(merged, readLayout());

    validateConfig(merged).forEach(problem => logger.warn(`Config: ${problem}`));

    CONFIG = merged;
    version += 1;
    if (version === 1) {
        logger.info('Config loaded');
    } else {
        logger.info('Config reloaded');
        listeners.forEach(listener => listener(version));
    }
}

/**
 * Polls the config files for changes and reloads automatically.
 * Polling (rather than fs.watch) survives editors that save by replacing the file,
 * files created after startup and Docker bind mounts.
 */
export function watchConfig() {
    let reloadTimeout;
    const onChange = (curr, prev) => {
        if (curr.mtimeMs === prev.mtimeMs) return;
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(loadConfig, 100);
    };
    [configPath, servicesPath, themePath, getLayoutPath()].forEach(p => fs.watchFile(p, { interval: 1000 }, onChange));
    logger.info('Watching config files for changes');
}

/**
 * Registers a callback invoked after each config reload.
 * @param {(version: number) => void} listener - Called with the new config version.
 * @returns {() => void} Function that unregisters the listener.
 */
export function onConfigChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Returns a number that increases every time the config is reloaded.
 * @returns {number} Current config version.
 */
export function getConfigVersion() {
    return version;
}

/**
 * Recursively removes keys that look like credentials.
 * @param {*} value - Value to clean.
 * @returns {*} A copy of the value without secret-like keys.
 */
function stripSecrets(value) {
    if (Array.isArray(value)) return value.map(stripSecrets);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !SECRET_KEY.test(key))
            .map(([key, v]) => [key, stripSecrets(v)])
    );
}

/**
 * Returns the configuration for the frontend: the `services` section is removed and
 * credential-like keys (apiKey, token, secret, password, ...) are stripped at any depth.
 * @returns {Object} Sanitized configuration object.
 */
export function getSanitizedConfig() {
    const { services: _services, ...rest } = CONFIG;
    return stripSecrets(rest);
}

/**
 * Puts back credential-like keys the browser never received: wherever `original` has a
 * secret key that `edited` lacks, the original value is copied over. Objects are matched by
 * key and arrays by position.
 * @param {*} edited - Value sent by the browser.
 * @param {*} original - The same value as stored on the server.
 * @returns {*} The edited value with secrets restored.
 */
export function restoreSecrets(edited, original) {
    if (Array.isArray(edited) && Array.isArray(original)) {
        return edited.map((v, i) => restoreSecrets(v, original[i]));
    }
    if (!isPlainObject(edited) || !isPlainObject(original)) return edited;
    const result = { ...edited };
    Object.entries(original).forEach(([key, value]) => {
        if (SECRET_KEY.test(key) && !Object.hasOwn(edited, key)) result[key] = value;
        else if (Object.hasOwn(edited, key)) result[key] = restoreSecrets(edited[key], value);
    });
    return result;
}

/**
 * Returns the configuration before the layout.yaml overlay is applied (server-side use only).
 * @returns {Object} The config as written in the config files.
 */
export function getBaseConfig() {
    return BASE_CONFIG;
}

/**
 * Returns the raw configuration object (server-side use only).
 * @returns {Object} Raw config object.
 */
export function getConfig() {
    return CONFIG;
}

/**
 * Replaces the in-memory configuration. Intended for tests.
 * @param {Object} config - The configuration to use.
 * @param {Object} [base] - The configuration before the layout overlay; defaults to `config`.
 */
export function setConfig(config, base = config) {
    CONFIG = config;
    BASE_CONFIG = base;
}

/**
 * Returns every card in the configuration, flattened across pages.
 * @returns {Array<Object>} All configured cards.
 */
export function getAllCards() {
    if (Array.isArray(CONFIG.pages)) return CONFIG.pages.flatMap(p => p.cards || []);
    if (Array.isArray(CONFIG.cards)) return CONFIG.cards;
    return [];
}

/**
 * Finds a configured card by id.
 * @param {string|number} id - The card id.
 * @returns {Object|undefined} The card config, if found.
 */
export function findCard(id) {
    return getAllCards().find(card => String(card.id) === String(id));
}

/**
 * Looks up a key in an object case-insensitively, trying each candidate name in order.
 * @param {Object} obj - Object to search.
 * @param {string[]} names - Candidate key names.
 * @returns {*} The first non-empty value found, or undefined.
 */
function findValue(obj, names) {
    if (!isPlainObject(obj)) return undefined;
    for (const name of names) {
        const key = Object.keys(obj).find(k => k.toLowerCase() === name.toLowerCase());
        if (key !== undefined && obj[key] !== '' && obj[key] != null) return obj[key];
    }
    return undefined;
}

/**
 * @typedef {Object} FieldSpec
 * @property {string[]} [env] - Environment variables checked first, in order.
 * @property {string[]} [aliases] - Alternative key names accepted in services.yaml.
 * @property {*} [default] - Value used when nothing else is set.
 */

/**
 * Resolves a service's settings. Each field is taken from, in order: its environment
 * variables, the `services` section (case-insensitive, aliases allowed), the first card
 * of `cardType` (when given), then its default.
 * @param {string|string[]} sectionPath - Dotted path(s) under `services`, e.g. 'sonarr' or
 *   ['git.github', 'github']. The first path that exists is used.
 * @param {Object<string, FieldSpec>} fields - Fields to resolve.
 * @param {Object} [options]
 * @param {string} [options.cardType] - Card type whose config is used as a fallback.
 * @returns {Object<string, *>} Resolved settings keyed by field name.
 */
export function getServiceConfig(sectionPath, fields, { cardType } = {}) {
    const paths = Array.isArray(sectionPath) ? sectionPath : [sectionPath];
    const section = paths
        .map(p => p.split('.').reduce((obj, key) => findValue(obj, [key]), CONFIG.services))
        .find(isPlainObject) || {};
    const card = cardType ? getAllCards().find(c => c.type === cardType) : undefined;

    const result = {};
    for (const [field, spec] of Object.entries(fields)) {
        const names = [field, ...(spec.aliases || [])];
        result[field] = (spec.env || []).map(name => process.env[name]).find(Boolean)
            ?? findValue(section, names)
            ?? findValue(card, names)
            ?? spec.default;
    }
    return result;
}
