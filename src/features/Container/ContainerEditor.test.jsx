import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import ContainerEditor from './ContainerEditor';
import CardEditor from '../../components/Editor/CardEditor';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

const box = { id: 'box', type: 'container', colSpan: 2, cards: [{ id: 's1', type: 'spacer' }, { id: 's2', type: 'spacer', title: 'Gap' }] };

describe('ContainerEditor', () => {
    it('sets the title, panel and scale', () => {
        const onChange = vi.fn();
        render(<ContainerEditor config={box} onChange={onChange} />);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kitchen' } });
        expect(onChange).toHaveBeenLastCalledWith({ ...box, title: 'Kitchen' });
        fireEvent.click(screen.getByRole('switch', { name: 'Panel behind the cards' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...box, background: false });
        fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...box, scale: 0.64 });
    });

    it('reorders and removes cards', () => {
        const onChange = vi.fn();
        render(<ContainerEditor config={box} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Move Gap up' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...box, cards: [box.cards[1], box.cards[0]] });
        fireEvent.click(screen.getByRole('button', { name: 'Remove Gap' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...box, cards: [box.cards[0]] });
    });

    it('adds a card through its own editor, without containers on offer', () => {
        const onChange = vi.fn();
        render(<ContainerEditor config={box} onChange={onChange} globalConfig={{ pages: [{ cards: [box] }] }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
        const list = screen.getByRole('dialog', { name: 'Add Card' });
        expect(within(list).queryByText('Container')).not.toBeInTheDocument();
        fireEvent.click(within(list).getByText('Empty Space'));

        const editor = screen.getByRole('dialog', { name: /Add Empty Space/ });
        fireEvent.click(within(editor).getByRole('tab', { name: 'Layout' }));
        expect(within(editor).queryByRole('radio', { name: '3 wide' })).not.toBeInTheDocument();
        expect(within(editor).queryByRole('switch', { name: 'Show on phone' })).not.toBeInTheDocument();
        fireEvent.click(within(editor).getByRole('button', { name: 'Add' }));

        const added = onChange.mock.lastCall[0].cards;
        expect(added).toHaveLength(3);
        expect(added[2]).toMatchObject({ type: 'spacer', id: expect.stringMatching(/^spacer-/) });
    });
});

describe('CardEditor for containers', () => {
    it('offers a height in rows', () => {
        const onSave = vi.fn();
        render(<CardEditor card={box} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
        fireEvent.click(screen.getByRole('radio', { name: '2 rows' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ ...box, rowSpan: 2 });
    });
});
