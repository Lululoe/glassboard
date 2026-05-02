import { useState, useEffect, useCallback } from 'react';

// ...
/**
 * Custom hook for interacting with Home Assistant entities.
 * Polls entity states and provides a toggle function with optimistic updates.
 * @param {Array} entities - List of entity configurations to track.
 * @param {string} [service='homeassistant'] - The Home Assistant service name.
 * @param {number} [interval=5000] - Polling interval in milliseconds.
 * @returns {Object} Object containing entityStates map, loading boolean, error string, and toggleEntity function.
 */
export const useHomeAssistant = (entities, service = 'homeassistant', interval = 5000) => {
    const [entityStates, setEntityStates] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch states for all entities
    useEffect(() => {
        if (!entities || entities.length === 0) {
            setLoading(false);
            return;
        }

        let mounted = true;

        const fetchStates = async () => {
            try {
                const statePromises = entities.map(async (entity) => {
                    try {
                        const response = await fetch(`/api?service=${service}&endpoint=states/${entity.entity_id}`);
                        if (response.ok) {
                            const state = await response.json();
                            return { entity_id: entity.entity_id, state };
                        }
                    } catch (err) {
                        console.error(`Failed to fetch state for ${entity.entity_id}:`, err);
                    }
                    return null;
                });

                const results = await Promise.all(statePromises);
                if (!mounted) return;

                const statesMap = {};
                results.forEach(result => {
                    if (result) {
                        statesMap[result.entity_id] = result.state;
                    }
                });
                setEntityStates(statesMap);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch entity states:', err);
                if (!mounted) return;
                setError(String(err));
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchStates();
        const id = setInterval(fetchStates, interval);

        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, [entities.length, interval]);

    // Toggle entity with optimistic update
    const toggleEntity = useCallback(async (entity, currentIsOn) => {
        const action = currentIsOn ? entity.off_action : entity.on_action;
        if (!action || !action.service) {
            console.warn('No action configured for entity:', entity.entity_id);
            return;
        }

        // Optimistic update - immediately update local state
        const optimisticState = currentIsOn ? 'off' : 'on';
        setEntityStates(prev => ({
            ...prev,
            [entity.entity_id]: {
                ...prev[entity.entity_id],
                state: optimisticState
            }
        }));

        try {
            // Use query param for service dispatch to avoid collision with 'service' in body
            const response = await fetch(`/api?service=${service}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: 'services',
                    entity_id: entity.entity_id,
                    service: action.service
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to call service:', error);
                // Revert optimistic update on error
                setEntityStates(prev => ({
                    ...prev,
                    [entity.entity_id]: prev[entity.entity_id]
                }));
                return;
            }

            // Fetch actual state after a short delay to confirm
            setTimeout(async () => {
                try {
                    const stateResponse = await fetch(`/api/homeassistant/states/${entity.entity_id}`);
                    if (stateResponse.ok) {
                        const newState = await stateResponse.json();
                        setEntityStates(prev => ({
                            ...prev,
                            [entity.entity_id]: newState
                        }));
                    }
                } catch (err) {
                    console.error('Error fetching updated state:', err);
                }
            }, 500);
        } catch (err) {
            console.error('Error toggling entity:', err);
            // Revert optimistic update on error
            setEntityStates(prev => ({
                ...prev,
                [entity.entity_id]: prev[entity.entity_id]
            }));
        }
    }, []);

    return { entityStates, loading, error, toggleEntity };
};
