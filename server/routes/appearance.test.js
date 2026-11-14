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

const put = (server, body) => request(server).put('/api/config/appearance').send(body);
const putLayout = (server, body) => request(server).put('/api/config/layout').send(body);

describe('appearance API', () => {
    let server;
    let dir;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glassboard-appearance-api-'));
        process.env.LAYOUT_FILE = path.join(dir, 'layout.yaml');
        setConfig({ appearance: { style: 'material' }, pages: [{ id: 'home', cards: [{ id: 'a', type: 'x' }] }] });
    });

    afterEach(() => {
        delete process.env.LAYOUT_FILE;
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('saves the style and accent where they differ from config.yaml', async () => {
        expect((await put(server, { style: 'liquid', accent: '#FF375F' })).status).toBe(200);
        expect(readLayout().appearance).toEqual({ style: 'liquid', accent: '#FF375F' });

        // Back to the style of config.yaml: nothing to store for it
        expect((await put(server, { style: 'material' })).status).toBe(200);
        expect(readLayout().appearance).toEqual({ accent: '#FF375F' });

        expect((await put(server, { accent: null })).status).toBe(200);
        expect(readLayout().appearance).toBeUndefined();
    });

    it('refuses unknown styles, colors that are not #rrggbb and other settings', async () => {
        expect((await put(server, { style: 'neon' })).status).toBe(400);
        expect((await put(server, { accent: 'red' })).status).toBe(400);
        expect((await put(server, { theme: 'ocean' })).status).toBe(400);
        expect(readLayout().appearance).toBeUndefined();
    });

    it('keeps the appearance when the layout is saved in edit mode', async () => {
        await put(server, { style: 'terminal' });
        expect((await putLayout(server, { pages: { home: [{ id: 'a', type: 'x' }] } })).status).toBe(200);
        expect(readLayout().appearance).toEqual({ style: 'terminal' });
    });

    it('is refused when editing is off', async () => {
        setConfig({ editable: false, pages: [{ id: 'home', cards: [] }] });
        expect((await put(server, { style: 'liquid' })).status).toBe(403);
    });
});
