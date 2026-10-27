import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const EMPTY = { prs: [], stats: { count: 0, open: 0 } };

/**
 * Polls pull requests for a git card. The repositories and filters are read by the
 * server from the card's config, so only the card id is sent.
 * @param {string} cardId - Id of the git card in config.yaml.
 * @param {number} [interval=60000] - Polling interval in ms.
 * @returns {{prs: Array<Object>, stats: {count: number, open: number}, loading: boolean, error: string|null}}
 */
export const useGit = (cardId, interval = 60000) => {
    const { data = EMPTY, loading, error } = usePolling(
        () => callService('git', { cardId }),
        { interval, enabled: cardId !== undefined, key: String(cardId) }
    );
    return { ...data, loading, error };
};
