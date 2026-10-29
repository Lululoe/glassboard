import { findCard } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_DURATION = 30 * 60 * 1000;
const FORECAST_TYPES = new Set(['daily', 'hourly']);
const forecastCache = new Map();
const geocodeCache = new Map();

/**
 * WMO weather interpretation codes used by Open-Meteo, mapped to readable conditions.
 * @see https://open-meteo.com/en/docs
 */
const WMO_CONDITIONS = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Heavy rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail',
};

/**
 * Returns the readable condition for a WMO weather code.
 * @param {number} code - WMO weather code.
 * @returns {string} Condition text.
 */
export function describeWeatherCode(code) {
    return WMO_CONDITIONS[code] || 'Unknown';
}

/**
 * Fetches JSON from Open-Meteo.
 * @param {string} baseUrl - Endpoint URL.
 * @param {Object<string, string|number>} params - Query parameters.
 * @returns {Promise<Object>} Parsed JSON response.
 */
async function openMeteoFetch(baseUrl, params) {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const response = await fetch(`${baseUrl}?${query}`);
    if (!response.ok) throw await upstreamError('Open-Meteo', response);
    return response.json();
}

/**
 * Resolves a place name to coordinates via the Open-Meteo geocoding API. Results are cached
 * for the lifetime of the process.
 * @param {string} name - Place name, e.g. "Berlin".
 * @returns {Promise<{latitude: number, longitude: number}>} Coordinates of the best match.
 */
async function geocode(name) {
    const key = name.toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key);

    const { results } = await openMeteoFetch(GEOCODING_URL, { name, count: 1, format: 'json' });
    if (!results?.length) throw new HttpError(404, `Location not found: ${name}`);
    const coords = { latitude: results[0].latitude, longitude: results[0].longitude };
    geocodeCache.set(key, coords);
    return coords;
}

/**
 * Resolves a weather card's coordinates from `latitude`/`longitude` or a `location` name.
 * @param {Object} card - Weather card config.
 * @returns {Promise<{latitude: number, longitude: number}>} Coordinates.
 */
async function resolveCoordinates(card) {
    const lat = card.latitude ?? card.data?.latitude;
    const lon = card.longitude ?? card.data?.longitude;
    if (lat != null && lon != null) {
        const latitude = Number(lat);
        const longitude = Number(lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new HttpError(400, 'Weather card latitude/longitude must be numbers');
        }
        return { latitude, longitude };
    }
    const location = card.location ?? card.data?.location;
    if (location) return geocode(String(location));
    throw new HttpError(400, 'Weather card requires latitude/longitude or location');
}

/**
 * Formats a UTC offset in seconds as `+HH:MM`.
 * @param {number} seconds - Offset from UTC.
 * @returns {string} ISO 8601 offset.
 */
function formatOffset(seconds = 0) {
    const sign = seconds < 0 ? '-' : '+';
    const abs = Math.abs(seconds);
    const pad = (n) => String(Math.floor(n)).padStart(2, '0');
    return `${sign}${pad(abs / 3600)}:${pad((abs % 3600) / 60)}`;
}

/**
 * Converts an Open-Meteo response into a list of forecast entries.
 * Local times are given an explicit UTC offset so browsers in other time zones parse them correctly.
 * @param {Object} data - Open-Meteo forecast response.
 * @param {string} type - 'daily' or 'hourly'.
 * @returns {Array<{datetime: string, condition: string, temperature: number, templow?: number, precipitation: number}>}
 */
function normalizeForecast(data, type) {
    const offset = formatOffset(data.utc_offset_seconds);
    if (type === 'daily') {
        const d = data.daily || {};
        return (d.time || []).map((date, i) => ({
            datetime: `${date}T12:00:00${offset}`,
            condition: describeWeatherCode(d.weather_code?.[i]),
            temperature: d.temperature_2m_max?.[i],
            templow: d.temperature_2m_min?.[i],
            precipitation: d.precipitation_probability_max?.[i] ?? 0,
        }));
    }
    const h = data.hourly || {};
    return (h.time || []).map((time, i) => ({
        datetime: `${time}:00${offset}`,
        condition: describeWeatherCode(h.weather_code?.[i]),
        temperature: h.temperature_2m?.[i],
        precipitation: h.precipitation_probability?.[i] ?? 0,
    }));
}

/**
 * Returns a forecast for a weather card from the public Open-Meteo API (no API key needed).
 * The location and units are read from the card's config. Cached for 30 minutes.
 * @param {Object} params
 * @param {string|number} params.cardId - Id of a weather card in config.yaml.
 * @param {string} [params.type='daily'] - 'daily' or 'hourly'.
 * @returns {Promise<{forecast: Array<Object>, units: string}>} Normalized forecast.
 */
export async function handleWeatherRequest({ cardId, type = 'daily' }) {
    if (cardId === undefined) throw new HttpError(400, 'cardId is required');
    if (!FORECAST_TYPES.has(type)) throw new HttpError(400, `Invalid forecast type: ${type}`);
    const card = findCard(cardId);
    if (card?.type !== 'weather') throw new HttpError(404, `Weather card not found: ${cardId}`);

    const units = String(card.units ?? card.data?.units ?? 'metric').toLowerCase() === 'imperial' ? 'imperial' : 'metric';
    const { latitude, longitude } = await resolveCoordinates(card);

    const cacheKey = `${latitude},${longitude}:${type}:${units}`;
    const cached = forecastCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

    const params = {
        latitude,
        longitude,
        timezone: 'auto',
        temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
    };
    if (type === 'daily') {
        params.daily = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max';
        params.forecast_days = 7;
    } else {
        params.hourly = 'weather_code,temperature_2m,precipitation_probability';
        params.forecast_hours = 24;
    }

    const response = await openMeteoFetch(FORECAST_URL, params);
    const data = { forecast: normalizeForecast(response, type), units };
    forecastCache.set(cacheKey, { timestamp: Date.now(), data });
    return data;
}

/**
 * Clears the forecast and geocoding caches. Intended for tests.
 */
export function clearWeatherCache() {
    forecastCache.clear();
    geocodeCache.clear();
}
