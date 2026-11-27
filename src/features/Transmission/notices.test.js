import { describe, it, expect } from 'vitest';
import { transmissionNotices } from './notices';

describe('Transmission notices', () => {
    it('reports torrents with errors, stalled ones and downloads', () => {
        const torrents = [{ state: 'error' }, { state: 'stalled' }, { state: 'downloading' }, { state: 'downloading' }, { state: 'seeding' }];
        expect(transmissionNotices(torrents)).toEqual([
            { level: 'alert', count: 1, title: '1 torrent with an error' },
            { level: 'todo', count: 1, title: '1 torrent stalled' },
            { level: 'activity', count: 2, title: '2 downloads in progress' },
        ]);
        expect(transmissionNotices([], 'offline')).toEqual([{ level: 'alert', title: "Can't reach Transmission" }]);
    });
});
