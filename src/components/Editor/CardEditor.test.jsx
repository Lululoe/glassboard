import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import CardEditor from './CardEditor';
import AddCardDialog from './AddCardDialog';

beforeAll(() => {
    // jsdom has no modal dialogs; opening is enough for the content to be accessible
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

const weather = { id: 'w', type: 'weather', colSpan: 2, location: 'Berlin' };

describe('CardEditor', () => {
    it('edits settings with the card form and the layout section', () => {
        const onSave = vi.fn();
        render(<CardEditor card={weather} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Hamburg' } });
        fireEvent.click(screen.getByRole('radio', { name: '°F' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
        fireEvent.click(screen.getByRole('radio', { name: '1 wide' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show on phone' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith({ id: 'w', type: 'weather', colSpan: 1, location: 'Hamburg', units: 'imperial', hideOn: ['phone'] });
    });

    it('edits any property as YAML and keeps the id', () => {
        const onSave = vi.fn();
        render(<CardEditor card={{ id: 'm', type: 'media' }} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        expect(screen.getByText(/no settings form/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'YAML' }));
        const textarea = screen.getByLabelText('Card YAML');
        expect(textarea.value).toBe('type: media\n');

        fireEvent.change(textarea, { target: { value: 'id: other\ntype: media\nurl: http://sonarr\n' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ id: 'm', type: 'media', url: 'http://sonarr' });
    });

    it('shows YAML errors instead of saving', () => {
        const onSave = vi.fn();
        render(<CardEditor card={weather} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.click(screen.getByRole('tab', { name: 'YAML' }));
        fireEvent.change(screen.getByLabelText('Card YAML'), { target: { value: 'location: [unclosed' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
        expect(screen.getByRole('alert')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Card YAML'), { target: { value: 'location: Rome' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toHaveTextContent('`type` is required.');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('asks before removing', () => {
        const onRemove = vi.fn();
        render(<CardEditor card={weather} onSave={() => {}} onCancel={() => {}} onRemove={onRemove} />);

        fireEvent.click(screen.getByRole('button', { name: 'Remove card' }));
        expect(onRemove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(onRemove).toHaveBeenCalled();
    });

    it('fills in Home Assistant actions from the entity id', () => {
        const onSave = vi.fn();
        render(<CardEditor card={{ id: 'h', type: 'hacontrol', data: { entities: [] } }} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.change(screen.getByLabelText('Entity id'), { target: { value: 'cover.garage' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0].data.entities).toEqual([{
            entity_id: 'cover.garage',
            on_action: { service: 'cover.open_cover' },
            off_action: { service: 'cover.close_cover' },
        }]);
    });
});

describe('List fields', () => {
    const graph = {
        id: 'g',
        type: 'graph',
        entities: [{ entity_id: 'sensor.a', name: 'Living Room' }, { entity_id: 'sensor.b' }],
    };

    it('names each item and opens one at a time to edit it', () => {
        const onSave = vi.fn();
        render(<CardEditor card={graph} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        const living = screen.getByRole('button', { name: /Living Room/, expanded: false });
        expect(screen.getByRole('button', { name: /sensor\.b/, expanded: false })).toBeInTheDocument();
        fireEvent.click(living);
        expect(living).toHaveAttribute('aria-expanded', 'true');
        fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'teal' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0].entities[0]).toEqual({ entity_id: 'sensor.a', name: 'Living Room', color: 'teal' });
    });

    it('adds an item open for editing, and moves and removes items', () => {
        const onSave = vi.fn();
        render(<CardEditor card={graph} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add sensor' }));
        fireEvent.change(screen.getByLabelText('Entity'), { target: { value: 'sensor.c' } });
        fireEvent.click(screen.getByRole('button', { name: 'Move sensor.c up' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Living Room' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0].entities.map(e => e.entity_id)).toEqual(['sensor.c', 'sensor.b']);
    });
});

describe('HA control editor', () => {
    it('fills in generic actions for group entities', () => {
        const onSave = vi.fn();
        render(<CardEditor card={{ id: 'h', type: 'hacontrol', data: { entities: [] } }} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.change(screen.getByLabelText('Entity id'), { target: { value: 'group.living_room_lights' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0].data.entities[0]).toEqual({
            entity_id: 'group.living_room_lights',
            on_action: { service: 'homeassistant.turn_on' },
            off_action: { service: 'homeassistant.turn_off' },
        });
    });
});

describe('AddCardDialog', () => {
    it('lists card types and reports the pick', () => {
        const onPick = vi.fn();
        render(<AddCardDialog onPick={onPick} onCancel={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /Empty Space/ }));
        expect(onPick).toHaveBeenCalledWith('spacer');
    });
});

describe('ConfirmDialog', () => {
    it('focuses Cancel and only acts on the named action', async () => {
        const { default: ConfirmDialog } = await import('./ConfirmDialog');
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmDialog title="Reset Dashboard?" message="Removes changes." confirmLabel="Reset Dashboard" onConfirm={onConfirm} onCancel={onCancel} />);

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Reset Dashboard' }));
        expect(onConfirm).toHaveBeenCalledOnce();
    });
});
