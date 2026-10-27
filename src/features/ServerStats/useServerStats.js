import { useRef } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const TEMP_HISTORY_LENGTH = 10;

const INITIAL = {
    info: { hostname: 'Loading...', ip: '...' },
    cpu: 0,
    ram: { used: 0, total: 0 },
    storage: { used: 0, free: 0, total: 0 },
    network: { in: 0, out: 0 },
    temp: [],
};

/**
 * Polls host resource statistics and keeps a short temperature history.
 * @param {number} [interval=2000] - Polling interval in milliseconds.
 * @returns {Object} Server stats (info, cpu, ram, storage, network) with `temp` as an array of recent readings.
 */
const useServerStats = (interval = 2000) => {
    const tempHistory = useRef([]);

    const { data = INITIAL } = usePolling(async () => {
        const stats = await callService('serverstats');
        tempHistory.current = [...tempHistory.current, stats.temp].slice(-TEMP_HISTORY_LENGTH);
        return { ...stats, temp: tempHistory.current };
    }, { interval });

    return data;
};

export default useServerStats;
