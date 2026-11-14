import { describe, expect, it } from 'vitest';
import { dominantColor, iconGlow } from './iconGlow';

describe('iconGlow', () => {
    it('glows in a plain background color', () => {
        expect(iconGlow('#ff9f0a')).toBe('#ff9f0a');
        expect(iconGlow('rgb(10, 108, 255)')).toBe('rgb(10, 108, 255)');
        expect(iconGlow('tomato')).toBe('tomato');
    });

    it('mixes the first and last colors of a gradient', () => {
        expect(iconGlow('linear-gradient(45deg, rgb(255, 123, 0) 0%, rgb(255, 183, 0) 100%)'))
            .toBe('color-mix(in srgb, rgb(255, 123, 0), rgb(255, 183, 0))');
        expect(iconGlow('linear-gradient(#4aa8ff, #22c55e, #0a6cff)')).toBe('color-mix(in srgb, #4aa8ff, #0a6cff)');
    });

    it('has no glow without a color to go by', () => {
        expect(iconGlow(undefined)).toBeNull();
        expect(iconGlow('')).toBeNull();
        expect(iconGlow('transparent')).toBeNull();
        expect(iconGlow('var(--icon-background)')).toBeNull();
        expect(iconGlow('url(icon.png)')).toBeNull();
    });
});

describe('dominantColor', () => {
    const pixels = (...colors) => new Uint8ClampedArray(colors.flat());

    it('finds the colored part of a logo, ignoring white, black and grey', () => {
        const orange = [255, 140, 0, 255];
        const logo = pixels(orange, orange, [255, 255, 255, 255], [0, 0, 0, 255], [128, 128, 128, 255]);
        expect(dominantColor(logo)).toBe('rgb(255, 140, 0)');
    });

    it('leaves out see-through pixels', () => {
        expect(dominantColor(pixels([0, 120, 255, 255], [255, 0, 0, 0]))).toBe('rgb(0, 120, 255)');
    });

    it('has no color for a grey or monochrome logo', () => {
        expect(dominantColor(pixels([255, 255, 255, 255], [20, 20, 20, 255], [128, 128, 128, 255]))).toBeNull();
    });
});
