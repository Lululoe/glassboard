import { describe, it, expect } from 'vitest';
import { entryAt, mergeEntries, moveEntry, normalizeItems, pathOfPage, replaceEntry, tidy, ungroup } from './sidebarModel';

const KEYS = ['home', 'infra', 'dev', 'living', 'kitchen'];

describe('sidebar model', () => {
    it('lists every page without any settings', () => {
        expect(normalizeItems(KEYS, undefined)).toEqual(KEYS.map(page => ({ page })));
    });

    it('keeps the stored order and icons, drops unknown and repeated pages, and adds missing ones', () => {
        const items = normalizeItems(KEYS, [
            { page: 'dev', icon: 'lu-GitPullRequest', iconColor: '', extra: 1 },
            { page: 'gone' },
            { folder: 'rooms', name: ' Rooms ', icon: 'lu-DoorOpen', pages: [{ page: 'living' }, { page: 'kitchen' }, { page: 'dev' }] },
            { folder: 'empty', pages: [{ page: 'gone' }] },
            'junk',
        ]);
        expect(items).toEqual([
            { page: 'dev', icon: 'lu-GitPullRequest' },
            { folder: 'rooms', name: 'Rooms', icon: 'lu-DoorOpen', pages: [{ page: 'living' }, { page: 'kitchen' }] },
            { page: 'home' },
            { page: 'infra' },
        ]);
    });

    it('accepts numeric page keys from config.yaml', () => {
        expect(normalizeItems(['0', '1'], [{ page: 1 }])).toEqual([{ page: '1' }, { page: '0' }]);
    });

    it('moves entries at the top, into folders and out of them', () => {
        const items = normalizeItems(KEYS, [{ folder: 'rooms', pages: [{ page: 'living' }, { page: 'kitchen' }] }]);
        // [rooms(living, kitchen), home, infra, dev]
        expect(moveEntry(items, { folder: null, index: 3 }, { folder: null, index: 0 }).map(e => e.page ?? e.folder))
            .toEqual(['dev', 'rooms', 'home', 'infra']);
        const intoFolder = moveEntry(items, { folder: null, index: 1 }, { folder: 'rooms', index: 1 });
        expect(entryAt(intoFolder, { folder: 'rooms', index: 1 })).toEqual({ page: 'home' });
        // Taking one of two pages out of a folder opens the folder up
        const out = moveEntry(items, { folder: 'rooms', index: 0 }, { folder: null, index: 3 });
        expect(out).toEqual([{ page: 'kitchen' }, { page: 'home' }, { page: 'infra' }, { page: 'living' }, { page: 'dev' }]);
    });

    it("doesn't put a folder into a folder", () => {
        const items = normalizeItems(KEYS, [{ folder: 'rooms', pages: [{ page: 'living' }, { page: 'kitchen' }] }]);
        expect(moveEntry(items, { folder: null, index: 0 }, { folder: 'rooms', index: 0 })).toBe(items);
        expect(mergeEntries(items, { folder: null, index: 0 }, 1)).toBe(items);
    });

    it('makes a folder by dropping a page on another, in that page’s place', () => {
        const items = normalizeItems(KEYS, undefined);
        const merged = mergeEntries(items, { folder: null, index: 4 }, 1, 'folder-new');
        expect(merged).toEqual([
            { page: 'home' },
            { folder: 'folder-new', name: 'Folder', pages: [{ page: 'infra' }, { page: 'kitchen' }] },
            { page: 'dev' },
            { page: 'living' },
        ]);
    });

    it('adds a page dropped on a folder to its end', () => {
        const items = normalizeItems(KEYS, [{ folder: 'rooms', pages: [{ page: 'living' }, { page: 'kitchen' }] }]);
        const merged = mergeEntries(items, { folder: null, index: 1 }, 0);
        expect(merged[0]).toEqual({ folder: 'rooms', pages: [{ page: 'living' }, { page: 'kitchen' }, { page: 'home' }] });
        expect(pathOfPage(merged, 'home')).toEqual({ folder: 'rooms', index: 2 });
    });

    it('drops empty folders and opens up folders of one page', () => {
        expect(tidy([{ folder: 'a', pages: [] }, { folder: 'b', pages: [{ page: 'x' }] }, { page: 'y' }]))
            .toEqual([{ page: 'x' }, { page: 'y' }]);
    });

    it('changes an entry and removes a folder, keeping its pages', () => {
        const items = normalizeItems(KEYS, [{ folder: 'rooms', pages: [{ page: 'living' }, { page: 'kitchen' }] }]);
        const changed = replaceEntry(items, { folder: 'rooms', index: 1 }, { page: 'kitchen', icon: 'mdi:silverware' });
        expect(entryAt(changed, { folder: 'rooms', index: 1 })).toEqual({ page: 'kitchen', icon: 'mdi:silverware' });
        expect(entryAt(items, { folder: 'rooms', index: 1 })).toEqual({ page: 'kitchen' });
        expect(ungroup(items, 'rooms').map(e => e.page)).toEqual(['living', 'kitchen', 'home', 'infra', 'dev']);
    });
});
