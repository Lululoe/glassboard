import { describe, it, expect } from 'vitest';
import { serverStatsNotices } from './notices';

describe('Server Stats notices', () => {
    it('reports a hot server and full storage, if the card shows them', () => {
        const stats = { info: { hostname: 'nas' }, temp: [60, 88], storage: { used: 95, total: 100 } };
        expect(serverStatsNotices(stats, ['temp', 'storage'])).toEqual([
            { level: 'alert', title: 'nas is running hot (88 °C)' },
            { level: 'alert', title: 'nas storage is 95 % full' },
        ]);
        expect(serverStatsNotices(stats, ['cpu'])).toEqual([]);
        expect(serverStatsNotices({ info: {}, temp: [50], storage: { used: 10, total: 100 } }, ['temp', 'storage'])).toEqual([]);
    });
});
