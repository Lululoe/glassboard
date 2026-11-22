import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import CardEditor from '../CardEditor';
import CardIconEditor from '../CardIconEditor';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

const app = (name) => ({ name, url: `http://${name}`, icon: 'lu-Globe' });

const gridCard = (apps) => ({ id: 'g', type: 'appgrid', data: { apps } });

/** The apps in the order shown, by their accessible names. */
const shownApps = () => screen.getAllByRole('button', { name: /^(One|Two|Three|New app)$/ }).map(el => el.getAttribute('aria-label'));

/** Drags an item onto another with a mouse. */
const drag = (from, to) => {
    from.getBoundingClientRect = () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 });
    to.getBoundingClientRect = () => ({ left: 100, top: 0, right: 110, bottom: 10, width: 10, height: 10 });
    fireEvent.pointerDown(from, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, { clientX: 105, clientY: 5 });
    fireEvent.pointerUp(window);
};

describe('App grid stage', () => {
    it('edits the selected app and saves it', () => {
        const onSave = vi.fn();
        render(<CardEditor card={gridCard([app('One'), app('Two')])} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Two' }), { key: 'Enter' });
        const inspector = screen.getByRole('region', { name: 'Selected app' });
        fireEvent.change(within(inspector).getByLabelText('Name'), { target: { value: 'Three' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0].data.apps[1].name).toBe('Three');
    });

    it('reorders by keyboard and keeps the selection on the app', () => {
        const onSave = vi.fn();
        render(<CardEditor card={gridCard([app('One'), app('Two')])} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        const one = screen.getByRole('button', { name: 'One' });
        fireEvent.keyDown(one, { key: 'Enter' });
        fireEvent.keyDown(one, { key: 'ArrowRight', shiftKey: true });

        expect(shownApps()).toEqual(['Two', 'One']);
        expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(screen.getByRole('region', { name: 'Selected app' })).getByLabelText('Name')).toHaveValue('One');
    });

    it('reorders by dragging, then selects the app', () => {
        render(<CardEditor card={gridCard([app('One'), app('Two')])} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        drag(screen.getByRole('button', { name: 'One' }), screen.getByRole('button', { name: 'Two' }));
        expect(shownApps()).toEqual(['Two', 'One']);
        expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true');
        expect(document.querySelector('.arrange-ghost')).toBeNull();
    });

    it('removes an app with an undo', () => {
        render(<CardEditor card={gridCard([app('One'), app('Two')])} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove One' }));
        expect(shownApps()).toEqual(['Two']);
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(shownApps()).toEqual(['One', 'Two']);
    });

    it('adds an app and selects it', () => {
        render(<CardEditor card={gridCard([app('One')])} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add app' }));
        expect(screen.getByRole('button', { name: 'New app' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches between its own apps and the header menu, keeping its own', () => {
        const onSave = vi.fn();
        const globalConfig = { launcher: { apps: [app('Three')] } };
        render(<CardEditor card={gridCard([app('One')])} globalConfig={globalConfig} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        fireEvent.click(screen.getByRole('radio', { name: "Header menu's apps" }));
        expect(screen.getByText('Three')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Three' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: "This card's apps" }));
        expect(shownApps()).toEqual(['One']);
    });

    it('keeps the settings on the selected app when another is removed', () => {
        render(<CardEditor card={gridCard([app('One'), app('Two')])} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        fireEvent.keyDown(screen.getByRole('button', { name: 'Two' }), { key: 'Enter' });
        fireEvent.click(screen.getByRole('button', { name: 'Remove One' }));
        expect(within(screen.getByRole('region', { name: 'Selected app' })).getByLabelText('Name')).toHaveValue('Two');
    });
});

describe('Header cards', () => {
    it('edits only the icon in its own dialog and stores its color and background', async () => {
        const onSave = vi.fn();
        render(<CardIconEditor card={{ id: 'w', type: 'weather', location: 'Berlin' }} onSave={onSave} onCancel={() => {}} />);

        const inspector = screen.getByRole('region', { name: 'Card icon' });
        fireEvent.change(within(inspector).getByLabelText('Search Lucide icons'), { target: { value: 'zap-off' } });
        fireEvent.click(await within(inspector).findByRole('button', { name: 'ZapOff' }));
        fireEvent.click(within(inspector).getByRole('button', { name: 'Theme accent icon color' }));
        fireEvent.click(within(inspector).getByRole('button', { name: 'Blue background' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0]).toMatchObject({ icon: 'lu-ZapOff', iconColor: 'var(--color-primary)', iconBackground: '#0a84ff', location: 'Berlin' });
    });

    it('keeps the card itself inert and offers nothing to arrange', () => {
        const { container } = render(<CardIconEditor card={{ id: 'w', type: 'weather' }} onSave={() => {}} onCancel={() => {}} />);
        expect(container.querySelector('.icon-stage-card')).toHaveAttribute('inert');
        expect(container.querySelector('.arrange-item')).toBeNull();
    });

    it('leaves the icon settings out of the card editor', () => {
        render(<CardEditor card={{ id: 'w', type: 'weather' }} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        expect(screen.queryByRole('region', { name: 'Card icon' })).not.toBeInTheDocument();
    });
});
