import { describe, it, expect } from 'vitest';
import { childCardsOf, flattenCards, isContainer } from './containerCards.js';

describe('containerCards', () => {
    it('recognises container cards case-insensitively', () => {
        expect(isContainer({ type: 'Container' })).toBe(true);
        expect(isContainer({ type: 'weather' })).toBe(false);
        expect(isContainer(null)).toBe(false);
    });

    it('returns the cards of containers only', () => {
        expect(childCardsOf({ type: 'container', cards: [{ id: 'a' }, null] })).toEqual([{ id: 'a' }]);
        expect(childCardsOf({ type: 'weather', cards: [{ id: 'a' }] })).toEqual([]);
    });

    it('flattens nested containers, each before its cards', () => {
        const inner = { id: 'inner', type: 'container', cards: [{ id: 'c' }] };
        const outer = { id: 'outer', type: 'container', cards: [{ id: 'b' }, inner] };
        expect(flattenCards([{ id: 'a' }, outer]).map(c => c.id)).toEqual(['a', 'outer', 'b', 'inner', 'c']);
        expect(flattenCards(undefined)).toEqual([]);
    });
});
