// @vitest-environment node
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, onTestFinished } from 'vitest';
import { createApp } from '../app.js';
import { setConfig } from '../config.js';
import { listenOnLoopback } from '../testServer.js';
import { demoHandlers, isDemoMode, resetDemoState } from './demo.js';

const iso = (date) => date.toISOString().slice(0, 10);

describe('demo mode', () => {
    beforeEach(() => {
        delete process.env.GLASSBOARD_DEMO;
        resetDemoState();
        setConfig({
            demo: true,
            launcher: { apps: Array.from({ length: 6 }, (_v, i) => ({ name: `App ${i}`, url: `http://app${i}.local` })) },
            pages: [{
                cards: [
                    { id: 'apps', type: 'appgrid' },
                    { id: 'prs', type: 'git', filterStatus: ['open'], repositories: [{ type: 'github', owner: 'me', repo: 'board' }] },
                    {
                        id: 'lights', type: 'hacontrol', data: {
                            entities: [
                                { entity_id: 'light.a', on_action: { service: 'light.turn_on' }, off_action: { service: 'light.turn_off' } },
                                { entity_id: 'light.b', on_action: { service: 'light.turn_on' }, off_action: { service: 'light.turn_off' } },
                            ],
                        },
                    },
                    { id: 'heat', type: 'thermostat', entity_id: 'climate.demo_room' },
                    { id: 'music', type: 'mediaplayer', entities: ['media_player.den', 'media_player.patio', 'media_player.attic'] },
                ],
            }],
        });
    });

    afterEach(() => {
        delete process.env.GLASSBOARD_DEMO;
    });

    it('is enabled by the config or the environment, with the environment taking precedence', () => {
        expect(isDemoMode()).toBe(true);
        process.env.GLASSBOARD_DEMO = 'false';
        expect(isDemoMode()).toBe(false);
        setConfig({});
        process.env.GLASSBOARD_DEMO = '1';
        expect(isDemoMode()).toBe(true);
        delete process.env.GLASSBOARD_DEMO;
        expect(isDemoMode()).toBe(false);
    });

    it('serves simulated data for every real service', async () => {
        const { serviceHandlers } = await import('./index.js');
        expect(Object.keys(demoHandlers).sort()).toEqual(Object.keys(serviceHandlers).sort());
    });

    it('simulates server stats and proxmox guests within sensible ranges', async () => {
        const stats = await demoHandlers.serverstats({});
        expect(stats.cpu).toBeGreaterThanOrEqual(0);
        expect(stats.cpu).toBeLessThanOrEqual(100);
        expect(stats.ram.used).toBeLessThan(stats.ram.total);

        const { nodes, summary } = await demoHandlers.proxmox({});
        expect(summary.total).toBe(nodes.length);
        expect(summary.running).toBe(nodes.filter(n => n.status === 'running').length);
    });

    it('marks the fifth app offline so the badge can be seen', async () => {
        const { statuses } = await demoHandlers.appstatus({ cardId: 'apps' });
        expect(statuses).toEqual([true, true, true, true, false, true]);
    });

    it('applies the git card status filter and repository name', async () => {
        const { prs, stats } = await demoHandlers.git({ cardId: 'prs' });
        expect(prs.length).toBeGreaterThan(0);
        expect(prs.every(pr => pr.state === 'open' && pr.repo === 'me/board')).toBe(true);
        expect(stats.open).toBe(prs.length);
    });

    it('only returns media events inside the requested range', async () => {
        const today = new Date();
        const events = await demoHandlers.media({ start: iso(today), end: iso(today) });
        expect(events.length).toBeGreaterThan(0);
        expect(events.every(e => new Date(e.datetime).toDateString() === today.toDateString())).toBe(true);
        await expect(demoHandlers.media({ start: 'x', end: 'y' })).rejects.toMatchObject({ status: 400 });
    });

    it('keeps Home Assistant toggles in memory', async () => {
        const before = await demoHandlers.homeassistant({ endpoint: 'states', entity_ids: ['light.a', 'light.b'] });
        expect(before['light.b'].state).toBe('off');

        await demoHandlers.homeassistant({ endpoint: 'services', entity_id: 'light.b', action: 'light.turn_on' });
        const after = await demoHandlers.homeassistant({ endpoint: 'states', entity_ids: ['light.b'] });
        expect(after['light.b'].state).toBe('on');

        await expect(demoHandlers.homeassistant({ endpoint: 'services', entity_id: 'light.b', action: 'lock.unlock' }))
            .rejects.toMatchObject({ status: 403 });
    });

    it('simulates thermostats and applies their actions', async () => {
        const ha = demoHandlers.homeassistant;
        const read = async () => (await ha({ endpoint: 'states', entity_ids: ['climate.demo_room'] }))['climate.demo_room'];

        const before = await read();
        expect(before.state).toBe('heat');
        expect(before.attributes).toMatchObject({ friendly_name: 'Demo Room', hvac_action: 'heating', preset_mode: 'comfort' });

        await ha({ endpoint: 'climate', entity_id: 'climate.demo_room', action: 'set_preset_mode', preset_mode: 'eco' });
        expect((await read()).attributes).toMatchObject({ temperature: 17, preset_mode: 'eco', hvac_action: 'idle' });

        await ha({ endpoint: 'climate', entity_id: 'climate.demo_room', action: 'set_hvac_mode', hvac_mode: 'off' });
        expect((await read()).state).toBe('off');

        await expect(ha({ endpoint: 'climate', entity_id: 'climate.nope', action: 'set_temperature', temperature: 20 }))
            .rejects.toMatchObject({ status: 403 });
    });

    it('simulates media players, playback and grouping', async () => {
        const ha = demoHandlers.homeassistant;
        const read = async () => ha({ endpoint: 'states', entity_ids: ['media_player.den', 'media_player.patio', 'media_player.attic'] });

        const before = await read();
        expect(before['media_player.den']).toMatchObject({ state: 'playing', attributes: { media_title: 'Midnight Tides' } });
        expect(before['media_player.den'].attributes.group_members).toEqual(['media_player.den', 'media_player.patio']);
        expect(before['media_player.attic'].state).toBe('paused');

        await ha({ endpoint: 'media', entity_id: 'media_player.den', action: 'media_play_pause' });
        await ha({ endpoint: 'media', entity_id: 'media_player.attic', action: 'media_next_track' });
        await ha({ endpoint: 'media', entity_id: 'media_player.patio', action: 'unjoin' });
        await ha({ endpoint: 'media', entity_id: 'media_player.den', action: 'join', group_members: ['media_player.attic'] });

        const after = await read();
        expect(after['media_player.den'].state).toBe('paused');
        expect(after['media_player.attic']).toMatchObject({ state: 'paused', attributes: { media_title: 'Glass Gardens', media_position: 0 } });
        expect(after['media_player.patio'].attributes.group_members).toEqual(['media_player.patio']);
        expect(after['media_player.den'].attributes.group_members).toEqual(['media_player.den', 'media_player.attic']);
    });

    it('returns daily and hourly forecasts keyed by entity id', async () => {
        const daily = await demoHandlers.weather({ cardId: 'weather' });
        expect(daily.forecast).toHaveLength(7);
        expect(daily.units).toBe('metric');
        const hourly = await demoHandlers.weather({ cardId: 'weather', type: 'hourly' });
        expect(hourly.forecast).toHaveLength(24);
    });

    it('routes /api to the simulated handlers and reports demo mode in /api/config', async () => {
        const server = await listenOnLoopback(await createApp({ frontend: false }));
        onTestFinished(() => { server.close(); });

        const res = await request(server).post('/api').send({ service: 'serverstats' });
        expect(res.status).toBe(200);
        expect(res.body.info.hostname).toBe('homelab');

        const config = await request(server).get('/api/config');
        expect(config.body.demo).toBe(true);
    });

    it('simulates lights and groups for the control dialogs', async () => {
        setConfig({
            demo: true,
            pages: [{ cards: [{ id: 'l', type: 'hacontrol', data: { entities: [{ entity_id: 'group.den_lights' }] } }] }],
        });
        const ha = demoHandlers.homeassistant;
        const { members } = await ha({ endpoint: 'details', entity_id: 'group.den_lights' });
        const ids = Object.keys(members);
        expect(ids.length).toBeGreaterThan(1);
        expect(ids.every(id => id.startsWith('light.den_'))).toBe(true);

        const color = ids.find(id => members[id].attributes.supported_color_modes.includes('hs'));
        await ha({ endpoint: 'control', entity_ids: [color], action: 'turn_on', brightness_pct: 30, hs_color: [200, 70] });
        const after = await ha({ endpoint: 'details', entity_id: 'group.den_lights' });
        expect(after.members[color]).toMatchObject({ state: 'on', attributes: { brightness: 77, hs_color: [200, 70], color_mode: 'hs' } });

        await ha({ endpoint: 'control', entity_ids: ids, action: 'turn_off' });
        const off = await ha({ endpoint: 'details', entity_id: 'group.den_lights' });
        expect(off.entity.state).toBe('off');
        await expect(ha({ endpoint: 'control', entity_ids: ['light.elsewhere'], action: 'turn_on' })).rejects.toMatchObject({ status: 403 });
    });

    it('simulates history for graph cards', async () => {
        setConfig({
            demo: true,
            pages: [{
                cards: [
                    { id: 'g', type: 'graph', chart: 'bar', ranges: ['24h', '7d'], entities: ['sensor.solar_energy', 'sensor.living_room_temperature'] },
                    { id: 'w', type: 'graph', chart: 'week', entities: ['sensor.gas_consumption'] },
                ],
            }],
        });
        const bars = await demoHandlers.homeassistant({ endpoint: 'graph', card_id: 'g', range: '7d' });
        expect(bars.times).toHaveLength(7);
        expect(bars.series.map(s => [s.unit, s.kind])).toEqual([['kWh', 'change'], ['°C', 'mean']]);
        expect(bars.series.every(s => s.values.length === 7 && s.values.every(Number.isFinite))).toBe(true);
        const week = await demoHandlers.homeassistant({ endpoint: 'graph', card_id: 'w' });
        expect(week).toMatchObject({ chart: 'week', series: [{ unit: 'm³' }] });
        expect(week.times).toHaveLength(14);
        await expect(demoHandlers.homeassistant({ endpoint: 'graph', card_id: 'g', range: '30d' })).rejects.toMatchObject({ status: 400 });
    });

    it('simulates a printer for printer cards', async () => {
        setConfig({ demo: true, pages: [{ cards: [{ id: 'p', type: 'printer', printer: 'p2s' }, { id: 'x', type: 'graph' }] }] });
        const ha = demoHandlers.homeassistant;
        const printer = await ha({ endpoint: 'printer', card_id: 'p' });
        expect(printer).toMatchObject({ name: 'P2S', status: 'running', progress: 51, light: 'on', controls: { pause: true } });
        expect(printer.spools).toHaveLength(4);

        await ha({ endpoint: 'printer_action', card_id: 'p', action: 'pause' });
        await ha({ endpoint: 'printer_action', card_id: 'p', action: 'light_off' });
        expect(await ha({ endpoint: 'printer', card_id: 'p' })).toMatchObject({ status: 'pause', light: 'off' });
        await ha({ endpoint: 'printer_action', card_id: 'p', action: 'stop' });
        expect((await ha({ endpoint: 'printer', card_id: 'p' })).status).toBe('idle');

        await expect(ha({ endpoint: 'printer', card_id: 'x' })).rejects.toMatchObject({ status: 403 });
        await expect(ha({ endpoint: 'printer_action', card_id: 'p', action: 'explode' })).rejects.toMatchObject({ status: 400 });
    });

    it('simulates robots for vacuum cards', async () => {
        setConfig({
            demo: true,
            pages: [{
                cards: [{
                    id: 'v', type: 'vacuum', entity_id: 'vacuum.robo', map: 'camera.map', camera: 'camera.front',
                    stats: [{ entity_id: 'sensor.robo_area', name: 'Area' }],
                    rooms: [{ area: 'kitchen', name: 'Kitchen' }],
                    consumables: [{ entity_id: 'sensor.brush', percent: 'sensor.brush_pct', reset: 'button.reset' }],
                }],
            }],
        });
        const ha = demoHandlers.homeassistant;
        const { robots: [robot] } = await ha({ endpoint: 'vacuum', card_id: 'v' });
        expect(robot).toMatchObject({ entity_id: 'vacuum.robo', state: 'cleaning', stats: [{ name: 'Area', unit: 'm²' }], rooms: [{ area: 'kitchen' }], wetness: null });

        await ha({ endpoint: 'vacuum_action', card_id: 'v', entity_id: 'vacuum.robo', action: 'stop' });
        await ha({ endpoint: 'vacuum_action', card_id: 'v', entity_id: 'vacuum.robo', action: 'set_fan', value: 'max' });
        await ha({ endpoint: 'vacuum_action', card_id: 'v', entity_id: 'vacuum.robo', action: 'reset_consumable', index: 0 });
        const after = (await ha({ endpoint: 'vacuum', card_id: 'v' })).robots[0];
        expect(after).toMatchObject({ state: 'idle', fan: { value: 'max' }, consumables: [{ percent: 100, resettable: true }] });

        expect(await ha({ endpoint: 'vacuum_map', card_id: 'v', entity_id: 'camera.front' })).toEqual({ kind: 'image' });
        const map = await ha({ endpoint: 'vacuum_map', card_id: 'v', entity_id: 'camera.map' });
        expect(map.kind).toBe('valetudo');
        expect(map.segments.map(s => s.name)).toContain('Kitchen');
        await expect(ha({ endpoint: 'vacuum', card_id: 'nope' })).rejects.toMatchObject({ status: 403 });
    });
});

