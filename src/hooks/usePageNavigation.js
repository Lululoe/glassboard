import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Returns the URL key of a page: its id, or its index when it has none.
 * @param {Object} page - Page config.
 * @param {number} idx - Page index.
 * @returns {string} The page key.
 */
const pageKey = (page, idx) => String(page.id ?? idx);

/**
 * Reads the page key from the current URL path.
 * @returns {string} Decoded path without the leading slash.
 */
const keyFromLocation = () => decodeURIComponent(window.location.pathname.slice(1));

/**
 * Finds the nearest page that is not hidden, walking from `from` in direction `step`.
 * @param {Array<Object>} pages - Page configs.
 * @param {number} from - Starting index (excluded).
 * @param {1|-1} step - Direction.
 * @returns {number} Index of the visible page, or -1.
 */
function findVisible(pages, from, step) {
    for (let i = from + step; i >= 0 && i < pages.length; i += step) {
        if (!pages[i].hidden && !pages[i].excluded) return i;
    }
    return -1;
}

/**
 * Builds the URL of a page, keeping the query string (like `?hide=`) of the current URL.
 * @param {string} key - Page key.
 * @returns {string} The URL path and query.
 */
const urlOf = (key) => `/${encodeURIComponent(key)}${window.location.search}`;

/**
 * Tracks the active page and keeps it in sync with the URL (`/<page id>`), including the
 * browser back/forward buttons. The page requested by the URL is resolved once the
 * pages are known, so deep links work even though the config loads asynchronously.
 * Hidden pages are skipped by next/prev but can still be opened by URL; pages marked `excluded`
 * (hidden with the `hide` URL parameter) cannot be opened at all.
 * @param {Array<Object>} pages - Page configs.
 * @returns {{pageIndex: number, goTo: (idx: number) => void, goToKey: (key: string) => void, next: () => void, prev: () => void, hasNext: boolean, hasPrev: boolean}}
 */
export function usePageNavigation(pages) {
    const [requestedKey, setRequestedKey] = useState(keyFromLocation);
    const keys = useMemo(() => pages.map(pageKey), [pages]);

    const requestedIndex = keys.indexOf(requestedKey);
    const firstVisible = findVisible(pages, -1, 1);
    const firstOpenable = pages.findIndex(p => !p.excluded);
    const pageIndex = requestedIndex !== -1 && !pages[requestedIndex].excluded
        ? requestedIndex
        : Math.max(0, firstVisible !== -1 ? firstVisible : firstOpenable);

    useEffect(() => {
        if (keys.length === 0) return;
        const path = `/${encodeURIComponent(keys[pageIndex])}`;
        if (window.location.pathname !== path) window.history.replaceState(null, '', urlOf(keys[pageIndex]));
    }, [keys, pageIndex]);

    useEffect(() => {
        const onPopState = () => setRequestedKey(keyFromLocation());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const goTo = useCallback((idx) => {
        if (idx < 0 || idx >= keys.length || idx === pageIndex || pages[idx].excluded) return;
        setRequestedKey(keys[idx]);
        window.history.pushState(null, '', urlOf(keys[idx]));
    }, [keys, pages, pageIndex]);

    // A page that is about to exist, like one just added in edit mode, can be opened by its key
    const goToKey = useCallback((key) => {
        setRequestedKey(key);
        window.history.pushState(null, '', urlOf(key));
    }, []);

    const nextIndex = findVisible(pages, pageIndex, 1);
    const prevIndex = findVisible(pages, pageIndex, -1);

    return {
        pageIndex,
        goTo,
        goToKey,
        next: () => goTo(nextIndex),
        prev: () => goTo(prevIndex),
        hasNext: nextIndex !== -1,
        hasPrev: prevIndex !== -1,
    };
}
