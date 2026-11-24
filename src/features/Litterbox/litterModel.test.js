import { describe, it, expect } from 'vitest';
import {
    dayFraction, formatChange, isBusy, lastVisit, lastWeighed, litterLevel, statusOf, totalVisits, wasteLevel, weightChange, withColors,
} from './litterModel';

describe('litter box model', () => {
    it('turns status codes into text and a level', () => {
        expect(statusOf({ status: 'rdy' })).toEqual({ text: 'Ready', level: 'ok' });
        expect(statusOf({ status: 'df1' }).text).toContain('2 cycles left');
        expect(statusOf({ status: 'dfs' }).level).toBe('bad');
        expect(isBusy({ status: 'ccp' })).toBe(true);
        expect(isBusy({ status: 'rdy' })).toBe(false);
        expect(statusOf({ status: null, state: 'docked' }).level).toBeTruthy();
    });

    it('warns about a full drawer and low litter', () => {
        expect(wasteLevel(50)).toBe('');
        expect(wasteLevel(75)).toBe('warn');
        expect(wasteLevel(95)).toBe('bad');
        expect(litterLevel(30)).toBe('warn');
        expect(litterLevel(10)).toBe('bad');
        expect(litterLevel(null)).toBe('');
    });

    it('sums visits and finds the last weighed cat and visit', () => {
        const cats = withColors([
            { name: 'Pepper', weight: 3.3, weighed_at: '2026-11-24T08:00:00Z', visits: 3 },
            { name: 'Teddy', weight: 5.1, weighed_at: '2026-11-24T10:00:00Z', visits: 2, color: 'red' },
        ]);
        expect(cats[0].color).toBeTruthy();
        expect(cats[1].color).toBe('red');
        expect(totalVisits(cats)).toBe(5);
        expect(totalVisits([{ visits: null }])).toBeNull();
        expect(lastWeighed(cats).name).toBe('Teddy');
        expect(lastVisit({ cats: [{ index: 0, visits: [1, 5] }, { index: 1, visits: [3] }] })).toEqual({ time: 5, index: 0 });
        expect(lastVisit(null)).toBeNull();
    });

    it('places times in the day and formats weight changes', () => {
        expect(dayFraction(new Date(2026, 10, 24, 12, 0).getTime())).toBe(0.5);
        expect(weightChange([{ t: 0, v: 3.3 }, { t: 1, v: 3.4 }])).toBeCloseTo(0.1);
        expect(weightChange([{ t: 0, v: 3 }])).toBeNull();
        expect(formatChange(-0.1, 'kg')).toMatch(/^−0[.,]10 kg$/);
        expect(formatChange(null)).toBe('');
    });
});
