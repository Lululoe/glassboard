import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from './logger.js';

let CONFIG = {};
const configPath = path.resolve(process.cwd(), 'config.yaml');
const servicesPath = path.resolve(process.cwd(), 'services.yaml');
const themePath = path.resolve(process.cwd(), 'theme.yaml');
let configLoaded = false;

// Load Config
/**
 * Loads the configuration from config.yaml and services.yaml into memory.
 * Merges them into a single global CONFIG object.
 * Logs success or failure.
 */
/**
 * Performs a deep merge of a source object into a target object.
 * @param {Object} target - The target object.
 * @param {Object} source - The source object.
 * @returns {Object} The merged object.
 */
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
}

// Helper: Load Environment Config
function loadEnvConfig() {
    const envConfig = {};
    for (const key in process.env) {
        if (key.startsWith('SERVICES__')) {
            // Format: SERVICES__SECTION__KEY
            // Example: SERVICES__SONARR__URL -> services.sonarr.url
            const parts = key.split('__').slice(1).map(p => p.toLowerCase());
            let current = envConfig;

            let targetKey = 'services';
            if (!envConfig[targetKey]) envConfig[targetKey] = {};
            current = envConfig[targetKey];

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    current[part] = process.env[key];
                } else {
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
            }
        }
    }
    return envConfig;
}

/**
 * Reads and parses a YAML file safely, returning an empty object if it fails or is missing.
 * @param {string} filePath - Absolute path to the YAML file.
 * @returns {Object} Parsed configuration object.
 */
function readYamlSafe(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                const raw = fs.readFileSync(filePath, 'utf8');
                return yaml.load(raw) || {};
            } else {
                logger.warn(`Expected file at ${filePath} but found directory.`);
            }
        } catch (e) {
            logger.warn(`Error reading ${filePath}: ${e.message}`);
        }
    }
    return {};
}

// Load Config
/**
 * Loads the configuration from config.yaml and services.yaml into memory.
 * Merges them into a single global CONFIG object.
 * Logs success or failure.
 */
export function loadConfig() {
    try {
        let mainConfig = {};
        let servicesConfig = {};
        let envConfig = loadEnvConfig();

        // Load Main Config
        mainConfig = readYamlSafe(configPath);
        if (Object.keys(mainConfig).length === 0 && !fs.existsSync(configPath)) {
            logger.warn('config.yaml not found at', configPath);
        }

        // Load Services Config
        servicesConfig = readYamlSafe(servicesPath);

        // Load Themes Config
        let themeConfig = readYamlSafe(themePath);

        // Merge: Main + Services + Themes + Env
        // 1. Initial merge of main config and services
        CONFIG = { ...mainConfig, ...servicesConfig };

        // 2. Merge themes
        // We want to merge theme.yaml themes with config.yaml themes
        // If config.yaml has a theme with same ID, it merges/overrides the default one
        if (themeConfig.themes) {
            if (!CONFIG.themes) CONFIG.themes = [];

            // For each theme in theme.yaml
            themeConfig.themes.forEach(defaultTheme => {
                const existingIndex = CONFIG.themes.findIndex(t => t.id === defaultTheme.id);
                if (existingIndex >= 0) {
                    // Merge override over default
                    CONFIG.themes[existingIndex] = deepMerge(defaultTheme, CONFIG.themes[existingIndex]);
                } else {
                    // Add default theme
                    CONFIG.themes.push(defaultTheme);
                }
            });
        }

        // 3. Env overrides
        deepMerge(CONFIG, envConfig);

        // Only log on fresh load or meaningful reload, simple state tracking
        if (!configLoaded) {
            logger.info('Config loaded successfully (Main + Services + Env)');
            configLoaded = true;
        }
    } catch (e) {
        logger.warn('Could not load configuration:', e.message);
    }
}

// Watch Config
/**
 * Watches config.yaml and services.yaml for changes and reloads automatically.
 * Debounces the reload to prevent multiple triggers.
 */
export function watchConfig() {
    let reloadTimeout;
    const reload = () => {
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(() => {
            logger.info('Configuration changed, reloading...');
            loadConfig();
        }, 100);
    };

    if (fs.existsSync(configPath)) {
        fs.watch(configPath, (eventType) => {
            if (eventType === 'change') reload();
        });
        logger.info('Watching config.yaml for changes');
    }

    if (fs.existsSync(servicesPath)) {
        fs.watch(servicesPath, (eventType) => {
            if (eventType === 'change') reload();
        });
        logger.info('Watching services.yaml for changes');
    }

    if (fs.existsSync(themePath)) {
        fs.watch(themePath, (eventType) => {
            if (eventType === 'change') reload();
        });
        logger.info('Watching theme.yaml for changes');
    }
}

// Get Full Config (Sanitized)
/**
 * Returns a sanitized version of the configuration for frontend use.
 * Strips out API keys and sensitive service details.
 * @returns {Object} Sanitized configuration object
 */
export function getSanitizedConfig() {
    // Deep clone
    const sanitized = JSON.parse(JSON.stringify(CONFIG));
    // Remove secrets
    delete sanitized.services;
    if (Array.isArray(sanitized.pages)) {
        sanitized.pages.forEach(page => {
            if (Array.isArray(page.cards)) {
                page.cards.forEach(card => {
                    delete card.apiKey;
                    delete card.apikey;
                });
            }
        });
    }
    if (Array.isArray(sanitized.cards)) {
        sanitized.cards.forEach(card => {
            delete card.apiKey;
            delete card.apikey;
        });
    }
    return sanitized;
}

// Raw Config Access (for internal use)
/**
 * Returns the raw configuration object.
 * @returns {Object} Raw config object
 */
export function getConfig() {
    return CONFIG;
}

// Feature specific config getters
/**
 * recieves the transmission URL from env or config.
 * @returns {string} Transmission RPC URL
 */
export function getConfigTransmissionUrl() {
    if (process.env.TRANSMISSION_URL) return process.env.TRANSMISSION_URL;
    if (CONFIG.services?.transmission?.url) return CONFIG.services.transmission.url;
    const cards = getAllCards();
    const card = cards.find(c => c.type === 'transmission' && c.url);
    if (card) return card.url;
    return 'http://localhost:9091/transmission/rpc';
}

/**
 * recieves Sonarr URL and API Key from env or config.
 * @returns {Object} Object containing SONARR_URL and SONARR_API_KEY
 */
export function getConfigSonarr() {
    const result = {};
    if (process.env.SONARR_URL) result.SONARR_URL = process.env.SONARR_URL;
    else if (CONFIG.services?.sonarr?.url) result.SONARR_URL = CONFIG.services.sonarr.url;
    if (!result.SONARR_URL) {
        const cards = getAllCards();
        const card = cards.find(c => c.type === 'sonarr' && c.url);
        if (card) result.SONARR_URL = card.url;
    }

    if (process.env.SONARR_API_KEY) result.SONARR_API_KEY = process.env.SONARR_API_KEY;
    else if (CONFIG.services?.sonarr?.apiKey) result.SONARR_API_KEY = CONFIG.services.sonarr.apiKey;
    else if (CONFIG.services?.sonarr?.apikey) result.SONARR_API_KEY = CONFIG.services.sonarr.apikey;
    else {
        const cards = getAllCards();
        const card = cards.find(c => c.type === 'sonarr' && (c.apiKey || c.apikey));
        if (card) result.SONARR_API_KEY = card.apiKey || card.apikey;
    }
    return result;
}

/**
 * recieves Home Assistant URL and Token from env or config.
 * @returns {Object} Object containing HA_URL and HA_TOKEN
 */
export function getConfigHomeAssistant() {
    const result = {};
    if (process.env.HA_URL) result.HA_URL = process.env.HA_URL;
    else if (CONFIG.services?.homeassistant?.url) result.HA_URL = CONFIG.services.homeassistant.url;

    if (process.env.HA_TOKEN) result.HA_TOKEN = process.env.HA_TOKEN;
    else if (CONFIG.services?.homeassistant?.token) result.HA_TOKEN = CONFIG.services.homeassistant.token;

    return result;
}

/**
 * Helper to extract all cards from config (flattened).
 * @returns {Array<Object>} Array of all configured cards.
 */
function getAllCards() {
    if (Array.isArray(CONFIG.cards)) return CONFIG.cards;
    if (Array.isArray(CONFIG.pages)) {
        return CONFIG.pages.flatMap(p => p.cards || []);
    }
    return [];
}

/**
 * Extracts a Set of all valid entity IDs defined in the configuration.
 * Used for security validation of API requests.
 * @returns {Set<string>} Set of valid entity IDs
 */
export function getValidEntityIds() {
    const entityIds = new Set();
    const cards = getAllCards();

    cards.forEach(card => {
        if (card.type === 'hacontrol' && card.data && Array.isArray(card.data.entities)) {
            card.data.entities.forEach(entity => {
                if (entity.entity_id) entityIds.add(entity.entity_id);
            });
        } else if (card.type === 'weather' && card.entity_id) {
            entityIds.add(card.entity_id);
        }
    });

    return entityIds;
}

/**
 * Validates if a specific service call is authorized for a given entity.
 * Checks against the on_action/off_action definitions in the card config.
 * @param {string} entityId - The Entity ID
 * @param {string} service - The service to call (e.g. 'light.turn_on')
 * @returns {boolean} True if authorized
 */
export function validateEntityAction(entityId, service) {
    const cards = getAllCards();
    for (const card of cards) {
        if (card.type === 'hacontrol' && card.data && Array.isArray(card.data.entities)) {
            const entity = card.data.entities.find(e => e.entity_id === entityId);
            if (entity) {
                const onService = entity.on_action?.service;
                const offService = entity.off_action?.service;
                return service === onService || service === offService;
            }
        }
    }
    return false;
}

/**
 * Aggregates all Media services (Sonarr/Radarr) from config.
 * Supports both the new 'media' card type services list and legacy global/env config.
 * @returns {Array<{type: string, url: string, apiKey: string}>} List of media services
 */
export function getMediaServices() {
    const services = [];

    // 1. Check for specific 'media' card configuration
    const cards = getAllCards();
    const mediaCard = cards.find(c => c.type === 'media');
    if (mediaCard && Array.isArray(mediaCard.services)) {
        mediaCard.services.forEach(s => {
            if (s.type && s.url && (s.apiKey || s.apikey)) {
                services.push({
                    type: s.type.toLowerCase(), // sonarr or radarr
                    url: s.url,
                    apiKey: s.apiKey || s.apikey
                });
            }
        });
        // If card has services, we prioritize them and return
        if (services.length > 0) return services;
    }

    // 2. Fallback: Global Config & Backward Compatibility
    // Sonarr
    const sonarrVar = getConfigSonarr();
    if (sonarrVar.SONARR_URL && sonarrVar.SONARR_API_KEY) {
        services.push({ type: 'sonarr', url: sonarrVar.SONARR_URL, apiKey: sonarrVar.SONARR_API_KEY });
    }

    // Radarr environment support
    const radarrUrl = process.env.RADARR_URL || CONFIG.services?.radarr?.url;
    const radarrKey = process.env.RADARR_API_KEY || CONFIG.services?.radarr?.apiKey || CONFIG.services?.radarr?.apikey;

    if (radarrUrl && radarrKey) {
        services.push({ type: 'radarr', url: radarrUrl, apiKey: radarrKey });
    }

    return services;
}

/**
 * receives Glances URL from env or config.
 * @returns {string} Glances URL
 */
export function getConfigGlancesUrl() {
    if (process.env.GLANCES_URL) return process.env.GLANCES_URL;
    if (CONFIG.services?.glances?.url) return CONFIG.services.glances.url;
    return 'http://localhost:61208'; // Default Glances port
}

/**
 * receives Proxmox config from env or config.
 * @returns {Object} Object containing url, box (optional), tokenId, secret (or user/pass)
 */
export function getConfigProxmox() {
    const result = {
        url: process.env.PROXMOX_URL || CONFIG.services?.proxmox?.url,
        tokenId: process.env.PROXMOX_TOKEN_ID || CONFIG.services?.proxmox?.tokenId || CONFIG.services?.proxmox?.tokenid,
        secret: process.env.PROXMOX_SECRET || CONFIG.services?.proxmox?.secret,
        // Fallback or additional options if needed
        node: process.env.PROXMOX_NODE || CONFIG.services?.proxmox?.node || 'pve'
    };

    // Fallback URL from card if not in services?
    if (!result.url) {
        const cards = getAllCards();
        const card = cards.find(c => c.type === 'proxmox' && c.url);
        if (card) result.url = card.url;
    }

    return result;
}

/**
 * Recieves Git credentials from env or config.
 * Supports github, gitlab, gitea.
 */
export function getConfigGit() {
    return {
        github: {
            token: process.env.GITHUB_TOKEN || CONFIG.services?.github?.token || CONFIG.services?.git?.github?.token
        },
        gitlab: {
            token: process.env.GITLAB_TOKEN || CONFIG.services?.gitlab?.token || CONFIG.services?.git?.gitlab?.token,
            url: process.env.GITLAB_URL || CONFIG.services?.gitlab?.url || CONFIG.services?.git?.gitlab?.url
        },
        gitea: {
            token: process.env.GITEA_TOKEN || CONFIG.services?.gitea?.token || CONFIG.services?.git?.gitea?.token,
            url: process.env.GITEA_URL || CONFIG.services?.gitea?.url || CONFIG.services?.git?.gitea?.url
        }
    };
}
