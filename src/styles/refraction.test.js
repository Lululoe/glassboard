import { describe, expect, it } from 'vitest';
import { displacementAt, refractionSupported } from './refraction.js';

describe('refraction', () => {
    it('is shown by Chromium browsers only', () => {
        expect(refractionSupported('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36')).toBe(true);
        expect(refractionSupported('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')).toBe(true);
        expect(refractionSupported('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15')).toBe(false);
        expect(refractionSupported('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1')).toBe(false);
        expect(refractionSupported('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe(false);
    });

    it('leaves the middle of a surface alone and bends its rim inward', () => {
        expect(displacementAt(100, 50, 200, 100, 20, 16)).toEqual({ dx: 0, dy: 0 });
        // Near the left edge the backdrop is taken from further right
        const left = displacementAt(1, 50, 200, 100, 20, 16);
        expect(left.dx).toBeGreaterThan(0.8);
        expect(left.dy).toBeCloseTo(0);
        // Near the bottom edge it is taken from further up
        expect(displacementAt(100, 99, 200, 100, 20, 16).dy).toBeLessThan(-0.8);
        // Weaker further in
        expect(displacementAt(10, 50, 200, 100, 20, 16).dx).toBeLessThan(left.dx);
    });
});
