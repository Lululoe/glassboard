import { describe, it, expect } from 'vitest';
import { gitNotices } from './notices';

describe('Pull Requests notices', () => {
    it('reports open pull requests, not drafts or merged ones', () => {
        expect(gitNotices([{ state: 'open' }, { state: 'draft' }, { state: 'merged' }]))
            .toEqual([{ level: 'todo', count: 1, title: '1 open pull request' }]);
        expect(gitNotices([{ state: 'open' }, { state: 'open' }])[0].title).toBe('2 open pull requests');
        expect(gitNotices([{ state: 'draft' }])).toEqual([]);
    });
});
