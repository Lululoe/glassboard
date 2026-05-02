import { useState, useEffect } from 'react';

/**
 * Hook to fetch system resource statistics for the server.
 * Maintains history for temperature metrics.
 * @param {number} [intervalMs=2000] - Polling interval in milliseconds.
 * @returns {Object} Server stats object (info, cpu, ram, storage, network, temp).
 */
const useServerStats = (intervalMs = 2000) => {
    const [stats, setStats] = useState({
        info: { hostname: 'Loading...', ip: '...' },
        cpu: 0,
        ram: { used: 0, total: 16 },
        storage: { used: 0, total: 0 },
        network: { in: 0, out: 0 },
        temp: [] // History of temps
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch from central API with service=serverstats
                const res = await fetch('/api?service=serverstats');
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();

                setStats(prev => {
                    // Update temp history
                    const newTempHistory = [...prev.temp];
                    if (data.temp !== undefined) {
                        newTempHistory.push(data.temp);
                        if (newTempHistory.length > 10) newTempHistory.shift(); // Keep last 10
                    }

                    return {
                        info: data.info || prev.info,
                        cpu: data.cpu !== undefined ? data.cpu : prev.cpu,
                        ram: data.ram || prev.ram,
                        storage: data.storage || prev.storage,
                        network: data.network || prev.network,
                        temp: newTempHistory
                    };
                });
            } catch (err) {
                console.error('Error fetching server stats:', err);
            }
        };

        // Initial fetch
        fetchStats();

        // Polling
        const interval = setInterval(fetchStats, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs]);

    return stats;
};

export default useServerStats;
