import { callService } from '../../lib/api';
import { BACKGROUND_SLOW, usePolling } from '../../hooks/usePolling';

/** The scanner updates sizes every 15 minutes at most, so once a minute is plenty. */
const POLL_INTERVAL = 60 * 1000;

/** Where a storage card can read its volume from. */
export const STORAGE_SOURCES = ['prometheus', 'homeassistant'];

/**
 * Loads a storage card's volume from its source, through the server.
 * @param {*} cardId - The card's id.
 * @param {string|undefined} source - The card's `source`; nothing loads without a known one.
 * @returns {{volume: Object|undefined, loading: boolean, error: string|null}} The volume in GB
 *   (kept after a failed poll), whether the first load is pending and the last error.
 */
export function useStorage(cardId, source) {
    const enabled = STORAGE_SOURCES.includes(source) && cardId !== undefined;
    const { data, loading, error } = usePolling(
        () => callService('storage', { card_id: cardId }),
        { interval: POLL_INTERVAL, backgroundInterval: BACKGROUND_SLOW, enabled, key: `${cardId}|${source}` },
    );
    return { volume: data, loading: enabled && loading && !data, error: enabled ? error : null };
}
