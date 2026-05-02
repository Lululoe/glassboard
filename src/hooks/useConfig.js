import { useState, useEffect } from 'react';
import yaml from 'js-yaml';

/**
 * Hook to load configuration from the server's config API.
 * @param {string} [url='/api/config'] - The config API endpoint.
 * @returns {Object} { config, error } object.
 */
export const useConfig = (url = '/api/config') => {
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch(url + '?t=' + new Date().getTime()); // Prevent caching
                if (!response.ok) throw new Error('Failed to fetch config');
                const text = await response.text();
                const data = yaml.load(text);

                setConfig(data);
                setError(null);
            } catch (err) {
                console.error("Config load error:", err);
                setError(err);
            }
        };

        fetchConfig();
    }, [url]);

    return { config, error };
};
