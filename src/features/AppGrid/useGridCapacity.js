import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures how many items fit in a grid without overflowing it: the number of column
 * tracks times the number of complete rows that fit the grid's height. Re-measures when
 * the grid is resized or `key` changes. Items are assumed to share one height.
 * Returns Infinity until a measurement is possible (e.g. no ResizeObserver or no layout).
 * @param {import('react').RefObject<HTMLElement>} ref - The grid element.
 * @param {string} [key=''] - Re-measures when it changes (e.g. size or label settings).
 * @returns {number} Number of items that fit.
 */
export function useGridCapacity(ref, key = '') {
    const [capacity, setCapacity] = useState(Infinity);
    const itemHeight = useRef(0);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const measure = () => {
            const style = getComputedStyle(el);
            const columns = style.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
            const gap = parseFloat(style.rowGap) || 0;
            const height = el.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
            if (el.firstElementChild instanceof HTMLElement) itemHeight.current = el.firstElementChild.offsetHeight;
            if (!itemHeight.current) return;

            const rows = Math.max(0, Math.floor((height + gap + 0.5) / (itemHeight.current + gap)));
            setCapacity(columns * rows);
        };

        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, key]);

    return capacity;
}
