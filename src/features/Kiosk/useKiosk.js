import { useEffect, useMemo, useRef, useState } from 'react';
import { callService } from '../../lib/api';
import { useNow } from '../../hooks/useNow';
import { usePolling } from '../../hooks/usePolling';
import { useMediaPlayers } from '../MediaPlayer/useMediaPlayers';
import { normalizeKiosk } from '../../../shared/kiosk.js';
import {
    INITIAL_TAKEOVER, dismissTakeover, isNight, nextTakeover, screenMode, showTakeover, weatherOf,
} from './kioskModel';

/** How often the kiosk's sensors and switches are read, in ms. */
const STATE_INTERVAL = 1500;

/**
 * Reads a number from an entity state.
 * @param {Object|null|undefined} state - The state.
 * @returns {number|null} The number, or null when there is none.
 */
const numberOf = (state) => {
    const value = Number.parseFloat(state?.state);
    return Number.isFinite(value) ? value : null;
};

/**
 * Runs kiosk mode: reads the kiosk's sensors, media players and switches, works out whether to
 * show the dashboard, the clock or nothing (and switches the screen to match), which player
 * takes over the screen, and whether the clock is in night colours.
 * @param {Object} config - The dashboard config; its `kiosk` holds the settings.
 * @param {Object} [options]
 * @param {boolean} [options.suspended=false] - Keeps the dashboard, e.g. while it is edited.
 * @returns {Object} What the kiosk shows and the actions of its control center.
 */
export function useKiosk(config, { suspended = false } = {}) {
    const kiosk = useMemo(() => normalizeKiosk(config.kiosk), [config.kiosk]);
    const now = useNow('second');
    const t = now.getTime();
    const idleMs = kiosk.idle_timeout * 1000;

    const ids = useMemo(() => [
        kiosk.presence_entity, kiosk.face_entity, kiosk.illuminance_entity, kiosk.brightness_entity,
        kiosk.screen_entity, kiosk.weather_entity, ...kiosk.toggles,
    ].filter(Boolean), [kiosk]);
    const { data, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: ids, icons: true }),
        { interval: STATE_INTERVAL, enabled: ids.length > 0, key: ids.join(',') },
    );
    const [pending, setPending] = useState(/** @type {Object<string, {state: string, at: number}>} */ ({}));
    /**
     * An entity's state, with a change sent from the control center until the next reading.
     * @param {string|undefined} id - The entity.
     * @returns {Object|null} The state.
     */
    const stateOf = (id) => {
        if (!id) return null;
        const raw = data?.[id] ?? null;
        const change = pending[id];
        return change && change.at > updatedAt ? { ...raw, state: change.state } : raw;
    };

    const volumeId = kiosk.volume_entity ?? kiosk.media_players[0];
    const media = useMediaPlayers({ entities: kiosk.media_players, speakers: volumeId ? [volumeId] : [] });

    // Touches and keys keep the dashboard
    const [lastInteraction, setLastInteraction] = useState(() => Date.now());
    useEffect(() => {
        const touched = () => setLastInteraction(Date.now());
        window.addEventListener('pointerdown', touched, true);
        window.addEventListener('keydown', touched, true);
        return () => {
            window.removeEventListener('pointerdown', touched, true);
            window.removeEventListener('keydown', touched, true);
        };
    }, []);

    // A face looking at the screen keeps the dashboard too, except right after the clock was asked for
    const [ignoreLookingUntil, setIgnoreLookingUntil] = useState(0);
    const [lastLooking, setLastLooking] = useState(0);
    const looking = stateOf(kiosk.face_entity)?.state === 'on' && t >= ignoreLookingUntil;
    if (looking && lastLooking !== t) setLastLooking(t);

    const presenceState = stateOf(kiosk.presence_entity)?.state;
    const presence = presenceState === 'on' ? true : presenceState === 'off' ? false : undefined;
    const mode = suspended ? 'dashboard' : screenMode({
        now: t, lastInteraction, lastLooking: looking ? t : lastLooking, presence, idleMs,
    });

    // Night colours, re-evaluated when the light or the hour changes
    const lux = kiosk.illuminance_entity ? numberOf(stateOf(kiosk.illuminance_entity)) : null;
    const nightKey = `${lux}|${kiosk.night_below}|${now.getHours()}`;
    const [night, setNight] = useState({ key: '', value: false });
    if (night.key !== nightKey) {
        setNight({ key: nightKey, value: isNight({ lux, threshold: kiosk.night_below, wasNight: night.value, now }) });
    }

    // The player that takes over the screen, worked out again every second and with every reading
    const players = media.players;
    const playersKey = `${t}|${players.map(p => `${p.id}:${p.state}`).join(',')}`;
    const [takeover, setTakeover] = useState({ key: '', state: INITIAL_TAKEOVER });
    if (takeover.key !== playersKey) {
        setTakeover({
            key: playersKey,
            state: nextTakeover(takeover.state, players.map(p => ({ id: p.id, state: p.state })), t, kiosk.pause_timeout * 1000),
        });
    }
    const takeoverPlayer = players.find(p => p.id === takeover.state.shown) ?? null;

    // The screen is switched off when nobody is in the room, and on again when someone comes in
    const screenOn = mode !== 'off';
    const screenState = stateOf(kiosk.screen_entity)?.state;
    const sentScreen = useRef(/** @type {boolean|null} */ (null));
    useEffect(() => {
        if (!kiosk.screen_entity || suspended || screenState === undefined) return;
        if (sentScreen.current === screenOn) return;
        sentScreen.current = screenOn;
        if (screenState === (screenOn ? 'on' : 'off')) return;
        callService('homeassistant', { endpoint: 'kiosk', action: 'screen', on: screenOn }).catch((err) => {
            console.error('Kiosk screen:', err);
            sentScreen.current = null;
        });
    }, [kiosk.screen_entity, suspended, screenOn, screenState]);

    /**
     * Sends a control center action, showing the new state until the next reading.
     * @param {string} entityId - The entity that changes.
     * @param {string} shown - Its state to show meanwhile.
     * @param {Object} params - The kiosk action.
     */
    const send = async (entityId, shown, params) => {
        setPending(prev => ({ ...prev, [entityId]: { state: shown, at: Date.now() } }));
        try {
            await callService('homeassistant', { endpoint: 'kiosk', ...params });
            setTimeout(refresh, 600);
        } catch (err) {
            console.error(`Kiosk ${entityId}:`, err);
            setPending(prev => {
                const next = { ...prev };
                delete next[entityId];
                return next;
            });
        }
    };

    const brightnessState = stateOf(kiosk.brightness_entity);
    const brightness = kiosk.brightness_entity ? (() => {
        const value = numberOf(brightnessState);
        if (value === null) return null;
        const min = Number(brightnessState.attributes?.min ?? 0);
        const max = Number(brightnessState.attributes?.max ?? 100);
        return max > min ? (value - min) / (max - min) : value / 100;
    })() : null;

    const actions = {
        /** @param {number} level - 0–1 of the brightness entity's range. */
        setBrightness: (level) => {
            const min = Number(brightnessState?.attributes?.min ?? 0);
            const max = Number(brightnessState?.attributes?.max ?? 100);
            const value = Math.round(min + level * (max - min));
            send(kiosk.brightness_entity, String(value), { action: 'brightness', value });
        },
        /**
         * @param {string} entityId - A toggle.
         * @param {boolean} on - Whether to turn it on.
         */
        toggle: (entityId, on) => send(entityId, on ? 'on' : 'off', { action: 'toggle', entity_id: entityId, on }),
        /** Shows the clock now, until the screen is touched again. */
        showClock: () => {
            setLastInteraction(0);
            setLastLooking(0);
            setIgnoreLookingUntil(Date.now() + idleMs);
        },
        /** Swipes the player on screen away. */
        dismissPlayer: () => setTakeover(prev => ({ ...prev, state: dismissTakeover(prev.state) })),
        /** @param {string} id - The player to bring on screen. */
        showPlayer: (id) => setTakeover(prev => ({ ...prev, state: showTakeover(prev.state, id) })),
    };

    return {
        kiosk,
        mode,
        night: night.value,
        now,
        weather: weatherOf(stateOf(kiosk.weather_entity)),
        toggles: kiosk.toggles.map(id => {
            const state = stateOf(id);
            return {
                id,
                name: state?.attributes?.friendly_name || id,
                icon: state?.icon || null,
                on: state?.state === 'on',
                available: Boolean(state) && state.state !== 'unavailable' && state.state !== 'unknown',
            };
        }),
        brightness,
        players,
        volumePlayer: media.speakers[0] ?? null,
        takeoverPlayer,
        media: media.actions,
        actions,
    };
}
