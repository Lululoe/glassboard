// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { controlCalls, fetchArtwork, handleHaRequest, resetControlCache } from './homeassistant.js';

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
                    {
                        id: 'music', type: 'mediaplayer',
                        entities: ['media_player.living', { entity_id: 'media_player.kitchen', name: 'Kitchen' }],
                        speakers: ['media_player.bedroom'],
                    },
                    {
                        id: 'house', type: 'thermostats', max: 24, presets: [{ name: 'Eco', preset: 'eco' }],
                        rooms: [
                            { entity_id: 'climate.kitchen' },
                            { entity_id: 'climate.attic', hvac_mode: 'cool', presets: [{ name: 'Away', preset: 'away' }] },
                            ...Array.from({ length: 5 }, (_, i) => ({ entity_id: `climate.extra_${i}` })),
                        ],
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

    it('allows the rooms of multiroom cards, with room settings over the shared ones', async () => {
        const call = (params) => handleHaRequest({ endpoint: 'climate', ...params });
        await handleHaRequest({ endpoint: 'states', entity_ids: ['climate.kitchen', 'climate.extra_3'] });

        // Shared settings: max 24, only the eco preset
        await call({ entity_id: 'climate.kitchen', action: 'set_preset_mode', preset_mode: 'eco' });
        await expect(call({ entity_id: 'climate.kitchen', action: 'set_temperature', temperature: 26 })).rejects.toMatchObject({ status: 400 });
        // The attic overrides presets and the on mode
        await call({ entity_id: 'climate.attic', action: 'set_preset_mode', preset_mode: 'away' });
        await call({ entity_id: 'climate.attic', action: 'set_hvac_mode', hvac_mode: 'cool' });
        await expect(call({ entity_id: 'climate.attic', action: 'set_preset_mode', preset_mode: 'eco' })).rejects.toMatchObject({ status: 403 });
        // Rooms after the sixth are not shown, so they are not allowed either
        await expect(handleHaRequest({ endpoint: 'states', entity_ids: ['climate.extra_4'] })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'climate.extra_4', action: 'set_temperature', temperature: 20 })).rejects.toMatchObject({ status: 403 });
    });

    it('sends media player actions and limits them to media player cards', async () => {
        const call = (params) => handleHaRequest({ endpoint: 'media', ...params });
        await call({ entity_id: 'media_player.living', action: 'media_play_pause' });
        await call({ entity_id: 'media_player.kitchen', action: 'volume_set', volume_level: 0.4 });
        await call({ entity_id: 'media_player.living', action: 'media_seek', seek_position: 90 });
        await call({ entity_id: 'media_player.living', action: 'join', group_members: ['media_player.bedroom'] });
        await call({ entity_id: 'media_player.bedroom', action: 'unjoin' });

        const calls = fetch.mock.calls.map(([url, init]) => [url.replace('http://ha.local/api/services/media_player/', ''), JSON.parse(init.body)]);
        expect(calls).toEqual([
            ['media_play_pause', { entity_id: 'media_player.living' }],
            ['volume_set', { entity_id: 'media_player.kitchen', volume_level: 0.4 }],
            ['media_seek', { entity_id: 'media_player.living', seek_position: 90 }],
            ['join', { entity_id: 'media_player.living', group_members: ['media_player.bedroom'] }],
            ['unjoin', { entity_id: 'media_player.bedroom' }],
        ]);

        await expect(call({ entity_id: 'media_player.garage', action: 'media_play_pause' })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'media_player.living', action: 'join', group_members: ['media_player.garage'] })).rejects.toMatchObject({ status: 403 });
        await expect(call({ entity_id: 'media_player.living', action: 'volume_set', volume_level: 2 })).rejects.toMatchObject({ status: 400 });
        await expect(call({ entity_id: 'media_player.living', action: 'turn_off' })).rejects.toMatchObject({ status: 400 });
        await expect(call({ entity_id: 'light.allowed', action: 'media_play_pause' })).rejects.toMatchObject({ status: 403 });
    });

    it('reads media player states for the card', async () => {
        await handleHaRequest({ endpoint: 'states', entity_ids: ['media_player.living', 'media_player.bedroom'] });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('loads artwork through the server with the token, only for card players', async () => {
        fetch.mockImplementation(async (url) => (String(url).includes('/api/states/')
            ? okResponse({ attributes: { entity_picture: '/api/media_player_proxy/media_player.living?token=abc' } })
            : { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: async () => new Uint8Array([1, 2]).buffer }));

        const art = await fetchArtwork('media_player.living');
        expect(art).toEqual({ contentType: 'image/png', body: Buffer.from([1, 2]) });
        expect(fetch.mock.calls[1][0]).toBe('http://ha.local/api/media_player_proxy/media_player.living?token=abc');
        expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer tkn');

        await expect(fetchArtwork('media_player.garage')).rejects.toMatchObject({ status: 403 });
    });

    it('returns no artwork when the player has none, and rejects non-images', async () => {
        fetch.mockResolvedValueOnce(okResponse({ attributes: {} }));
        expect(await fetchArtwork('media_player.kitchen')).toBeNull();

        fetch.mockImplementation(async (url) => (String(url).includes('/api/states/')
            ? okResponse({ attributes: { entity_picture: 'https://cdn.example/cover' } })
            : { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => new ArrayBuffer(0) }));
        await expect(fetchArtwork('media_player.kitchen')).rejects.toMatchObject({ status: 502 });
        // External picture URLs are fetched without the Home Assistant token
        expect(fetch.mock.calls.at(-1)[1].headers).toEqual({});
    });
});

describe('Home Assistant control dialogs', () => {
    const states = {
        'group.living': { state: 'on', attributes: { entity_id: ['light.lamp', 'switch.fan'] } },
        'light.lamp': { state: 'on', attributes: { brightness: 255 } },
        'switch.fan': { state: 'off', attributes: {} },
    };

    beforeEach(() => {
        resetControlCache();
        setConfig({
            services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } },
            pages: [{ cards: [{ id: 'l', type: 'hacontrol', data: { entities: [{ entity_id: 'group.living' }, { entity_id: 'light.desk' }] } }] }],
        });
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const id = decodeURIComponent(String(url).split('/states/')[1] || '');
            return okResponse(states[id] || []);
        }));
    });

    it('loads an entity with the states of its group members', async () => {
        const details = await handleHaRequest({ endpoint: 'details', entity_id: 'group.living' });
        // Without the live connection, icons come from the entity or a fallback for its domain
        expect(details.entity).toEqual({ ...states['group.living'], icon: 'mdi:google-circles-communities' });
        expect(details.members).toEqual({
            'light.lamp': { ...states['light.lamp'], icon: 'mdi:lightbulb' },
            'switch.fan': { ...states['switch.fan'], icon: 'mdi:toggle-switch-variant-off' },
        });
        await expect(handleHaRequest({ endpoint: 'details', entity_id: 'light.lamp' })).rejects.toMatchObject({ status: 403 });
    });

    it('controls configured entities and members of configured groups', async () => {
        await handleHaRequest({ endpoint: 'control', entity_ids: ['light.lamp', 'switch.fan'], action: 'turn_off' });
        const posts = fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
        expect(posts.map(([url, init]) => [url, JSON.parse(init.body)])).toEqual([
            ['http://ha.local/api/services/light/turn_off', { entity_id: ['light.lamp'] }],
            ['http://ha.local/api/services/homeassistant/turn_off', { entity_id: ['switch.fan'] }],
        ]);
        await expect(handleHaRequest({ endpoint: 'control', entity_ids: ['light.kitchen'], action: 'turn_on' }))
            .rejects.toMatchObject({ status: 403 });
    });

    it('validates brightness and colors', () => {
        const allowed = new Set(['light.a']);
        expect(controlCalls({ entity_id: 'light.a', action: 'turn_on', brightness_pct: 40, hs_color: [24, 85] }, allowed))
            .toEqual([{ domain: 'light', service: 'turn_on', body: { entity_id: ['light.a'], brightness_pct: 40, hs_color: [24, 85] } }]);
        expect(controlCalls({ entity_ids: ['light.a'], action: 'turn_on', color_temp_kelvin: 2700.4 }, allowed)[0].body.color_temp_kelvin).toBe(2700);
        const bad = [
            { action: 'turn_on' },
            { action: 'toggle' },
            { action: 'turn_on', brightness_pct: 0 },
            { action: 'turn_on', brightness_pct: 50.5 },
            { action: 'turn_on', color_temp_kelvin: 500 },
            { action: 'turn_on', hs_color: [400, 10] },
            { action: 'turn_on', hs_color: [10, 10], color_temp_kelvin: 3000 },
        ];
        bad.forEach((params, i) => {
            const withId = i === 0 ? params : { entity_id: 'light.a', ...params };
            expect(() => controlCalls(withId, allowed)).toThrow(expect.objectContaining({ status: 400 }));
        });
    });
});
