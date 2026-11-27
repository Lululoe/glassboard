/**
 * What the Media Calendar card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { plural } from '../../lib/format';

/**
 * Media Calendar: episodes and films that have come out but haven't been downloaded.
 * @param {Array<Object>} events - The calendar's events, with their `status`.
 * @returns {Array<Object>} The notices.
 */
export function mediaNotices(events) {
    const missing = events.filter(e => e.status === 'missing');
    if (missing.length === 0) return [];
    return [{
        level: 'todo',
        count: missing.length,
        title: missing.length === 1 ? `${missing[0].title} is missing` : `${plural(missing.length, 'release')} missing`,
    }];
}
