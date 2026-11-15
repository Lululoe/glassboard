import { describe, expect, it } from 'vitest';
import {
    ACCENT_PRESETS, APPEARANCE_STYLES, accentVariables, fadeSurface, isAccent, normalizeAppearance, transparencyVariables,
} from './appearance.js';

describe('appearance', () => {
    it('defaults to Glass with the theme accent', () => {
        expect(normalizeAppearance(undefined)).toEqual({ style: 'glass', accent: null, transparency: 0.5 });
        expect(normalizeAppearance({ style: 'disco', accent: 'blue', transparency: 2 })).toEqual({ style: 'glass', accent: null, transparency: 0.5 });
    });

    it('keeps known styles and #rrggbb accents', () => {
        expect(normalizeAppearance({ style: 'terminal', accent: '#33FF66', transparency: 0.8 })).toEqual({ style: 'terminal', accent: '#33ff66', transparency: 0.8 });
        APPEARANCE_STYLES.forEach(style => expect(normalizeAppearance({ style }).style).toBe(style));
    });

    it('fades Glass and Liquid Glass surfaces toward solid below the middle and toward clear above it', () => {
        expect(transparencyVariables('glass', 0.5)).toEqual({ '--surface-solid': '0', '--surface-clear': '1' });
        expect(transparencyVariables('glass', 0)).toEqual({ '--surface-solid': '1', '--surface-clear': '1' });
        expect(transparencyVariables('liquid', 0.25)).toEqual({ '--surface-solid': '0.5', '--surface-clear': '1' });
        expect(transparencyVariables('liquid', 1)).toEqual({ '--surface-solid': '0', '--surface-clear': '0.25' });
        expect(transparencyVariables('material', 1)).toEqual({});
    });

    it("lets every rgba() opacity of a theme's surface follow the transparency", () => {
        expect(fadeSurface('rgba(0, 0, 0, 0.75)')).toBe('rgba(0, 0, 0, calc((0.75 + (1 - 0.75) * var(--surface-solid, 0)) * var(--surface-clear, 1)))');
        expect(fadeSurface('linear-gradient(rgba(1, 2, 3, 0.2), rgba(4, 5, 6, .6))').match(/var\(--surface-clear/g)).toHaveLength(2);
        expect(fadeSurface('#123456')).toBe('#123456');
    });

    it('offers only valid accent presets', () => {
        ACCENT_PRESETS.forEach(preset => expect(isAccent(preset.color)).toBe(true));
    });

    it('sets the primary color and its shades from the accent', () => {
        const vars = accentVariables('#ff375f');
        expect(vars['--color-primary']).toBe('#ff375f');
        expect(vars['--color-primary-light']).toContain('#ff375f');
        expect(vars['--focus-ring']).toContain('#ff375f');
        expect(accentVariables(null)).toEqual({});
    });
});

describe('ink on the accent', () => {
    it('keeps white where bold labels reach 3:1 and switches to dark on light accents', async () => {
        const { onAccent } = await import('./appearance.js');
        expect(onAccent('#0a84ff')).toBe('#fff');
        expect(onAccent('#5e5ce6')).toBe('#fff');
        expect(onAccent('#30d158')).toBe('#1c1c1e');
        expect(onAccent('#ff9f0a')).toBe('#1c1c1e');
        expect(onAccent('#40c8e0')).toBe('#1c1c1e');
    });
});
