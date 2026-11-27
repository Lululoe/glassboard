import { describe, it, expect } from 'vitest';
import { appGridNotices } from './notices';

describe('App Grid notices', () => {
    it('reports offline apps, except those without a status check', () => {
        const apps = [{ name: 'Sonarr' }, { name: 'Plex' }, { name: 'Router', statusCheck: false }];
        expect(appGridNotices(apps, [true, null, false])).toEqual([]);
        expect(appGridNotices(apps, [false, true, false])).toEqual([{ level: 'alert', count: 1, title: 'Sonarr is offline' }]);
        expect(appGridNotices(apps, [false, false, false])).toEqual([{ level: 'alert', count: 2, title: '2 apps offline' }]);
    });
});
