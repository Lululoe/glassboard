import { describe, expect, it } from 'vitest';
import { ACCENT_PRESETS, APPEARANCE_STYLES, accentVariables, isAccent, normalizeAppearance } from './appearance.js';

describe('appearance', () => {
    it('defaults to Glass with the theme accent', () => {
        expect(normalizeAppearance(undefined)).toEqual({ style: 'glass', accent: null });
        expect(normalizeAppearance({ style: 'disco', accent: 'blue' })).toEqual({ style: 'glass', accent: null });
    });

    it('keeps known styles and #rrggbb accents', () => {
        expect(normalizeAppearance({ style: 'terminal', accent: '#33FF66' })).toEqual({ style: 'terminal', accent: '#33ff66' });
        APPEARANCE_STYLES.forEach(style => expect(normalizeAppearance({ style }).style).toBe(style));
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
