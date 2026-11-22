import { describe, expect, it } from 'vitest';
import { searchEntities } from './entityModel';

const entities = [
    { entity_id: 'light.kitchen_ceiling', name: 'Kitchen Ceiling' },
    { entity_id: 'sensor.kitchen_temperature', name: 'Kitchen Temperature' },
    { entity_id: 'light.living_room', name: 'Living Room' },
];

describe('searchEntities', () => {
    it('lists everything by name without a search', () => {
        expect(searchEntities(entities, '').map(e => e.name)).toEqual(['Kitchen Ceiling', 'Kitchen Temperature', 'Living Room']);
    });

    it('needs every word in the name or the id', () => {
        expect(searchEntities(entities, 'kitchen temp').map(e => e.entity_id)).toEqual(['sensor.kitchen_temperature']);
        expect(searchEntities(entities, 'light.').map(e => e.name)).toEqual(['Kitchen Ceiling', 'Living Room']);
        expect(searchEntities(entities, 'garage')).toEqual([]);
    });

    it('puts an exact id and names starting with the search first', () => {
        expect(searchEntities(entities, 'living')[0].name).toBe('Living Room');
        expect(searchEntities(entities, 'light.living_room')[0].entity_id).toBe('light.living_room');
    });
});
