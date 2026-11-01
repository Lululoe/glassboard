import { useLayoutEffect, useState } from 'react';

/**
 * Measures an element and follows its size, e.g. to draw a chart that fills its card.
 * Returns 0 × 0 until the element is measured (or when ResizeObserver is unavailable).
 * @returns {[{width: number, height: number}, (el: HTMLElement|null) => void]} The size, and a
 *   ref callback for the element.
 */
export function useElementSize() {
    const [element, setElement] = useState(/** @type {HTMLElement|null} */ (null));
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!element || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return [size, setElement];
}
