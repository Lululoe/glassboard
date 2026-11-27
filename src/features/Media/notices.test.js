import { describe, it, expect } from 'vitest';
import { mediaNotices } from './notices';

describe('Media Calendar notices', () => {
    it('reports missing releases', () => {
        expect(mediaNotices([{ title: 'Andor', status: 'missing' }, { title: 'Dune', status: 'downloaded' }]))
            .toEqual([{ level: 'todo', count: 1, title: 'Andor is missing' }]);
        expect(mediaNotices([{ status: 'missing' }, { status: 'missing' }])[0].title).toBe('2 releases missing');
        expect(mediaNotices([{ status: 'upcoming' }])).toEqual([]);
    });
});
