import { describe, it, expect } from 'vitest';
import { haControlNotices } from './notices';

describe('Entity notices', () => {
    it('reports unavailable devices and unlocked locks, once loaded', () => {
        const entities = [{ entity_id: 'lock.door', name: 'Door' }, { entity_id: 'light.lamp', name: 'Lamp' }, { entity_id: 'switch.gone' }];
        const states = { 'lock.door': { state: 'unlocked' }, 'light.lamp': { state: 'on' } };
        expect(haControlNotices(entities, states, true)).toEqual([
            { level: 'todo', title: 'Door is unlocked' },
            { level: 'alert', title: 'switch.gone is unavailable' },
        ]);
        expect(haControlNotices(entities, {}, false)).toEqual([]);
        expect(haControlNotices([{ entity_id: 'lock.door' }], { 'lock.door': { state: 'locked' } }, true)).toEqual([]);
    });
});
