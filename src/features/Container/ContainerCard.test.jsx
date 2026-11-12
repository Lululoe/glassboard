import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ContainerCard from './ContainerCard';
import { columnsOf, newChildId, scaleOf } from './containerModel';

const spacer = (id, extra = {}) => ({ id, type: 'spacer', ...extra });

describe('ContainerCard', () => {
    it('lays out its cards in as many columns and rows as it is large', () => {
        const { container } = render(
            <ContainerCard config={{ id: 'box', type: 'container', colSpan: 2, rowSpan: 2, title: 'Living room', cards: [spacer('a'), spacer('b')] }} />,
        );
        expect(screen.getByRole('heading', { name: 'Living room' })).toBeInTheDocument();
        const card = container.querySelector('.container-card');
        expect(card.style.getPropertyValue('--container-cols')).toBe('2');
        expect(card.style.getPropertyValue('--container-rows')).toBe('2');
        expect(card.style.getPropertyValue('--container-scale')).toBe('0.88');
        expect(container.querySelectorAll('.container-card-item .spacer-card')).toHaveLength(2);
    });

    it('narrows wide cards to the container and shares slots for small ones', () => {
        const { container } = render(
            <ContainerCard config={{ id: 'box', type: 'container', colSpan: 1, cards: [spacer('a', { colSpan: 3 }), spacer('b', { tileSize: 'quarter' }), spacer('c', { tileSize: 'quarter' })] }} />,
        );
        const items = container.querySelectorAll('.container-card-item');
        expect(items[0]).toHaveClass('col-span-1');
        expect(container.querySelectorAll('.container-card-slot .container-card-item')).toHaveLength(2);
    });

    it('shows a hint while empty, an error for unknown types and no panel when turned off', () => {
        const { container, rerender } = render(<ContainerCard config={{ id: 'box', type: 'container', background: false }} />);
        expect(screen.getByText(/No cards yet/)).toBeInTheDocument();
        expect(container.querySelector('.container-card')).toHaveClass('plain');
        rerender(<ContainerCard config={{ id: 'box', type: 'container', cards: [{ id: 'z', type: 'nope' }] }} />);
        expect(screen.getByText('Unknown card type "nope"')).toBeInTheDocument();
    });
});

describe('containerModel', () => {
    it('clamps the scale and reads the columns', () => {
        expect(scaleOf({})).toBe(0.88);
        expect(scaleOf({ scale: 0.2 })).toBe(0.6);
        expect(scaleOf({ scale: 2 })).toBe(1);
        expect(columnsOf({ colSpan: 3 })).toBe(3);
        expect(columnsOf({ tileSize: 'half' })).toBe(1);
    });

    it('creates ids that are not taken', () => {
        const id = newChildId('weather', new Set());
        expect(id).toMatch(/^weather-[a-z0-9]{1,4}$/);
    });
});
