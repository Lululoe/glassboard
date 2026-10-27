import { useEffect, useState } from 'react';

/**
 * Loads the dashboard configuration from `/api/config` and reloads it whenever the server
 * reports a config file change over `/api/config/events`.
 * @returns {{config: Object|null, error: string|null}} The config (null until loaded) and the last load error.
 */
export const useConfig = () => {
    const [state, setState] = useState({ config: null, error: null });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch('/api/config', { cache: 'no-store' });
                if (!response.ok) throw new Error(`Failed to load config (${response.status})`);
                const config = await response.json();
                if (!cancelled) setState({ config, error: null });
            } catch (err) {
                console.error('Config load error:', err);
                if (!cancelled) setState(prev => ({ ...prev, error: err.message }));
            }
        };
        load();

        if (typeof EventSource === 'undefined') {
            return () => { cancelled = true; };
        }
        const events = new EventSource('/api/config/events');
        events.addEventListener('config', load);
        return () => {
            cancelled = true;
            events.close();
        };
    }, []);

    return state;
};
