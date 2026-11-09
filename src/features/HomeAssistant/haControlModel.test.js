import { describe, expect, it } from 'vitest';
import { splitControlCards } from './haControlModel';

describe('splitControlCards', () => {
    it('gives every entity of an older control card its own quarter tile', () => {
        const cards = [
            { id: 'w', type: 'weather' },
            { id: 'lights', type: 'hacontrol', colSpan: 1, data: { entities: [{ entity_id: 'light.a' }, { entity_id: 'light.b' }] } },
            { id: 'g', type: 'graph' },
        ];
        expect(splitControlCards(cards)).toEqual([
            { id: 'w', type: 'weather' },
            { id: 'lights', type: 'hacontrol', tileSize: 'quarter', data: { entities: [{ entity_id: 'light.a' }] } },
            { id: 'lights-2', type: 'hacontrol', tileSize: 'quarter', data: { entities: [{ entity_id: 'light.b' }] } },
            { id: 'g', type: 'graph' },
        ]);
    });

    it('makes single entity cards quarter tiles and skips taken ids', () => {
        const cards = [
            { id: 'l', type: 'hacontrol', colSpan: 2, data: { entities: [{ entity_id: 'light.a' }, { entity_id: 'light.b' }] } },
            { id: 'l-2', type: 'hacontrol', tileSize: 'half', data: { entities: [{ entity_id: 'light.c' }] } },
        ];
        expect(splitControlCards(cards).map(c => [c.id, c.tileSize, c.colSpan])).toEqual([
            ['l', 'quarter', undefined],
            ['l-2-2', 'quarter', undefined],
            ['l-2', 'quarter', undefined],
        ]);
    });

    it('returns the same list when there is nothing to split', () => {
        const cards = [{ id: 'l', type: 'hacontrol', tileSize: 'quarter', data: { entities: [{ entity_id: 'light.a' }] } }];
        expect(splitControlCards(cards)).toBe(cards);
    });
});
