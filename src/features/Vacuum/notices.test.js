import { describe, it, expect } from 'vitest';
import { vacuumNotices } from './notices';

describe('Vacuum notices', () => {
    it('reports robot errors, worn parts and cleaning', () => {
        const robots = [
            {
                name: 'L10s', state: 'error', stats: [{ name: 'Error', value: 'Main brush jammed' }],
                consumables: [{ name: 'Filter', value: 0, percent: null }, { name: 'Brush', value: 120, percent: null }],
            },
            { name: 'S5', state: 'cleaning', consumables: [{ name: 'Mop', value: 5, percent: 15 }, { name: 'Side', value: 3, percent: 5 }] },
            { name: 'Q7', state: 'docked', consumables: [{ name: 'Filter', value: 90, percent: 90 }] },
        ];
        expect(vacuumNotices(robots)).toEqual([
            { level: 'alert', title: 'L10s has a problem: Main brush jammed' },
            { level: 'todo', count: 1, title: 'L10s: Filter needs replacing' },
            { level: 'todo', count: 2, title: 'S5: 2 parts need replacing' },
            { level: 'activity', title: 'S5 is cleaning' },
        ]);
        expect(vacuumNotices([{ name: 'S5', state: 'returning', consumables: [] }]))
            .toEqual([{ level: 'activity', title: 'S5 is returning to its dock' }]);
    });
});
