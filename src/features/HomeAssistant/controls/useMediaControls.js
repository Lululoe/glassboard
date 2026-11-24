import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { callService } from '../../../lib/api';
import { usePolling } from '../../../hooks/usePolling';
import { toMediaPlayer } from './mediaModel';

const POLL_INTERVAL = 1000;
const SEND_INTERVAL = 300;
const REFRESH_DELAY = 700;
// An optimistic value outlives polls that were already on their way when it was set
const OVERRIDE_GRACE = 2500;

/**
 * Loads a media player of an Entity tile for its pop-up and changes its power, input and
 * volume. Every change shows at once and is replaced by Home Assistant's state once confirmed;
 * a failed change is dropped again. Volume requests are throttled while the slider is dragged.
 * @param {Object} entity - The entity config from the card (`entity_id`, `name`, `sources`).
 * @param {() => void} [onChange] - Called after a change was sent and confirmed.
 * @returns {{player: Object, loading: boolean, error: string|null, actions: Object}} The player
 *   (see toMediaPlayer), load state and actions.
 */
export function useMediaControls(entity, onChange) {
    const id = entity.entity_id;
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'details', entity_id: id }),
        { interval: POLL_INTERVAL, enabled: Boolean(id), key: id || '' },
    );
    const [pending, setPending] = useState(/** @type {Object} */ ({}));
    const timers = useRef({ refresh: undefined, volume: undefined, lastVolume: 0 });
    const changed = useRef(onChange);
    useLayoutEffect(() => { changed.current = onChange; });
    useEffect(() => () => {
        clearTimeout(timers.current.refresh);
        clearTimeout(timers.current.volume);
    }, []);

    const fresh = pending.until > updatedAt ? pending : {};
    const player = toMediaPlayer(entity, data?.entity, fresh);

    const show = useCallback((change) => {
        setPending(prev => ({ ...(prev.until > Date.now() ? prev : {}), ...change, until: Date.now() + OVERRIDE_GRACE }));
    }, []);

    const send = useCallback((params, undo) => callService('homeassistant', { endpoint: 'control', entity_id: id, entity_ids: [id], ...params })
        .then(() => {
            clearTimeout(timers.current.refresh);
            timers.current.refresh = setTimeout(() => {
                refresh();
                changed.current?.();
            }, REFRESH_DELAY);
        })
        .catch(err => {
            console.error(`Media ${params.action}:`, err);
            setPending(prev => {
                const next = { ...prev };
                undo.forEach(key => { delete next[key]; });
                return next;
            });
        }), [id, refresh]);

    const actions = {
        /** Switches the player on or off. */
        setOn: (on) => {
            show({ on });
            send({ action: on ? 'turn_on' : 'turn_off' }, ['on']);
        },
        /** Switches to an input, turning the player on first when it's off. */
        selectSource: async (source) => {
            const wasOff = !player.on;
            show({ on: true, source });
            if (wasOff && player.can.power) await send({ action: 'turn_on' }, ['on']);
            send({ action: 'select_source', source }, ['source']);
        },
        /** Sets the volume in percent; `final` sends at once, otherwise at most every 300 ms. */
        setVolume: (pct, final) => {
            const value = Math.round(Math.min(100, Math.max(0, pct)));
            show({ volume: value });
            const t = timers.current;
            const fire = () => {
                t.volume = undefined;
                t.lastVolume = Date.now();
                send({ action: 'volume_set', volume_level: value / 100 }, ['volume']);
            };
            clearTimeout(t.volume);
            const wait = SEND_INTERVAL - (Date.now() - t.lastVolume);
            if (final || wait <= 0) fire();
            else t.volume = setTimeout(fire, wait);
        },
        /** Turns the volume one step up or down. */
        stepVolume: (up) => {
            if (player.volume !== null) show({ volume: Math.min(100, Math.max(0, player.volume + (up ? 1 : -1))) });
            send({ action: up ? 'volume_up' : 'volume_down' }, ['volume']);
        },
        /** Mutes or unmutes. */
        setMuted: (muted) => {
            show({ muted });
            send({ action: 'volume_mute', is_volume_muted: muted }, ['muted']);
        },
    };

    return { player, loading: loading && !data, error: data ? null : error, actions };
}
