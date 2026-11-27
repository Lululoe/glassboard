import { describe, it, expect } from 'vitest';
import { thermostatNotices } from './notices';

describe('Thermostat notices', () => {
    it('reports unavailable thermostats, once loaded', () => {
        expect(thermostatNotices([{ name: 'Office', available: false }, { name: 'Kitchen', available: true }], true))
            .toEqual([{ level: 'alert', count: 1, title: 'Office is unavailable' }]);
        expect(thermostatNotices([{ name: 'A', available: false }, { name: 'B', available: false }], true)[0].title)
            .toBe('2 thermostats unavailable');
        expect(thermostatNotices([{ name: 'Office', available: false }], false)).toEqual([]);
    });
});
