// @vitest-environment node
import request from 'supertest';
import { afterAll, describe, it, expect, vi, beforeAll } from 'vitest';
import { createApp } from './app.js';
import { getBaseConfig, getConfig, setConfig } from './config.js';
import { asEditor, listenOnLoopback } from './testServer.js';

vi.mock('./services/index.js', async () => {
    const { HttpError } = await import('./errors.js');
    return {
        serviceHandlers: {
            transmission: vi.fn(async () => ({ source: 'transmission' })),
            forbidden: vi.fn(async () => { throw new HttpError(403, 'Entity not authorized'); }),
            broken: vi.fn(async () => { throw new Error('boom'); }),
        },
        demoHandlers: {},
        plugins: { plugins: [], failed: [], routers: [], find: () => undefined },
    };
});

describe('API app', () => {
    let server;

    beforeAll(async () => {
        server = await listenOnLoopback(await createApp({ frontend: false }));
    });

    afterAll(() => {
        server.close();
    });

    it('rejects requests without a service parameter', async () => {
        const res = await request(server).post('/api').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Service parameter required');
    });

    it('dispatches to the registered handler', async () => {
        const res = await request(server).post('/api').send({ service: 'transmission' });
        expect(res.status).toBe(200);
        expect(res.body.source).toBe('transmission');
    });

    it('returns 404 for unknown services, including prototype keys', async () => {
        for (const service of ['unknown_service', '__proto__', 'constructor', 'toString']) {
            const res = await request(server).post('/api').send({ service });
            expect(res.status).toBe(404);
        }
    });

    it('uses the status code carried by the error', async () => {
        const res = await request(server).post('/api').send({ service: 'forbidden' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Entity not authorized');
    });

    it('responds 500 for unexpected errors', async () => {
        const res = await request(server).post('/api').send({ service: 'broken' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('boom');
    });

    it('returns JSON 404 for unknown API paths instead of the SPA', async () => {
        const res = await request(server).get('/api/homeassistant/states/light.x');
        expect(res.status).toBe(404);
        expect(res.type).toMatch(/json/);
    });

    it('blocks config and env files', async () => {
        for (const path of ['/config.yaml', '/services.yaml', '/theme.yml', '/sub/services.yaml', '/.env']) {
            const res = await request(server).get(path);
            expect(res.status).toBe(403);
        }
    });

    it('does not send CORS headers', async () => {
        const res = await request(server).post('/api').set('Origin', 'https://evil.example').send({ service: 'transmission' });
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('ignores service calls another site could make: GET, URL parameters and form posts', async () => {
        const get = await request(server).get('/api?service=transmission');
        expect(get.status).toBe(404);

        const form = await request(server).post('/api?service=transmission').type('form').send('service=transmission');
        expect(form.status).toBe(415);

        const text = await request(server).post('/api?service=transmission').set('Content-Type', 'text/plain').send('{"service":"transmission"}');
        expect(text.status).toBe(415);

        // URL parameters are ignored even on a JSON post
        const query = await request(server).post('/api?service=transmission').send({});
        expect(query.status).toBe(400);
    });

    it('serves the sanitized config without caching', async () => {
        const res = await request(server).get('/api/config');
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('serves Material Design Icons as cacheable SVG', async () => {
        const res = await request(server).get('/api/icons/mdi/lightbulb-off.svg');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('image/svg+xml');
        expect(res.headers['cache-control']).toBe('public, max-age=604800');
        // supertest treats SVG as binary
        expect(String(res.body)).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 24 24"><path d="M[^"]+"\/><\/svg>$/);

        expect((await request(server).get('/api/icons/mdi/not-an-icon-at-all.svg')).status).toBe(404);
        expect((await request(server).get('/api/icons/mdi/Light_bulb.svg')).status).toBe(404);
    });

    describe('installing plugins', () => {
        const saved = { config: getConfig(), base: getBaseConfig() };
        const allow = (base) => setConfig({ ...saved.config, ...base }, { ...saved.base, ...base });

        afterAll(() => setConfig(saved.config, saved.base));

        it('is off unless editing and plugins.install are on', async () => {
            allow({ editable: true, plugins: {} });
            const list = await request(server).get('/api/plugins');
            expect(list.body.install).toMatchObject({ allowed: false, reason: expect.stringContaining('plugins.install: true') });

            for (const [route, body] of [['preview', { source: 'someone/hello' }], ['preview', { id: 'hello' }], ['install', { preview: 'x' }], ['remove', { id: 'hello' }]]) {
                const res = await asEditor(server).post(`/api/plugins/${route}`).send(body);
                expect(res.status).toBe(403);
            }
            allow({ editable: false, plugins: { install: true } });
            expect((await asEditor(server).post('/api/plugins/preview').send({ source: 'someone/hello' })).status).toBe(403);
        });

        it('needs the edit password', async () => {
            allow({ editable: true, plugins: { install: true } });
            const res = await request(server).post('/api/plugins/preview').send({ source: 'someone/hello' });
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('edit_locked');
            // The server's folder is only shown to those who can edit
            expect((await request(server).get('/api/plugins')).body.install.folder).toBeNull();
            expect((await asEditor(server).get('/api/plugins')).body.install.folder).toEqual(expect.any(String));
        });

        it('takes only JSON, so other sites can’t send it', async () => {
            allow({ editable: true, plugins: { install: true } });
            const res = await asEditor(server).post('/api/plugins/preview').type('form').send('source=someone/hello');
            expect(res.status).toBe(415);
        });

        it('passes the request on once it is on', async () => {
            allow({ editable: true, plugins: { install: true } });
            expect((await request(server).get('/api/plugins')).body.install).toMatchObject({ allowed: true, reason: null });
            const res = await asEditor(server).post('/api/plugins/preview').send({ source: 'not a repository' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Enter a GitHub repository');
        });
    });
});
