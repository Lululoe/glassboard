import { describe, expect, it } from 'vitest';
import { blockChar, blockLayout, blockRows } from './blockChart';

/** A plot 100 units high that is `h` pixels tall. */
const yFor = (h) => (unit, v) => h - (v / 100) * h;

describe('block chart', () => {
    it('fills cells in eighths', () => {
        expect(blockChar(0)).toBe(' ');
        expect(blockChar(0.5)).toBe('▄');
        expect(blockChar(0.01)).toBe('▁');
        expect(blockChar(1.5)).toBe('█');
    });

    it('draws areas from the bottom and lines as their top cell', () => {
        const columns = [{ lo: 0, hi: 2.5 }, null, { lo: 0, hi: 1 }];
        expect(blockRows(columns, 3)).toEqual(['▄  ', '█  ', '█ █']);
        expect(blockRows(columns, 3, true)).toEqual(['▄  ', '   ', '  █']);
    });

    it('fills one sensor as an area and draws several as lines', () => {
        const base = { n: 2, w: 76, h: 48, y: yFor(48), bar: false, stacked: false };
        const one = blockLayout({ ...base, drawn: [{ i: 0, unit: '°C', color: 'red', values: [0, 100] }] });
        expect(one.cols).toBe(10);
        expect(one.rows).toBe(4);
        // Rising from empty on the left to full on the right
        expect(one.series[0].rows[3][0]).not.toBe('█');
        expect(one.series[0].rows.slice(1).every(row => row.endsWith('█'))).toBe(true);
        expect(one.series[0].rows[0].at(-1)).not.toBe(' ');

        const two = blockLayout({ ...base, drawn: [
            { i: 0, unit: '°C', color: 'red', values: [50, 50] },
            { i: 1, unit: '°C', color: 'blue', values: [100, 100] },
        ] });
        // A line is one cell per column
        expect(two.series[1].rows[0].trim().length).toBe(two.cols);
        expect(two.series[1].rows[1].trim()).toBe('');
    });

    it('stacks bars and leaves a gap between periods', () => {
        const grid = blockLayout({
            n: 2, w: 76, h: 48, y: yFor(48), bar: true, stacked: true,
            drawn: [
                { i: 0, unit: 'kWh', color: 'red', values: [50, 25] },
                { i: 1, unit: 'kWh', color: 'blue', values: [50, 0] },
            ],
        });
        const [first, second] = grid.series;
        // The first sensor fills the bottom half of the first bar, the second sits on top of it
        expect(first.rows.slice(2).every(row => row.startsWith('█'))).toBe(true);
        expect(first.rows.slice(0, 2).every(row => row.startsWith(' '))).toBe(true);
        expect(second.rows.slice(0, 2).every(row => row.startsWith('█'))).toBe(true);
        // The last column of each period stays empty
        expect(first.rows.every(row => row[4] === ' ')).toBe(true);
    });
});
