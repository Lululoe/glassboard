import { useState } from 'react';

/**
 * Whether the page header should play its entrance: when the dashboard opens, and when switching
 * to a page whose header is different. A header that is the same on the next page stays as it
 * is, and changes made while editing show without it.
 * @param {Object|null} header - The header shown, as resolvePageHeader returns it.
 * @param {number} pageIndex - The page shown.
 * @returns {boolean} Whether it enters.
 */
export function useHeaderEntrance(header, pageIndex) {
    const key = JSON.stringify(header);
    const [shown, setShown] = useState({ key, pageIndex, entering: true });
    const changed = shown.key !== key || shown.pageIndex !== pageIndex;
    const entering = changed ? shown.pageIndex !== pageIndex && shown.key !== key : shown.entering;
    // Adjusted while rendering, so the new page's first frame already has the answer
    if (changed) setShown({ key, pageIndex, entering });
    return entering;
}
