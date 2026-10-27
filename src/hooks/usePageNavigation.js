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
        if (!pages[i].hidden) return i;
    }
    return -1;
}

/**
 * Tracks the active page and keeps it in sync with the URL (`/<page id>`), including the
 * browser back/forward buttons. The page requested by the URL is resolved once the
 * pages are known, so deep links work even though the config loads asynchronously.
 * Hidden pages are skipped by next/prev but can still be opened by URL.
 * @param {Array<Object>} pages - Page configs.
 * @returns {{pageIndex: number, goTo: (idx: number) => void, next: () => void, prev: () => void, hasNext: boolean, hasPrev: boolean}}
 */
export function usePageNavigation(pages) {
    const [requestedKey, setRequestedKey] = useState(keyFromLocation);
    const keys = useMemo(() => pages.map(pageKey), [pages]);

    const requestedIndex = keys.indexOf(requestedKey);
    const pageIndex = requestedIndex !== -1 ? requestedIndex : Math.max(0, findVisible(pages, -1, 1));

    useEffect(() => {
        if (keys.length === 0) return;
        const path = `/${encodeURIComponent(keys[pageIndex])}`;
        if (window.location.pathname !== path) window.history.replaceState(null, '', path);
    }, [keys, pageIndex]);

    useEffect(() => {
        const onPopState = () => setRequestedKey(keyFromLocation());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const goTo = useCallback((idx) => {
        if (idx < 0 || idx >= keys.length || idx === pageIndex) return;
        setRequestedKey(keys[idx]);
        window.history.pushState(null, '', `/${encodeURIComponent(keys[idx])}`);
    }, [keys, pageIndex]);

    const nextIndex = findVisible(pages, pageIndex, 1);
    const prevIndex = findVisible(pages, pageIndex, -1);

    return {
        pageIndex,
        goTo,
        next: () => goTo(nextIndex),
        prev: () => goTo(prevIndex),
        hasNext: nextIndex !== -1,
        hasPrev: prevIndex !== -1,
    };
}
