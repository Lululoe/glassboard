import { getAllCards, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';
import { createHaSocket } from './haSocket.js';

/**
 * Resolves Home Assistant connection settings.
 * @returns {{url: string, token: string}} Base URL (without trailing slash) and access token.
 * @throws {HttpError} 503 when Home Assistant is not configured.
 */
function getHaConfig() {
    const { url, token } = getServiceConfig('homeassistant', {
        url: { env: ['HA_URL'] },
        token: { env: ['HA_TOKEN'] },
    });
    if (!url || !token) throw new HttpError(503, 'Home Assistant not configured');
    return { url: url.replace(/\/$/, ''), token };
}

/**
 * Calls the Home Assistant REST API.
 * @param {string} apiPath - Path below `/api`, e.g. `/states/light.kitchen`.
 * @param {RequestInit} [init] - Additional fetch options.
 * @returns {Promise<Object>} Parsed JSON response.
 */
async function haFetch(apiPath, init = {}) {
    const { url, token } = getHaConfig();
    const response = await fetch(`${url}/api${apiPath}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw await upstreamError('Home Assistant', response);
    return response.json();
}

/** @type {ReturnType<typeof createHaSocket>|null} */
let live = null;

/**
 * Reads states over one websocket connection that Home Assistant keeps up to date, instead of
 * one REST request per entity and poll. Until the connection is up (and when it drops), states
 * are fetched over REST. Also enables what only the websocket API offers, like favorite colors.
 * @param {Object} [options]
 * @param {() => boolean} [options.isActive] - Whether to connect at all (false in demo mode).
 * @param {typeof WebSocket} [options.WebSocketImpl] - WebSocket class (for tests).
 */
export function startLiveStates({ isActive = () => true, WebSocketImpl } = {}) {
    stopLiveStates();
    live = createHaSocket({
        WebSocketImpl,
        getConfig: () => {
            if (!isActive()) return null;
            try {
                return getHaConfig();
            } catch {
                return null;
            }
        },
        // Members of groups on hacontrol cards can be shown and changed in the control dialog
        expand: (ids, attributesOf) => {
            const all = new Set(ids);
            getControlEntityIds().forEach(id => groupMembers({ attributes: attributesOf(id) }).forEach(m => all.add(m)));
            return all;
        },
    });
    live.onEvent('entity_registry_updated', (event) => registryCache.delete(event?.data?.entity_id));
    live.watch(getValidEntityIds());
}

/** Closes the live connection; states are fetched over REST again. */
export function stopLiveStates() {
    live?.close();
    live = null;
    registryCache.clear();
    iconResources.clear();
}

/**
 * Returns an entity's state: from the live connection when it has it, over REST otherwise.
 * @param {string} entityId - The entity id.
 * @returns {Promise<Object|null>} The state (null when Home Assistant doesn't know the entity
 *   and the live connection says so).
 */
async function getState(entityId) {
    const cached = live?.getState(entityId);
    if (cached?.known) return cached.state;
    return haFetch(`/states/${encodeURIComponent(entityId)}`);
}

const REGISTRY_TTL = 5 * 60 * 1000;
const ICONS_TTL = 60 * 60 * 1000;
const COLOR_KEYS = ['hs_color', 'rgb_color', 'rgbw_color', 'rgbww_color', 'xy_color', 'color_temp_kelvin'];
/** Entity registry entries (null when unreadable), refreshed when Home Assistant reports a change. */
const registryCache = new Map();
/** Icon tables from Home Assistant: `entity_component` and `entity:<integration>`. */
const iconResources = new Map();

/**
 * Reads an entity's registry entry: its own icon, integration, translation key and options
 * like favorite colors. Only the websocket API exposes the registry.
 * @param {string} entityId - The entity.
 * @returns {Promise<Object|null>} The entry, or null when it can't be read (no live connection,
 *   an entity without a registry entry, or a token without access).
 */
async function registryEntry(entityId) {
    if (!live) return null;
    const hit = registryCache.get(entityId);
    if (hit && Date.now() - hit.at < REGISTRY_TTL) return hit.entry;
    let entry = null;
    try {
        entry = await live.command({ type: 'config/entity_registry/get', entity_id: entityId });
    } catch {
        // Not connected yet: try again next time instead of caching the miss
        if (!live.status().connected) return null;
    }
    registryCache.set(entityId, { at: Date.now(), entry });
    return entry;
}

/**
 * Loads one of Home Assistant's icon tables, which its own frontend uses to pick entity icons.
 * @param {string} key - `entity_component`, or `entity:<integration>` for an integration's icons.
 * @returns {Promise<Object|null>} The `resources`, or null when they can't be read.
 */
async function iconTable(key) {
    if (!live) return null;
    const hit = iconResources.get(key);
    if (hit && Date.now() - hit.at < ICONS_TTL) return hit.promise;
    const [category, integration] = key.split(':');
    const promise = live.command({ type: 'frontend/get_icons', category, ...(integration ? { integration } : {}) })
        .then(result => result?.resources || null)
        .catch(() => {
            iconResources.delete(key);
            return null;
        });
    iconResources.set(key, { at: Date.now(), promise });
    return promise;
}

/**
 * Picks the icon for a state from an icon table entry (`{ default, state: { off: ... } }`).
 * @param {Object|undefined} entry - The table entry.
 * @param {string} state - The entity's state.
 * @returns {string|null} The icon.
 */
const iconForState = (entry, state) => (typeof entry?.state?.[state] === 'string' ? entry.state[state] : null)
    || (typeof entry?.default === 'string' ? entry.default : null);

const FALLBACK_ICONS = {
    light: ['mdi:lightbulb', 'mdi:lightbulb-off'],
    switch: ['mdi:toggle-switch-variant', 'mdi:toggle-switch-variant-off'],
    input_boolean: ['mdi:check-circle-outline', 'mdi:close-circle-outline'],
    fan: ['mdi:fan', 'mdi:fan-off'],
    climate: ['mdi:thermostat', 'mdi:thermostat'],
    media_player: ['mdi:cast', 'mdi:cast-off'],
};

/**
 * Icon for entities Home Assistant has no icon table entry for (groups), or when the tables
 * can't be read. Groups of lights get a light group icon.
 * @param {Object|null} state - The entity's state.
 * @param {string} entityId - The entity id.
 * @returns {string|null} The icon, or null to let the card choose.
 */
export function fallbackIcon(state, entityId) {
    const domain = entityId.split('.')[0];
    const off = state?.state === 'off';
    if (domain === 'group') {
        const members = groupMembers(state);
        if (members.length && members.every(id => id.startsWith('light.'))) return off ? 'mdi:lightbulb-group-off' : 'mdi:lightbulb-group';
        return 'mdi:google-circles-communities';
    }
    const icons = FALLBACK_ICONS[domain];
    return icons ? icons[off ? 1 : 0] : null;
}

/**
 * The icon Home Assistant shows for an entity, in the same order as its frontend: an icon set
 * on the entity, the entity's icon attribute, its integration's icon, its domain's icon for
 * the device class and state, and finally a fallback.
 * @param {string} entityId - The entity id.
 * @param {Object|null} state - Its state.
 * @returns {Promise<string|null>} An icon like `mdi:lightbulb-off`, or null when unknown.
 */
export async function entityIcon(entityId, state) {
    if (!state) return null;
    const entry = await registryEntry(entityId);
    if (typeof entry?.icon === 'string' && entry.icon) return entry.icon;
    if (typeof state.attributes?.icon === 'string' && state.attributes.icon) return state.attributes.icon;
    const domain = entityId.split('.')[0];
    if (entry?.platform && entry.translation_key) {
        const table = await iconTable(`entity:${entry.platform}`);
        const icon = iconForState(table?.[entry.platform]?.[domain]?.[entry.translation_key], state.state);
        if (icon) return icon;
    }
    if (typeof entry?.original_icon === 'string' && entry.original_icon) return entry.original_icon;
    const components = await iconTable('entity_component');
    const deviceClass = state.attributes?.device_class || entry?.device_class || entry?.original_device_class;
    const icon = iconForState(components?.[domain]?.[deviceClass] || components?.[domain]?._, state.state);
    return icon || fallbackIcon(state, entityId);
}

/**
 * Adds `icon` (see entityIcon) to a state.
 * @param {string} entityId - The entity id.
 * @param {Object|null} state - Its state.
 * @returns {Promise<Object|null>} The state with its icon.
 */
async function withIcon(entityId, state) {
    return state ? { ...state, icon: await entityIcon(entityId, state) } : state;
}

/**
 * Keeps the well-formed favorite colors, each `{ hs_color }`, `{ rgb_color }`, `{ xy_color }`,
 * `{ color_temp_kelvin }` etc.
 * @param {*} colors - `options.light.favorite_colors` from the entity registry.
 * @returns {Array<Object>|null} The colors, or null when none are set.
 */
export function sanitizeFavorites(colors) {
    if (!Array.isArray(colors)) return null;
    return colors.flatMap((/** @type {*} */ color) => {
        const key = COLOR_KEYS.find(k => color && typeof color === 'object' && k in color);
        if (!key) return [];
        const value = color[key];
        const valid = key === 'color_temp_kelvin' ? Number.isFinite(value) : Array.isArray(value) && value.every(Number.isFinite);
        return valid ? [/** @type {Object} */ ({ [key]: value })] : [];
    });
}

/**
 * Reads the favorite colors of a light, which Home Assistant's own light dialog shows and lets
 * you edit. They live in the entity registry, which only the websocket API exposes.
 * @param {string} entityId - A light.
 * @returns {Promise<Array<Object>|null>} The colors, or null when the light has none set or
 *   they can't be read (no live connection, or a token without access to the registry).
 */
async function favoriteColors(entityId) {
    if (!entityId.startsWith('light.')) return null;
    const entry = await registryEntry(entityId);
    return sanitizeFavorites(entry?.options?.light?.favorite_colors);
}

/** Rooms a multiroom thermostat card shows; further rooms are ignored. */
export const MAX_ROOMS = 6;

/**
 * Lists the climate entities of thermostat cards with their effective settings. A multiroom
 * card's room settings override the card's shared `presets`, `hvac_mode`, `min` and `max`.
 * @returns {Array<Object>} One settings object per climate entity, with `entity_id`.
 */
export function getClimateConfigs() {
    const configs = [];
    getAllCards().forEach(card => {
        if (card.type === 'thermostat' && card.entity_id) configs.push(card);
        if (card.type === 'thermostats' && Array.isArray(card.rooms)) {
            const { presets, hvac_mode: hvacMode, min, max } = card;
            card.rooms.slice(0, MAX_ROOMS).forEach(room => {
                if (room?.entity_id) configs.push({ presets, hvac_mode: hvacMode, min, max, ...room });
            });
        }
    });
    return configs;
}

/**
 * Lists the media players a media player card shows, as `{ entity_id, name }`. Accepts
 * `entities` (ids or objects) or a single `entity_id`.
 * @param {Object} card - The media player card config.
 * @returns {Array<{entity_id: string, name?: string}>} The players.
 */
export function mediaPlayersOf(card) {
    const list = Array.isArray(card.entities) ? card.entities : card.entity_id ? [card.entity_id] : [];
    return list
        .map(entry => (typeof entry === 'string' ? { entity_id: entry } : entry))
        .filter(entry => entry?.entity_id);
}

/**
 * Collects the media player entities of all media player cards: their players and the
 * speakers listed for grouping and volume.
 * @returns {Set<string>} Allowed media player entity ids.
 */
export function getMediaEntityIds() {
    const ids = new Set();
    getAllCards().forEach(card => {
        if (card.type !== 'mediaplayer') return;
        mediaPlayersOf(card).forEach(p => ids.add(p.entity_id));
        (Array.isArray(card.speakers) ? card.speakers : []).forEach(sp => {
            const id = typeof sp === 'string' ? sp : sp?.entity_id;
            if (id) ids.add(id);
        });
    });
    return ids;
}

/**
 * Validates a media player action and returns the Home Assistant service and body for it.
 * Only playback, seeking, volume and grouping of media players on media player cards are
 * allowed; grouped speakers must be on a media player card too.
 * @param {Object} params - Request parameters (`entity_id`, `action` and its value).
 * @returns {{service: string, body: Object}} The media_player service and its body.
 * @throws {HttpError} 403 for entities not on a media player card, 400 for invalid values.
 */
export function mediaCall(params) {
    const { entity_id: entityId, action } = params;
    const allowed = getMediaEntityIds();
    if (!allowed.has(entityId)) throw new HttpError(403, `Entity not authorized: ${entityId}`);
    const body = { entity_id: entityId };

    switch (action) {
        case 'media_play_pause':
        case 'media_next_track':
        case 'media_previous_track':
        case 'unjoin':
            return { service: action, body };
        case 'media_seek': {
            const position = Number(params.seek_position);
            if (!Number.isFinite(position) || position < 0) throw new HttpError(400, 'seek_position must be a positive number');
            return { service: action, body: { ...body, seek_position: position } };
        }
        case 'volume_set': {
            const level = Number(params.volume_level);
            if (!Number.isFinite(level) || level < 0 || level > 1) throw new HttpError(400, 'volume_level must be between 0 and 1');
            return { service: action, body: { ...body, volume_level: level } };
        }
        case 'join': {
            const members = Array.isArray(params.group_members) ? params.group_members : [];
            if (members.length === 0 || members.some(id => typeof id !== 'string' || id === entityId)) {
                throw new HttpError(400, 'group_members must list other media players');
            }
            const stranger = members.find(id => !allowed.has(id));
            if (stranger) throw new HttpError(403, `Entity not authorized: ${stranger}`);
            return { service: action, body: { ...body, group_members: members } };
        }
        default:
            throw new HttpError(400, `Unknown media player action: ${action}`);
    }
}

/**
 * Loads the artwork of a media player through the server, because Home Assistant's
 * picture URLs need its access token. The picture path comes from the entity's state on
 * the server, never from the browser.
 * @param {string} entityId - A media player on a media player card.
 * @returns {Promise<{contentType: string, body: Buffer}|null>} The image, or null when there is none.
 */
export async function fetchArtwork(entityId) {
    if (!getMediaEntityIds().has(entityId)) throw new HttpError(403, `Entity not authorized: ${entityId}`);
    const { url, token } = getHaConfig();
    const state = await getState(entityId);
    const picture = state?.attributes?.entity_picture;
    if (typeof picture !== 'string' || !picture) return null;

    const absolute = /^https?:\/\//.test(picture);
    const response = await fetch(absolute ? picture : `${url}${picture.startsWith('/') ? '' : '/'}${picture}`, {
        headers: absolute ? {} : { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw await upstreamError('Home Assistant artwork', response);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) throw new HttpError(502, 'Artwork is not an image');
    return { contentType, body: Buffer.from(await response.arrayBuffer()) };
}

/**
 * Collects every entity id referenced by hacontrol, thermostat and media player cards.
 * Only these entities may be read through the API.
 * @returns {Set<string>} Allowed entity ids.
 */
export function getValidEntityIds() {
    const entityIds = new Set();
    getAllCards().forEach(card => {
        if (card.type === 'hacontrol') {
            (card.data?.entities || []).forEach(e => e.entity_id && entityIds.add(e.entity_id));
        }
    });
    getClimateConfigs().forEach(c => entityIds.add(c.entity_id));
    getMediaEntityIds().forEach(id => entityIds.add(id));
    return entityIds;
}

/**
 * Finds the settings that control a climate entity, from a single or multiroom thermostat card.
 * @param {string} entityId - The climate entity id.
 * @returns {Object|undefined} The effective settings.
 */
export function findThermostatCard(entityId) {
    return getClimateConfigs().find(c => c.entity_id === entityId);
}

/**
 * Validates a thermostat action against the settings that control the entity and returns the
 * Home Assistant service and request body for it. Only the target temperature, a preset
 * and switching between off and the card's on mode are allowed.
 * @param {Object} params - Request parameters (`entity_id`, `action` and its value).
 * @returns {{service: string, body: Object}} The climate service and its body.
 * @throws {HttpError} 403 for entities without a thermostat card, 400 for invalid values.
 */
export function climateCall(params) {
    const { entity_id: entityId, action } = params;
    const card = findThermostatCard(entityId);
    if (!card) throw new HttpError(403, `Entity not authorized: ${entityId}`);

    if (action === 'set_temperature') {
        const temperature = Number(params.temperature);
        const min = Number.isFinite(card.min) ? card.min : 0;
        const max = Number.isFinite(card.max) ? card.max : 100;
        if (!Number.isFinite(temperature) || temperature < min || temperature > max) {
            throw new HttpError(400, `temperature must be between ${min} and ${max}`);
        }
        return { service: action, body: { entity_id: entityId, temperature } };
    }
    if (action === 'set_preset_mode') {
        const preset = params.preset_mode;
        if (typeof preset !== 'string' || !preset) throw new HttpError(400, 'preset_mode is required');
        // With presets in the card config, only the Home Assistant presets listed there may be set
        if (Array.isArray(card.presets) && !card.presets.some(p => p?.preset === preset)) {
            throw new HttpError(403, `Preset not allowed for this thermostat: ${preset}`);
        }
        return { service: action, body: { entity_id: entityId, preset_mode: preset } };
    }
    if (action === 'set_hvac_mode') {
        const onMode = card.hvac_mode || 'heat';
        if (params.hvac_mode !== 'off' && params.hvac_mode !== onMode) {
            throw new HttpError(400, `hvac_mode must be "off" or "${onMode}"`);
        }
        return { service: action, body: { entity_id: entityId, hvac_mode: params.hvac_mode } };
    }
    throw new HttpError(400, `Unknown thermostat action: ${action}`);
}

/**
 * Lists the entities of hacontrol cards, whose control dialogs may read and change them.
 * @returns {Set<string>} Entity ids.
 */
export function getControlEntityIds() {
    const ids = new Set();
    getAllCards().forEach(card => {
        if (card.type === 'hacontrol') (card.data?.entities || []).forEach(e => e.entity_id && ids.add(e.entity_id));
    });
    return ids;
}

/**
 * Returns the members of a group entity (`group.*`, or a light/switch group with an
 * `entity_id` attribute), or an empty list for single entities.
 * @param {Object|null|undefined} state - The entity's Home Assistant state.
 * @returns {string[]} Member entity ids.
 */
export function groupMembers(state) {
    const members = state?.attributes?.entity_id;
    return Array.isArray(members) ? members.filter(id => typeof id === 'string') : [];
}

const MEMBER_CACHE_MS = 15000;
let memberCache = { at: 0, ids: /** @type {Set<string>} */ (new Set()), key: '' };

/**
 * Entities a control dialog may change: the hacontrol entities and the members of the groups
 * among them. Group members are read from Home Assistant, never taken from the browser, and
 * cached for a few seconds.
 * @returns {Promise<Set<string>>} Allowed entity ids.
 */
async function allowedControlIds() {
    const configured = getControlEntityIds();
    const key = [...configured].sort().join(',');
    if (memberCache.key === key && Date.now() - memberCache.at < MEMBER_CACHE_MS) return memberCache.ids;
    const ids = new Set(configured);
    const states = await Promise.all([...configured].map(id => getState(id).catch(() => null)));
    states.forEach(state => groupMembers(state).forEach(id => ids.add(id)));
    memberCache = { at: Date.now(), ids, key };
    return ids;
}

/**
 * Validates a control dialog action and turns it into Home Assistant service calls. Lights get
 * `light.turn_on` / `light.turn_off` with brightness, white temperature or color; everything
 * else is switched with `homeassistant.turn_on` / `turn_off`.
 * @param {Object} params - `entity_ids` (or `entity_id`), `action` (`turn_on`/`turn_off`) and,
 *   for turn_on, optional `brightness_pct`, `color_temp_kelvin` or `hs_color`.
 * @param {Set<string>} allowed - Entities that may be controlled.
 * @returns {Array<{domain: string, service: string, body: Object}>} The calls to make.
 * @throws {HttpError} 403 for entities that are not allowed, 400 for invalid values.
 */
export function controlCalls(params, allowed) {
    const ids = Array.isArray(params.entity_ids) ? params.entity_ids : params.entity_id ? [params.entity_id] : [];
    if (ids.length === 0 || ids.length > 50 || ids.some(id => typeof id !== 'string')) {
        throw new HttpError(400, 'entity_ids must list 1 to 50 entities');
    }
    const stranger = ids.find(id => !allowed.has(id));
    if (stranger) throw new HttpError(403, `Entity not authorized: ${stranger}`);
    const { action } = params;
    if (action !== 'turn_on' && action !== 'turn_off') throw new HttpError(400, `Unknown control action: ${action}`);

    const light = {};
    if (action === 'turn_on') {
        if (params.brightness_pct !== undefined) {
            const pct = Number(params.brightness_pct);
            if (!Number.isInteger(pct) || pct < 1 || pct > 100) throw new HttpError(400, 'brightness_pct must be 1-100');
            light.brightness_pct = pct;
        }
        if (params.color_temp_kelvin !== undefined) {
            const kelvin = Number(params.color_temp_kelvin);
            if (!Number.isFinite(kelvin) || kelvin < 1000 || kelvin > 12000) throw new HttpError(400, 'color_temp_kelvin must be 1000-12000');
            light.color_temp_kelvin = Math.round(kelvin);
        }
        if (params.hs_color !== undefined) {
            const [h, sat] = Array.isArray(params.hs_color) ? params.hs_color.map(Number) : [];
            if (!(h >= 0 && h <= 360 && sat >= 0 && sat <= 100)) throw new HttpError(400, 'hs_color must be [0-360, 0-100]');
            if (light.color_temp_kelvin) throw new HttpError(400, 'Use either color_temp_kelvin or hs_color');
            light.hs_color = [h, sat];
        }
    }

    const lights = ids.filter(id => id.startsWith('light.'));
    const others = ids.filter(id => !id.startsWith('light.'));
    const calls = [];
    if (lights.length) calls.push({ domain: 'light', service: action, body: { entity_id: lights, ...light } });
    if (others.length) calls.push({ domain: 'homeassistant', service: action, body: { entity_id: others } });
    return calls;
}

/**
 * Loads what a control dialog shows: the entity's state, for groups its members' states (each
 * with its `icon`), and the favorite colors of the lights among them that have some set.
 * @param {string} entityId - An entity of an hacontrol card.
 * @returns {Promise<{entity: Object, members: Object<string, Object|null>, favorites: Object<string, Array<Object>>}>}
 *   The states and favorite colors.
 */
export async function entityDetails(entityId) {
    if (!getControlEntityIds().has(entityId)) throw new HttpError(403, `Entity not authorized: ${entityId}`);
    const entity = await withIcon(entityId, await getState(entityId));
    const ids = groupMembers(entity);
    const states = await Promise.all(ids.map(id => getState(id).then(state => withIcon(id, state)).catch(() => null)));
    const lights = [entityId, ...ids];
    const colors = await Promise.all(lights.map(favoriteColors));
    const favorites = Object.fromEntries(lights.flatMap((id, i) => (colors[i] ? [[id, colors[i]]] : [])));
    return { entity, members: Object.fromEntries(ids.map((id, i) => [id, states[i]])), favorites };
}

/**
 * Checks whether an action is configured as the on_action or off_action of an entity.
 * @param {string} entityId - The entity id.
 * @param {string} action - The Home Assistant service, e.g. 'light.turn_on'.
 * @returns {boolean} True if the action is allowed for the entity.
 */
export function validateEntityAction(entityId, action) {
    return getAllCards().some(card => card.type === 'hacontrol' &&
        (card.data?.entities || []).some(e => e.entity_id === entityId &&
            (e.on_action?.service === action || e.off_action?.service === action)));
}

/**
 * Throws unless the entity is referenced in the config.
 * @param {string} entityId - Entity id to check.
 * @param {Set<string>} allowed - Allowed entity ids.
 */
function assertEntityAllowed(entityId, allowed) {
    if (!allowed.has(entityId)) throw new HttpError(403, `Entity not authorized: ${entityId}`);
}

/**
 * Clears the cached group members. Intended for tests.
 */
export function resetControlCache() {
    memberCache = { at: 0, ids: new Set(), key: '' };
}

/**
 * Handles Home Assistant requests.
 * - `endpoint: 'states'` with `entity_ids: string[]` returns `{ [entity_id]: state | null }`;
 *   with `icons: true` each state also has the `icon` Home Assistant shows for it.
 * - `endpoint: 'states/<entity_id>'` returns a single state.
 * - `endpoint: 'services'` with `entity_id` and `action` calls the configured service.
 * - `endpoint: 'climate'` with `entity_id`, `action` (`set_temperature`, `set_preset_mode`,
 *   `set_hvac_mode`) and its value controls the climate entity of a thermostat card.
 * - `endpoint: 'media'` with `entity_id`, `action` and its value controls a media player
 *   of a media player card (see mediaCall).
 * - `endpoint: 'details'` with `entity_id` returns an hacontrol entity and its group members.
 * - `endpoint: 'control'` switches, dims or colors hacontrol entities and group members
 *   (see controlCalls).
 * @param {Object} params - Request parameters.
 * @returns {Promise<Object>} Home Assistant response data.
 */
export async function handleHaRequest(params) {
    const { endpoint } = params;
    if (!endpoint) throw new HttpError(400, 'Home Assistant service requires endpoint parameter');
    getHaConfig();
    // Config changes can add entities, so the live connection's list is updated with each request
    live?.watch(getValidEntityIds());

    if (endpoint === 'states') {
        const ids = Array.isArray(params.entity_ids) ? params.entity_ids : [];
        const allowed = getValidEntityIds();
        ids.forEach(id => assertEntityAllowed(id, allowed));
        const states = await Promise.all(ids.map(id => getState(id)
            .then(state => (params.icons ? withIcon(id, state) : state))
            .catch(() => null)));
        return Object.fromEntries(ids.map((id, i) => [id, states[i]]));
    }

    if (endpoint.startsWith('states/')) {
        const entityId = endpoint.slice('states/'.length);
        assertEntityAllowed(entityId, getValidEntityIds());
        const state = await getState(entityId);
        if (!state) throw new HttpError(404, `Entity not found: ${entityId}`);
        return state;
    }

    if (endpoint === 'services') {
        const { entity_id: entityId, action } = params;
        if (!entityId || !action) throw new HttpError(400, 'entity_id and action are required');
        if (!validateEntityAction(entityId, action)) {
            throw new HttpError(403, 'Action not authorized for this entity');
        }
        const [domain, serviceName] = action.split('.');
        if (!domain || !serviceName) throw new HttpError(400, 'Invalid action format. Expected "domain.service"');

        return haFetch(`/services/${encodeURIComponent(domain)}/${encodeURIComponent(serviceName)}`, {
            method: 'POST',
            body: JSON.stringify({ entity_id: entityId }),
        });
    }

    if (endpoint === 'climate') {
        const { service, body } = climateCall(params);
        return haFetch(`/services/climate/${service}`, { method: 'POST', body: JSON.stringify(body) });
    }

    if (endpoint === 'details') return entityDetails(String(params.entity_id || ''));

    if (endpoint === 'control') {
        const calls = controlCalls(params, await allowedControlIds());
        const results = [];
        for (const { domain, service, body } of calls) {
            results.push(await haFetch(`/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify(body) }));
        }
        return results.flat();
    }

    if (endpoint === 'media') {
        const { service, body } = mediaCall(params);
        return haFetch(`/services/media_player/${service}`, { method: 'POST', body: JSON.stringify(body) });
    }

    throw new HttpError(400, `Unknown Home Assistant endpoint: ${endpoint}`);
}
