import { useEffect } from 'react';

/** How long a scroll area keeps its scrollbar after the last scroll, in milliseconds. */
const SCROLLBAR_LINGER = 900;

/**
 * Marks any element that is being scrolled with the `is-scrolling` class, removed again a moment
 * after the scrolling stops. Card scroll areas show their scrollbar only while it is set.
 * One listener on the document catches every scroll area, since scroll events are captured.
 */
export function useScrollingClass() {
    useEffect(() => {
        /** @type {WeakMap<Element, ReturnType<typeof setTimeout>>} */
        const timers = new WeakMap();
        /** @type {Set<Element>} */
        const active = new Set();
        const onScroll = (/** @type {Event} */ e) => {
            const el = e.target;
            if (!(el instanceof Element)) return;
            clearTimeout(timers.get(el));
            el.classList.add('is-scrolling');
            active.add(el);
            timers.set(el, setTimeout(() => {
                el.classList.remove('is-scrolling');
                active.delete(el);
            }, SCROLLBAR_LINGER));
        };
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
            document.removeEventListener('scroll', onScroll, { capture: true });
            active.forEach(el => {
                clearTimeout(timers.get(el));
                el.classList.remove('is-scrolling');
            });
        };
    }, []);
}
