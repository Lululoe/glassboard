import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const EMPTY = { nodes: [], summary: { running: 0, total: 0, cpuAvg: 0 } };

/**
 * Polls Proxmox VM/LXC stats and the running/total summary.
 * @param {number} [interval=3000] - Polling interval in milliseconds.
 * @returns {{nodes: Array<Object>, summary: Object, error: string|null}} Guests, summary and the last error.
 */
const useProxmox = (interval = 3000) => {
    const { data = EMPTY, error } = usePolling(() => callService('proxmox'), { interval });
    return { ...data, error };
};

export default useProxmox;
