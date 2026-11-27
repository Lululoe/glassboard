/**
 * What the Pull Requests card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { plural } from '../../lib/format';

/**
 * Pull Requests: open pull requests that wait for review. Drafts are still being worked on.
 * @param {Array<Object>} prs - The pull requests the card shows.
 * @returns {Array<Object>} The notices.
 */
export function gitNotices(prs) {
    const open = prs.filter(pr => pr.state === 'open');
    if (open.length === 0) return [];
    return [{ level: 'todo', count: open.length, title: `${plural(open.length, 'open pull request')}` }];
}
