import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch calendar events from the Media API (Sonarr/Radarr).
 * @param {Date} start - Start date of the range
 * @param {Date} end - End date of the range
 * @param {string} [service='media'] - Service name (default 'media')
 * @param {number} [interval=60000] - Polling interval in ms (default 1 min)
 * @returns {Object} { events, loading, error }
 */
export const useMedia = (start, end, service = 'media', interval = 60000) => {
    // Use timestamps for dependency stability
    const startTime = start ? start.getTime() : 0;
    const endTime = end ? end.getTime() : 0;

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(!events.length);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!startTime || !endTime) return;

        let mounted = true;

        const run = async () => {
            if (events.length === 0) setLoading(true);
            setError(null);
            try {
                const s = new Date(startTime);
                const e = new Date(endTime);

                // Format as YYYY-MM-DD local time to avoid timezone shifts (toISOString() is UTC)
                const toLocalISODate = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                const startStr = toLocalISODate(s);
                const endStr = toLocalISODate(e);

                const res = await fetch(`/api?service=${service}&start=${startStr}&end=${endStr}`);
                if (!res.ok) throw new Error(`Media fetch failed: ${res.status}`);

                const list = await res.json();
                if (!mounted) return;
                setEvents(list || []);
            } catch (err) {
                if (!mounted) return;
                setError(String(err));
                setEvents([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        run();

        if (interval > 0) {
            const id = setInterval(run, interval);
            return () => { mounted = false; clearInterval(id); };
        }

        return () => { mounted = false; };
    }, [startTime, endTime, interval]);

    return { events, loading, error };
};
