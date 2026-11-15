import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import BentoGrid from './BentoGrid';

vi.mock('../../features/registry', () => ({
    getCardComponent: (type) => ({
        ok: ({ config }) => <div>ok card {config.id} span {config.colSpan ?? 1}</div>,
        header: () => <div className="two-tone-header"><span className="app-icon-container" /></div>,
        crash: () => { throw new Error('kaboom'); },
        container: ({ config }) => <section className="container-card">container {config.id}</section>,
    })[type] || null,
    getCardSizes: (type) => (type === 'ok' ? ['quarter', 'half', '1', '2', '3'] : undefined),
    getCardInfo: (type) => (type === 'header' ? { headerIcon: true } : undefined),
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

        describe('containers', () => {
            const box = {
                id: 'box', type: 'container', colSpan: 2, rowSpan: 2,
                cards: [{ id: 'in1', type: 'ok', tileSize: 'quarter' }, { id: 'in2', type: 'ok' }],
            };
            const page = [{ id: 'a', type: 'ok' }, box, { id: 'c', type: 'ok' }];
            const takenOut = [
                { id: 'a', type: 'ok' },
                { ...box, cards: [box.cards[0]] },
                { id: 'in2', type: 'ok' },
                { id: 'c', type: 'ok' },
            ];

            it('spans its rows and gives each card inside its own grab area', () => {
                const { container } = render(<BentoGrid cards={page} editing />);
                expect(container.querySelector('[data-key="id:box"]').style.gridRow).toBe('span 2');
                expect(container.querySelectorAll('[data-key="id:box"] .grid-child-surface')).toHaveLength(2);
                expect(screen.getByRole('button', { name: /^box, two wide/ })).toBeInTheDocument();
            });

            it('takes a card out onto the page with Enter', () => {
                const onLayoutChange = vi.fn();
                const { container } = render(<BentoGrid cards={page} editing onLayoutChange={onLayoutChange} />);
                const surface = container.querySelector('[data-key="id:box"] [data-child="1"]');
                expect(surface).toHaveAttribute('aria-label', expect.stringMatching(/^in2, in box/));
                fireEvent.keyDown(surface, { key: 'Enter' });
                expect(onLayoutChange).toHaveBeenCalledWith(takenOut);
            });

            it('drops a dragged page card into a container', () => {
                const onLayoutChange = vi.fn();
                const { container } = render(<BentoGrid cards={page} editing onLayoutChange={onLayoutChange} />);
                const surface = container.querySelector('[data-key="id:a"] .grid-edit-surface');

                // jsdom has no layout: every box is empty at 0,0, so the pointer there is over the container
                fireEvent.pointerDown(surface, { button: 0, pointerId: 3, clientX: 10, clientY: 10 });
                fireEvent.pointerMove(window, { pointerId: 3, clientX: 0, clientY: 0 });
                expect(container.querySelector('[data-key="id:box"]')).toHaveClass('drop-target');
                expect(container.querySelector('[data-key="id:a"]')).toHaveClass('over-container');
                fireEvent.pointerUp(window, { pointerId: 3, clientX: 0, clientY: 0 });

                expect(onLayoutChange).toHaveBeenLastCalledWith([
                    { ...box, cards: [...box.cards, { id: 'a', type: 'ok' }] },
                    { id: 'c', type: 'ok' },
                ]);
                expect(container.querySelector('.drop-target')).toBeNull();
            });

            it('does not drop a container into another container', () => {
                const onLayoutChange = vi.fn();
                const other = { id: 'box2', type: 'container', cards: [] };
                const { container } = render(<BentoGrid cards={[other, ...page]} editing onLayoutChange={onLayoutChange} />);
                fireEvent.pointerDown(container.querySelector('[data-key="id:box2"] .grid-edit-surface'), { button: 0, pointerId: 4, clientX: 10, clientY: 10 });
                fireEvent.pointerMove(window, { pointerId: 4, clientX: 0, clientY: 0 });
                expect(container.querySelector('.drop-target')).toBeNull();
                fireEvent.pointerUp(window, { pointerId: 4, clientX: 0, clientY: 0 });
                expect(onLayoutChange.mock.calls.every(([cards]) => cards.some(c => c.id === 'box2'))).toBe(true);
            });

            it('takes a card out once it is dragged, but not on a tap', () => {
                const onLayoutChange = vi.fn();
                const { container } = render(<BentoGrid cards={page} editing onLayoutChange={onLayoutChange} />);
                const surface = container.querySelector('[data-key="id:box"] [data-child="1"]');

                fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
                fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });
                expect(onLayoutChange).not.toHaveBeenCalled();

                fireEvent.pointerDown(surface, { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
                fireEvent.pointerMove(window, { pointerId: 2, clientX: 60, clientY: 40 });
                expect(onLayoutChange).toHaveBeenCalledWith(takenOut);
                fireEvent.pointerUp(window, { pointerId: 2, clientX: 60, clientY: 40 });
            });
        });

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

        it('opens the icon editor from the button on a header icon', () => {
            const onEditIcon = vi.fn();
            render(<BentoGrid cards={[{ id: 'a', type: 'ok' }, { id: 'b', type: 'header' }]} editing onEditIcon={onEditIcon} onEditCard={() => {}} />);
            expect(screen.getAllByRole('button', { name: /Change the icon/ })).toHaveLength(1);
            fireEvent.click(screen.getByRole('button', { name: 'Change the icon of b' }));
            expect(onEditIcon).toHaveBeenCalledWith(1);
        });

        it('draws the grid behind the cards with a free row', () => {
            setWidth(1200);
            const { container, rerender } = render(<BentoGrid cards={[{ id: 'a', type: 'ok', colSpan: 2 }]} editing />);
            expect(container.querySelectorAll('.grid-guide-tile')).toHaveLength(6);
            rerender(<BentoGrid cards={[{ id: 'a', type: 'ok', colSpan: 2 }]} />);
            expect(container.querySelector('.grid-guide')).toBeNull();
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
