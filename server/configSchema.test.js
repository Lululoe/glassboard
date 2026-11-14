// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateConfig } from './configSchema.js';

describe('validateConfig', () => {
    it('accepts a valid config', () => {
        expect(validateConfig({
            theme: 'default',
            pages: [
                { id: 'home', cards: [{ id: 'w', type: 'weather', colSpan: 2, location: 'Berlin' }] },
                { id: 'status', type: 'iframe', url: 'https://status.local' },
            ],
        })).toEqual([]);
    });

    it('reports readable paths for invalid fields', () => {
        const problems = validateConfig({
            pages: [{ id: 'home', cards: [{ id: 'a', type: 'git', colSpan: 'wide' }, { type: 'media' }] }],
        });
        expect(problems.some(p => p.startsWith('pages[0].cards[0].colSpan:'))).toBe(true);
        expect(problems.some(p => p.startsWith('pages[0].cards[1].id:'))).toBe(true);
    });

    it('reports duplicate ids and iframe pages without a url', () => {
        const problems = validateConfig({
            pages: [
                { id: 'home', cards: [{ id: 'x', type: 'git' }] },
                { id: 'home', type: 'iframe', cards: [{ id: 'x', type: 'media' }] },
            ],
        });
        expect(problems).toContain('pages[1].id: Duplicate page id "home"');
        expect(problems).toContain('pages[1].url: Iframe pages require a url');
        expect(problems).toContain('pages[1].cards[0].id: Duplicate card id "x"');
    });

    it('checks ids inside container cards and accepts row spans', () => {
        const problems = validateConfig({
            cards: [
                { id: 'x', type: 'git' },
                { id: 'box', type: 'container', rowSpan: 2, cards: [{ id: 'x', type: 'weather' }] },
            ],
        });
        expect(problems).toEqual(['cards[1].cards[0].id: Duplicate card id "x"']);
        expect(validateConfig({ cards: [{ id: 'box', type: 'container', rowSpan: 4 }] }).some(p => p.startsWith('cards[0].rowSpan:'))).toBe(true);
    });

    it('accepts page headers and reports invalid header options', () => {
        expect(validateConfig({
            pageHeader: { align: 'center', layout: 'stacked', title: { type: 'clock', format: 'HH:mm', color: '#fff' }, subtitle: false },
            pages: [{ id: 'home', pageHeader: false }, { id: 'more', pageHeader: { title: 'Hello' } }],
        })).toEqual([]);

        const problems = validateConfig({
            pageHeader: { align: 'middle', title: { type: 'template' }, subtitle: { color: 'red; top: 0' } },
            pages: [{ id: 'home', pageHeader: { layout: 'grid' } }],
        });
        expect(problems.some(p => p.startsWith('pageHeader.align:'))).toBe(true);
        expect(problems.some(p => p.startsWith('pageHeader.title:'))).toBe(true);
        expect(problems.some(p => p.startsWith('pageHeader.subtitle'))).toBe(true);
        expect(problems.some(p => p.startsWith('pages[0].pageHeader'))).toBe(true);
    });

    it('accepts the header bar auto-hide modes only', () => {
        expect(validateConfig({ headerAutoHide: 'with-page-header' })).toEqual([]);
        expect(validateConfig({ headerAutoHide: 'sometimes' })[0]).toMatch(/^headerAutoHide:/);
    });
});

