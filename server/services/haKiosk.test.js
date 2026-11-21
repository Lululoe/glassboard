// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setConfig } from '../config.js';
import { findPerson, kioskCall, listedEntities, personIdOf } from './haKiosk.js';
import {
    fetchArtwork, fetchKioskAvatar, getMediaEntityIds, getValidEntityIds, handleHaRequest, resetPeopleCache,
} from './homeassistant.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

describe('kiosk Home Assistant actions', () => {
    beforeEach(() => {
        setConfig({
            services: { homeassistant: { url: 'http://ha.local', token: 'tkn' } },
            pages: [{ cards: [] }],
            kiosk: {
                media_players: ['media_player.kitchen'],
                volume_entity: 'media_player.tablet',
                toggles: ['switch.mute', 'light.shelf'],
                brightness_entity: 'number.brightness',
                screen_entity: 'switch.screen',
                presence_entity: 'binary_sensor.presence',
                user_entity: 'sensor.face_person',
                logout_entity: 'button.face_logout',
            },
        });
    });

    it('lets the browser read the kiosk entities and control its media players', () => {
        const valid = getValidEntityIds();
        ['media_player.kitchen', 'media_player.tablet', 'switch.mute', 'number.brightness', 'binary_sensor.presence']
            .forEach(id => expect(valid.has(id)).toBe(true));
        expect(valid.has('switch.other')).toBe(false);
        expect([...getMediaEntityIds()]).toEqual(['media_player.kitchen', 'media_player.tablet']);
    });

    it('sets the brightness within the entity range', () => {
        expect(kioskCall({ action: 'brightness', value: 80 }, { attributes: { min: 5, max: 70 } }))
            .toEqual({ domain: 'number', service: 'set_value', body: { entity_id: 'number.brightness', value: 70 } });
        expect(kioskCall({ action: 'brightness', value: 33.4 }).body.value).toBe(33);
        expect(() => kioskCall({ action: 'brightness', value: 120 })).toThrow(/between 0 and 100/);
    });

    it('switches only the screen and the toggles of the kiosk', () => {
        expect(kioskCall({ action: 'screen', on: false }))
            .toEqual({ domain: 'homeassistant', service: 'turn_off', body: { entity_id: 'switch.screen' } });
        expect(kioskCall({ action: 'toggle', entity_id: 'light.shelf', on: true }))
            .toEqual({ domain: 'homeassistant', service: 'turn_on', body: { entity_id: 'light.shelf' } });
        expect(() => kioskCall({ action: 'toggle', entity_id: 'switch.other', on: true })).toThrow(/not authorized/);
        expect(() => kioskCall({ action: 'toggle', entity_id: 'switch.mute', on: 'yes' })).toThrow(/true or false/);
        expect(() => kioskCall({ action: 'reboot', on: true })).toThrow(/Unknown kiosk action/);
    });

    it('refuses actions on entities that are not set up', () => {
        setConfig({ pages: [{ cards: [] }], kiosk: {} });
        expect(() => kioskCall({ action: 'brightness', value: 10 })).toThrow(/No brightness entity/);
        expect(() => kioskCall({ action: 'screen', on: true })).toThrow(/No screen entity/);
        expect(() => kioskCall({ action: 'logout' })).toThrow(/No logout entity/);
    });

    it('logs out by pressing the logout entity, and lets the browser read only who is logged in', () => {
        expect(kioskCall({ action: 'logout' }))
            .toEqual({ domain: 'button', service: 'press', body: { entity_id: 'button.face_logout' } });
        setConfig({ pages: [{ cards: [] }], kiosk: { logout_entity: 'script.face_logout' } });
        expect(kioskCall({ action: 'logout' }).service).toBe('turn_on');
        setConfig({ pages: [{ cards: [] }], kiosk: { user_entity: 'sensor.face_person', logout_entity: 'button.face_logout' } });
        expect(getValidEntityIds().has('sensor.face_person')).toBe(true);
        expect(getValidEntityIds().has('button.face_logout')).toBe(false);
    });

    it('calls Home Assistant through the kiosk endpoint', async () => {
        const fetchMock = vi.fn(async (url) => (String(url).includes('/states/')
            ? okResponse({ state: '40', attributes: { min: 0, max: 100 } })
            : okResponse([])));
        vi.stubGlobal('fetch', fetchMock);
        await handleHaRequest({ endpoint: 'kiosk', action: 'brightness', value: 55 });
        const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/services/number/set_value'));
        expect(JSON.parse(call[1].body)).toEqual({ entity_id: 'number.brightness', value: 55 });
        vi.unstubAllGlobals();
    });

    it('serves the artwork of kiosk players', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okResponse({ attributes: {} })));
        await expect(fetchArtwork('media_player.kitchen')).resolves.toBeNull();
        await expect(fetchArtwork('media_player.elsewhere')).rejects.toThrow(/not authorized/);
        vi.unstubAllGlobals();
    });

    it('finds the person a name belongs to', () => {
        expect(personIdOf('Lukas')).toBe('person.lukas');
        expect(personIdOf('Anna-Maria Müller')).toBe('person.anna_maria_muller');
        const people = [
            { entity_id: 'person.lukas', attributes: { friendly_name: 'Luks' } },
            { entity_id: 'person.anna', attributes: { friendly_name: 'Anna Maria' } },
            { entity_id: 'sensor.anna', attributes: { friendly_name: 'Anna' } },
        ];
        expect(findPerson('anna maria', people)?.entity_id).toBe('person.anna');
        expect(findPerson('Luks', people)?.entity_id).toBe('person.lukas');
        expect(findPerson('Lukas', people)?.entity_id).toBe('person.lukas');
        expect(findPerson('Anna', people)?.entity_id).toBe('person.anna');
        expect(findPerson('Bert', people)).toBeNull();
    });

    it('serves the profile picture of the person logged in, and nobody else\'s', async () => {
        resetPeopleCache();
        let person = 'Lukas';
        const fetchMock = vi.fn(async (url) => {
            const path = String(url);
            if (path.endsWith('/api/states/sensor.face_person')) return okResponse({ state: person, attributes: {} });
            if (path.endsWith('/api/states/person.lukas')) return okResponse({ state: 'home', attributes: { entity_picture: '/api/image/serve/abc/512x512' } });
            if (path.endsWith('/api/states')) return okResponse([{ entity_id: 'person.anna', state: 'home', attributes: { friendly_name: 'Anna', entity_picture: 'https://example.org/anna.png' } }]);
            if (path.includes('/api/states/')) return { ok: false, status: 404, json: async () => ({}), text: async () => 'Entity not found' };
            return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: async () => new Uint8Array([1, 2]).buffer };
        });
        vi.stubGlobal('fetch', fetchMock);

        const avatar = await fetchKioskAvatar();
        expect(avatar).toEqual({ contentType: 'image/png', body: Buffer.from([1, 2]) });
        const picture = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/image/serve/'));
        expect(String(picture[0])).toBe('http://ha.local/api/image/serve/abc/512x512');
        expect(picture[1].headers).toEqual({ Authorization: 'Bearer tkn' });

        // Found by display name; a picture elsewhere is fetched without the token
        person = 'Anna';
        await fetchKioskAvatar();
        expect(fetchMock.mock.calls.at(-1)).toEqual(['https://example.org/anna.png', { headers: {} }]);

        person = 'none';
        await expect(fetchKioskAvatar()).resolves.toBeNull();
        person = 'Nobody Known';
        await expect(fetchKioskAvatar()).resolves.toBeNull();

        setConfig({ pages: [{ cards: [] }], kiosk: {} });
        await expect(fetchKioskAvatar()).rejects.toThrow(/No user entity/);
        vi.unstubAllGlobals();
    });

    it('lists entities by id and name only, for the options', () => {
        const list = listedEntities([
            { entity_id: 'switch.b', state: 'on', attributes: { friendly_name: 'B' } },
            { entity_id: 'sensor.lux', state: '3', attributes: { device_class: 'illuminance', unit_of_measurement: 'lx' } },
            { entity_id: 'camera.door', state: 'idle', attributes: {} },
            { entity_id: 'media_player.a', state: 'playing', attributes: { friendly_name: 'A', media_title: 'Song' } },
        ]);
        expect(list).toEqual([
            { entity_id: 'media_player.a', name: 'A' },
            { entity_id: 'sensor.lux', name: 'sensor.lux', device_class: 'illuminance', unit: 'lx' },
            { entity_id: 'switch.b', name: 'B' },
        ]);
    });
});
