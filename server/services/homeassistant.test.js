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
                    { id: 'living', type: 'thermostat', entity_id: 'climate.living' },
                    {
                        id: 'office', type: 'thermostat', entity_id: 'climate.office', hvac_mode: 'heat_cool', min: 15, max: 25,
                        presets: [{ name: 'Eco', preset: 'eco' }, { name: 'Comfort', temperature: 21 }],
                    },
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

    it('reads thermostat entities', async () => {
        await handleHaRequest({ endpoint: 'states', entity_ids: ['climate.living'] });
        expect(fetch).toHaveBeenCalledWith('http://ha.local/api/states/climate.living', expect.anything());
    });

    it('sends thermostat actions to the climate services', async () => {
        await handleHaRequest({ endpoint: 'climate', entity_id: 'climate.living', action: 'set_temperature', temperature: 21.5 });
        await handleHaRequest({ endpoint: 'climate', entity_id: 'climate.living', action: 'set_preset_mode', preset_mode: 'away' });
        await handleHaRequest({ endpoint: 'climate', entity_id: 'climate.living', action: 'set_hvac_mode', hvac_mode: 'heat' });

        const calls = fetch.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)]);
        expect(calls).toEqual([
            ['http://ha.local/api/services/climate/set_temperature', { entity_id: 'climate.living', temperature: 21.5 }],
            ['http://ha.local/api/services/climate/set_preset_mode', { entity_id: 'climate.living', preset_mode: 'away' }],
            ['http://ha.local/api/services/climate/set_hvac_mode', { entity_id: 'climate.living', hvac_mode: 'heat' }],
        ]);
    });

    it('limits thermostat actions to the card config', async () => {
        const call = (params) => handleHaRequest({ endpoint: 'climate', ...params });
        await expect(call({ entity_id: 'climate.other', action: 'set_temperature', temperature: 20 })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'light.allowed', action: 'set_temperature', temperature: 20 })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'climate.office', action: 'set_temperature', temperature: 30 })).rejects.toMatchObject({ status: 400 });
        await expect(call({ entity_id: 'climate.office', action: 'set_preset_mode', preset_mode: 'boost' })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'climate.office', action: 'set_hvac_mode', hvac_mode: 'heat' })).rejects.toMatchObject({ status: 400 });
        await expect(call({ entity_id: 'climate.office', action: 'turn_on' })).rejects.toMatchObject({ status: 400 });
        expect(fetch).not.toHaveBeenCalled();

        await call({ entity_id: 'climate.office', action: 'set_hvac_mode', hvac_mode: 'heat_cool' });
        await call({ entity_id: 'climate.office', action: 'set_preset_mode', preset_mode: 'eco' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
