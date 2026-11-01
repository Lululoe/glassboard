import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const REFRESH_INTERVAL = 30 * 60 * 1000;

/**
 * Loads a weather forecast from the public Open-Meteo API (via the server) and refreshes it
 * every 30 minutes. The location and units are read by the server from the card's config,
 * so only the card id is sent.
 * @param {string} cardId - Id of the weather card in config.yaml.
 * @param {string} [type='daily'] - Forecast type ('daily' or 'hourly').
 * @param {boolean} [enabled=true] - Whether to load it at all.
 * @returns {{weather: {forecast: Array<Object>, units: string}|null, loading: boolean, error: string|null}}
 */
export const useWeather = (cardId, type = 'daily', enabled = true) => {
    const { data, loading, error } = usePolling(
        () => callService('weather', { cardId, type }),
        { interval: REFRESH_INTERVAL, enabled: enabled && cardId !== undefined, key: `${cardId}|${type}` }
    );

    return { weather: data ?? null, loading, error };
};
