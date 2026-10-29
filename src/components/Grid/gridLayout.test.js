import { describe, it, expect } from 'vitest';
import {
    buildEntries, deviceFor, fitToColumns, isHiddenAt, moveItem, nearestSize, sizeOf, usableSizes, withSize,
} from './gridLayout';

describe('sizeOf / withSize', () => {
    it('reads tileSize first, then a clamped colSpan', () => {
        expect(sizeOf({ tileSize: 'half', colSpan: 2 })).toBe('half');
        expect(sizeOf({ colSpan: 2 })).toBe('2');
        expect(sizeOf({ colSpan: 9 })).toBe('3');
        expect(sizeOf({})).toBe('1');
    });

    it('sets tileSize or colSpan and drops the other', () => {
        expect(withSize({ id: 'a', colSpan: 2 }, 'quarter')).toEqual({ id: 'a', colSpan: 2, tileSize: 'quarter' });
        expect(withSize({ id: 'a', tileSize: 'half' }, '3')).toEqual({ id: 'a', colSpan: 3 });
    });
});

describe('buildEntries', () => {
    it('stacks halves and packs quarters into shared slots in order', () => {
        const entries = buildEntries([
            { tileSize: 'half' }, { tileSize: 'half' }, // slot 1: two rows
            { colSpan: 2 },
            { tileSize: 'quarter' }, { tileSize: 'quarter' }, { tileSize: 'half' }, // slot 2
            { tileSize: 'quarter' }, // slot 3
        ]);

        expect(entries.map(e => e.kind)).toEqual(['slot', 'card', 'slot', 'slot']);
        expect(entries[0].items.map(i => [i.index, i.col, i.row, i.w, i.h])).toEqual([[0, 0, 0, 2, 1], [1, 0, 1, 2, 1]]);
        expect(entries[2].items.map(i => [i.index, i.col, i.row])).toEqual([[3, 0, 0], [4, 1, 0], [5, 0, 1]]);
        expect(entries[3].items[0].index).toBe(6);
    });

    it('starts a new slot when a half no longer fits', () => {
        const entries = buildEntries([{ tileSize: 'quarter' }, { tileSize: 'half' }, { tileSize: 'half' }]);
        expect(entries).toHaveLength(2);
        expect(entries[0].items.map(i => [i.index, i.row])).toEqual([[0, 0], [1, 1]]);
        expect(entries[1].items[0].index).toBe(2);
    });

    it('leaves out cards that are not included, keeping their indexes', () => {
        const entries = buildEntries([{ id: 'a' }, { id: 'b' }, { id: 'c' }], card => card.id !== 'b');
        expect(entries).toEqual([{ kind: 'card', index: 0 }, { kind: 'card', index: 2 }]);
    });

    it('does not let a full card split a slot', () => {
        const entries = buildEntries([{ tileSize: 'quarter' }, { colSpan: 1 }, { tileSize: 'quarter' }]);
        expect(entries.map(e => e.kind)).toEqual(['slot', 'card', 'slot']);
    });
});

describe('fitToColumns', () => {
    it('narrows cards wider than the grid and leaves the rest untouched', () => {
        const wide = { id: 'w', colSpan: 3 };
        const half = { id: 'h', tileSize: 'half' };
        expect(fitToColumns(wide, 1)).toEqual({ id: 'w', colSpan: 1 });
        expect(fitToColumns(wide, 2)).toEqual({ id: 'w', colSpan: 2 });
        expect(fitToColumns(wide, 3)).toBe(wide);
        expect(fitToColumns(half, 1)).toBe(half);
    });
});

describe('usableSizes', () => {
    it('defaults to full-height sizes and drops widths the grid cannot show', () => {
        expect(usableSizes(undefined, 3)).toEqual(['1', '2', '3']);
        expect(usableSizes(undefined, 1)).toEqual(['1']);
        expect(usableSizes(['3', 'quarter', '1', 'half'], 2)).toEqual(['quarter', 'half', '1']);
    });
});

describe('nearestSize', () => {
    it('picks the size closest to the dragged-out footprint', () => {
        const all = ['quarter', 'half', '1', '2', '3'];
        expect(nearestSize(all, 1, 1)).toBe('quarter');
        expect(nearestSize(all, 2.2, 0.9)).toBe('half');
        expect(nearestSize(all, 3.8, 2.1)).toBe('2');
        expect(nearestSize(['1', '2'], 6, 2)).toBe('2');
    });
});

describe('moveItem', () => {
    it('moves without mutating the input', () => {
        const list = ['a', 'b', 'c'];
        expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
        expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b']);
        expect(list).toEqual(['a', 'b', 'c']);
    });
});

describe('screen sizes', () => {
    it('maps columns to devices and checks hideOn', () => {
        expect([1, 2, 3].map(deviceFor)).toEqual(['phone', 'tablet', 'desktop']);
        expect(isHiddenAt({ hideOn: ['phone'] }, 1)).toBe(true);
        expect(isHiddenAt({ hideOn: ['phone'] }, 3)).toBe(false);
        expect(isHiddenAt({}, 1)).toBe(false);
    });
});
