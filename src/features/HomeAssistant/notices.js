/**
 * What the Entity card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */

/**
 * Whether a Home Assistant state means the device can't be reached.
 * @param {Object|undefined} state - The entity's state.
 * @returns {boolean} True for missing, unavailable or unknown entities.
 */
const unreachable = (state) => !state || state.state === 'unavailable' || state.state === 'unknown';

/**
 * HA Control: a device that can't be reached, and a lock that is unlocked. Lights and switches
 * that are on are left alone.
 * @param {Array<Object>} entities - The card's entities (`entity_id`, `name`).
 * @param {Object<string, Object>} states - Their states by entity id.
 * @param {boolean} loaded - Whether the states have loaded, so a slow start isn't reported.
 * @returns {Array<Object>} The notices.
 */
export function haControlNotices(entities, states, loaded) {
    if (!loaded) return [];
    return entities.flatMap((entity) => {
        const state = states[entity.entity_id];
        const name = entity.name || state?.attributes?.friendly_name || entity.entity_id;
        if (unreachable(state)) return [{ level: 'alert', title: `${name} is unavailable` }];
        if (entity.entity_id.startsWith('lock.') && ['unlocked', 'open', 'opening'].includes(state.state)) {
            return [{ level: 'todo', title: `${name} is ${state.state === 'unlocked' ? 'unlocked' : 'open'}` }];
        }
        return [];
    });
}
