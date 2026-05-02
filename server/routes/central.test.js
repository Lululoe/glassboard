import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi } from 'vitest';
import centralRouter from './central.js';

// Mock the downstream handlers so we test only the central router's multiplexing capabilities
vi.mock('./transmission.js', () => ({ handleTransmissionRequest: vi.fn(async () => ({ ok: true, source: 'transmission' })) }));
vi.mock('./homeassistant.js', () => ({ handleHaRequest: vi.fn(async () => ({ ok: true, source: 'ha' })) }));
vi.mock('./media.js', () => ({ handleMediaRequest: vi.fn(async () => ({ ok: true, source: 'media' })) }));

const app = express();
app.use(express.json());
// Mount the router identically to server.js
app.use('/api/central', centralRouter);
// Add basic error handler since central.js delegates errors using next(err)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

describe('Central Express Route Multiplexer', () => {

    it('denies requests lacking the service parameter', async () => {
        const res = await request(app).post('/api/central').send({ payload: 'test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Service parameter required');
    });

    it('correctly routes transmission requests internally', async () => {
        const res = await request(app).post('/api/central').send({ service: 'transmission', method: 'torrent-get' });
        expect(res.status).toBe(200);
        expect(res.body.source).toBe('transmission');
    });

    it('requires endpoint parameter for Home Assistant service proxy', async () => {
        const res = await request(app).post('/api/central').send({ service: 'homeassistant' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Home Assistant service requires endpoint parameter');
    });

    it('rejects unknown service identifiers securely', async () => {
        const res = await request(app).post('/api/central').send({ service: 'unknown_scary_service' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Unknown service: unknown_scary_service');
    });
});
