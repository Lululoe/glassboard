import { useCallback, useMemo, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const CONFIRM_DELAY = 500;

/**
 * Polls the states of Home Assistant entities in a single request and toggles them with
 * optimistic updates. An optimistic state is shown until newer data arrives from the
 * server, and is dropped if the action fails.
 * @param {Array<Object>} entities - Entity configs (entity_id, on_action, off_action, on_state, off_state).
 * @param {number} [interval=5000] - Polling interval in ms.
 * @returns {{entityStates: Object<string, Object>, loading: boolean, error: string|null, toggleEntity: (entity: Object, isOn: boolean) => Promise<void>}}
 */
export const useHomeAssistant = (entities, interval = 5000) => {
    const ids = entities.map(e => e.entity_id).filter(Boolean);
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: ids }),
        { interval, enabled: ids.length > 0, key: ids.join(',') }
    );
    const [overrides, setOverrides] = useState(/** @type {Object<string, {state: string, at: number}>} */ ({}));

    const entityStates = useMemo(() => {
        const states = { ...data };
        Object.entries(overrides).forEach(([id, override]) => {
            if (override.at > updatedAt) states[id] = { ...states[id], state: override.state };
        });
        return states;
    }, [data, overrides, updatedAt]);

    const toggleEntity = useCallback(async (entity, isOn) => {
        const action = isOn ? entity.off_action : entity.on_action;
        if (!action?.service) return;

        const id = String(entity.entity_id);
        const optimisticState = isOn ? (entity.off_state || 'off') : (entity.on_state || 'on');
        setOverrides(prev => ({ ...prev, [id]: { state: optimisticState, at: Date.now() } }));

        try {
            await callService('homeassistant', { endpoint: 'services', entity_id: id, action: action.service });
            setTimeout(refresh, CONFIRM_DELAY);
        } catch (err) {
            console.error(`Failed to toggle ${id}:`, err);
            setOverrides(prev => {
                const { [id]: _removed, ...rest } = prev;
                return rest;
            });
        }
    }, [refresh]);

    return { entityStates, loading, error, toggleEntity };
};
