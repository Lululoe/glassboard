// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateConfig } from './configSchema.js';

describe('validateConfig', () => {
    it('accepts a valid config', () => {
        expect(validateConfig({
            theme: 'default',
            pages: [
                { id: 'home', cards: [{ id: 'w', type: 'weather', colSpan: 2, entity_id: 'weather.home' }] },
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
});
