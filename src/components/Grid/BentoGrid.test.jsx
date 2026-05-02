import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BentoGrid from './BentoGrid';
import React from 'react';

describe('BentoGrid Layout Framework', () => {
    it('returns null if config is absent or empty', () => {
        const { container } = render(<BentoGrid config={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('injects FallbackCard natively for unregistered grid items', () => {
        const fakeConfig = {
            cards: [{ id: '1', type: 'UnrecognizedBlahType' }]
        };
        render(<BentoGrid config={fakeConfig} />);
        
        // Our FallbackCard renders 'Unknown Card Type'
        expect(screen.getByText('Unknown Card Type')).toBeInTheDocument();
    });

    it('defaults to a col-span of 1 when card size config is natively absent', () => {
        const fakeConfig = {
            cards: [{ id: '1', type: 'UnrecognizedBlahType' }]
        };
        const { container } = render(<BentoGrid config={fakeConfig} />);
        const gridItem = container.querySelector('.grid-item');
        expect(gridItem).toHaveClass('col-span-1');
    });

    it('applies the mathematically appropriate explicit CSS properties based on card size configuration', () => {
        const fakeConfig = {
            cards: [{ id: '1', type: 'UnrecognizedBlahType', colSpan: 3, primaryColor: '#ff0000' }]
        };
        
        const { container } = render(<BentoGrid config={fakeConfig} />);
        const gridItem = container.querySelector('.grid-item');
        expect(gridItem).toBeInTheDocument();
        expect(gridItem).toHaveClass('col-span-3');
        expect(gridItem).toHaveStyle({ '--card-primary': '#ff0000' });
    });
});
