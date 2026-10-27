import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, callService } from './api';

describe('callService', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: 1 }) })));
    });

    it('posts the service and params to /api', async () => {
        await callService('media', { start: '2026-01-01' });
        expect(fetch).toHaveBeenCalledWith('/api', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ start: '2026-01-01', service: 'media' }),
        }));
    });

    it('shares identical concurrent requests', async () => {
        await Promise.all([callService('proxmox'), callService('proxmox'), callService('git', { cardId: 'a' })]);
        expect(fetch).toHaveBeenCalledTimes(2);

        await callService('proxmox');
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('throws ApiError with the server message and status', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Entity not authorized' }) });
        const error = await callService('homeassistant').catch(e => e);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ message: 'Entity not authorized', status: 403 });
    });
});
