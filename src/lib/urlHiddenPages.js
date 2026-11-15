/**
 * Pages can be hidden entirely with the `hide` URL parameter, for example on a wall tablet
 * that should not show the server pages: `/?hide=servers,media` or `/?hide=servers&hide=media`.
 * Each value matches a page's id (or its index for pages without one) or its name, ignoring case.
 * A hidden page is left out of the navigation, the page control and the sidebar, and cannot be
 * opened by its URL either.
 */

/**
 * Reads the pages to hide from a URL query string.
 * @param {string} search - The query string, like `window.location.search`.
 * @returns {Set<string>} Lowercased page ids and names.
 */
export function hiddenPagesFromUrl(search) {
    const params = new URLSearchParams(search);
    const tokens = params.getAll('hide')
        .flatMap(value => value.split(','))
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    return new Set(tokens);
}

/**
 * Marks the pages hidden by the URL as `excluded`. When the URL would hide every page,
 * it is ignored, so the dashboard never ends up empty.
 * @param {Array<any>} pages - Page configs.
 * @param {Set<string>} hidden - Lowercased page ids and names, from {@link hiddenPagesFromUrl}.
 * @returns {Array<any>} The pages, the same array when none is hidden.
 */
export function excludeUrlHiddenPages(pages, hidden) {
    if (hidden.size === 0) return pages;
    const matches = (/** @type {any} */ page, /** @type {number} */ idx) => hidden.has(String(page.id ?? idx).toLowerCase())
        || (typeof page.name === 'string' && hidden.has(page.name.trim().toLowerCase()));
    if (!pages.some(matches) || pages.every(matches)) return pages;
    return pages.map((page, idx) => (matches(page, idx) ? { ...page, excluded: true } : page));
}
