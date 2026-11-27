/**
 * What the App Grid card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { plural } from '../../lib/format';

/**
 * App Grid: apps that fail their status check.
 * @param {Array<Object>} apps - The card's apps.
 * @param {Array<boolean|null>} statuses - Whether each app answered; null when not checked.
 * @returns {Array<Object>} The notices.
 */
export function appGridNotices(apps, statuses) {
    const offline = apps.filter((app, i) => statuses[i] === false && app?.statusCheck !== false);
    if (offline.length === 0) return [];
    return [{
        level: 'alert',
        count: offline.length,
        title: offline.length === 1 ? `${offline[0].name || 'An app'} is offline` : `${plural(offline.length, 'app')} offline`,
    }];
}
