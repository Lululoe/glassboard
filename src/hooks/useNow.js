import { useEffect, useState } from 'react';

/**
 * The current time, updated at the start of every second or every minute.
 * @param {'second'|'minute'} [precision='minute'] - How often it changes.
 * @returns {Date} The time.
 */
export function useNow(precision = 'minute') {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const step = precision === 'second' ? 1000 : 60000;
        let timer;
        const schedule = () => {
            // Lands just after the next full second or minute, so the clock never shows a stale value
            timer = setTimeout(() => {
                setNow(new Date());
                schedule();
            }, step - (Date.now() % step) + 20);
        };
        schedule();
        return () => clearTimeout(timer);
    }, [precision]);

    return now;
}
