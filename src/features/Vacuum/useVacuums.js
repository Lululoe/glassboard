import { useCallback, useEffect, useRef, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const POLL_INTERVAL = 3000;
const REFRESH_DELAY = 800;
// An optimistic value outlives polls that were already on their way when it was set
const OVERRIDE_GRACE = 2500;

/**
 * Loads a vacuum card's robots and controls them. Changes show at once; rooms picked on the
 * card are kept here, so the card and the robot's pop-up share them.
 * @param {*} cardId - The card's id.
 * @param {boolean} enabled - Whether the card has robots.
 * @returns {Object} `robots`, `loading`, `error`, `selection`, `toggleRoom` and `run`.
 */
export function useVacuums(cardId, enabled) {
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'vacuum', card_id: cardId }),
        { interval: POLL_INTERVAL, enabled: enabled && cardId !== undefined, key: String(cardId) },
    );
    const [overrides, setOverrides] = useState(/** @type {Object<string, Object>} */ ({}));
    const [selection, setSelection] = useState(/** @type {Object<string, string[]>} */ ({}));
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    useEffect(() => () => clearTimeout(timer.current), []);

    const robots = (data?.robots || []).map(robot => {
        const o = overrides[robot.entity_id];
        if (!o || o.until <= updatedAt) return robot;
        return {
            ...robot,
            state: o.state ?? robot.state,
            fan: o.fan !== undefined ? { ...robot.fan, value: o.fan } : robot.fan,
            wetness: o.wetness !== undefined && robot.wetness ? { ...robot.wetness, value: o.wetness } : robot.wetness,
        };
    });

    /**
     * Sends an action and shows its result right away.
     * @param {Object} robot - The robot.
     * @param {string} action - The action (see the server's vacuumCall).
     * @param {Object} [extra] - Its value.
     * @param {Object} [optimistic] - What to show until Home Assistant confirms.
     * @returns {Promise<void>}
     */
    const send = useCallback(async (robot, action, extra = {}, optimistic = null) => {
        if (optimistic) {
            setOverrides(prev => ({ ...prev, [robot.entity_id]: { ...prev[robot.entity_id], ...optimistic, until: Date.now() + OVERRIDE_GRACE } }));
        }
        try {
            await callService('homeassistant', { endpoint: 'vacuum_action', card_id: cardId, entity_id: robot.entity_id, action, ...extra });
            clearTimeout(timer.current);
            timer.current = setTimeout(refresh, REFRESH_DELAY);
        } catch (err) {
            console.error(`Vacuum ${action}:`, err);
            setOverrides(prev => {
                const next = { ...prev };
                delete next[robot.entity_id];
                return next;
            });
        }
    }, [cardId, refresh]);

    const run = {
        /** Starts (the picked rooms, or everywhere) or, while cleaning, pauses. */
        startOrPause: (robot) => {
            if (robot.state === 'cleaning') return send(robot, 'pause', {}, { state: 'paused' });
            const areas = selection[robot.entity_id] || [];
            // A paused robot carries on with what it was doing
            if (areas.length > 0 && robot.state !== 'paused') return send(robot, 'clean_rooms', { areas }, { state: 'cleaning' });
            return send(robot, 'start', {}, { state: 'cleaning' });
        },
        stop: (robot) => send(robot, 'stop', {}, { state: 'idle' }),
        dock: (robot) => send(robot, 'return_to_base', {}, { state: 'returning' }),
        locate: (robot) => send(robot, 'locate'),
        setFan: (robot, value) => send(robot, 'set_fan', { value }, { fan: value }),
        setWetness: (robot, value) => send(robot, 'set_wetness', { value }, { wetness: value }),
        resetConsumable: (robot, index) => send(robot, 'reset_consumable', { index }),
    };

    const toggleRoom = useCallback((robot, area) => setSelection(prev => {
        const current = prev[robot.entity_id] || [];
        return { ...prev, [robot.entity_id]: current.includes(area) ? current.filter(a => a !== area) : [...current, area] };
    }), []);

    return { robots, loading: loading && !data, error: data ? null : error, selection, toggleRoom, run };
}
