// @vitest-environment node
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { isAllowedHost } from './hostCheck.js';
import { listenOnLoopback } from './testServer.js';

vi.mock('./services/index.js', () => ({ serviceHandlers: {}, demoHandlers: {}, plugins: { plugins: [], failed: [], routers: [] } }));

describe('host names the dashboard answers to', () => {
    let server;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterEach(() => {
        delete process.env.ALLOWED_HOSTS;
    });

    afterAll(() => server.close());

    it.each([
        ['192.168.1.20', true],
        ['[::1]', true],
        ['fe80::1', true],
        ['localhost', true],
        ['glassboard', true],
        ['glassboard.local', true],
        ['dashboard.lan', true],
        ['dash.home.arpa', true],
        ['dash.internal', true],
        ['evil.example.com', false],
        ['192.168.1.20.evil.example', false],
        ['local.evil.example', false],
        ['', false],
    ])('%j: %s', (host, expected) => {
        expect(isAllowedHost(host, [])).toBe(expected);
    });

    it('also answers to the names in ALLOWED_HOSTS', () => {
        expect(isAllowedHost('dash.example.com', ['dash.example.com'])).toBe(true);
        expect(isAllowedHost('DASH.example.com.', ['dash.example.com'])).toBe(true);
        expect(isAllowedHost('other.example.com', ['dash.example.com'])).toBe(false);
        expect(isAllowedHost('a.b.example.com', ['*.example.com'])).toBe(true);
        expect(isAllowedHost('example.com', ['*.example.com'])).toBe(false);
        expect(isAllowedHost('anything.example', ['*'])).toBe(true);
    });

    it('refuses requests for other names, as a rebound website would send them', async () => {
        const rebound = await request(server).post('/api').set('Host', 'attacker.example:3001').send({ service: 'homeassistant' });
        expect(rebound.status).toBe(421);
        expect(rebound.text).toContain('ALLOWED_HOSTS');
        expect((await request(server).get('/api/config').set('Host', 'attacker.example')).status).toBe(421);

        expect((await request(server).get('/api/config').set('Host', '192.168.1.20:3001')).status).toBe(200);
        // Health checks always answer
        expect((await request(server).get('/health').set('Host', 'attacker.example')).status).toBe(200);

        process.env.ALLOWED_HOSTS = 'dash.example.com';
        expect((await request(server).get('/api/config').set('Host', 'dash.example.com')).status).toBe(200);
    });
});
