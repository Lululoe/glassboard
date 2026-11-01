import { describe, it, expect } from 'vitest';
import { findSelfhst, loadCatalog, searchCatalog, selfhstEntry } from './iconCatalog';

const row = (over) => ({ Name: 'Plex', Reference: 'plex', SVG: 'Yes', Light: 'Yes', Tags: 'Streaming', ...over });

describe('iconCatalog', () => {
    it('reads the versions of a selfh.st icon', () => {
        expect(selfhstEntry(row())).toMatchObject({ ref: 'sh-plex', mono: 'sh-plex-light', name: 'Plex' });
        expect(selfhstEntry(row({ Light: 'No' })).mono).toBeNull();
        expect(selfhstEntry(row({ SVG: 'No' }))).toMatchObject({ ref: 'sh-plex-png', mono: null });
    });

    it('finds an entry by either version', () => {
        const items = [selfhstEntry(row())];
        expect(findSelfhst(items, 'sh-plex-light')?.name).toBe('Plex');
        expect(findSelfhst(items, 'sh-plex')?.name).toBe('Plex');
        expect(findSelfhst(items, 'sh-other')).toBeUndefined();
    });

    it('searches names and tags, ignoring separators', () => {
        const items = [selfhstEntry(row()), selfhstEntry(row({ Name: 'Home Assistant', Reference: 'home-assistant', Tags: '' }))];
        expect(searchCatalog(items, 'home-assist').map(i => i.name)).toEqual(['Home Assistant']);
        expect(searchCatalog(items, 'home assist').map(i => i.name)).toEqual(['Home Assistant']);
        expect(searchCatalog(items, 'stream').map(i => i.name)).toEqual(['Plex']);
        expect(searchCatalog(items, '')).toHaveLength(2);
    });

    it('lists every Lucide icon', async () => {
        const items = await loadCatalog('lucide');
        expect(items.length).toBeGreaterThan(1000);
        expect(searchCatalog(items, 'arrow-down-a-z').map(i => i.ref)).toContain('lu-ArrowDownAZ');
    });
});
