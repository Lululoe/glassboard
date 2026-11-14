import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
