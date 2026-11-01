import { useLayoutEffect, useState } from 'react';

// Keep in sync with the breakpoints in BentoGrid.css
const TABLET = '(max-width: 999px)';
const PHONE = '(max-width: 639px)';

/**
 * Estimates the number of columns from the window width, before the grid can be measured.
 * @returns {number} 3 on wide screens, 2 on tablets, 1 on phones.
 */
function columnsFromWindow() {
    if (typeof window === 'undefined' || !window.matchMedia) return 3;
    if (window.matchMedia(PHONE).matches) return 1;
    if (window.matchMedia(TABLET).matches) return 2;
    return 3;
}

/**
 * Number of columns the bento grid currently shows. The grid's CSS decides the columns
 * (`--cols` at each breakpoint); this reads them back whenever the grid changes size, so
 * the cards always agree with the layout, also where media query events do not fire.
 * @param {import('react').RefObject<HTMLElement>} ref - The grid container.
 * @returns {number} 1, 2 or 3.
 */
export function useGridColumns(ref) {
    const [columns, setColumns] = useState(columnsFromWindow);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const read = () => {
            const value = parseInt(getComputedStyle(el).getPropertyValue('--cols'), 10);
            setColumns(value >= 1 && value <= 3 ? value : columnsFromWindow());
        };
        read();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(read);
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);

    return columns;
}
