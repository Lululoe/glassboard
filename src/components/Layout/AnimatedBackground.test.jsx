import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnimatedBackground from './AnimatedBackground';

describe('AnimatedBackground', () => {
    it('draws nothing for a still background', () => {
        const { container } = render(<AnimatedBackground background={{ color: '#0061d4' }} />);
        expect(container.firstChild).toBeNull();
        expect(render(<AnimatedBackground background={{ motion: 'fireworks' }} />).container.firstChild).toBeNull();
    });

    it('takes the moving fields colors from the background color', () => {
        const { container } = render(<AnimatedBackground background={{ color: '#c2372f', motion: 'aurora' }} />);
        const layer = container.querySelector('.page-motion');
        expect(layer).toHaveClass('motion-aurora');
        expect(layer).toHaveAttribute('aria-hidden', 'true');
        expect(layer.style.getPropertyValue('--motion-a')).toBe('#c2372f');
        expect(layer.querySelectorAll('i')).toHaveLength(3);
    });

    it('floats six shapes for blobs and draws matrix rain on a canvas', () => {
        expect(render(<AnimatedBackground background={{ motion: 'blobs' }} />).container.querySelectorAll('.motion-blobs i')).toHaveLength(6);
        expect(render(<AnimatedBackground background={{ theme: true, motion: 'matrix' }} />).container.querySelector('canvas')).not.toBeNull();
    });

    describe('weather', () => {
        afterEach(() => vi.unstubAllGlobals());

        it('follows the current weather of the dashboard', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ condition: 'Overcast', isDay: true, cloudCover: 100 }) })));
            const { container } = render(<AnimatedBackground background={{ motion: 'weather' }} />);
            await waitFor(() => expect(container.querySelector('.weather-scene')).toHaveClass('effect-cover'));
            expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ type: 'current', service: 'weather' });
            expect(container.querySelectorAll('.weather-cloud').length).toBeGreaterThan(2);
        });

        it('shows a fixed effect without asking for the weather', () => {
            vi.stubGlobal('fetch', vi.fn());
            const { container } = render(<AnimatedBackground background={{ motion: 'weather', weather: 'rain' }} />);
            expect(container.querySelector('.weather-scene')).toHaveClass('effect-rain');
            expect(container.querySelector('canvas')).not.toBeNull();
            expect(fetch).not.toHaveBeenCalled();
        });

        it('shows the sun, and nothing while there is no weather', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: 'No weather card' }) })));
            expect(render(<AnimatedBackground background={{ motion: 'weather', weather: 'sun' }} />).container.querySelector('.weather-sun-glow')).not.toBeNull();
            const { container } = render(<AnimatedBackground background={{ motion: 'weather' }} />);
            await waitFor(() => expect(fetch).toHaveBeenCalled());
            expect(container.querySelector('.weather-scene')).toBeNull();
        });
    });
});
