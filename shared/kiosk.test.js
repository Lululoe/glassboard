// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KIOSK_DEFAULTS, kioskEntityIds, kioskFromUrl, kioskMediaIds, normalizeKiosk } from './kiosk.js';

describe('kiosk settings', () => {
    it('fills in defaults and leaves out malformed values', () => {
        expect(normalizeKiosk(undefined)).toEqual({ media_players: [], toggles: [], ...KIOSK_DEFAULTS });
        const kiosk = normalizeKiosk({
            media_players: ['media_player.kitchen', 'light.nope', 'media_player.kitchen', 42],
            toggles: ['switch.mute', 'sensor.temp', 'light.shelf'],
            clock: 'sundial',
            idle_timeout: 2,
            pause_timeout: 120,
            presence_entity: 'binary_sensor.presence',
            face_entity: 'sensor.wrong_domain',
            brightness_entity: 'number.brightness',
        });
        expect(kiosk.media_players).toEqual(['media_player.kitchen']);
        expect(kiosk.toggles).toEqual(['switch.mute', 'light.shelf']);
        expect(kiosk.clock).toBe('lockscreen');
        expect(kiosk.idle_timeout).toBe(KIOSK_DEFAULTS.idle_timeout);
        expect(kiosk.pause_timeout).toBe(120);
        expect(kiosk.presence_entity).toBe('binary_sensor.presence');
        expect(kiosk.face_entity).toBeUndefined();
    });

    it('lists the entities it reads and the media players it controls', () => {
        const raw = {
            media_players: ['media_player.kitchen'],
            volume_entity: 'media_player.tablet',
            toggles: ['switch.mute'],
            screen_entity: 'switch.screen',
            illuminance_entity: 'sensor.lux',
        };
        expect(kioskMediaIds(raw)).toEqual(['media_player.kitchen', 'media_player.tablet']);
        expect(kioskEntityIds(raw).sort()).toEqual([
            'media_player.kitchen', 'media_player.tablet', 'sensor.lux', 'switch.mute', 'switch.screen',
        ]);
    });

    it('is turned on by the kiosk URL parameter', () => {
        expect(kioskFromUrl('')).toBe(false);
        expect(kioskFromUrl('?hide=servers')).toBe(false);
        expect(kioskFromUrl('?kiosk')).toBe(true);
        expect(kioskFromUrl('?kiosk=1')).toBe(true);
        expect(kioskFromUrl('?hide=x&kiosk=true')).toBe(true);
        expect(kioskFromUrl('?kiosk=0')).toBe(false);
        expect(kioskFromUrl('?kiosk=off')).toBe(false);
    });
});
