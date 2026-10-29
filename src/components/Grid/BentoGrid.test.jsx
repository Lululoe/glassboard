import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import BentoGrid from './BentoGrid';

vi.mock('../../features/registry', () => ({
    getCardComponent: (type) => ({
        ok: ({ config }) => <div>ok card {config.id} span {config.colSpan ?? 1}</div>,
        crash: () => { throw new Error('kaboom'); },
    })[type] || null,
    getCardSizes: (type) => (type === 'ok' ? ['quarter', 'half', '1', '2', '3'] : undefined),
}));

/**
 * Makes matchMedia report the given width, so useGridColumns picks the matching columns.
 * @param {number} width - Simulated window width in px.
 */
function setWidth(width) {
    vi.stubGlobal('matchMedia', (query) => ({
        matches: Number(query.match(/max-width: (\d+)px/)?.[1] ?? 0) >= width,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
}

describe('BentoGrid', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('renders nothing without cards', () => {
        const { container } = render(<BentoGrid cards={undefined} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a fallback for unknown and missing card types', () => {
        render(<BentoGrid cards={[{ id: '1', type: 'Unrecognized' }, { id: '2' }]} />);
        expect(screen.getByText('Unknown card type "Unrecognized"')).toBeInTheDocument();
        expect(screen.getByText('Card is missing a type')).toBeInTheDocument();
    });

    it('applies col-span and primary color', () => {
        const { container } = render(
            <BentoGrid cards={[{ id: '1', type: 'ok' }, { id: '2', type: 'ok', colSpan: 3, primaryColor: '#ff0000' }]} />
        );
        const items = container.querySelectorAll('.grid-item');
        expect(items[0]).toHaveClass('col-span-1');
        expect(items[1]).toHaveClass('col-span-3');
        expect(items[1]).toHaveStyle({ '--card-primary': '#ff0000' });
    });

    it('isolates a crashing card from the rest of the grid', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<BentoGrid cards={[{ id: 'bad', type: 'crash' }, { id: 'good', type: 'ok' }]} />);

        expect(screen.getByText('Card "bad" failed to render: kaboom')).toBeInTheDocument();
        expect(screen.getByText(/ok card good/)).toBeInTheDocument();
        console.error.mockRestore();
    });

    it('places half and quarter cards in shared slots', () => {
        const { container } = render(<BentoGrid cards={[
            { id: 'a', type: 'ok', tileSize: 'half' },
            { id: 'b', type: 'ok', tileSize: 'half' },
            { id: 'c', type: 'ok', tileSize: 'quarter' },
        ]} />);

        const slots = container.querySelectorAll('.grid-slot');
        expect(slots).toHaveLength(2);
        const [a, b] = slots[0].querySelectorAll('.grid-item');
        expect(a).toHaveClass('tile-half');
        expect(a.style.gridRow).toBe('1 / span 1');
        expect(b.style.gridRow).toBe('2 / span 1');
        expect(slots[1].querySelector('.grid-item')).toHaveClass('tile-quarter');
    });

    it('renders wide cards one wide on phones', () => {
        setWidth(400);
        const { container } = render(<BentoGrid cards={[{ id: 'w', type: 'ok', colSpan: 2 }]} />);

        expect(container.querySelector('.grid-item')).toHaveClass('col-span-1');
        expect(screen.getByText('ok card w span 1')).toBeInTheDocument();
    });

    it('shows wide cards at full width on large screens', () => {
        setWidth(1400);
        render(<BentoGrid cards={[{ id: 'w', type: 'ok', colSpan: 2 }]} />);
        expect(screen.getByText('ok card w span 2')).toBeInTheDocument();
    });

    it('hides cards on the screen sizes listed in hideOn, except while editing', () => {
        setWidth(400);
        const hidden = [{ id: 'a', type: 'ok', hideOn: ['phone'] }, { id: 'b', type: 'ok', hideOn: ['desktop'] }];
        const { rerender, container } = render(<BentoGrid cards={hidden} />);

        expect(screen.queryByText(/ok card a/)).toBeNull();
        expect(screen.getByText(/ok card b/)).toBeInTheDocument();

        rerender(<BentoGrid cards={hidden} editing />);
        expect(container.querySelector('[data-key="id:a"]')).toHaveClass('hidden-here');
        expect(screen.getByText('Hidden on phone')).toBeInTheDocument();
    });

    describe('edit mode', () => {
        const cards = [{ id: 'a', type: 'ok' }, { id: 'b', type: 'ok', colSpan: 2 }, { id: 'c', type: 'ok' }];

        it('makes cards inert and movable', () => {
            const { container } = render(<BentoGrid cards={cards} editing />);
            expect(container.querySelector('.bento-grid')).toHaveClass('editing');
            expect(container.querySelector('.grid-item-body')).toHaveAttribute('inert');
            expect(screen.getAllByRole('button', { name: /Arrow keys move/ })).toHaveLength(3);
        });

        it('moves a card with the arrow keys', () => {
            const onLayoutChange = vi.fn();
            render(<BentoGrid cards={cards} editing onLayoutChange={onLayoutChange} />);

            fireEvent.keyDown(screen.getByRole('button', { name: /^a, one wide/ }), { key: 'ArrowRight' });
            expect(onLayoutChange.mock.calls[0][0].map(c => c.id)).toEqual(['b', 'a', 'c']);
        });

        it('resizes a card with plus/minus and the corner handle', () => {
            const onLayoutChange = vi.fn();
            render(<BentoGrid cards={cards} editing onLayoutChange={onLayoutChange} />);

            fireEvent.keyDown(screen.getByRole('button', { name: /^a, one wide/ }), { key: '-' });
            expect(onLayoutChange.mock.calls[0][0][0]).toEqual({ id: 'a', type: 'ok', tileSize: 'half' });

            const handle = screen.getByRole('button', { name: 'Resize b, now two wide' });
            fireEvent.keyDown(handle, { key: 'Enter' });
            expect(onLayoutChange.mock.calls[1][0][1]).toEqual({ id: 'b', type: 'ok', colSpan: 3 });
        });

        it('leaves edit mode on Escape and on a background tap', () => {
            const onExitEdit = vi.fn();
            const { container } = render(<BentoGrid cards={cards} editing onExitEdit={onExitEdit} />);

            fireEvent.keyDown(screen.getByRole('button', { name: /^a, one wide/ }), { key: 'Escape' });
            fireEvent.click(container.querySelector('.bento-grid-container'));
            expect(onExitEdit).toHaveBeenCalledTimes(2);
        });

        it('enters edit mode on a long press, but not from a card control', () => {
            vi.useFakeTimers();
            const onRequestEdit = vi.fn();
            const { container } = render(<BentoGrid cards={cards} onRequestEdit={onRequestEdit} />);
            const item = container.querySelector('.grid-item');

            fireEvent.pointerDown(item, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
            act(() => vi.advanceTimersByTime(600));
            expect(onRequestEdit).toHaveBeenCalledTimes(1);

            const control = document.createElement('button');
            item.querySelector('.grid-item-body').append(control);
            fireEvent.pointerDown(control, { button: 0, pointerId: 2 });
            act(() => vi.advanceTimersByTime(600));
            expect(onRequestEdit).toHaveBeenCalledTimes(1);
        });

        it('opens the editor from the edit button', () => {
            const onEditCard = vi.fn();
            render(<BentoGrid cards={cards} editing onEditCard={onEditCard} />);

            fireEvent.click(screen.getByRole('button', { name: 'Edit b' }));
            expect(onEditCard).toHaveBeenCalledWith(1);
        });

        it('cancels the long press when the pointer moves', () => {
            vi.useFakeTimers();
            const onRequestEdit = vi.fn();
            const { container } = render(<BentoGrid cards={cards} onRequestEdit={onRequestEdit} />);

            fireEvent.pointerDown(container.querySelector('.grid-item'), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
            fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 60 });
            act(() => vi.advanceTimersByTime(600));
            expect(onRequestEdit).not.toHaveBeenCalled();
        });
    });
});
