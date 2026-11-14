import { createContext, useContext, useEffect, useId, useSyncExternalStore } from 'react';

/**
 * Notices are how cards tell the dashboard that something needs attention, without the
 * sidebar or any other part knowing about the card. A card publishes at most one notice with
 * `useCardNotice`, derived from data it already has; the notice exists while the condition
 * holds and goes away when the card passes nothing or unmounts.
 *
 * Levels, most urgent first:
 * - `alert`: something is broken, such as an app that is offline.
 * - `todo`: something waits for the user, such as open pull requests.
 * - `activity`: something is running, such as a print or a download.
 */
export const NOTICE_LEVELS = /** @type {const} */ (['alert', 'todo', 'activity']);

const RANK = { alert: 0, todo: 1, activity: 2 };

/**
 * @typedef {Object} Notice
 * @property {'alert'|'todo'|'activity'} level - How urgent it is.
 * @property {string} title - What it is about, such as "3 open pull requests".
 * @property {number} [count] - How many things it stands for; 1 when left out.
 */

/**
 * @typedef {Notice & {page: string, card: string}} PublishedNotice
 */

/**
 * Creates the store all notices of a dashboard are kept in. Each publishing hook has its own
 * entry, which holds the notices of its card, so a card that unmounts only removes its own.
 * @returns {{set: (token: string, notices: PublishedNotice|PublishedNotice[]|null) => void, subscribe: (listener: () => void) => () => void, getSnapshot: () => PublishedNotice[]}} The store.
 */
export function createNoticeStore() {
    const entries = new Map();
    let snapshot = /** @type {PublishedNotice[]} */ ([]);
    const listeners = new Set();
    const emit = () => {
        snapshot = [...entries.values()].flat();
        listeners.forEach(listener => listener());
    };
    return {
        set(token, notices) {
            const list = (Array.isArray(notices) ? notices : [notices]).filter(Boolean);
            if (list.length > 0) {
                const old = entries.get(token);
                if (old && JSON.stringify(old) === JSON.stringify(list)) return;
                entries.set(token, list);
            } else if (!entries.delete(token)) {
                return;
            }
            emit();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => snapshot,
    };
}

/**
 * Checks and tidies a notice a card passed.
 * @param {*} notice - What the card passed: a notice, or a falsy value for none.
 * @returns {Notice|null} The notice, or null when there is none or it is not valid.
 */
export function normalizeNotice(notice) {
    if (!notice || typeof notice !== 'object' || !NOTICE_LEVELS.includes(notice.level)) return null;
    const title = typeof notice.title === 'string' ? notice.title.trim() : '';
    if (!title) return null;
    const count = Number.isFinite(notice.count) && notice.count > 0 ? Math.round(notice.count) : undefined;
    return { level: notice.level, title, ...(count ? { count } : {}) };
}

/**
 * Whether a card's `notify` setting lets a notice of a level through.
 * @param {boolean|Object<string, boolean>|undefined} notify - `false` turns all notices of the card
 *   off, `{ activity: false }` only those of one level.
 * @param {string} level - The notice's level.
 * @returns {boolean} Whether the notice is published.
 */
export function notifies(notify, level) {
    if (notify === false) return false;
    if (notify && typeof notify === 'object') return notify[level] !== false;
    return true;
}

/**
 * @typedef {Object} NoticeSummary
 * @property {PublishedNotice[]} items - The notices, most urgent first.
 * @property {number} alert - How many things are broken.
 * @property {number} todo - How many things wait for the user.
 * @property {number} activity - How many things are running.
 * @property {'alert'|'todo'|'activity'|null} level - The most urgent level, or null when there are none.
 * @property {number} count - The count of that level.
 */

/**
 * Sums up notices, of all pages or of some.
 * @param {PublishedNotice[]} notices - All notices.
 * @param {string[]} [pages] - Keys of the pages to include; all pages when left out.
 * @returns {NoticeSummary} The summary.
 */
export function summarizeNotices(notices, pages) {
    const keys = pages ? new Set(pages) : null;
    const items = notices
        .filter(n => !keys || keys.has(n.page))
        .sort((a, b) => RANK[a.level] - RANK[b.level]);
    const total = (level) => items.filter(n => n.level === level).reduce((sum, n) => sum + (n.count ?? 1), 0);
    const summary = { items, alert: total('alert'), todo: total('todo'), activity: total('activity') };
    const level = NOTICE_LEVELS.find(l => summary[l] > 0) ?? null;
    return { ...summary, level, count: level ? summary[level] : 0 };
}

export const NoticesContext = createContext(/** @type {ReturnType<typeof createNoticeStore>|null} */ (null));
export const NoticePageContext = createContext(/** @type {string|undefined} */ (undefined));
export const NoticeCardContext = createContext(/** @type {{id: string, notify: string}|undefined} */ (undefined));

/**
 * Publishes the notices of the card it is called in, for the sidebar and anything else that
 * shows notices. Pass a notice, a list of them (falsy entries are skipped), or a falsy value
 * when there is nothing to tell; the notices also go away when the card unmounts. A card with
 * `notify: false` in its config publishes nothing, `notify: { activity: false }` no activity.
 * @example
 * const { prs } = useGit(config.id);
 * useCardNotice(prs.length > 0 && { level: 'todo', count: prs.length, title: `${prs.length} open pull requests` });
 * @example
 * useCardNotice([failed && { level: 'alert', title: 'Print failed' }, printing && { level: 'activity', title: 'Printing' }]);
 * @param {Notice|Array<Notice|null|undefined|false>|null|undefined|false} notices - The notice or notices.
 */
export function useCardNotice(notices) {
    const store = useContext(NoticesContext);
    const page = useContext(NoticePageContext);
    const card = useContext(NoticeCardContext);
    const token = useId();
    const scoped = Boolean(store && page !== undefined && card);
    const notify = scoped ? JSON.parse(card.notify) : null;
    const list = scoped
        ? (Array.isArray(notices) ? notices : [notices])
            .map(normalizeNotice)
            .filter(n => n && notifies(notify, n.level))
            .map(n => ({ ...n, page, card: card.id }))
        : [];
    const serialized = list.length > 0 ? JSON.stringify(list) : null;

    useEffect(() => {
        store?.set(token, serialized ? JSON.parse(serialized) : null);
    }, [store, token, serialized]);

    useEffect(() => () => store?.set(token, null), [store, token]);
}

/**
 * Follows all notices of the dashboard.
 * @returns {PublishedNotice[]} The notices, in no particular order.
 */
export function useNotices() {
    const store = useContext(NoticesContext);
    return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getSnapshot ?? noNotices, noNotices);
}

const EMPTY = /** @type {PublishedNotice[]} */ ([]);
const noNotices = () => EMPTY;
const noSubscription = () => () => {};
