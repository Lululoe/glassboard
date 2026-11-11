import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hides something until it is revealed, and hides it again a moment after it is no longer used.
 * @param {boolean} enabled - Whether it hides at all.
 * @param {boolean} [hold=false] - Keeps it shown, e.g. while a menu it opened is open.
 * @returns {{hidden: boolean, reveal: () => void, hideSoon: (delay?: number) => void}} Whether it is hidden
 *   now, a function that shows it, and one that hides it after `delay` ms (900 by default).
 */
export function useAutoHide(enabled, hold = false) {
    const [revealed, setRevealed] = useState(false);
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));

    const reveal = useCallback(() => {
        clearTimeout(timer.current);
        setRevealed(true);
    }, []);

    const hideSoon = useCallback((delay = 900) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setRevealed(false), delay);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return { hidden: enabled && !revealed && !hold, reveal, hideSoon };
}
