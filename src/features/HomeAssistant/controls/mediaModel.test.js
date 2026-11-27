import { describe, it, expect } from 'vitest';
import { inputsOf, isMediaPlayer, mediaIsOn, mediaTileText, sourceIcon, toMediaPlayer } from './mediaModel';

const TV = {
    state: 'on',
    attributes: { friendly_name: 'LG TV', source: 'PC', source_list: ['Apple TV', 'Nintendo Switch', 'PC'], supported_features: 24505 },
};

describe('media player model', () => {
    it('recognizes media players and their on states', () => {
        expect(isMediaPlayer('media_player.tv')).toBe(true);
        expect(isMediaPlayer('light.tv')).toBe(false);
        expect(mediaIsOn('playing')).toBe(true);
        expect(mediaIsOn('standby')).toBe(false);
        expect(mediaIsOn(undefined)).toBe(false);
    });

    it('guesses input icons from their names', () => {
        expect(sourceIcon('Apple TV')).toBe('mdi:apple');
        expect(sourceIcon('Nintendo Switch')).toBe('mdi:gamepad-variant');
        expect(sourceIcon('PC')).toBe('mdi:monitor');
        expect(sourceIcon('HDMI 3')).toBe('mdi:video-input-hdmi');
        expect(sourceIcon('Something')).toBe('mdi:video-input-component');
    });

    it('filters, renames and orders inputs as the card lists them', () => {
        expect(inputsOf(TV.attributes.source_list).map(i => i.name)).toEqual(['Apple TV', 'Nintendo Switch', 'PC']);
        const picked = inputsOf(TV.attributes.source_list, [{ source: 'PC', icon: 'mdi:desktop-tower' }, { source: 'Nintendo Switch', name: 'Switch' }, { source: 'Gone' }]);
        expect(picked).toEqual([
            { source: 'PC', name: 'PC', icon: 'mdi:desktop-tower' },
            { source: 'Nintendo Switch', name: 'Switch', icon: 'mdi:gamepad-variant' },
        ]);
    });

    it('shows the input on the tile', () => {
        expect(mediaTileText(TV)).toBe('PC');
        expect(mediaTileText(TV, [{ source: 'PC', name: 'Computer' }])).toBe('Computer');
        expect(mediaTileText({ state: 'off', attributes: {} })).toBe('Off');
        expect(mediaTileText({ state: 'unavailable' })).toBe('Unavailable');
        expect(mediaTileText({ state: 'playing', attributes: { app_name: 'Netflix' } })).toBe('Netflix');
    });

    it('reads features and pending values', () => {
        const tv = toMediaPlayer({ entity_id: 'media_player.tv' }, TV);
        expect(tv).toMatchObject({ name: 'LG TV', on: true, source: 'PC', volume: null });
        expect(tv.can).toEqual({ power: true, source: true, volumeSet: false, volumeStep: true, mute: true });
        expect(toMediaPlayer({ entity_id: 'media_player.tv' }, TV, { source: 'Apple TV', on: false })).toMatchObject({ source: 'Apple TV', on: false });
    });
});
