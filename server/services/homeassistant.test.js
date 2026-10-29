// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { handleHaRequest } from './homeassistant.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

describe('Home Assistant service', () => {
    beforeEach(() => {
        setConfig({
            services: { homeassistant: { url: 'http://ha.local/', token: 'tkn' } },
            pages: [{
                cards: [
                    {
                        id: 'lights', type: 'hacontrol', data: {
                            entities: [{
                                entity_id: 'light.allowed',
                                on_action: { service: 'light.turn_on' },
                                off_action: { service: 'light.turn_off' },
                            }],
                        },
                    },
                    { id: 'sensors', type: 'hacontrol', data: { entities: [{ entity_id: 'sensor.temp' }] } },
                ],
            }],
        });
        vi.stubGlobal('fetch', vi.fn(async (url) => okResponse({ url })));
    });

    it('returns 503 when Home Assistant is not configured', async () => {
        setConfig({});
        await expect(handleHaRequest({ endpoint: 'states', entity_ids: [] })).rejects.toMatchObject({ status: 503 });
    });

    it('fetches several allowed entity states in one request', async () => {
        const result = await handleHaRequest({ endpoint: 'states', entity_ids: ['light.allowed', 'sensor.temp'] });
        expect(Object.keys(result)).toEqual(['light.allowed', 'sensor.temp']);
        expect(fetch).toHaveBeenCalledWith('http://ha.local/api/states/light.allowed', expect.anything());
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tkn');
    });

    it('rejects states for entities that are not in the config', async () => {
        await expect(handleHaRequest({ endpoint: 'states', entity_ids: ['lock.front_door'] }))
            .rejects.toMatchObject({ status: 403 });
        await expect(handleHaRequest({ endpoint: 'states/lock.front_door' })).rejects.toMatchObject({ status: 403 });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('calls configured actions and rejects others', async () => {
        await handleHaRequest({ endpoint: 'services', entity_id: 'light.allowed', action: 'light.turn_on' });
        expect(fetch).toHaveBeenCalledWith('http://ha.local/api/services/light/turn_on',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ entity_id: 'light.allowed' }) }));

        await expect(handleHaRequest({ endpoint: 'services', entity_id: 'light.allowed', action: 'lock.unlock' }))
            .rejects.toMatchObject({ status: 403 });
    });

    it('maps upstream failures to 502', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
        await expect(handleHaRequest({ endpoint: 'states/light.allowed' })).rejects.toMatchObject({ status: 502 });
    });
});
