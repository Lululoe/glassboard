import { describe, expect, it } from 'vitest';
import {
    INITIAL_TAKEOVER, dismissTakeover, isNight, monthWeeks, nextTakeover, screenMode, showTakeover, weatherOf,
} from './kioskModel';

describe('screenMode', () => {
    const base = { now: 100_000, lastInteraction: 0, lastLooking: 0, presence: true, idleMs: 30_000 };

    it('shows the dashboard after a touch or a look, for the idle time', () => {
        expect(screenMode({ ...base, lastInteraction: 90_000 })).toBe('dashboard');
        expect(screenMode({ ...base, lastLooking: 80_000 })).toBe('dashboard');
        expect(screenMode({ ...base, lastInteraction: 60_000 })).toBe('clock');
    });

    it('turns the screen off when the room is empty, unless it was just touched', () => {
        expect(screenMode({ ...base, presence: false })).toBe('off');
        expect(screenMode({ ...base, presence: false, lastInteraction: 95_000 })).toBe('dashboard');
        expect(screenMode({ ...base, presence: undefined })).toBe('clock');
    });
});

describe('isNight', () => {
    const noon = new Date(2026, 10, 20, 12);
    const late = new Date(2026, 10, 20, 23);

    it('follows the light, with some slack before the day comes back', () => {
        expect(isNight({ lux: 4, threshold: 10, wasNight: false, now: noon })).toBe(true);
        expect(isNight({ lux: 12, threshold: 10, wasNight: false, now: noon })).toBe(false);
        expect(isNight({ lux: 12, threshold: 10, wasNight: true, now: noon })).toBe(true);
        expect(isNight({ lux: 40, threshold: 10, wasNight: true, now: noon })).toBe(false);
    });

    it('goes by the hour without a light sensor', () => {
        expect(isNight({ lux: null, threshold: 10, wasNight: false, now: late })).toBe(true);
        expect(isNight({ lux: null, threshold: 10, wasNight: true, now: noon })).toBe(false);
    });
});

describe('takeover', () => {
    const PAUSE = 60_000;
    const step = (state, players, now) => nextTakeover(state, players, now, PAUSE);

    it('takes over while a player plays and steps back after a long pause', () => {
        let s = step(INITIAL_TAKEOVER, [{ id: 'a', state: 'idle' }], 0);
        expect(s.shown).toBeNull();
        s = step(s, [{ id: 'a', state: 'playing' }], 1000);
        expect(s.shown).toBe('a');
        s = step(s, [{ id: 'a', state: 'paused' }], 2000);
        expect(s.shown).toBe('a');
        s = step(s, [{ id: 'a', state: 'paused' }], 2000 + PAUSE - 1);
        expect(s.shown).toBe('a');
        s = step(s, [{ id: 'a', state: 'paused' }], 2000 + PAUSE);
        expect(s.shown).toBeNull();
    });

    it('steps back at once when the player stops', () => {
        let s = step(INITIAL_TAKEOVER, [{ id: 'a', state: 'playing' }], 0);
        s = step(s, [{ id: 'a', state: 'idle' }], 1000);
        expect(s.shown).toBeNull();
    });

    it('stays away after a swipe until the player starts playing again', () => {
        let s = step(INITIAL_TAKEOVER, [{ id: 'a', state: 'playing' }, { id: 'b', state: 'playing' }], 0);
        expect(s.shown).toBe('a');
        s = dismissTakeover(s);
        s = step(s, [{ id: 'a', state: 'playing' }, { id: 'b', state: 'playing' }], 1000);
        // The grouped speaker doesn't take over in its place
        expect(s.shown).toBeNull();
        s = step(s, [{ id: 'a', state: 'paused' }, { id: 'b', state: 'playing' }], 2000);
        expect(s.shown).toBeNull();
        s = step(s, [{ id: 'a', state: 'playing' }, { id: 'b', state: 'playing' }], 3000);
        expect(s.shown).toBe('a');
    });

    it('keeps the player on screen and prefers a playing one', () => {
        let s = step(INITIAL_TAKEOVER, [{ id: 'a', state: 'paused' }, { id: 'b', state: 'idle' }], 0);
        expect(s.shown).toBe('a');
        s = step(s, [{ id: 'a', state: 'paused' }, { id: 'b', state: 'playing' }], 1000);
        expect(s.shown).toBe('a');
        s = step(s, [{ id: 'a', state: 'idle' }, { id: 'b', state: 'playing' }], 2000);
        expect(s.shown).toBe('b');
    });

    it('brings a swiped player back on request', () => {
        let s = step(INITIAL_TAKEOVER, [{ id: 'a', state: 'playing' }], 0);
        s = showTakeover(dismissTakeover(s), 'a');
        expect(step(s, [{ id: 'a', state: 'playing' }], 1000).shown).toBe('a');
    });
});

describe('clock helpers', () => {
    it('describes the weather of a weather entity', () => {
        expect(weatherOf({ state: 'partlycloudy', attributes: { temperature: 6.6 } }))
            .toEqual({ condition: 'Partly cloudy', kind: 'partlycloudy', temperature: '7°' });
        expect(weatherOf({ state: 'unavailable', attributes: {} })).toBeNull();
        expect(weatherOf(null)).toBeNull();
    });

    it('lays out a month from Monday', () => {
        const weeks = monthWeeks(new Date(2026, 10, 20));
        // 1 November 2026 is a Sunday
        expect(weeks[0].map(c => c.current)).toEqual([false, false, false, false, false, false, true]);
        expect(weeks.flat().filter(c => c.current)).toHaveLength(30);
        expect(weeks.every(w => w.length === 7)).toBe(true);
    });
});
