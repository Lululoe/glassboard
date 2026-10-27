import { getAllCards, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

const WEATHER_CACHE_DURATION = 30 * 60 * 1000;
const FORECAST_TYPES = new Set(['daily', 'hourly', 'twice_daily']);
const weatherCache = new Map();

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
 * Collects every entity id referenced by hacontrol and weather cards.
 * Only these entities may be read through the API.
 * @returns {Set<string>} Allowed entity ids.
 */
export function getValidEntityIds() {
    const entityIds = new Set();
    getAllCards().forEach(card => {
        if (card.type === 'hacontrol') {
            (card.data?.entities || []).forEach(e => e.entity_id && entityIds.add(e.entity_id));
        } else if (card.type === 'weather') {
            const id = card.entity_id || card.data?.entity_id;
            if (id) entityIds.add(id);
        }
    });
    return entityIds;
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

    throw new HttpError(400, `Unknown Home Assistant endpoint: ${endpoint}`);
}

/**
 * Fetches a weather forecast via the `weather.get_forecasts` service, cached for 30 minutes.
 * @param {Object} params
 * @param {string} params.entity_id - Weather entity configured on a weather card.
 * @param {string} [params.type='daily'] - 'daily', 'hourly' or 'twice_daily'.
 * @returns {Promise<Object>} The service response from Home Assistant.
 */
export async function handleWeatherRequest({ entity_id: entityId, type = 'daily' }) {
    if (!entityId) throw new HttpError(400, 'entity_id is required');
    if (!FORECAST_TYPES.has(type)) throw new HttpError(400, `Invalid forecast type: ${type}`);
    assertEntityAllowed(entityId, getValidEntityIds());

    const cacheKey = `${entityId}:${type}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_DURATION) return cached.data;

    const data = await haFetch('/services/weather/get_forecasts?return_response=true', {
        method: 'POST',
        body: JSON.stringify({ entity_id: [entityId], type }),
    });
    weatherCache.set(cacheKey, { timestamp: Date.now(), data });
    return data;
}

/**
 * Clears the weather forecast cache. Intended for tests.
 */
export function clearWeatherCache() {
    weatherCache.clear();
}
