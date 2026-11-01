import { useCallback, useEffect, useRef, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const POLL_INTERVAL = 3000;
const REFRESH_DELAY = 800;
// An optimistic value outlives polls that were already on their way when it was set
const OVERRIDE_GRACE = 2500;

/**
 * Loads a printer card's printer and controls it. Changes show at once.
 * @param {*} cardId - The card's id.
 * @param {boolean} enabled - Whether the card has a printer set.
 * @returns {Object} `printer`, `loading`, `error` and `run`.
 */
export function usePrinter(cardId, enabled) {
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'printer', card_id: cardId }),
        { interval: POLL_INTERVAL, enabled: enabled && cardId !== undefined, key: String(cardId) },
    );
    const [override, setOverride] = useState(/** @type {Object|null} */ (null));
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    useEffect(() => () => clearTimeout(timer.current), []);

    const printer = data && override && override.until > updatedAt ? { ...data, ...override.values } : data;

    /**
     * Sends an action and shows its result right away.
     * @param {string} action - The action (see the server's printerAction).
     * @param {Object} values - What to show until Home Assistant confirms.
     * @returns {Promise<void>}
     */
    const send = useCallback(async (action, values) => {
        setOverride({ values, until: Date.now() + OVERRIDE_GRACE });
        try {
            await callService('homeassistant', { endpoint: 'printer_action', card_id: cardId, action });
            clearTimeout(timer.current);
            timer.current = setTimeout(refresh, REFRESH_DELAY);
        } catch (err) {
            console.error(`Printer ${action}:`, err);
            setOverride(null);
        }
    }, [cardId, refresh]);

    const run = {
        pause: () => send('pause', { status: 'pause' }),
        resume: () => send('resume', { status: 'running' }),
        stop: () => send('stop', { status: 'idle' }),
        toggleLight: () => (printer?.light === 'on'
            ? send('light_off', { light: 'off' })
            : send('light_on', { light: 'on' })),
    };

    return { printer, loading: loading && !data, error: data ? null : error, run };
}
