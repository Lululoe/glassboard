// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { setConfig } from '../config.js';
import { readLayout } from '../layout.js';
import { createApp } from '../app.js';
import { asEditor, listenOnLoopback } from '../testServer.js';

// Saving reloads the config from disk; keep the test config in memory instead
vi.mock('../config.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        loadConfig: vi.fn(),
        setConfig: (config, base = config) => actual.setConfig({ editable: true, ...config }, { editable: true, ...base }),
    };
});

const put = (server, body) => asEditor(server).put('/api/config/kiosk').send(body);

describe('kiosk options API', () => {
    let server;
    let dir;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glassboard-kiosk-api-'));
        process.env.LAYOUT_FILE = path.join(dir, 'layout.yaml');
        setConfig({ kiosk: { clock: 'analog' }, pages: [{ id: 'home', cards: [{ id: 'a', type: 'x' }] }] });
    });

    afterEach(() => {
        delete process.env.LAYOUT_FILE;
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('saves the options and goes back to config.yaml', async () => {
        const options = {
            media_players: ['media_player.kitchen'],
            toggles: ['switch.mute'],
            clock: 'standby',
            presence_entity: 'binary_sensor.presence',
            face_entity: null,
        };
        expect((await put(server, options)).status).toBe(200);
        expect(readLayout().kiosk).toEqual({
            media_players: ['media_player.kitchen'], toggles: ['switch.mute'], clock: 'standby', presence_entity: 'binary_sensor.presence',
        });

        // The same as config.yaml: nothing to store
        expect((await put(server, { clock: 'analog' })).status).toBe(200);
        expect(readLayout().kiosk).toBeUndefined();

        await put(server, { clock: 'stacked' });
        expect((await asEditor(server).delete('/api/config/kiosk')).status).toBe(200);
        expect(readLayout().kiosk).toBeUndefined();
    });

    it('keeps the kiosk options when the layout is saved', async () => {
        await put(server, { clock: 'stacked' });
        expect((await asEditor(server).put('/api/config/layout').send({ pages: { home: [{ id: 'a', type: 'x' }] } })).status).toBe(200);
        expect(readLayout().kiosk).toEqual({ clock: 'stacked' });
    });

    it('refuses entities of the wrong kind and unknown options', async () => {
        expect((await put(server, { toggles: ['sensor.temp'] })).status).toBe(400);
        expect((await put(server, { presence_entity: 'light.kitchen' })).status).toBe(400);
        expect((await put(server, { clock: 'sundial' })).status).toBe(400);
        expect((await put(server, { token: 'x' })).status).toBe(400);
    });

    it('needs editing to be on', async () => {
        setConfig({ editable: false, pages: [] }, { editable: false, pages: [] });
        expect((await put(server, { clock: 'analog' })).status).toBe(403);
        expect((await asEditor(server).get('/api/config/entities')).status).toBe(403);
    });
});
