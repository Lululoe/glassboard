// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setConfig } from '../config.js';
import { getValidEntityIds, handleHaRequest } from './homeassistant.js';
import {
    dayStart, litterCall, litterData, litterHistory, litterSettings, resetLitterCache, thin, visitTimes, visitsPerDay,
} from './haLitter.js';
import { demoLitterAction, demoLitterHistory, demoLitterState, demoLitterbox, demoVisits } from './demoLitter.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

const BOX = {
    id: 'litter', type: 'litterbox', entity_id: 'vacuum.lr4_litter_box', status: 'sensor.lr4_status_code', waste: 'sensor.lr4_waste_drawer',
    litter: 'sensor.lr4_litter_level', reset: 'button.lr4_reset', clean_delay: 'select.lr4_wait', globe_light: 'select.lr4_light',
    panel_lock: 'switch.lr4_lock', firmware: 'update.lr4_firmware', hopper: 'bad id',
    cats: [
        { name: 'Pepper', weight: 'sensor.pepper_weight', visits: 'sensor.pepper_visits' },
        { weight: 'sensor.teddy_weight' },
        { name: 'Nothing' },
    ],
};

const STATES = {
    'vacuum.lr4_litter_box': { state: 'docked', attributes: { friendly_name: 'Litter-Robot 4' } },
    'sensor.lr4_status_code': { state: 'rdy', attributes: {} },
    'sensor.lr4_waste_drawer': { state: '120', attributes: { unit_of_measurement: '%' } },
    'sensor.lr4_litter_level': { state: 'unavailable', attributes: {} },
    'select.lr4_wait': { state: '7', attributes: { options: ['3', '7', '15'] } },
    'select.lr4_light': { state: 'on', attributes: { options: ['on', 'off', 'auto'] } },
    'switch.lr4_lock': { state: 'off', attributes: {} },
    'update.lr4_firmware': { state: 'on', attributes: { installed_version: '1.0', latest_version: '1.1' } },
    'sensor.pepper_weight': { state: '3.32', attributes: { unit_of_measurement: 'kg' }, last_changed: '2026-11-20T08:00:00Z' },
    'sensor.pepper_visits': { state: '4', attributes: {} },
    'sensor.teddy_weight': { state: 'unknown', attributes: {} },
};
const readState = async (id) => STATES[id] ?? null;

describe('litter box settings', () => {
    it('leaves out invalid entities and cats without sensors', () => {
        const box = litterSettings(BOX);
        expect(box.hopper).toBeNull();
        expect(box.sleep_start).toBeNull();
        expect(box.cats.map(c => c.name)).toEqual(['Pepper', 'Cat 2']);
    });
});

describe('litter box data', () => {
    beforeEach(() => setConfig({ pages: [{ cards: [BOX, { id: 'other', type: 'vacuum', entity_id: 'vacuum.robo' }] }] }));

    it('reads levels, settings and cats', async () => {
        const data = await litterData({ card_id: 'litter' }, readState);
        expect(data).toMatchObject({
            name: 'Litter-Robot 4', state: 'docked', status: 'rdy', waste: 100, litter: null, resettable: true,
            clean_delay: { value: '7', options: ['3', '7', '15'] }, panel_lock: false, sleep: null,
            firmware: { update: true, installed: '1.0', latest: '1.1' },
        });
        expect(data.cats[0]).toMatchObject({ name: 'Pepper', weight: 3.32, weight_unit: 'kg', visits: 4, weighed_at: '2026-11-20T08:00:00Z' });
        expect(data.cats[1]).toMatchObject({ weight: null, visits: null, weighed_at: null });
    });

    it('refuses other cards', async () => {
        await expect(litterData({ card_id: 'other' }, readState)).rejects.toMatchObject({ status: 403 });
        await expect(litterData({ card_id: 'nope' }, readState)).rejects.toMatchObject({ status: 403 });
    });

    it('lets the card read its own entities only', () => {
        const ids = getValidEntityIds();
        expect(ids.has('sensor.pepper_visits')).toBe(true);
        expect(ids.has('button.lr4_reset')).toBe(true);
        expect(ids.has('sensor.secret')).toBe(false);
    });
});

describe('litter box actions', () => {
    beforeEach(() => setConfig({ pages: [{ cards: [BOX, { id: 'bare', type: 'litterbox', entity_id: 'vacuum.bare' }] }] }));

    it('turns actions into service calls', async () => {
        const call = (params) => litterCall({ card_id: 'litter', ...params }, readState);
        expect(await call({ action: 'clean' })).toEqual({ domain: 'vacuum', service: 'start', body: { entity_id: 'vacuum.lr4_litter_box' } });
        expect(await call({ action: 'reset' })).toEqual({ domain: 'button', service: 'press', body: { entity_id: 'button.lr4_reset' } });
        expect(await call({ action: 'set_clean_delay', value: '15' })).toMatchObject({ service: 'select_option', body: { entity_id: 'select.lr4_wait', option: '15' } });
        expect(await call({ action: 'set_globe_light', value: 'auto' })).toMatchObject({ body: { entity_id: 'select.lr4_light', option: 'auto' } });
        expect(await call({ action: 'set_panel_lock', value: true })).toEqual({ domain: 'homeassistant', service: 'turn_on', body: { entity_id: 'switch.lr4_lock' } });
    });

    it('refuses invalid values and missing entities', async () => {
        const call = (params, card = 'litter') => litterCall({ card_id: card, ...params }, readState);
        await expect(call({ action: 'set_clean_delay', value: '99' })).rejects.toMatchObject({ status: 400 });
        await expect(call({ action: 'set_panel_lock', value: 'yes' })).rejects.toMatchObject({ status: 400 });
        await expect(call({ action: 'explode' })).rejects.toMatchObject({ status: 400 });
        await expect(call({ action: 'reset' }, 'bare')).rejects.toMatchObject({ status: 403 });
        await expect(call({ action: 'set_globe_light', value: 'on' }, 'bare')).rejects.toMatchObject({ status: 403 });
    });
});

describe('litter box history', () => {
    const now = new Date(2026, 10, 24, 15, 0).getTime();
    const h = (hour, day = 0) => new Date(2026, 10, 24 + day, hour, 0).getTime();

    it('finds visits where the counter goes up', () => {
        const samples = [{ t: h(23, -1), v: 5 }, { t: h(0), v: 0 }, { t: h(6), v: 1 }, { t: h(9), v: 1 }, { t: h(12), v: 3 }];
        expect(visitTimes(samples, dayStart(now))).toEqual([h(6), h(12), h(12)]);
    });

    it('counts visits per day from each day\'s highest count', () => {
        const samples = [{ t: h(20, -2), v: 4 }, { t: h(10, -1), v: 2 }, { t: h(12), v: 3 }];
        expect(visitsPerDay(samples, now, 3)).toEqual([4, 2, 3]);
    });

    it('thins long series to the limit, keeping the newest', () => {
        const samples = Array.from({ length: 1000 }, (_, i) => ({ t: i, v: i }));
        const thinned = thin(samples, 100);
        expect(thinned.length).toBeLessThanOrEqual(101);
        expect(thinned[thinned.length - 1]).toEqual({ t: 999, v: 999 });
    });

    describe('over Home Assistant', () => {
        beforeEach(() => {
            resetLitterCache();
            setConfig({ services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } }, pages: [{ cards: [BOX] }] });
            vi.stubGlobal('fetch', vi.fn(async () => okResponse([[
                { entity_id: 'sensor.pepper_visits', state: '0', last_changed: new Date(h(1)).toISOString() },
                { state: '1', last_changed: new Date(h(8)).toISOString() },
            ]])));
        });
        afterEach(() => vi.unstubAllGlobals());

        it('loads and caches today\'s visits', async () => {
            const result = await litterHistory({ card_id: 'litter', range: 'today' }, now);
            expect(result.cats).toEqual([{ index: 0, visits: [h(8)] }, { index: 1, visits: [] }]);
            await litterHistory({ card_id: 'litter', range: 'today' }, now + 1000);
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(String(fetch.mock.calls[0][0])).toContain('/history/period/');
        });

        it('refuses unknown ranges', async () => {
            await expect(litterHistory({ card_id: 'litter', range: 'year' }, now)).rejects.toMatchObject({ status: 400 });
        });

        it('serves the endpoints through handleHaRequest', async () => {
            await handleHaRequest({ endpoint: 'litterbox_action', card_id: 'litter', action: 'clean' });
            const [url, init] = fetch.mock.calls.at(-1);
            expect(String(url)).toContain('/services/vacuum/start');
            expect(JSON.parse(init.body)).toEqual({ entity_id: 'vacuum.lr4_litter_box' });
        });
    });
});

describe('demo litter box', () => {
    beforeEach(() => setConfig({ pages: [{ cards: [BOX] }] }));

    it('simulates the robot, cats and history', async () => {
        const data = await demoLitterbox({ card_id: 'litter' });
        expect(data.status).toBe('rdy');
        expect(data.cats[0].weight).toBeGreaterThan(3);
        expect(demoLitterState('sensor.unrelated')).toBeNull();
        const week = demoLitterHistory({ card_id: 'litter', range: 'week' });
        expect(week.cats[0].days).toHaveLength(7);
        expect(demoLitterHistory({ card_id: 'litter', range: 'weight' }).cats[0].points.length).toBeGreaterThan(20);
    });

    it('cleans, resets and changes settings', async () => {
        const now = Date.now();
        await demoLitterAction({ card_id: 'litter', action: 'clean' }, now);
        expect(demoLitterState('sensor.lr4_status_code', now + 1000).state).toBe('ccp');
        await demoLitterAction({ card_id: 'litter', action: 'reset' }, now);
        expect(demoLitterState('sensor.lr4_waste_drawer', now).state).toBe('0');
        await demoLitterAction({ card_id: 'litter', action: 'set_clean_delay', value: '15' }, now);
        expect(demoLitterState('select.lr4_wait', now).state).toBe('15');
        await expect(demoLitterAction({ card_id: 'litter', action: 'set_clean_delay', value: '99' }, now)).rejects.toMatchObject({ status: 400 });
    });

    it('spreads visits over the day', () => {
        const day = dayStart(Date.now());
        const visits = demoVisits(0, day, day + 24 * 60 * 60 * 1000);
        expect(visits.length).toBeGreaterThanOrEqual(4);
        expect(visits.every(t => t >= day && t < day + 24 * 60 * 60 * 1000)).toBe(true);
    });
});
