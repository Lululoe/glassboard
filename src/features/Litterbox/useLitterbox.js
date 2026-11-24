import { useCallback, useEffect, useRef, useState } from 'react';
import { callService } from '../../lib/api';
import { BACKGROUND_FAST, usePolling } from '../../hooks/usePolling';

const POLL_INTERVAL = 5000;
const HISTORY_INTERVAL = { today: 60000, week: 5 * 60000, weight: 10 * 60000 };
const REFRESH_DELAY = 800;
// An optimistic value outlives polls that were already on their way when it was set
const OVERRIDE_GRACE = 4000;

/**
 * Loads a litter box card's robot and cats, and controls the robot. Changes show at once and
 * are replaced by Home Assistant's state once confirmed; a failed change is dropped again.
 * @param {*} cardId - The card's id.
 * @param {boolean} enabled - Whether the card has a robot.
 * @returns {{box: Object|null, loading: boolean, error: string|null, run: Object}} The litter box
 *   (see the server's litterData), load state and actions.
 */
export function useLitterbox(cardId, enabled) {
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'litterbox', card_id: cardId }),
        { interval: POLL_INTERVAL, backgroundInterval: BACKGROUND_FAST, enabled: enabled && cardId !== undefined, key: String(cardId) },
    );
    const [override, setOverride] = useState(/** @type {Object|null} */ (null));
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    useEffect(() => () => clearTimeout(timer.current), []);

    let box = data || null;
    if (box && override && override.until > updatedAt) {
        const { until: _until, ...change } = override;
        box = {
            ...box,
            ...change,
            clean_delay: change.clean_delay !== undefined && box.clean_delay ? { ...box.clean_delay, value: change.clean_delay } : box.clean_delay,
            globe_light: change.globe_light !== undefined && box.globe_light ? { ...box.globe_light, value: change.globe_light } : box.globe_light,
        };
    }

    /**
     * Sends an action and shows its result right away.
     * @param {string} action - The action (see the server's litterCall).
     * @param {Object} [extra] - Its value.
     * @param {Object} [optimistic] - What to show until Home Assistant confirms.
     * @returns {Promise<void>}
     */
    const send = useCallback(async (action, extra = {}, optimistic = null) => {
        if (optimistic) setOverride(prev => ({ ...(prev?.until > Date.now() ? prev : {}), ...optimistic, until: Date.now() + OVERRIDE_GRACE }));
        try {
            await callService('homeassistant', { endpoint: 'litterbox_action', card_id: cardId, action, ...extra });
            clearTimeout(timer.current);
            timer.current = setTimeout(refresh, REFRESH_DELAY);
        } catch (err) {
            console.error(`Litter box ${action}:`, err);
            setOverride(null);
        }
    }, [cardId, refresh]);

    const run = {
        clean: () => send('clean', {}, { status: 'ccp' }),
        reset: () => send('reset'),
        setCleanDelay: (value) => send('set_clean_delay', { value }, { clean_delay: value }),
        setGlobeLight: (value) => send('set_globe_light', { value }, { globe_light: value }),
        setPanelLock: (value) => send('set_panel_lock', { value }, { panel_lock: value }),
    };

    return { box, loading: loading && !data, error: data ? null : error, run };
}

/**
 * Loads a range of a litter box card's history: `today`, `week` or `weight`.
 * @param {*} cardId - The card's id.
 * @param {string} range - The range.
 * @param {boolean} enabled - Whether it is shown.
 * @returns {{history: Object|null, loading: boolean, error: string|null}} The history (see the
 *   server's litterHistory).
 */
export function useLitterHistory(cardId, range, enabled) {
    const { data, loading, error } = usePolling(
        () => callService('homeassistant', { endpoint: 'litterbox_history', card_id: cardId, range }),
        { interval: HISTORY_INTERVAL[range] || 60000, enabled: enabled && cardId !== undefined, key: `${cardId}|${range}` },
    );
    return { history: data || null, loading: loading && !data, error: data ? null : error };
}
