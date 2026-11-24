import { describe, expect, it } from 'vitest';
import {
    isStale, readTime, SAMPLE_STORAGE, allocateColumns, categoryColor, dotNoise, formatSize, largestCategory, legendItems, storageModel, storageSize, columnsFor, formatShare,
} from './storageModel';
import { dotCells, dotPath } from './dots';

describe('storage model', () => {
    it('adds up the categories and keeps the total at least as large as what is used', () => {
        const volume = storageModel({ total: 100, categories: [{ name: 'A', size: 30 }, { name: 'B', size: 20 }, { name: 'C', size: 0 }] });
        expect(volume).toMatchObject({ total: 100, used: 50, free: 50, percent: 50 });
        expect(volume.categories.map(c => c.name)).toEqual(['A', 'B']);
        expect(storageModel({ total: 10, categories: [{ name: 'A', size: 30 }] }).total).toBe(30);
    });

    it('shows the sample until categories are configured', () => {
        expect(storageModel(undefined).categories).toHaveLength(SAMPLE_STORAGE.categories.length);
    });

    it('picks colors like the graph card and keeps other colors', () => {
        expect(categoryColor('green', 0)).toBe('var(--system-green)');
        expect(categoryColor('Yellow', 0)).toBe('var(--graph-yellow)');
        expect(categoryColor('cyan', 0)).toBe('var(--system-cyan)');
        expect(categoryColor('#ff0000', 0)).toBe('#ff0000');
        expect(categoryColor(undefined, 1)).toBe('var(--system-orange)');
    });

    it('formats sizes in gigabytes and terabytes', () => {
        expect(formatSize(357.84)).toBe('358 GB');
        expect(formatSize(52.64)).toBe('52.6 GB');
        expect(formatSize(1480)).toBe('1.48 TB');
        expect(formatSize(4000)).toBe('4 TB');
    });

    it('reads the size the card is shown at', () => {
        expect(storageSize({ tileSize: 'half', colSpan: 2 })).toBe('half');
        expect(storageSize({ colSpan: 2 })).toBe('2');
        expect(storageSize({})).toBe('1');
        expect(storageSize({ colSpan: 5 })).toBe('3');
    });
});

describe('column allocation', () => {
    it('splits columns by share and gives small categories one', () => {
        expect(allocateColumns([50, 30, 20], 100, 10)).toEqual([5, 3, 2]);
        expect(allocateColumns([50, 50], 200, 10)).toEqual([3, 2]);
        const counts = allocateColumns([990, 1], 1000, 20);
        expect(counts[1]).toBe(1);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
    });

    it('allocates nothing without columns', () => {
        expect(allocateColumns([1, 2], 3, 0)).toEqual([0, 0]);
    });
});

describe('legend', () => {
    const categories = storageModel(SAMPLE_STORAGE).categories;

    it('lists the largest first and puts the rest together', () => {
        const items = legendItems(categories, 4);
        expect(items).toHaveLength(4);
        expect(items[0].name).toBe('Media');
        expect(items[3].name).toBe('Other');
        expect(items[3].members).toEqual(['VMs', 'Downloads', 'Documents', 'Apps', 'System']);
        expect(items.reduce((sum, c) => sum + c.size, 0)).toBe(categories.reduce((sum, c) => sum + c.size, 0));
    });

    it('finds the largest category', () => {
        expect(largestCategory(categories).name).toBe('Media');
        expect(largestCategory([])).toBeUndefined();
    });
});

describe('dots', () => {
    it('lights the same dots every time', () => {
        expect(dotNoise(3, 4, 5)).toBe(dotNoise(3, 4, 5));
        expect(dotNoise(3, 4, 5)).not.toBe(dotNoise(3, 5, 4));
    });

    it('puts every cell in exactly one group', () => {
        const { base, lit, twinkle } = dotCells(10, 4, 1, 0.3);
        expect(base.length + lit.length + twinkle.length).toBe(40);
        expect(dotCells(10, 4, 1, 0).lit).toHaveLength(0);
    });

    it('draws round and square dots', () => {
        expect(dotPath([[0, 0]], 0, 0, 1, false)).toContain('a1 1');
        expect(dotPath([[0, 0]], 0, 0, 1, true)).toBe('M1.5 1.5h2v2h-2z');
    });
});

describe('times', () => {
    it('reads ISO dates, Unix seconds and milliseconds', () => {
        expect(readTime('2026-11-23T10:00:00Z')).toBe('2026-11-23T10:00:00.000Z');
        expect(readTime(1795341600)).toBe('2026-11-22T10:00:00.000Z');
        expect(readTime('1795341600')).toBe('2026-11-22T10:00:00.000Z');
        expect(readTime(1795341600000)).toBe('2026-11-22T10:00:00.000Z');
        expect(readTime(undefined)).toBeUndefined();
        expect(readTime('soon')).toBeUndefined();
    });

    it('tells stale data from fresh', () => {
        const now = new Date('2026-11-23T10:00:00Z');
        expect(isStale('2026-11-23T09:30:00Z', 15, now)).toBe(true);
        expect(isStale('2026-11-23T09:50:00Z', 15, now)).toBe(false);
        expect(isStale(undefined, 15, now)).toBe(false);
        expect(isStale('2026-11-20T09:30:00Z', 0, now)).toBe(false);
    });
});

describe('columnsFor', () => {
    it('keeps the columns of the size until the list is too narrow for them', () => {
        expect(columnsFor(0, 3)).toBe(3);
        expect(columnsFor(700, 3)).toBe(3);
        expect(columnsFor(400, 3)).toBe(2);
        expect(columnsFor(300, 2)).toBe(1);
        expect(columnsFor(120, 1)).toBe(1);
    });
});


describe('formatShare', () => {
    it('rounds to whole percent and says <1% for slivers', () => {
        expect([formatShare(0.37), formatShare(0.006), formatShare(0.0002)]).toEqual(['37%', '1%', '<1%']);
    });
});
