import { useEffect } from 'react';

/**
 * Syncs the browser URL with the active page index.
 * 
 * @param {Array} pages - List of page objects from config
 * @param {number} pageIndex - Current page index state
 * @param {Function} setPageIndex - Setter for page index
 * @returns {number} - The initial page index based on current URL
 */
export const useRouteSync = (pages, pageIndex, setPageIndex) => {

    useEffect(() => {
        if (!pages || pages.length === 0) return;

        // Sync URL on page change
        const activePage = pages[pageIndex];
        if (activePage) {
            const path = `/${activePage.id}`;
            if (window.location.pathname !== path) {
                window.history.pushState(null, '', path);
            }
        }
    }, [pageIndex, pages]);

    useEffect(() => {
        // Handle Back/Forward buttons
        const handlePopState = () => {
            if (!pages || pages.length === 0) return;

            const path = window.location.pathname.substring(1); // remove leading slash
            const index = pages.findIndex(p => p.id === path);

            if (index !== -1) {
                setPageIndex(index);
            } else if (path === '' && pages.length > 0) {
                // Root URL -> Index 0
                setPageIndex(0);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [pages, setPageIndex]);
};

/**
 * Helper to determine the initial active page index based on the current browser URL.
 * @param {Array} pages - The array of configured pages.
 * @returns {number} The initial page index (0 if not found).
 */
export const getInitialPageIndex = (pages) => {
    if (!pages || pages.length === 0) return 0;
    const path = window.location.pathname.substring(1);
    const index = pages.findIndex(p => p.id === path);
    return index !== -1 ? index : 0;
};
