import { describe, it, expect } from 'vitest';
import { PRESETS, presetsFor, presetsFromFavorites, rgbToHs, toLight } from './lightModel';

const colorLight = { state: 'on', attributes: { supported_color_modes: ['hs', 'color_temp'] } };
const whiteLight = { state: 'on', attributes: { supported_color_modes: ['color_temp'] } };

describe('light model', () => {
    it('turns Home Assistant favorite colors into presets', () => {
        expect(presetsFromFavorites([
            { color_temp_kelvin: 2700 },
            { hs_color: [24.4, 85] },
            { rgb_color: [0, 0, 255] },
            { rgbww_color: [255, 0, 0, 10, 10] },
            { xy_color: [0.17, 0.7] },
            { hs_color: [100, 5] },
        ])).toEqual([
            { name: '2700 K', ct: 2700 },
            { name: 'Orange', h: 24, s: 85 },
            { name: 'Blue', h: 240, s: 100 },
            { name: 'Red', h: 0, s: 100 },
            { name: 'Green', h: expect.any(Number), s: expect.any(Number) },
            { name: 'White', h: 100, s: 5 },
        ]);
        expect(rgbToHs([255, 128, 0])).toEqual({ h: 30, s: 100 });
    });

    it('shows favorite colors instead of the default presets when a light has them', () => {
        expect(presetsFor(toLight('light.a', colorLight))).toBe(PRESETS);
        const favorites = [{ color_temp_kelvin: 3000 }, { hs_color: [180, 80] }];
        expect(presetsFor(toLight('light.a', colorLight, {}, undefined, favorites)).map(p => p.name)).toEqual(['3000 K', 'Cyan']);
        // White lights only show white favorites; an empty list shows none
        expect(presetsFor(toLight('light.w', whiteLight, {}, undefined, favorites)).map(p => p.name)).toEqual(['3000 K']);
        expect(presetsFor(toLight('light.a', colorLight, {}, undefined, []))).toEqual([]);
    });
});

describe('last known colors', () => {
    it('keeps showing the last brightness and color while a light is off', async () => {
        const { rememberColor } = await import('./lastColors');
        const id = 'light.remembered';
        const on = { state: 'on', attributes: { supported_color_modes: ['hs', 'color_temp'], color_mode: 'hs', hs_color: [210, 75], brightness: 51, color_temp_kelvin: 4000 } };
        const off = { state: 'off', attributes: { supported_color_modes: ['hs', 'color_temp'] } };
        expect(toLight(id, off)).toMatchObject({ h: 30, s: 50, bri: 100, mode: 'ct' });

        rememberColor(id, on);
        expect(toLight(id, off)).toMatchObject({ on: false, h: 210, s: 75, bri: 20, ct: 4000, mode: 'hs' });
        // Remembered across reloads
        expect(JSON.parse(localStorage.getItem('glassboard.lastLightColors'))[id]).toMatchObject({ h: 210, bri: 20 });
        // Off states don't overwrite it
        rememberColor(id, off);
        expect(toLight(id, off)).toMatchObject({ h: 210 });
    });
});
