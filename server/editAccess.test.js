// @vitest-environment node
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { getBaseConfig, getConfig, setConfig } from './config.js';
import { EDIT_HEADER, MAX_FAILED_ATTEMPTS, MIN_PASSWORD_LENGTH, announceEditing, editKey, editPassword, resetEditAccess } from './editAccess.js';
import logger from './logger.js';
import { listenOnLoopback } from './testServer.js';

vi.mock('./services/index.js', () => ({ serviceHandlers: {}, demoHandlers: {}, plugins: { plugins: [], failed: [], routers: [] } }));

describe('edit password', () => {
    let server;
    const saved = { config: getConfig(), base: getBaseConfig() };
    const editable = (on) => setConfig({ ...saved.config, editable: on, pages: [] }, { ...saved.base, editable: on, pages: [] });

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterEach(() => {
        process.env.EDIT_PASSWORD = 'test-edit-password';
        resetEditAccess();
    });

    afterAll(() => {
        server.close();
        setConfig(saved.config, saved.base);
    });

    it('keeps editing off without a long enough EDIT_PASSWORD, and never logs it', async () => {
        editable(true);
        delete process.env.EDIT_PASSWORD;
        expect(editPassword()).toBeNull();
        expect(editKey()).toBeNull();
        expect((await request(server).get('/api/config')).body.editable).toBe(false);
        expect((await request(server).get('/api/config/edit')).body).toEqual({ editable: false, unlocked: false });
        const refused = await request(server).post('/api/config/edit/unlock').send({ password: 'anything at all' });
        expect(refused.status).toBe(403);
        expect(refused.body.error).toContain('EDIT_PASSWORD');

        process.env.EDIT_PASSWORD = 'short';
        expect((await request(server).get('/api/config')).body.editable).toBe(false);
        expect((await request(server).post('/api/config/edit/unlock').send({ password: 'short' })).body.error).toContain(`at least ${MIN_PASSWORD_LENGTH} characters`);

        process.env.EDIT_PASSWORD = 'correct horse';
        expect((await request(server).get('/api/config')).body.editable).toBe(true);
        const warn = vi.spyOn(logger, 'warn');
        const info = vi.spyOn(logger, 'info');
        announceEditing();
        delete process.env.EDIT_PASSWORD;
        announceEditing();
        const logged = [...warn.mock.calls, ...info.mock.calls].flat().join('\n');
        expect(logged).toContain('EDIT_PASSWORD');
        expect(logged).not.toContain('correct horse');
        warn.mockRestore();
        info.mockRestore();
    });

    it('refuses changes without the key, and unlocks with the password', async () => {
        editable(true);
        process.env.EDIT_PASSWORD = 'correct horse';
        // An invalid change, so nothing is written: the key is checked first
        const change = () => request(server).put('/api/config/kiosk').send({ clock: 'nope' });
        expect((await change()).body).toMatchObject({ code: 'edit_locked' });
        expect((await request(server).get('/api/config/edit')).body).toEqual({ editable: true, unlocked: false });

        const wrong = await request(server).post('/api/config/edit/unlock').send({ password: 'battery staple' });
        expect(wrong.status).toBe(401);
        expect(wrong.body.code).toBe('wrong_password');

        const right = await request(server).post('/api/config/edit/unlock').send({ password: ' correct horse ' });
        expect(right.status).toBe(200);
        expect(right.body.key).toBe(editKey());
        expect((await request(server).get('/api/config/edit').set(EDIT_HEADER, right.body.key)).body).toEqual({ editable: true, unlocked: true });
        expect((await change().set(EDIT_HEADER, right.body.key)).status).toBe(400);

        // A new password makes old keys stop working
        process.env.EDIT_PASSWORD = 'new password';
        expect((await change().set(EDIT_HEADER, right.body.key)).status).toBe(401);
    });

    it('makes an address wait after too many wrong passwords', async () => {
        editable(true);
        process.env.EDIT_PASSWORD = 'correct horse';
        for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
            expect((await request(server).post('/api/config/edit/unlock').send({ password: `guess ${i}` })).status).toBe(401);
        }
        const locked = await request(server).post('/api/config/edit/unlock').send({ password: 'correct horse' });
        expect(locked.status).toBe(429);
        expect(locked.body.error).toMatch(/Too many wrong passwords/);
    });

    it('can’t be unlocked while editing is off', async () => {
        editable(false);
        expect((await request(server).post('/api/config/edit/unlock').send({ password: 'test-edit-password' })).status).toBe(403);
        expect((await request(server).get('/api/config/edit')).body).toEqual({ editable: false, unlocked: false });
    });

    it('takes the password only as JSON', async () => {
        editable(true);
        expect((await request(server).post('/api/config/edit/unlock').type('form').send('password=test-edit-password')).status).toBe(415);
    });
});
