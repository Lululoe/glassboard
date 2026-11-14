import { describe, expect, it } from 'vitest';
import { iconGlow } from './iconGlow';

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
