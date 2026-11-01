import { describe, it, expect } from 'vitest';
import { composeBackground, parseBackground, withBackgroundType } from './background';

describe('background', () => {
    it('reads solid colors and gradients', () => {
        expect(parseBackground('#0a84ff')).toMatchObject({ type: 'solid', stops: ['#0a84ff'], opacity: 100 });
        expect(parseBackground('#abc')).toMatchObject({ type: 'solid', stops: ['#aabbcc'] });
        expect(parseBackground('linear-gradient(45deg, #111111, #222222)')).toMatchObject({ type: 'linear', stops: ['#111111', '#222222'], angle: 45 });
        expect(parseBackground('radial-gradient(circle at 30% 30%, #111111, #222222)')).toMatchObject({ type: 'radial', stops: ['#111111', '#222222'] });
        expect(parseBackground('transparent').type).toBe('none');
    });

    it('reads the rgba gradients of existing configs and opacity', () => {
        const fields = parseBackground('linear-gradient(45deg,rgba(255, 123, 0, 1) 0%, rgba(255, 183, 0, 1) 100%)');
        expect(fields).toMatchObject({ type: 'linear', stops: ['#ff7b00', '#ffb700'], opacity: 100 });
        expect(parseBackground('#11223380')).toMatchObject({ stops: ['#112233'], opacity: 50 });
        expect(parseBackground('rgba(0, 0, 0, 0.25)')).toMatchObject({ type: 'solid', opacity: 25 });
    });

    it('keeps what it cannot represent as CSS', () => {
        expect(parseBackground('var(--color-primary)')).toMatchObject({ type: 'css', css: 'var(--color-primary)' });
        expect(parseBackground('url(a.png), #fff').type).toBe('css');
    });

    it('writes CSS and reads it back', () => {
        const linear = { type: 'linear', stops: ['#111111', '#222222'], angle: 90, opacity: 100, css: '' };
        expect(composeBackground(linear)).toBe('linear-gradient(90deg, #111111, #222222)');
        expect(composeBackground({ ...linear, opacity: 50 })).toBe('linear-gradient(90deg, #11111180, #22222280)');
        expect(composeBackground({ ...linear, type: 'radial' })).toBe('radial-gradient(circle at 30% 30%, #111111, #222222)');
        expect(composeBackground({ ...linear, type: 'solid' })).toBe('#111111');
        expect(composeBackground({ ...linear, type: 'none' })).toBe('transparent');
        expect(parseBackground(composeBackground({ ...linear, opacity: 50 }))).toMatchObject({ stops: ['#111111', '#222222'], angle: 90, opacity: 50 });
    });

    it('changes style keeping the colors that still apply', () => {
        const linear = { type: 'linear', stops: ['#111111', '#222222'], angle: 90, opacity: 100, css: '' };
        const solid = withBackgroundType(linear, 'solid');
        expect(solid.stops).toEqual(['#111111']);
        expect(withBackgroundType(solid, 'linear').stops).toEqual(['#111111', '#1c1c1e']);
        expect(withBackgroundType(linear, 'css').css).toBe('linear-gradient(90deg, #111111, #222222)');
        expect(withBackgroundType({ ...linear, type: 'none' }, 'css').css).toBe('');
    });
});
