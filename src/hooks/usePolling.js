import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { usePageActive } from '../context/pageActive';

/**
 * Subscribes to browser tab visibility changes.
 * @param {() => void} callback - Called when visibility changes.
 * @returns {() => void} Unsubscribe function.
 */
function subscribeVisibility(callback) {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
}

/**
 * Reads whether the browser tab is visible.
 * @returns {boolean} True unless the document is hidden.
 */
const isDocumentVisible = () => document.visibilityState !== 'hidden';

/**
 * Runs `fetcher` immediately and then every `interval` ms while the card's page is active
 * and the browser tab is visible. Polling resumes with an immediate fetch when the page or
 * tab becomes visible again. A new poll is scheduled only after the previous one finishes,
 * so slow backends never cause overlapping requests.
 *
 * @template T
 * @param {() => Promise<T>} fetcher - Loads the data. Always called with the latest props.
 * @param {Object} [options]
 * @param {number} [options.interval=0] - Poll interval in ms; 0 fetches once.
 * @param {boolean} [options.enabled=true] - Set to false to skip fetching (e.g. missing config).
 * @param {string} [options.key=''] - Restarts polling when it changes (e.g. a date range).
 * @returns {{data: T|undefined, error: string|null, loading: boolean, updatedAt: number, refresh: () => void}}
 *   The latest data (kept after errors), the last error, whether the first load is pending,
 *   when data last arrived, and a function that fetches again immediately.
 */
export function usePolling(fetcher, { interval = 0, enabled = true, key = '' } = {}) {
    const pageActive = usePageActive();
    const documentVisible = useSyncExternalStore(subscribeVisibility, isDocumentVisible, () => true);
    const [state, setState] = useState({ data: undefined, error: null, loading: enabled, updatedAt: 0 });
    const [nonce, setNonce] = useState(0);
    const load = useEffectEvent(() => fetcher());
    const running = enabled && pageActive && documentVisible;

    useEffect(() => {
        if (!running) return;
        let cancelled = false;
        let timer;

        const tick = async () => {
            try {
                const data = await load();
                if (!cancelled) setState({ data, error: null, loading: false, updatedAt: Date.now() });
            } catch (err) {
                if (!cancelled) setState(prev => ({ ...prev, error: err.message || String(err), loading: false }));
            }
            if (!cancelled && interval > 0) timer = setTimeout(tick, interval);
        };
        tick();

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [running, interval, key, nonce]);

    const refresh = useCallback(() => setNonce(n => n + 1), []);
    return { ...state, loading: state.loading && enabled, refresh };
}
