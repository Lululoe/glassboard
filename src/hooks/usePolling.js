import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { usePageActive } from '../context/pageActive';

/** Background pace of cards with live Home Assistant state, which poll every few seconds while shown. */
export const BACKGROUND_FAST = 60 * 1000;

/** Background pace of cards that read slower services, such as GitHub or Proxmox. */
export const BACKGROUND_SLOW = 5 * 60 * 1000;

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
 * With `backgroundInterval`, polling goes on at that slower pace while the card's page is not
 * the one shown, so cards on other pages can still publish notices (see `useCardNotice`).
 * A hidden browser tab still pauses all polling.
 *
 * @template T
 * @param {() => Promise<T>} fetcher - Loads the data. Always called with the latest props.
 * @param {Object} [options]
 * @param {number} [options.interval=0] - Poll interval in ms; 0 fetches once.
 * @param {boolean} [options.enabled=true] - Set to false to skip fetching (e.g. missing config).
 * @param {string} [options.key=''] - Restarts polling when it changes (e.g. a date range).
 * @param {number} [options.backgroundInterval=0] - Poll interval in ms while the page is not shown; 0 pauses.
 * @returns {{data: T|undefined, error: string|null, loading: boolean, updatedAt: number, refresh: () => void}}
 *   The latest data (kept after errors), the last error, whether the first load is pending,
 *   when data last arrived, and a function that fetches again immediately.
 */
export function usePolling(fetcher, { interval = 0, enabled = true, key = '', backgroundInterval = 0 } = {}) {
    const pageActive = usePageActive();
    const documentVisible = useSyncExternalStore(subscribeVisibility, isDocumentVisible, () => true);
    const [state, setState] = useState({ data: undefined, error: null, loading: enabled, updatedAt: 0 });
    const [nonce, setNonce] = useState(0);
    const load = useEffectEvent(() => fetcher());
    const background = !pageActive && backgroundInterval > 0;
    const running = enabled && documentVisible && (pageActive || background);
    const pace = background ? backgroundInterval : interval;
    const lastLoad = useRef({ at: 0, of: '' });

    useEffect(() => {
        if (!running) return;
        let cancelled = false;
        let timer;

        const tick = async () => {
            try {
                const data = await load();
                lastLoad.current = { at: Date.now(), of: `${key}|${nonce}` };
                if (!cancelled) setState({ data, error: null, loading: false, updatedAt: lastLoad.current.at });
            } catch (err) {
                if (!cancelled) setState(prev => ({ ...prev, error: err.message || String(err), loading: false }));
            }
            if (!cancelled && pace > 0) timer = setTimeout(tick, pace);
        };
        // Leaving the page doesn't fetch the same data again right away; the background pace counts from the last fetch
        const last = lastLoad.current;
        const wait = background && last.at > 0 && last.of === `${key}|${nonce}` ? Math.max(0, last.at + pace - Date.now()) : 0;
        if (wait > 0) timer = setTimeout(tick, wait);
        else tick();

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [running, background, pace, key, nonce]);

    const refresh = useCallback(() => setNonce(n => n + 1), []);
    return { ...state, loading: state.loading && enabled, refresh };
}
