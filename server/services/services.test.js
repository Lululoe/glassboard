// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { getMediaServices, handleMediaRequest } from './media.js';
import { handleProxmoxRequest } from './proxmox.js';
import { handleServerStatsRequest } from './serverstats.js';
import { handleTransmissionRequest, mapTorrents, toRpcUrl } from './transmission.js';

vi.mock('undici', () => ({
    Agent: vi.fn(),
    fetch: vi.fn(),
}));

const jsonResponse = (body, init = {}) => ({
    ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => '', ...init,
});

describe('media service', () => {
    beforeEach(() => setConfig({}));

    it('validates the date range', async () => {
        await expect(handleMediaRequest({ start: 'yesterday', end: '2026-01-02' })).rejects.toMatchObject({ status: 400 });
    });

    it('prefers services listed on the media card', () => {
        setConfig({
            services: { sonarr: { url: 'http://global', apiKey: 'g' } },
            pages: [{ cards: [{ id: 'm', type: 'media', services: [{ type: 'Radarr', url: 'http://r', apikey: 'k' }] }] }],
        });
        expect(getMediaServices()).toEqual([{ type: 'radarr', url: 'http://r', apiKey: 'k' }]);
    });

    it('falls back to the services section', () => {
        setConfig({ services: { sonarr: { url: 'http://s', apikey: 'k' } } });
        expect(getMediaServices()).toEqual([{ type: 'sonarr', url: 'http://s', apiKey: 'k' }]);
    });
});

describe('transmission service', () => {
    it('appends the RPC path to bare hosts', () => {
        expect(toRpcUrl('http://nas:9091')).toBe('http://nas:9091/transmission/rpc');
        expect(toRpcUrl('http://nas:9091/transmission/rpc')).toBe('http://nas:9091/transmission/rpc');
    });

    it('maps torrents and totals', () => {
        const result = mapTorrents([{ id: 1, name: 'a', percentDone: 0.5, rateDownload: 2000, rateUpload: 10 }]);
        expect(result.torrents[0]).toMatchObject({ progress: 50, speedDown: '2.00 KB/s' });
        expect(result).toMatchObject({ totalRateDown: 2000, totalRateUp: 10, totalCount: 1 });
    });

    it('performs the session handshake and sends basic auth', async () => {
        setConfig({ services: { transmission: { url: 'http://nas:9091', username: 'u', password: 'p' } } });
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 409, headers: { get: () => 'session-1' } })
            .mockResolvedValueOnce(jsonResponse({ arguments: { torrents: [] } })));

        await handleTransmissionRequest();

        const headers = fetch.mock.calls[1][1].headers;
        expect(headers['X-Transmission-Session-Id']).toBe('session-1');
        expect(headers.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
    });
});

describe('proxmox service', () => {
    const resources = {
        data: [
            { type: 'qemu', vmid: 100, name: 'vm', status: 'running', cpu: 0.25, mem: 1, maxmem: 4, disk: 1, maxdisk: 2 },
            { type: 'lxc', vmid: 101, name: 'ct', status: 'stopped', cpu: 0 },
            { type: 'node', node: 'pve' },
        ],
    };

    it('returns 503 when not configured', async () => {
        setConfig({});
        await expect(handleProxmoxRequest()).rejects.toMatchObject({ status: 503 });
    });

    it('accepts tokenSecret and skips TLS verification by default', async () => {
        const undici = await import('undici');
        undici.fetch.mockResolvedValueOnce(jsonResponse(resources));
        setConfig({ services: { proxmox: { url: 'https://pve:8006/', tokenId: 'root@pam!dash', tokenSecret: 's' } } });

        const result = await handleProxmoxRequest();

        expect(undici.fetch).toHaveBeenCalledWith('https://pve:8006/api2/json/cluster/resources', expect.objectContaining({
            headers: { Authorization: 'PVEAPIToken=root@pam!dash=s' },
        }));
        expect(result.nodes).toEqual([
            { id: 100, name: 'vm', type: 'vm', status: 'running', cpu: 25, ram: 25, disk: 50 },
            { id: 101, name: 'ct', type: 'lxc', status: 'stopped', cpu: 0, ram: 0, disk: 0 },
        ]);
        expect(result.summary).toEqual({ running: 1, total: 2, cpuAvg: 25 });
    });

    it('uses the verifying global fetch when verifyTls is enabled', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: [] })));
        setConfig({ services: { proxmox: { url: 'https://pve', tokenId: 'id', secret: 's', verifyTls: 'true' } } });

        await handleProxmoxRequest();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe('serverstats service', () => {
    it('converts Glances data to numbers', async () => {
        setConfig({});
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
            system: { hostname: 'box' },
            cpu: { total: 12 },
            mem: { used: 2 * 1024 ** 3, total: 8 * 1024 ** 3 },
            fs: [{ mnt_point: '/', used: 1024 ** 3, free: 3 * 1024 ** 3, size: 4 * 1024 ** 3 }],
            network: [{ rx: 5, tx: 7 }, { rx: 1, tx: 1 }],
            sensors: [{ label: 'acpitz', value: 30 }, { label: 'Package id 0', value: 55 }],
        })));

        expect(await handleServerStatsRequest()).toEqual({
            info: { hostname: 'box', ip: 'Unknown' },
            cpu: 12,
            ram: { used: 2, total: 8 },
            storage: { used: 1, free: 3, total: 4 },
            network: { in: 6, out: 8 },
            temp: 55,
        });
    });
});
