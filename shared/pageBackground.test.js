import { describe, expect, it } from 'vitest';
import { backgroundCss, gradientFrom } from './pageBackground';

describe('backgroundCss', () => {
    it('makes a gradient from a color, lighter in light mode and darker in dark mode', () => {
        expect(backgroundCss({ color: '#5e3bd1' }, 'light')).toEqual({ image: gradientFrom('#5e3bd1', 'light'), dim: 0 });
        expect(gradientFrom('#5e3bd1', 'light')).toContain('#fff) 100%');
        expect(gradientFrom('#5e3bd1', 'dark')).toContain('45%, #000) 100%');
    });

    it('shows a picture, dimmed as far as 80%', () => {
        expect(backgroundCss({ image: '/api/config/background/a.jpg', dim: 0.3 }, 'dark'))
            .toEqual({ image: 'url("/api/config/background/a.jpg")', dim: 0.3 });
        expect(backgroundCss({ image: 'https://x.test/p.jpg', dim: 3 }, 'dark').dim).toBe(0.8);
    });

    it("falls back to the theme's gradient for missing or invalid settings", () => {
        expect(backgroundCss(undefined, 'dark')).toEqual({ image: null, dim: 0 });
        expect(backgroundCss({ color: 'red; x: y' }, 'dark')).toEqual({ image: null, dim: 0 });
        expect(backgroundCss({ image: 'javascript:alert(1)' }, 'dark')).toEqual({ image: null, dim: 0 });
    });
});
