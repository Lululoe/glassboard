// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { setConfig } from '../config.js';
import { readLayout } from '../layout.js';
import { createApp } from '../app.js';

// Saving reloads the config from disk; keep the test config in memory instead
vi.mock('../config.js', async (importOriginal) => ({ ...await importOriginal(), loadConfig: vi.fn() }));

const config = () => ({
    pages: [
        { id: 'home', cards: [{ id: 'a', type: 'x' }, { id: 't', type: 'transmission', url: 'http://t', password: 'pw' }] },
        { id: 'web', type: 'iframe', url: 'http://example.com' },
        { id: 'admin', cards: [{ id: 'c', type: 'x' }] },
    ],
});

const put = (app, body) => request(app).put('/api/config/layout').send(body);

describe('layout API', () => {
    let app;
    let dir;

    beforeAll(async () => {
        app = await createApp({ frontend: false });
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
        const res = await put(app, {
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
        await put(app, {
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
            expect((await put(app, body)).status).toBe(400);
        }
        expect(readLayout().pages).toEqual({});
    });

    it('refuses to save or reset when editing is disabled', async () => {
        setConfig({ ...config(), editable: false });
        expect((await put(app, { pages: { home: [], admin: [] } })).status).toBe(403);
        expect((await request(app).delete('/api/config/layout')).status).toBe(403);
    });

    it('resets the layout', async () => {
        await put(app, { pages: { home: [], admin: [{ id: 'c', type: 'x' }] } });
        const res = await request(app).delete('/api/config/layout');

        expect(res.status).toBe(200);
        expect(readLayout()).toEqual({ pages: {}, removed: [] });
    });
});
