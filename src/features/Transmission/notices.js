/**
 * What the Transmission card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { plural } from '../../lib/format';

/**
 * Transmission: torrents with an error, stalled ones, and downloads in progress. A server that
 * can't be reached is an alert of its own.
 * @param {Array<Object>} torrents - The torrents, with their simplified `state`.
 * @param {string|null} [error] - Why loading failed.
 * @returns {Array<Object>} The notices.
 */
export function transmissionNotices(torrents, error = null) {
    if (error) return [{ level: 'alert', title: "Can't reach Transmission" }];
    const count = (state) => torrents.filter(t => t.state === state).length;
    const failed = count('error');
    const stalled = count('stalled');
    const downloading = count('downloading');
    return [
        failed > 0 && { level: 'alert', count: failed, title: `${plural(failed, 'torrent')} with an error` },
        stalled > 0 && { level: 'todo', count: stalled, title: `${plural(stalled, 'torrent')} stalled` },
        downloading > 0 && { level: 'activity', count: downloading, title: `${plural(downloading, 'download')} in progress` },
    ].filter(Boolean);
}
