import { useState, useEffect } from 'react';

/**
 * Hook to fetch Proxmox VM/LXC stats and system summary.
 * @param {number} [intervalMs=3000] - Polling interval in milliseconds.
 * @returns {Object} Data object containing nodes array, summary object, and error state.
 */
const useProxmox = (intervalMs = 3000) => {
    const [data, setData] = useState({
        nodes: [],
        summary: {
            running: 0,
            total: 0,
            cpuAvg: 0
        },
        error: null
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api?service=proxmox');
                if (!res.ok) throw new Error('Failed to fetch proxmox stats');
                const json = await res.json();

                setData({
                    nodes: json.nodes || [],
                    summary: json.summary || { running: 0, total: 0, cpuAvg: 0 },
                    error: null
                });
            } catch (err) {
                console.error('Error fetching proxmox stats:', err);
                setData(prev => ({ ...prev, error: err.message }));
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs]);

    return data;
};

export default useProxmox;
