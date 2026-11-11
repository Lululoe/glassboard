// @vitest-environment node
import fs from 'fs';
import http from 'http';
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

    describe('page background', () => {
        const pages = { home: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://t' }], admin: [{ id: 'c', type: 'x' }] };
        const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

        it('stores an uploaded picture and serves it', async () => {
            const upload = await request(server).post('/api/config/background').set('Content-Type', 'image/png').send(png);
            expect(upload.status).toBe(200);
            expect(upload.body.url).toMatch(/^\/api\/config\/background\/[a-f0-9]{32}\.png$/);

            const served = await request(server).get(upload.body.url);
            expect(served.status).toBe(200);
            expect(served.headers['content-type']).toBe('image/png');
        });

        it('refuses other files and names', async () => {
            expect((await request(server).post('/api/config/background').set('Content-Type', 'text/plain').send('hi')).status).toBe(400);
            expect((await request(server).get('/api/config/background/notes.txt')).status).toBe(404);
        });

        it('saves a color or a picture, and null goes back to config.yaml', async () => {
            expect((await put(server, { pages, background: { color: '#7a2bd4' } })).status).toBe(200);
            expect(readLayout().background).toEqual({ color: '#7a2bd4' });

            expect((await put(server, { pages })).status).toBe(200);
            expect(readLayout().background).toEqual({ color: '#7a2bd4' });

            expect((await put(server, { pages, background: null })).status).toBe(200);
            expect(readLayout().background).toBeUndefined();

            expect((await put(server, { pages, background: { color: 'red' } })).status).toBe(400);
            expect((await put(server, { pages, background: { image: 'javascript:alert(1)' } })).status).toBe(400);
        });

        it('downloads a picture from the web and serves it from here', async () => {
            const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
            const site = await listenOnLoopback(http.createServer((req, res) => {
                if (req.url === '/wall.webp') res.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(webp);
                else if (req.url === '/page') res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>');
                else res.writeHead(404).end();
            }));
            const base = `http://127.0.0.1:${site.address().port}`;
            try {
                const ok = await request(server).post('/api/config/background/download').send({ url: `${base}/wall.webp` });
                expect(ok.status).toBe(200);
                expect(ok.body.url).toMatch(/^\/api\/config\/background\/[a-f0-9]{32}\.webp$/);
                expect((await request(server).get(ok.body.url)).headers['content-type']).toBe('image/webp');

                expect((await request(server).post('/api/config/background/download').send({ url: `${base}/page` })).status).toBe(400);
                expect((await request(server).post('/api/config/background/download').send({ url: `${base}/missing.jpg` })).status).toBe(502);
                expect((await request(server).post('/api/config/background/download').send({ url: 'file:///etc/passwd' })).status).toBe(400);
            } finally {
                site.close();
            }
        });

        it("saves a page's own background, or the theme's on that page", async () => {
            const res = await put(server, { pages, pageBackgrounds: { home: { color: '#1f8a4c' }, admin: { theme: true } } });
            expect(res.status).toBe(200);
            expect(readLayout().pageBackgrounds).toEqual({ home: { color: '#1f8a4c' }, admin: { theme: true } });

            expect((await put(server, { pages, pageBackgrounds: { home: null, admin: null } })).status).toBe(200);
            expect(readLayout().pageBackgrounds).toBeUndefined();

            expect((await put(server, { pages, pageBackgrounds: { nope: { color: '#000000' } } })).status).toBe(400);
            expect((await put(server, { pages, pageBackgrounds: { home: { theme: false } } })).status).toBe(400);
        });

        it('stores null to clear a page background set in config.yaml', async () => {
            const withBackground = config();
            withBackground.pages[0].background = { color: '#c2372f' };
            setConfig(withBackground);
            expect((await put(server, { pages, pageBackgrounds: { home: null } })).status).toBe(200);
            expect(readLayout().pageBackgrounds).toEqual({ home: null });
            expect((await put(server, { pages, pageBackgrounds: { home: { color: '#c2372f' } } })).status).toBe(200);
            expect(readLayout().pageBackgrounds).toBeUndefined();
        });

        it('removes pictures no saved background uses', async () => {
            const first = (await request(server).post('/api/config/background').set('Content-Type', 'image/png').send(png)).body.url;
            const second = (await request(server).post('/api/config/background').set('Content-Type', 'image/png').send(Buffer.concat([png, Buffer.from([1])]))).body.url;

            await put(server, { pages, background: { image: second, dim: 0.3 } });
            expect((await request(server).get(first)).status).toBe(404);
            expect((await request(server).get(second)).status).toBe(200);
        });
    });

    describe('page header', () => {
        const pages = { home: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://t' }], admin: [{ id: 'c', type: 'x' }] };

        it('saves the header of all pages and of single pages', async () => {
            const res = await put(server, {
                pages,
                pageHeader: { align: 'center', title: { type: 'greeting', color: 'teal' } },
                pageHeaders: { home: { subtitle: false }, admin: false },
            });
            expect(res.status).toBe(200);
            expect(readLayout()).toMatchObject({
                pageHeader: { align: 'center', title: { type: 'greeting', color: 'teal' } },
                pageHeaders: { home: { subtitle: false }, admin: false },
            });

            expect((await put(server, { pages, pageHeader: null, pageHeaders: { home: null, admin: null } })).status).toBe(200);
            expect(readLayout().pageHeader).toBeUndefined();
            expect(readLayout().pageHeaders).toBeUndefined();
        });

        it('saves the style of all pages and of a page', async () => {
            const res = await put(server, {
                pages,
                pageHeader: { style: 'monochrome' },
                pageHeaders: { home: { align: 'left', layout: 'auto', style: 'monochrome' } },
            });
            expect(res.status).toBe(200);
            expect(readLayout().pageHeader).toEqual({ style: 'monochrome' });
            expect(readLayout().pageHeaders).toEqual({ home: { align: 'left', layout: 'auto', style: 'monochrome' } });
            expect((await put(server, { pages, pageHeader: { style: 'sepia' } })).status).toBe(400);
        });

        it('saves widgets and lets the browser read their entities', async () => {
            const widget = { id: 'w-1', type: 'gauge', entity_id: 'sensor.outside', min: -10, max: 35, condition: { operator: 'above', value: 0 } };
            expect((await put(server, { pages, pageHeader: { widgets: [widget] } })).status).toBe(200);
            expect(readLayout().pageHeader).toEqual({ widgets: [widget] });

            expect((await put(server, { pages, pageHeader: { widgets: [{ ...widget, entity_id: 'sensor.x; rm' }] } })).status).toBe(400);
            expect((await put(server, { pages, pageHeader: { widgets: [{ ...widget, type: 'rocket' }] } })).status).toBe(400);
        });

        it('saves when the header bar hides itself, unless it matches config.yaml', async () => {
            expect((await put(server, { pages, headerAutoHide: 'with-page-header' })).status).toBe(200);
            expect(readLayout().headerAutoHide).toBe('with-page-header');
            expect((await put(server, { pages, headerAutoHide: 'never' })).status).toBe(200);
            expect(readLayout().headerAutoHide).toBeUndefined();
            expect((await put(server, { pages, headerAutoHide: 'sometimes' })).status).toBe(400);
        });

        it('never stores a template sent by the browser', async () => {
            const res = await put(server, {
                pages,
                pageHeader: { title: { type: 'template', template: '{{ states.lock }}', refresh: 30 } },
                pageHeaders: { home: { subtitle: { type: 'template', template: '{{ x }}' } } },
            });
            expect(res.status).toBe(200);
            expect(readLayout().pageHeader).toEqual({ title: { type: 'template', refresh: 30 } });
            expect(readLayout().pageHeaders).toEqual({ home: { subtitle: { type: 'template' } } });
        });

        it("doesn't store what matches config.yaml, ignoring its templates", async () => {
            setConfig({ ...config(), pageHeader: { title: { type: 'template', template: '{{ 1 }}' } } });
            expect((await put(server, { pages, pageHeader: { title: { type: 'template', template: '{{ 1 }}' } } })).status).toBe(200);
            expect(readLayout().pageHeader).toBeUndefined();
        });

        it('rejects invalid headers and unknown pages', async () => {
            expect((await put(server, { pages, pageHeader: { align: 'middle' } })).status).toBe(400);
            expect((await put(server, { pages, pageHeader: { title: { type: 'clock', color: 'red; top: 0' } } })).status).toBe(400);
            expect((await put(server, { pages, pageHeaders: { nope: false } })).status).toBe(400);
        });
    });

    describe('added pages', () => {
        const pages = { home: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://t' }], admin: [{ id: 'c', type: 'x' }] };

        it('saves a page added in the browser with its cards', async () => {
            const res = await put(server, {
                pages: { ...pages, garden: [{ id: 'g', type: 'spacer', colSpan: 2 }] },
                addedPages: [{ id: 'garden', name: 'Garden' }],
            });
            expect(res.status).toBe(200);
            const layout = readLayout();
            expect(layout.addedPages).toEqual([{ id: 'garden', name: 'Garden' }]);
            expect(layout.pages.garden).toEqual([{ id: 'g', colSpan: 2, config: { type: 'spacer' } }]);

            // Left out, the added pages are kept
            expect((await put(server, { pages: { ...pages, garden: [] } })).status).toBe(200);
            expect(readLayout().addedPages).toEqual([{ id: 'garden', name: 'Garden' }]);
        });

        it('needs every added page and refuses ids that are taken or unknown', async () => {
            expect((await put(server, { pages, addedPages: [{ id: 'garden' }] })).status).toBe(400);
            expect((await put(server, { pages: { ...pages, web: [] }, addedPages: [{ id: 'web' }] })).status).toBe(400);
            expect((await put(server, { pages: { ...pages, x: [] } })).status).toBe(400);
            expect((await put(server, { pages: { ...pages, 'Bad Id': [] }, addedPages: [{ id: 'Bad Id' }] })).status).toBe(400);
        });

        it('removes a page that is no longer sent', async () => {
            await put(server, { pages: { ...pages, garden: [] }, addedPages: [{ id: 'garden' }] });
            expect((await put(server, { pages, addedPages: [] })).status).toBe(200);
            expect(readLayout().addedPages).toBeUndefined();
        });
    });
});
