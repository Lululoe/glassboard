import { getAllCards, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

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

/**
 * Collects every entity id referenced by hacontrol and thermostat cards.
 * Only these entities may be read through the API.
 * @returns {Set<string>} Allowed entity ids.
 */
export function getValidEntityIds() {
    const entityIds = new Set();
    getAllCards().forEach(card => {
        if (card.type === 'hacontrol') {
            (card.data?.entities || []).forEach(e => e.entity_id && entityIds.add(e.entity_id));
        }
        if (card.type === 'thermostat' && card.entity_id) entityIds.add(card.entity_id);
    });
    return entityIds;
}

/**
 * Finds the thermostat card that controls a climate entity.
 * @param {string} entityId - The climate entity id.
 * @returns {Object|undefined} The card config.
 */
export function findThermostatCard(entityId) {
    return getAllCards().find(card => card.type === 'thermostat' && card.entity_id === entityId);
}

/**
 * Validates a thermostat action against the card that controls the entity and returns the
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
 * Handles Home Assistant requests.
 * - `endpoint: 'states'` with `entity_ids: string[]` returns `{ [entity_id]: state | null }`.
 * - `endpoint: 'states/<entity_id>'` returns a single state.
 * - `endpoint: 'services'` with `entity_id` and `action` calls the configured service.
 * - `endpoint: 'climate'` with `entity_id`, `action` (`set_temperature`, `set_preset_mode`,
 *   `set_hvac_mode`) and its value controls the climate entity of a thermostat card.
 * @param {Object} params - Request parameters.
 * @returns {Promise<Object>} Home Assistant response data.
 */
export async function handleHaRequest(params) {
    const { endpoint } = params;
    if (!endpoint) throw new HttpError(400, 'Home Assistant service requires endpoint parameter');
    getHaConfig();

    if (endpoint === 'states') {
        const ids = Array.isArray(params.entity_ids) ? params.entity_ids : [];
        const allowed = getValidEntityIds();
        ids.forEach(id => assertEntityAllowed(id, allowed));
        const states = await Promise.all(ids.map(id =>
            haFetch(`/states/${encodeURIComponent(id)}`).catch(() => null)));
        return Object.fromEntries(ids.map((id, i) => [id, states[i]]));
    }

    if (endpoint.startsWith('states/')) {
        const entityId = endpoint.slice('states/'.length);
        assertEntityAllowed(entityId, getValidEntityIds());
        return haFetch(`/states/${encodeURIComponent(entityId)}`);
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

    throw new HttpError(400, `Unknown Home Assistant endpoint: ${endpoint}`);
}
