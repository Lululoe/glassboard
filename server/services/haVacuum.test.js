// @vitest-environment node
import zlib from 'zlib';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { handleHaRequest, getValidEntityIds } from './homeassistant.js';
import { readValetudoMap, resetMapCache, robotSettings, robotsOf, simplifyValetudoMap, vacuumCall } from './haVacuum.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

/** A PNG with Valetudo's map data in a zTXt chunk, as its camera entity serves it. */
function valetudoPng(map, keyword = 'ValetudoMap') {
    const chunk = (type, data) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(data.length, 0);
        head.write(type, 4, 'latin1');
        return Buffer.concat([head, data, Buffer.alloc(4)]);
    };
    const text = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0, 0]), zlib.deflateSync(JSON.stringify(map))]);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', Buffer.alloc(13)), chunk('zTXt', text), chunk('IEND', Buffer.alloc(0))]);
}

const MAP = {
    pixelSize: 5,
    layers: [
        { type: 'segment', metaData: { segmentId: '1', name: 'Kitchen' }, dimensions: { x: { min: 10, max: 12, avg: 11 }, y: { min: 20, max: 21, avg: 20 } }, compressedPixels: [10, 20, 3, 10, 21, 2] },
        { type: 'wall', metaData: {}, dimensions: { x: { min: 8, max: 14, avg: 11 }, y: { min: 18, max: 23, avg: 20 } }, compressedPixels: [8, 18, 7] },
    ],
    entities: [
        { type: 'path', points: [50, 100, 60, 105] },
        { type: 'robot_position', points: [55, 100], metaData: { angle: 90 } },
        { type: 'charger_location', points: [45, 95] },
    ],
};

const ROBOT = {
    id: 'robo', type: 'vacuum', entity_id: 'vacuum.robo', battery: 'sensor.battery', wetness: 'select.water', progress: 'sensor.progress',
    map: 'camera.map', camera: 'camera.front',
    stats: [
        { entity_id: 'sensor.area', name: 'Area' },
        'sensor.time',
        { entity_id: 'vacuum.robo', attribute: 'fan_speed', name: 'Fan' },
        { entity_id: 'sensor.missing', name: 'Missing' },
        { entity_id: 'bad id' },
    ],
    rooms: [{ area: 'kitchen', name: 'Kitchen', segment: 1 }, { area: 'office' }, { name: 'No area' }],
    consumables: [
        { entity_id: 'sensor.brush', name: 'Brush', percent: 'sensor.brush_pct', reset: 'button.reset_brush' },
        { entity_id: 'sensor.filter', name: 'Filter' },
    ],
};

const STATES = {
    'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Robo', fan_speed: 'max', fan_speed_list: ['low', 'max'] } },
    'sensor.battery': { state: '78', attributes: { unit_of_measurement: '%' } },
    'sensor.progress': { state: '42', attributes: {} },
    'select.water': { state: 'high', attributes: { options: ['low', 'high'] } },
    'sensor.area': { state: '90000', attributes: { unit_of_measurement: 'cm²' } },
    'sensor.time': { state: '720', attributes: { unit_of_measurement: 's', friendly_name: 'Clean time' } },
    'sensor.brush': { state: '8160', attributes: { unit_of_measurement: 'min' } },
    'sensor.brush_pct': { state: '15', attributes: {} },
    'sensor.filter': { state: '0', attributes: { unit_of_measurement: 'min' } },
};

describe('vacuum settings', () => {
    it('leaves out invalid entries and limits robots', () => {
        const robot = robotSettings(ROBOT);
        expect(robot.stats.map(s => s.entity_id)).toEqual(['sensor.area', 'sensor.time', 'vacuum.robo', 'sensor.missing']);
        expect(robot.rooms.map(r => r.area)).toEqual(['kitchen', 'office']);
        expect(robotSettings({ entity_id: 'vacuum.a', map: 'nope' }).map).toBeNull();
        expect(robotsOf({ type: 'vacuums', robots: Array.from({ length: 9 }, (_, i) => `vacuum.r${i}`) })).toHaveLength(6);
        expect(robotsOf({ type: 'weather' })).toEqual([]);
    });
});

describe('Home Assistant vacuum endpoints', () => {
    beforeEach(() => {
        resetMapCache();
        setConfig({
            services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } },
            pages: [{ cards: [ROBOT, { id: 'plain', type: 'vacuum', entity_id: 'vacuum.plain', map: 'camera.plain' }, { id: 'lights', type: 'hacontrol', data: { entities: [] } }] }],
        });
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = decodeURIComponent(String(url));
            if (init?.method === 'POST') return okResponse([]);
            const id = u.split('/states/')[1];
            if (id) return STATES[id] ? okResponse(STATES[id]) : { ok: false, status: 404, text: async () => 'not found', json: async () => ({}) };
            if (u.includes('/camera_proxy/camera.map')) return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => valetudoPng(MAP) };
            if (u.includes('/camera_proxy/')) return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => Buffer.from('jpeg data') };
            return okResponse({});
        }));
    });

    const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url, init]) => [String(url).split('/api')[1], JSON.parse(init.body)]);

    it('reports a robot with its stats, rooms and consumables', async () => {
        const { robots: [robot] } = await handleHaRequest({ endpoint: 'vacuum', card_id: 'robo' });
        expect(robot).toMatchObject({
            entity_id: 'vacuum.robo', name: 'Robo', state: 'cleaning', battery: 78, progress: 42,
            fan: { value: 'max', options: ['low', 'max'] },
            wetness: { value: 'high', options: ['low', 'high'] },
            camera: 'camera.front', map: 'camera.map',
        });
        expect(robot.stats).toEqual([
            { name: 'Area', value: '90000', unit: 'cm²', battery: false },
            { name: 'Clean time', value: '720', unit: 's', battery: false },
            { name: 'Fan', value: 'max', unit: '', battery: false },
            { name: 'Missing', value: null, unit: '', battery: false },
        ]);
        expect(robot.rooms).toEqual([{ name: 'Kitchen', area: 'kitchen', segment: '1' }, { name: 'office', area: 'office', segment: null }]);
        expect(robot.consumables).toEqual([
            { index: 0, name: 'Brush', value: '8160', unit: 'min', percent: 15, resettable: true },
            { index: 1, name: 'Filter', value: '0', unit: 'min', percent: null, resettable: false },
        ]);
        // Card entities can be read like others
        expect(getValidEntityIds()).toContain('sensor.brush_pct');
    });

    it('only runs what the card allows', async () => {
        const act = (params) => handleHaRequest({ endpoint: 'vacuum_action', card_id: 'robo', entity_id: 'vacuum.robo', ...params });
        await act({ action: 'start' });
        await act({ action: 'clean_rooms', areas: ['kitchen', 'office'] });
        await act({ action: 'set_fan', value: 'low' });
        await act({ action: 'set_wetness', value: 'low' });
        await act({ action: 'reset_consumable', index: 0 });
        expect(posts()).toEqual([
            ['/services/vacuum/start', { entity_id: 'vacuum.robo' }],
            ['/services/vacuum/clean_area', { entity_id: 'vacuum.robo', cleaning_area_id: ['kitchen', 'office'] }],
            ['/services/vacuum/set_fan_speed', { entity_id: 'vacuum.robo', fan_speed: 'low' }],
            ['/services/select/select_option', { entity_id: 'select.water', option: 'low' }],
            ['/services/button/press', { entity_id: 'button.reset_brush' }],
        ]);

        const refused = [
            [{ card_id: 'lights', entity_id: 'vacuum.robo', action: 'start' }, 403],
            [{ card_id: 'robo', entity_id: 'vacuum.other', action: 'start' }, 403],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'clean_rooms', areas: ['garage'] }, 403],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'clean_rooms', areas: [] }, 400],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'set_fan', value: 'turbo' }, 400],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'set_wetness', value: 'flood' }, 400],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'reset_consumable', index: 1 }, 403],
            [{ card_id: 'plain', entity_id: 'vacuum.plain', action: 'set_wetness', value: 'low' }, 403],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'selfdestruct' }, 400],
            [{ card_id: 'robo', entity_id: 'vacuum.robo', action: 'constructor' }, 400],
        ];
        for (const [params, status] of refused) {
            await expect(vacuumCall(params)).rejects.toMatchObject({ status });
        }
    });

    it('turns Valetudo map data into a minimal map, and leaves other cameras as images', async () => {
        const map = await handleHaRequest({ endpoint: 'vacuum_map', card_id: 'robo', entity_id: 'camera.map' });
        expect(map).toMatchObject({
            kind: 'valetudo',
            viewBox: [4, 14, 15, 14],
            path: 'M10 20L12 21',
            robot: { x: 11, y: 20, angle: 90 },
            charger: { x: 9, y: 19 },
            segments: [{ id: '1', name: 'Kitchen', d: 'M10 20h3v1h-3zM10 21h2v1h-2z', x: 11, y: 20 }],
            walls: 'M8 18h7v1h-7z',
        });
        expect(await handleHaRequest({ endpoint: 'vacuum_map', card_id: 'robo', entity_id: 'camera.front' })).toEqual({ kind: 'image' });
        // A plain camera isn't loaded again just to find out that it's no map
        const calls = fetch.mock.calls.length;
        await handleHaRequest({ endpoint: 'vacuum_map', card_id: 'robo', entity_id: 'camera.front' });
        expect(fetch.mock.calls.length).toBe(calls);

        await expect(handleHaRequest({ endpoint: 'vacuum_map', card_id: 'robo', entity_id: 'camera.garden' })).rejects.toMatchObject({ status: 403 });
        await expect(handleHaRequest({ endpoint: 'vacuum', card_id: 'lights' })).rejects.toMatchObject({ status: 403 });
    });

    it('reads only Valetudo map data from images', () => {
        expect(readValetudoMap(valetudoPng(MAP))).toEqual(MAP);
        expect(readValetudoMap(valetudoPng(MAP, 'Other'))).toBeNull();
        expect(readValetudoMap(Buffer.from('not an image at all'))).toBeNull();
        const broken = valetudoPng(MAP);
        broken.fill(0, broken.length - 40, broken.length - 20);
        expect(readValetudoMap(broken)).toBeNull();
        expect(simplifyValetudoMap({ layers: [], entities: [] })).toMatchObject({ viewBox: [0, 0, 100, 100], segments: [], robot: null, path: '' });
    });
});
