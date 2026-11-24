// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setConfig } from '../config.js';
import { getEntityState } from './homeassistant.js';
import { categoryName, handleStorageRequest, prometheusQueries, stateToGb, storageEntityIds } from './storage.js';

vi.mock('./homeassistant.js', () => ({ getEntityState: vi.fn() }));

const series = (value, metric = {}) => ({ metric, value: [1763900000, String(value)] });
const answer = (result) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: { resultType: 'vector', result } }), text: async () => '' });
const withCard = (card) => setConfig({ services: { prometheus: { url: 'http://prom:9090/' } }, cards: [{ id: 'disk', type: 'storage', ...card }] });

describe('storage service', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.mocked(getEntityState).mockReset();
    });

    it('builds the scanner queries for a pool or a filesystem, escaping labels', () => {
        expect(prometheusQueries({ pool: 'tank' })).toMatchObject({
            total: 'storage_zpool_size_bytes{pool="tank"}',
            used: 'storage_zpool_allocated_bytes{pool="tank"}',
            rest: 'Snapshots & other',
        });
        expect(prometheusQueries({ target: 'node"1' })).toMatchObject({
            total: 'storage_fs_size_bytes{target="node\\"1", mount="/"}',
            categories: 'sum by (category) (storage_content_bytes{target="node\\"1", mount="/"})',
            rest: 'Other',
        });
        expect(prometheusQueries({ pool: 'tank', queries: { total: 'my_total', label: 'kind' } })).toMatchObject({ total: 'my_total', label: 'kind' });
    });

    it('names categories', () => {
        expect(categoryName('zfs_proxmox')).toBe('VM disks & dumps');
        expect(categoryName('zfs_media', { zfs_media: 'Films' })).toBe('Films');
        expect(categoryName('big_files')).toBe('Big files');
    });

    it('reads a pool from Prometheus in GB, adding what the categories leave out', async () => {
        withCard({ source: 'prometheus', pool: 'tank' });
        fetch.mockImplementation(async (url) => {
            const query = decodeURIComponent(new URL(url).searchParams.get('query'));
            if (query.startsWith('storage_zpool_size_bytes')) return answer([series(4e12)]);
            if (query.startsWith('storage_zpool_allocated_bytes')) return answer([series(2.1e12)]);
            if (query.startsWith('sum by')) return answer([series(4e11, { category: 'zfs_photos' }), series(1.5e12, { category: 'zfs_media' }), series(4608, { category: 'zfs_paperless' })]);
            return answer([series(1763890000, { mode: 'content' })]);
        });
        const volume = await handleStorageRequest({ card_id: 'disk' });
        expect(fetch.mock.calls[0][0]).toMatch(/^http:\/\/prom:9090\/api\/v1\/query\?query=/);
        expect(volume.total).toBe(4000);
        expect(volume.categories.map(c => c.name)).toEqual(['Media', 'Photos', 'Snapshots & other']);
        expect(volume.categories[2].size).toBeCloseTo(200);
        expect(volume.updated).toBe(1763890000);
    });

    it('reports Prometheus failures and missing totals', async () => {
        withCard({ source: 'prometheus', target: 'docker-node-01' });
        fetch.mockResolvedValue({ ok: false, status: 503, text: async () => 'down' });
        await expect(handleStorageRequest({ card_id: 'disk' })).rejects.toMatchObject({ status: 502 });
        fetch.mockResolvedValue(answer([]));
        await expect(handleStorageRequest({ card_id: 'disk' })).rejects.toThrow(/no data/);
    });

    it('adds up Home Assistant entities per category, converting units', async () => {
        const states = {
            'sensor.size': { state: '2', attributes: { unit_of_measurement: 'TB' } },
            'sensor.movies': { state: '600', attributes: { unit_of_measurement: 'GB' } },
            'sensor.shows': { state: '400000', attributes: { unit_of_measurement: 'MB' } },
            'sensor.photos': { state: '100', attributes: { unit_of_measurement: 'GiB' } },
            'sensor.used': { state: '1300', attributes: { unit_of_measurement: 'GB' } },
            'sensor.gone': { state: 'unavailable', attributes: {} },
        };
        vi.mocked(getEntityState).mockImplementation(async id => states[id] ?? null);
        withCard({
            source: 'homeassistant', total: 'sensor.size', used: 'sensor.used',
            categories: [
                { name: 'Video', entities: 'sensor.movies, sensor.shows', color: 'blue' },
                { name: 'Photos', entities: ['sensor.photos'] },
                { name: 'Lost', entity: 'sensor.gone' },
            ],
        });
        const volume = await handleStorageRequest({ card_id: 'disk' });
        expect(volume.total).toBe(2000);
        expect(volume.categories.map(c => c.name)).toEqual(['Video', 'Photos', 'Other']);
        expect(volume.categories[0]).toMatchObject({ size: 1000, color: 'blue' });
        expect(volume.categories[1].size).toBeCloseTo(107.37, 1);
        expect(volume.categories[2].size).toBeCloseTo(192.63, 1);
    });

    it('takes a fixed total and lists the entities it reads', async () => {
        vi.mocked(getEntityState).mockResolvedValue({ state: '5', attributes: { unit_of_measurement: 'GB' } });
        withCard({ source: 'homeassistant', total: 50, categories: [{ name: 'A', entity: 'sensor.a' }] });
        expect(await handleStorageRequest({ card_id: 'disk' })).toEqual({ total: 50, categories: [{ name: 'A', size: 5 }] });
        expect(storageEntityIds({ source: 'homeassistant', total: 'sensor.t', categories: [{ entities: 'sensor.a, bad id' }] })).toEqual(['sensor.t', 'sensor.a']);
    });

    it('converts states to GB', () => {
        expect(stateToGb({ state: '1024', attributes: { unit_of_measurement: 'MiB' } })).toBeCloseTo(1.0737, 3);
        expect(stateToGb({ state: '3', attributes: {} })).toBe(3);
        expect(stateToGb({ state: 'unknown' })).toBeNull();
        expect(stateToGb({ state: '3', attributes: { unit_of_measurement: 'GB' } }, 'TB')).toBe(3000);
    });

    it('only answers for storage cards with a source', async () => {
        setConfig({ cards: [{ id: 'x', type: 'weather' }, { id: 'y', type: 'storage' }] });
        await expect(handleStorageRequest({ card_id: 'x' })).rejects.toMatchObject({ status: 403 });
        await expect(handleStorageRequest({ card_id: 'y' })).rejects.toMatchObject({ status: 400 });
    });
});
