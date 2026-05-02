import express from 'express';
import { getConfigHomeAssistant, getValidEntityIds, validateEntityAction } from '../config.js';

// 24h caching for weather
const weatherCache = new Map();
const WEATHER_CACHE_DURATION = 24 * 60 * 60 * 1000;

/**
 * Handles Home Assistant requests (states, services).
 * @param {string} endpoint - 'states/:entity_id' or 'services'
 * @param {Object} params - params for the request
 */
export async function handleHaRequest(endpoint, params) {
    const haConfig = getConfigHomeAssistant();

    if (!haConfig.HA_URL || !haConfig.HA_TOKEN) {
        const err = new Error('Home Assistant not configured');
        err.status = 503;
        throw err;
    }

    // GET /states/:entity_id
    if (endpoint.startsWith('states/')) {
        const entity_id = endpoint.split('/')[1];

        const validEntityIds = getValidEntityIds();
        if (!validEntityIds.has(entity_id)) {
            const err = new Error('Entity not authorized');
            err.status = 403;
            throw err;
        }

        const response = await fetch(`${haConfig.HA_URL}/api/states/${entity_id}`, {
            headers: {
                'Authorization': `Bearer ${haConfig.HA_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = new Error('Failed to fetch state from Home Assistant');
            err.status = response.status;
            throw err;
        }

        return await response.json();
    }

    // POST /services
    if (endpoint === 'services') {
        const { entity_id, service } = params;

        if (!entity_id || !service) {
            const err = new Error('entity_id and service are required');
            err.status = 400;
            throw err;
        }

        if (!validateEntityAction(entity_id, service)) {
            const err = new Error('Service call not authorized for this entity');
            err.status = 403;
            throw err;
        }

        const [domain, serviceName] = service.split('.');
        if (!domain || !serviceName) {
            const err = new Error('Invalid service format. Expected "domain.service"');
            err.status = 400;
            throw err;
        }

        const response = await fetch(`${haConfig.HA_URL}/api/services/${domain}/${serviceName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${haConfig.HA_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ entity_id })
        });

        if (!response.ok) {
            const errorText = await response.text();
            const err = new Error(`Failed to call service: ${errorText}`);
            err.status = response.status;
            throw err;
        }

        return await response.json();
    }

    throw new Error(`Unknown HA endpoint: ${endpoint}`);
}

/**
 * Handles Weather requests.
 * @param {Object} params - { entity_id, type }
 */
export async function handleWeatherRequest({ entity_id, type = 'daily' }) {
    const haConfig = getConfigHomeAssistant();

    if (!haConfig.HA_URL || !haConfig.HA_TOKEN) {
        const err = new Error('Home Assistant not configured');
        err.status = 503;
        throw err;
    }

    const cacheKey = `${entity_id}:${type}`;
    const now = Date.now();
    const cached = weatherCache.get(cacheKey);

    if (cached && (now - cached.timestamp) < WEATHER_CACHE_DURATION) {
        return cached.data;
    }

    const response = await fetch(`${haConfig.HA_URL}/api/services/weather/get_forecasts?return_response=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${haConfig.HA_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            entity_id: [entity_id],
            type: type
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Failed to fetch weather forecast: ${errorText}`);
        err.status = response.status;
        throw err;
    }

    const result = await response.json();
    weatherCache.set(cacheKey, { timestamp: now, data: result });
    return result;
}

const router = express.Router();

// Get Entity State
/**
 * Route: GET /states/:entity_id
 * Proxies a request to Home Assistant to get the current state of an entity.
 * Validates entity authorization before forwarding.
 */
router.get('/states/:entity_id', async (req, res, next) => {
    try {
        const { entity_id } = req.params;
        const result = await handleHaRequest(`states/${entity_id}`, {});
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Call Service
/**
 * Route: POST /services
 * Calls a Home Assistant service (e.g. light.turn_on).
 * Validates if the action is allowed for the specific entity in config.
 */
router.post('/services', async (req, res, next) => {
    try {
        const result = await handleHaRequest('services', req.body);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Get Weather
/**
 * Route: GET /weather/:entity_id
 * Fetches weather forecast data using the `weather.get_forecasts` service.
 * Implements 24-hour caching to reduce API load.
 */
router.get('/weather/:entity_id', async (req, res, next) => {
    try {
        const { entity_id } = req.params;
        const type = req.query.type || 'daily';
        const result = await handleWeatherRequest({ entity_id, type });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
