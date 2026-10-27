// @vitest-environment node
import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createApp } from './app.js';

vi.mock('./services/index.js', async () => {
    const { HttpError } = await import('./errors.js');
    return {
        serviceHandlers: {
            transmission: vi.fn(async () => ({ source: 'transmission' })),
            forbidden: vi.fn(async () => { throw new HttpError(403, 'Entity not authorized'); }),
            broken: vi.fn(async () => { throw new Error('boom'); }),
        },
    };
});

describe('API app', () => {
    let app;

    beforeAll(async () => {
        app = await createApp({ frontend: false });
    });

    it('rejects requests without a service parameter', async () => {
        const res = await request(app).post('/api').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Service parameter required');
    });

    it('dispatches to the registered handler', async () => {
        const res = await request(app).post('/api').send({ service: 'transmission' });
        expect(res.status).toBe(200);
        expect(res.body.source).toBe('transmission');
    });

    it('returns 404 for unknown services, including prototype keys', async () => {
        for (const service of ['unknown_service', '__proto__', 'constructor', 'toString']) {
            const res = await request(app).post('/api').send({ service });
            expect(res.status).toBe(404);
        }
    });

    it('uses the status code carried by the error', async () => {
        const res = await request(app).post('/api').send({ service: 'forbidden' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Entity not authorized');
    });

    it('responds 500 for unexpected errors', async () => {
        const res = await request(app).post('/api').send({ service: 'broken' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('boom');
    });

    it('returns JSON 404 for unknown API paths instead of the SPA', async () => {
        const res = await request(app).get('/api/homeassistant/states/light.x');
        expect(res.status).toBe(404);
        expect(res.type).toMatch(/json/);
    });

    it('blocks config and env files', async () => {
        for (const path of ['/config.yaml', '/services.yaml', '/theme.yml', '/sub/services.yaml', '/.env']) {
            const res = await request(app).get(path);
            expect(res.status).toBe(403);
        }
    });

    it('does not send CORS headers', async () => {
        const res = await request(app).post('/api').set('Origin', 'https://evil.example').send({ service: 'transmission' });
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('serves the sanitized config without caching', async () => {
        const res = await request(app).get('/api/config');
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });
});
