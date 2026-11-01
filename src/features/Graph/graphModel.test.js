import { describe, it, expect } from 'vitest';
import { colorOf, formatValue, graphRanges, longLabel, niceRange, percentChange, shouldStack, signedPercent, weekTotals } from './graphModel';

describe('graph model', () => {
    it('reads the ranges a card offers', () => {
        expect(graphRanges({})).toEqual({ ranges: ['24h', '7d', '30d'], selector: true });
        expect(graphRanges({ ranges: ['6h', 'x', '3d'] })).toEqual({ ranges: ['6h', '3d'], selector: true });
        expect(graphRanges({ ranges: false, range: '7d' })).toEqual({ ranges: ['7d'], selector: false });
        expect(longLabel('24h')).toBe('Last 24 hours');
        expect(longLabel('1w')).toBe('Last 1 week');
    });

    it('picks colors and stacking', () => {
        expect(colorOf(null, 0)).toBe('var(--system-blue)');
        expect(colorOf(undefined, 9)).toBe('var(--system-orange)');
        expect(colorOf('Yellow', 0)).toBe('var(--graph-yellow)');
        expect(colorOf('#123456', 0)).toBe('#123456');
        expect(shouldStack({}, [{ unit: 'kWh' }, { unit: 'kWh' }])).toBe(true);
        expect(shouldStack({}, [{ unit: 'W' }, { unit: 'W' }])).toBe(false);
        expect(shouldStack({ stack: true }, [{ unit: 'W' }, { unit: 'W' }])).toBe(true);
        expect(shouldStack({ stack: true }, [{ unit: 'kWh' }, { unit: 'm³' }])).toBe(false);
    });

    it('rounds axes and values', () => {
        expect(niceRange(0, 3.7, true)).toEqual([0, 5]);
        const [lo, hi] = niceRange(19.6, 22.3, false);
        expect(lo).toBeLessThanOrEqual(19.6);
        expect(hi).toBeGreaterThanOrEqual(22.3);
        expect(hi - lo).toBeLessThan(10);
        // Never below zero for values that never are
        expect(niceRange(0.2, 1000, false)[0]).toBe(0);
        expect(niceRange(-4, 8, false)[0]).toBeLessThan(-4);
        expect(formatValue(21.46, '°C')).toBe('21.5°C');
        expect(formatValue(0.042, 'kWh')).toBe('0.04 kWh');
        expect(formatValue(1234, 'W')).toBe('1,234 W');
        expect(formatValue(20, '°C', 0)).toBe('20°C');
        expect(formatValue(null, 'W')).toBe('–');
    });

    it('compares weeks', () => {
        const parts = [{ values: [...Array(7).fill(1), ...Array(7).fill(2)] }, { values: [...Array(13).fill(1), null] }];
        const { totals, thisWeek, lastWeek, change } = weekTotals(parts);
        expect(totals[0]).toBe(2);
        expect(totals[13]).toBe(2);
        expect([thisWeek, lastWeek, change]).toEqual([20, 14, 43]);
        expect(percentChange(5, 0)).toBeNull();
        expect([signedPercent(12), signedPercent(-3), signedPercent(null)]).toEqual(['+12%', '−3%', '']);
    });
});
