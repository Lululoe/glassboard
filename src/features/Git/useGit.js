import { useState, useEffect } from 'react';

/**
 * Hook to fetch pull requests from integrated git repositories.
 * @param {Object} config - Configuration object with repository lists and filters.
 * @returns {Object} Object containing prs array, stats object, loading boolean, and error string.
 */
export const useGit = (config) => {
    const [prs, setPrs] = useState([]);
    const [stats, setStats] = useState({ count: 0, open: 0, review_requested: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!config || !config.repositories) {
            return;
        }

        const fetchData = async () => {
            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        service: 'git',
                        repos: config.repositories,
                        labels: config.filterLabels || config.labels,
                        filterStatus: config.filterStatus || config.status
                    })
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                setPrs(data.prs);
                setStats(data.stats);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch git data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every minute

        return () => clearInterval(interval);
    }, [config]);

    return { prs, stats, loading, error };
};
