import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch weather forecast data from Home Assistant.
 * @param {string} entityId - Weather entity ID (e.g. weather.home)
 * @param {string} [type='daily'] - Forecast type ('daily' or 'hourly')
 * @param {string} [service='weather'] - Service name (default 'weather')
 * @returns {Object} { weather, loading, error }
 */
export const useWeather = (entityId, type = 'daily', service = 'weather') => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!entityId) {
            setLoading(false);
            return;
        }

        let mounted = true;
        setLoading(true);

        const fetchWeather = async () => {
            try {
                const response = await fetch(`/api?service=${service}&entity_id=${entityId}&type=${type}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch weather: ${response.status}`);
                }

                const data = await response.json();

                if (!mounted) return;

                const forecastData = data.service_response ? data.service_response[entityId] : data[entityId];

                setWeather(forecastData);
                setError(null);
            } catch (err) {
                if (!mounted) return;
                setError(String(err));
                setWeather(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchWeather();

        return () => {
            mounted = false;
        };
    }, [entityId, type, service]);

    return { weather, loading, error };
};
