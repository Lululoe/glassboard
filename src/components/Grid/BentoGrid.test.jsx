import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BentoGrid from './BentoGrid';

vi.mock('../../features/registry', () => ({
    getCardComponent: (type) => ({
        ok: ({ config }) => <div>ok card {config.id}</div>,
        crash: () => { throw new Error('kaboom'); },
    })[type] || null,
}));

describe('BentoGrid', () => {
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
        expect(screen.getByText('ok card good')).toBeInTheDocument();
        console.error.mockRestore();
    });
});
