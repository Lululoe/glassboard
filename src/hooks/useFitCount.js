import { useLayoutEffect, useState } from 'react';

/**
 * Counts how many columns of at least `minWidth` fit side by side in an element, so a row of
 * days or items follows the card's actual width instead of the viewport width.
 * Returns `max` until the element is measured (or when ResizeObserver is unavailable).
 * @param {number} minWidth - Narrowest a column may get, in px.
 * @param {number} max - Most columns to show.
 * @param {number} [gap=12] - Gap between columns, in px.
 * @returns {[number, (el: HTMLElement|null) => void]} The column count, and a ref callback for the element.
 */
export function useFitCount(minWidth, max, gap = 12) {
    const [element, setElement] = useState(/** @type {HTMLElement|null} */ (null));
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    const count = width > 0 ? Math.floor((width + gap) / (minWidth + gap)) : max;
    return [Math.max(1, Math.min(max, count)), setElement];
}
