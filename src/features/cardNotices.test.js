import { describe, it, expect } from 'vitest';
import {
    appGridNotices, gitNotices, haControlNotices, mediaNotices, printerNotices, proxmoxNotices,
    serverStatsNotices, thermostatNotices, transmissionNotices, vacuumNotices,
} from './cardNotices';

describe('card notices', () => {
    it('reports offline apps, except those without a status check', () => {
        const apps = [{ name: 'Sonarr' }, { name: 'Plex' }, { name: 'Router', statusCheck: false }];
        expect(appGridNotices(apps, [true, null, false])).toEqual([]);
        expect(appGridNotices(apps, [false, true, false])).toEqual([{ level: 'alert', count: 1, title: 'Sonarr is offline' }]);
        expect(appGridNotices(apps, [false, false, false])).toEqual([{ level: 'alert', count: 2, title: '2 apps offline' }]);
    });

    it('reports open pull requests, not drafts or merged ones', () => {
        expect(gitNotices([{ state: 'open' }, { state: 'draft' }, { state: 'merged' }]))
            .toEqual([{ level: 'todo', count: 1, title: '1 open pull request' }]);
        expect(gitNotices([{ state: 'open' }, { state: 'open' }])[0].title).toBe('2 open pull requests');
        expect(gitNotices([{ state: 'draft' }])).toEqual([]);
    });

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

    it('reports prints by their status, but not a finished print', () => {
        const base = { name: 'P2S', job: 'Benchy' };
        expect(printerNotices(null)).toEqual([]);
        expect(printerNotices({ ...base, status: 'running', progress: 62.4 }))
            .toEqual([{ level: 'activity', title: 'P2S: printing Benchy · 62 %' }]);
        expect(printerNotices({ ...base, status: 'failed', error: 'Nozzle clog' }))
            .toEqual([{ level: 'alert', title: 'P2S: Nozzle clog' }]);
        expect(printerNotices({ ...base, status: 'pause', stage: 'paused_filament_runout' }))
            .toEqual([{ level: 'alert', title: 'P2S: Filament ran out' }]);
        expect(printerNotices({ ...base, status: 'pause', stage: 'paused_user' }))
            .toEqual([{ level: 'todo', title: 'P2S: print paused' }]);
        expect(printerNotices({ ...base, status: 'finish', endTime: new Date().toISOString() })).toEqual([]);
        expect(printerNotices({ ...base, status: 'idle' })).toEqual([]);
    });

    it('reports torrents with errors, stalled ones and downloads', () => {
        const torrents = [{ state: 'error' }, { state: 'stalled' }, { state: 'downloading' }, { state: 'downloading' }, { state: 'seeding' }];
        expect(transmissionNotices(torrents)).toEqual([
            { level: 'alert', count: 1, title: '1 torrent with an error' },
            { level: 'todo', count: 1, title: '1 torrent stalled' },
            { level: 'activity', count: 2, title: '2 downloads in progress' },
        ]);
        expect(transmissionNotices([], 'offline')).toEqual([{ level: 'alert', title: "Can't reach Transmission" }]);
    });

    it('reports a hot server and full storage, if the card shows them', () => {
        const stats = { info: { hostname: 'nas' }, temp: [60, 88], storage: { used: 95, total: 100 } };
        expect(serverStatsNotices(stats, ['temp', 'storage'])).toEqual([
            { level: 'alert', title: 'nas is running hot (88 °C)' },
            { level: 'alert', title: 'nas storage is 95 % full' },
        ]);
        expect(serverStatsNotices(stats, ['cpu'])).toEqual([]);
        expect(serverStatsNotices({ info: {}, temp: [50], storage: { used: 10, total: 100 } }, ['temp', 'storage'])).toEqual([]);
    });

    it('reports an unreachable Proxmox host', () => {
        expect(proxmoxNotices('timeout')).toEqual([{ level: 'alert', title: "Can't reach Proxmox" }]);
        expect(proxmoxNotices(null)).toEqual([]);
    });

    it('reports missing releases', () => {
        expect(mediaNotices([{ title: 'Andor', status: 'missing' }, { title: 'Dune', status: 'downloaded' }]))
            .toEqual([{ level: 'todo', count: 1, title: 'Andor is missing' }]);
        expect(mediaNotices([{ status: 'missing' }, { status: 'missing' }])[0].title).toBe('2 releases missing');
        expect(mediaNotices([{ status: 'upcoming' }])).toEqual([]);
    });

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

    it('reports unavailable thermostats, once loaded', () => {
        expect(thermostatNotices([{ name: 'Office', available: false }, { name: 'Kitchen', available: true }], true))
            .toEqual([{ level: 'alert', count: 1, title: 'Office is unavailable' }]);
        expect(thermostatNotices([{ name: 'A', available: false }, { name: 'B', available: false }], true)[0].title)
            .toBe('2 thermostats unavailable');
        expect(thermostatNotices([{ name: 'Office', available: false }], false)).toEqual([]);
    });
});
