import { useMemo, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { loggedInName, normalizeKiosk } from '../../../shared/kiosk.js';

/** How often the logged-in person is read, in ms. */
const USER_INTERVAL = 2000;

/**
 * Reads a time attribute.
 * @param {*} value - An ISO date string, or anything else.
 * @returns {Date|null} The time, or null when it isn't one.
 */
const timeOf = (value) => {
    if (typeof value !== 'string' || !value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * @typedef {Object} KioskUser
 * @property {string} name - Who is logged in.
 * @property {Date|null} since - When they logged in, from the entity's `since` attribute.
 * @property {Date|null} expires - When the login ends, from its `expires` attribute.
 * @property {(() => Promise<void>)|null} logout - Logs them out; null without a logout entity.
 */

/**
 * Who is logged in on the kiosk tablet, from the kiosk's user entity (such as a face
 * recognition sensor whose state is the person's name). Only read on kiosk screens: other
 * screens don't belong to the person in front of the tablet.
 * @param {Object|null|undefined} config - The dashboard config; its `kiosk` holds the entities.
 * @param {boolean} enabled - Whether this screen is in kiosk mode.
 * @returns {KioskUser|null} The person, or null when nobody is logged in.
 */
export function useKioskUser(config, enabled) {
    const kiosk = useMemo(() => normalizeKiosk(config?.kiosk), [config?.kiosk]);
    const id = enabled ? kiosk.user_entity : undefined;
    const { data, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: [id] }),
        { interval: USER_INTERVAL, enabled: Boolean(id), key: id ?? '' },
    );
    // After logging out the bubble goes at once, without waiting for the next reading
    const [loggedOutAt, setLoggedOutAt] = useState(0);

    const state = id ? data?.[id] : null;
    const name = loggedInName(state?.state);
    if (!name || loggedOutAt > updatedAt) return null;
    return {
        name,
        since: timeOf(state.attributes?.since),
        expires: timeOf(state.attributes?.expires),
        logout: kiosk.logout_entity
            ? async () => {
                await callService('homeassistant', { endpoint: 'kiosk', action: 'logout' });
                setLoggedOutAt(Date.now());
                refresh();
            }
            : null,
    };
}
