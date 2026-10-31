import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { callService } from '../../../lib/api';
import { usePolling } from '../../../hooks/usePolling';
import { isDimmable, toLight } from './lightModel';

const POLL_INTERVAL = 2000;
const SEND_INTERVAL = 300;
const REFRESH_DELAY = 700;
// An optimistic value outlives polls that were already on their way when it was set
const OVERRIDE_GRACE = 1500;

/**
 * Loads an hacontrol entity for its control dialog (with its members, for groups) and changes
 * it. Every change shows at once; requests for the same lights are throttled while a slider
 * is dragged, and the final value is always sent.
 * @param {Object} entity - The entity config from the card (`entity_id`, `name`).
 * @param {boolean} enabled - Whether the dialog is open.
 * @param {() => void} [onChange] - Called after a change was sent and confirmed.
 * @returns {Object} The entity, its members, load state and actions.
 */
export function useEntityControls(entity, enabled, onChange) {
    const id = entity.entity_id;
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'details', entity_id: id }),
        { interval: POLL_INTERVAL, enabled: enabled && Boolean(id), key: id || '' },
    );
    const [overrides, setOverrides] = useState(/** @type {Object<string, Object>} */ ({}));
    const queue = useRef(new Map());
    const refreshTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const changed = useRef(onChange);
    useLayoutEffect(() => { changed.current = onChange; });

    useEffect(() => () => {
        clearTimeout(refreshTimer.current);
        queue.current.forEach(q => clearTimeout(q.timer));
    }, []);

    const fresh = (eid) => (overrides[eid] && overrides[eid].until > updatedAt ? overrides[eid] : undefined);
    const memberIds = Object.keys(data?.members || {});
    const members = memberIds.map(mid => toLight(mid, data.members[mid], fresh(mid)));
    const main = toLight(id, data?.entity, fresh(id), entity.name);
    const isGroup = memberIds.length > 0;
    if (isGroup) main.on = members.some(m => m.on);

    /**
     * Shows changes before Home Assistant confirms them.
     * @param {Object<string, Object>} changes - Changes per entity id.
     */
    const applyOverrides = useCallback((changes) => {
        const until = Date.now() + OVERRIDE_GRACE;
        setOverrides(prev => {
            const next = { ...prev };
            Object.entries(changes).forEach(([eid, change]) => { next[eid] = { ...prev[eid], ...change, until }; });
            return next;
        });
    }, []);

    /**
     * Sends a control request, at most every SEND_INTERVAL per key; `final` sends at once.
     * @param {string} key - Groups requests that replace each other (e.g. one slider).
     * @param {Object} params - Control parameters.
     * @param {boolean} [final=true] - Whether this is the last value (e.g. slider released).
     */
    const send = useCallback((key, params, final = true) => {
        const q = queue.current.get(key) || { last: 0, timer: undefined, params: null };
        q.params = params;
        queue.current.set(key, q);
        const fire = () => {
            q.timer = undefined;
            q.last = Date.now();
            const body = q.params;
            callService('homeassistant', { endpoint: 'control', ...body })
                .then(() => {
                    clearTimeout(refreshTimer.current);
                    refreshTimer.current = setTimeout(() => {
                        refresh();
                        changed.current?.();
                    }, REFRESH_DELAY);
                })
                .catch(err => {
                    console.error(`Control ${key}:`, err);
                    // Show Home Assistant's state again instead of the failed change
                    setOverrides(prev => {
                        const next = { ...prev };
                        (body.entity_ids || []).forEach(eid => { delete next[eid]; });
                        return next;
                    });
                });
        };
        const wait = SEND_INTERVAL - (Date.now() - q.last);
        if (final || wait <= 0) {
            clearTimeout(q.timer);
            fire();
        } else if (!q.timer) {
            q.timer = setTimeout(fire, wait);
        }
    }, [refresh]);

    const dimmableMembers = () => members.filter(isDimmable);

    const actions = {
        /** Switches one light (or the whole group when given the group). */
        setOn: (light, on) => {
            const ids = light.id === id && isGroup ? memberIds : [light.id];
            applyOverrides(Object.fromEntries([...ids, light.id].map(eid => [eid, { on }])));
            send(`on:${light.id}`, { entity_ids: ids, action: on ? 'turn_on' : 'turn_off' });
        },
        /** Sets one light's brightness; 0 turns it off. */
        setBrightness: (light, pct, final) => {
            const value = Math.round(Math.min(100, Math.max(0, pct)));
            applyOverrides({ [light.id]: value > 0 ? { on: true, bri: value } : { on: false } });
            send(`bri:${light.id}`, value > 0
                ? { entity_ids: [light.id], action: 'turn_on', brightness_pct: value }
                : { entity_ids: [light.id], action: 'turn_off' }, final);
        },
        /** Dims every dimmable member that is on (or all of them when none is). */
        setGroupBrightness: (pct, final) => {
            const value = Math.round(Math.min(100, Math.max(0, pct)));
            const on = dimmableMembers().filter(m => m.on);
            const targets = (on.length ? on : dimmableMembers()).map(m => m.id);
            if (targets.length === 0) return;
            applyOverrides(Object.fromEntries(targets.map(eid => [eid, value > 0 ? { on: true, bri: value } : { on: false }])));
            send('bri:group', value > 0
                ? { entity_ids: targets, action: 'turn_on', brightness_pct: value }
                : { entity_ids: targets, action: 'turn_off' }, final);
        },
        /** Sets a white tone (`{ ct }`) or a color (`{ h, s }`), turning the light on. */
        setColor: (light, change, final) => {
            const isCt = change.ct !== undefined;
            applyOverrides({ [light.id]: { on: true, mode: isCt ? 'ct' : 'hs', ...change } });
            const h = change.h ?? light.h;
            const s = change.s ?? light.s;
            send(`color:${light.id}`, isCt
                ? { entity_ids: [light.id], action: 'turn_on', color_temp_kelvin: Math.round(change.ct) }
                : { entity_ids: [light.id], action: 'turn_on', hs_color: [Math.round(h), Math.round(s)] }, final);
        },
    };

    return {
        loading: loading && !data,
        error: data ? null : error,
        isGroup,
        main,
        members,
        actions,
    };
}
