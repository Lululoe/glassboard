import { describe, it, expect } from 'vitest';
import { excludeUrlHiddenPages, hiddenPagesFromUrl } from './urlHiddenPages';

const pages = [{ id: 'home', name: 'Home' }, { id: 'servers', name: 'Server Room' }, { name: 'Media' }];

describe('hiddenPagesFromUrl', () => {
    it('reads comma separated and repeated values, ignoring case and blanks', () => {
        expect([...hiddenPagesFromUrl('?hide=Servers,%20media,&hide=x')]).toEqual(['servers', 'media', 'x']);
    });

    it('is empty without the parameter', () => {
        expect(hiddenPagesFromUrl('?foo=1').size).toBe(0);
    });
});

describe('excludeUrlHiddenPages', () => {
    it('marks pages matched by id, index or name', () => {
        const result = excludeUrlHiddenPages(pages, new Set(['servers', '2']));
        expect(result.map(p => !!p.excluded)).toEqual([false, true, true]);
        const byName = excludeUrlHiddenPages(pages, new Set(['server room']));
        expect(byName[1].excluded).toBe(true);
    });

    it('returns the same pages when nothing matches', () => {
        expect(excludeUrlHiddenPages(pages, new Set(['nope']))).toBe(pages);
    });

    it('ignores a URL that would hide every page', () => {
        expect(excludeUrlHiddenPages(pages, new Set(['home', 'servers', 'media']))).toBe(pages);
    });
});
