import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const EMPTY = [];

/**
 * Polls the reachability of the apps on an app grid card. The URLs are read by the
 * server from the card's config, so only the card id is sent.
 * @param {string} cardId - Id of the app grid card in config.yaml.
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - Set to false to skip checking.
 * @param {number} [options.interval=60000] - Polling interval in ms.
 * @returns {Array<boolean|null>} Online state per app index; null when not checked.
 */
export const useAppStatus = (cardId, { enabled = true, interval = 60000 } = {}) => {
    const { data } = usePolling(
        () => callService('appstatus', { cardId }),
        { interval, enabled: enabled && cardId !== undefined, key: String(cardId) }
    );
    return data?.statuses ?? EMPTY;
};
