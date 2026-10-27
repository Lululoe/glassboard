import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const REFRESH_INTERVAL = 30 * 60 * 1000;

/**
 * Loads a weather forecast from Home Assistant and refreshes it every 30 minutes.
 * @param {string} entityId - Weather entity id (e.g. weather.home).
 * @param {string} [type='daily'] - Forecast type ('daily' or 'hourly').
 * @returns {{weather: Object|null, loading: boolean, error: string|null}}
 */
export const useWeather = (entityId, type = 'daily') => {
    const { data, loading, error } = usePolling(async () => {
        const response = await callService('weather', { entity_id: entityId, type });
        return (response.service_response || response)[entityId] || null;
    }, { interval: REFRESH_INTERVAL, enabled: Boolean(entityId), key: `${entityId}|${type}` });

    return { weather: data ?? null, loading, error };
};
