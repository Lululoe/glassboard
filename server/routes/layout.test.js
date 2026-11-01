// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { setConfig } from '../config.js';
import { readLayout } from '../layout.js';
import { createApp } from '../app.js';
import { listenOnLoopback } from '../testServer.js';

// Saving reloads the config from disk; keep the test config in memory instead
vi.mock('../config.js', async (importOriginal) => ({ ...await importOriginal(), loadConfig: vi.fn() }));

const config = () => ({
    pages: [
        { id: 'home', cards: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://t', password: 'pw' }] },
        { id: 'web', type: 'iframe', url: 'http://example.com' },
        { id: 'admin', cards: [{ id: 'c', type: 'x' }] },
    ],
});

const put = (server, body) => request(server).put('/api/config/layout').send(body);

describe('layout API', () => {
    let server;
    let dir;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glassboard-layout-api-'));
        process.env.LAYOUT_FILE = path.join(dir, 'layout.yaml');
        setConfig(config());
    });

    afterEach(() => {
        delete process.env.LAYOUT_FILE;
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('saves moves between pages, new cards and removals', async () => {
        const res = await put(server, {
            pages: {
                home: [{ id: 't', type: 'transmission', url: 'http://t', colSpan: 2 }],
                admin: [{ id: 'a', type: 'x', tileSize: 'quarter' }, { id: 'n', type: 'spacer', hideOn: ['phone'] }],
            },
        });

        expect(res.status).toBe(200);
        expect(readLayout()).toEqual({
            pages: {
                home: [{ id: 't', colSpan: 2 }],
                admin: [{ id: 'a', tileSize: 'quarter' }, { id: 'n', colSpan: 1, hideOn: ['phone'], config: { type: 'spacer' } }],
            },
            removed: ['c'],
        });
    });

    it('keeps secrets the browser never received', async () => {
        await put(server, {
            pages: {
                home: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://new' }],
                admin: [{ id: 'c', type: 'x' }],
            },
        });

        const saved = readLayout().pages.home[1];
        expect(saved.config).toEqual({ type: 'transmission', url: 'http://new', password: 'pw' });
    });

    it('rejects missing or unknown pages, duplicate ids and invalid cards', async () => {
        const cases = [
            { pages: { home: [{ id: 'a', type: 'x' }] } },
            { pages: { home: [], admin: [], web: [] } },
            { pages: { home: [{ id: 'a', type: 'x' }], admin: [{ id: 'a', type: 'x' }] } },
            { pages: { home: [{ id: 'a' }], admin: [] } },
            { pages: { home: [{ id: 'a', type: 'x', colSpan: 7 }], admin: [] } },
        ];
        for (const body of cases) {
            expect((await put(server, body)).status).toBe(400);
        }
        expect(readLayout().pages).toEqual({});
    });

    it('refuses to save or reset when editing is disabled', async () => {
        setConfig({ ...config(), editable: false });
        expect((await put(server, { pages: { home: [], admin: [] } })).status).toBe(403);
        expect((await request(server).delete('/api/config/layout')).status).toBe(403);
    });

    it('resets the layout', async () => {
        await put(server, { pages: { home: [], admin: [{ id: 'c', type: 'x' }] } });
        const res = await request(server).delete('/api/config/layout');

        expect(res.status).toBe(200);
        expect(readLayout()).toEqual({ pages: {}, removed: [] });
    });
    it('saves the header menu and icon backgrounds, and keeps them when left out', async () => {
        const launcher = { apps: [{ name: 'Plex', url: 'http://plex', icon: { source: 'sh', value: 'plex-light', color: 'currentColor' } }], links: [] };
        const pages = () => ({ home: [{ id: 'a', type: 'x' }], admin: [{ id: 'c', type: 'x' }] });

        await put(server, { pages: pages(), launcher, iconBackgrounds: ['linear-gradient(90deg, #111111, #222222)'] }).expect(200);
        expect(readLayout().launcher).toEqual(launcher);
        expect(readLayout().iconBackgrounds).toEqual(['linear-gradient(90deg, #111111, #222222)']);

        await put(server, { pages: pages() }).expect(200);
        expect(readLayout().launcher).toEqual(launcher);
        expect(readLayout().iconBackgrounds).toEqual(['linear-gradient(90deg, #111111, #222222)']);
    });

    it('does not store a header menu equal to config.yaml', async () => {
        const launcher = { apps: [{ name: 'Plex', url: 'http://plex' }] };
        setConfig({ ...config(), launcher });
        await put(server, { pages: { home: [], admin: [] }, launcher }).expect(200);
        expect(readLayout().launcher).toBeUndefined();
    });

    it('rejects a header menu item without a name', async () => {
        await put(server, { pages: { home: [], admin: [] }, launcher: { apps: [{ url: 'http://x' }] } }).expect(400);
    });

    it('lists the Material icon names', async () => {
        const res = await request(server).get('/api/icons/mdi').expect(200);
        expect(res.body.names).toContain('lightbulb-off');
    });

    it('undoes a reset', async () => {
        await put(server, { pages: { home: [{ id: 'a', type: 'x', colSpan: 2 }], admin: [] } }).expect(200);
        const saved = readLayout();
        await request(server).delete('/api/config/layout').expect(200);
        expect(readLayout().pages).toEqual({});

        await request(server).post('/api/config/layout/restore').expect(200);
        expect(readLayout()).toEqual(saved);
        await request(server).post('/api/config/layout/restore').expect(404);
    });
});
