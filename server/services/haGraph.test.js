// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { aggregate, bucketStatistics, graphData, graphSettings, hoursOf, makeBuckets, resetGraphCache, slotsFor } from './haGraph.js';
import { handleHaRequest } from './homeassistant.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

describe('graph data', () => {
    it('reads ranges and settings with defaults', () => {
        expect([hoursOf('24h'), hoursOf('7d'), hoursOf('2w'), hoursOf('0h'), hoursOf('5m'), hoursOf('9999d')]).toEqual([24, 168, 336, null, null, null]);
        expect(graphSettings({ entities: ['sensor.a', { entity_id: 'sensor.b', name: 'B' }, { entity_id: 'bad id' }] })).toEqual({
            chart: 'line', ranges: ['24h', '7d', '30d'], selector: true,
            entities: [{ entity_id: 'sensor.a' }, { entity_id: 'sensor.b', name: 'B' }],
        });
        expect(graphSettings({ chart: 'bar', ranges: ['6h', 'nope'] }).ranges).toEqual(['6h']);
        expect(graphSettings({ ranges: false, range: '3d' })).toMatchObject({ ranges: ['3d'], selector: false });
        expect(graphSettings({ ranges: false })).toMatchObject({ ranges: ['24h'], selector: false });
        expect(graphSettings({ entities: Array.from({ length: 12 }, (_, i) => `sensor.s${i}`) }).entities).toHaveLength(8);
    });

    it('divides ranges into periods of local time', () => {
        expect(slotsFor('line', 24)).toEqual({ count: 144, minutes: 10 });
        expect(slotsFor('line', 168)).toEqual({ count: 168, minutes: 60 });
        expect(slotsFor('line', 720)).toEqual({ count: 120, minutes: 360 });
        expect(slotsFor('bar', 24)).toEqual({ count: 24, minutes: 60 });
        expect(slotsFor('bar', 168)).toEqual({ count: 7, minutes: 1440 });
        expect(slotsFor('week', 0)).toEqual({ count: 14, minutes: 1440 });

        const now = new Date(2026, 10, 1, 15, 37).getTime();
        const hours = makeBuckets(3, 60, now);
        expect(hours.map(b => new Date(b.start).getHours())).toEqual([13, 14, 15]);
        expect(hours.at(-1).end).toBe(now);
        expect(hours[0].end).toBe(hours[1].start);
        const days = makeBuckets(2, 1440, now);
        expect(days.map(b => new Date(b.start).getDate())).toEqual([31, 1]);
        expect(new Date(days[1].start).getHours()).toBe(0);
    });

    it('averages states over time and adds up meters', () => {
        const buckets = [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }];
        // 10 until t=5, then 20: the first period averages 15
        const temps = [{ t: -5, v: 10 }, { t: 5, v: 20 }, { t: 12, v: null }, { t: 15, v: 30 }];
        const means = aggregate(temps, buckets, 'mean');
        expect(means[0]).toBe(15);
        // Unavailable from t=12 to 15 doesn't count
        expect(means[1]).toBeCloseTo((20 * 2 + 30 * 5) / 7);
        expect(means[2]).toBe(30);

        // A meter that resets to zero at t=16
        const meter = [{ t: -1, v: 100 }, { t: 4, v: 101.5 }, { t: 12, v: 103 }, { t: 16, v: 0.5 }, { t: 18, v: 1 }];
        expect(aggregate(meter, buckets, 'increase')).toEqual([1.5, 1.5 + 0.5 + 0.5, 0]);
        expect(aggregate(meter, buckets, 'delta')[1]).toBeCloseTo(-100.5);
        expect(aggregate([], buckets, 'mean')).toEqual([null, null, null]);
    });

    it('fits statistics into the periods', () => {
        const buckets = [{ start: 0, end: 100 }, { start: 100, end: 150 }];
        const rows = [{ start: 0, mean: 10, change: 1 }, { start: 50, mean: 20, change: 2 }, { start: 100, mean: 30, change: null }];
        expect(bucketStatistics(rows, buckets, 'mean')).toEqual([15, 30]);
        expect(bucketStatistics(rows, buckets, 'change')).toEqual([3, null]);
    });

    describe('endpoint', () => {
        beforeEach(() => {
            resetGraphCache();
            setConfig({
                services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } },
                pages: [{
                    cards: [
                        { id: 'temps', type: 'graph', ranges: ['24h', '7d'], entities: [{ entity_id: 'sensor.temp', name: 'Room', color: 'orange' }] },
                        { id: 'meter', type: 'graph', chart: 'week', entities: ['sensor.energy'] },
                        { id: 'lights', type: 'hacontrol', data: { entities: [] } },
                    ],
                }],
            });
        });

        it('builds series from the history when there are no statistics', async () => {
            const now = new Date(2026, 10, 1, 12, 7).getTime();
            vi.stubGlobal('fetch', vi.fn(async (url) => {
                const u = decodeURIComponent(String(url));
                if (u.includes('/states/sensor.temp')) return okResponse({ state: '21.5', attributes: { unit_of_measurement: '°C', friendly_name: 'Temp', state_class: 'measurement' } });
                if (u.includes('/history/period/')) {
                    return okResponse([[
                        { entity_id: 'sensor.temp', state: '20', last_changed: new Date(now - 30 * 3600000).toISOString() },
                        { state: '22', last_changed: new Date(now - 3600000).toISOString() },
                    ]]);
                }
                return okResponse([]);
            }));
            const data = await graphData({ card_id: 'temps', range: '24h' }, now);
            expect(data).toMatchObject({ chart: 'line', range: '24h', minutes: 10 });
            expect(data.times).toHaveLength(144);
            expect(data.series).toEqual([expect.objectContaining({
                entity_id: 'sensor.temp', name: 'Room', unit: '°C', color: 'orange', kind: 'mean', current: 21.5,
            })]);
            expect(data.series[0].values[0]).toBe(20);
            expect(data.series[0].values.at(-1)).toBe(22);
            const history = fetch.mock.calls.map(([url]) => decodeURIComponent(String(url))).find(u => u.includes('/history/'));
            expect(history).toContain('filter_entity_id=sensor.temp');
            expect(history).toContain('minimal_response');

            // Answered from the cache for a few seconds
            fetch.mockClear();
            await graphData({ card_id: 'temps', range: '24h' }, now + 1000);
            expect(fetch).not.toHaveBeenCalled();
        });

        it('only serves graph cards and the ranges they offer', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => okResponse([])));
            await expect(handleHaRequest({ endpoint: 'graph', card_id: 'lights' })).rejects.toMatchObject({ status: 403 });
            await expect(handleHaRequest({ endpoint: 'graph', card_id: 'temps', range: '30d' })).rejects.toMatchObject({ status: 400 });
            // The week comparison ignores ranges
            const week = await handleHaRequest({ endpoint: 'graph', card_id: 'meter', range: 'whatever' });
            expect(week.times).toHaveLength(14);
            // Graph sensors can be read like other card entities
            await expect(handleHaRequest({ endpoint: 'states', entity_ids: ['sensor.energy'] })).resolves.toBeDefined();
        });
    });
});
