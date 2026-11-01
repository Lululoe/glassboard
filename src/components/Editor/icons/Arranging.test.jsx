import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import CardEditor from '../CardEditor';
import HeaderMenuEditor from '../HeaderMenuEditor';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

const app = (name) => ({ name, url: `http://${name}`, icon: 'lu-Globe' });

const gridCard = (apps) => ({ id: 'g', type: 'appgrid', data: { apps } });

/** The apps in the order shown, by their accessible names. */
const shownApps = () => screen.getAllByRole('button', { name: /^(One|Two|Three|New app)$/ }).map(el => el.getAttribute('aria-label'));

/** Drags an item onto another with a mouse. */
const drag = (from, to) => {
    from.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    to.getBoundingClientRect = () => ({ left: 100, top: 0, width: 10, height: 10 });
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
    it('edits only the icon top left and stores its color and background', async () => {
        const onSave = vi.fn();
        render(<CardEditor card={{ id: 'w', type: 'weather', location: 'Berlin' }} onSave={onSave} onCancel={() => {}} onRemove={() => {}} />);

        const inspector = screen.getByRole('region', { name: 'Card icon' });
        fireEvent.change(within(inspector).getByLabelText('Search Lucide icons'), { target: { value: 'zap-off' } });
        fireEvent.click(await within(inspector).findByRole('button', { name: 'ZapOff' }));
        fireEvent.click(within(inspector).getByRole('button', { name: 'Theme accent icon color' }));
        fireEvent.click(within(inspector).getByRole('button', { name: 'Blue background' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave.mock.calls[0][0]).toMatchObject({ icon: 'lu-ZapOff', iconColor: 'var(--color-primary)', iconBackground: '#0a84ff' });
    });

    it('keeps the card itself inert and offers nothing to arrange', () => {
        const { container } = render(<CardEditor card={{ id: 'w', type: 'weather' }} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        expect(container.querySelector('.icon-stage-card')).toHaveAttribute('inert');
        expect(container.querySelector('.arrange-item')).toBeNull();
    });

    it('does not show the icon settings on cards without a header', () => {
        render(<CardEditor card={{ id: 's', type: 'spacer' }} onSave={() => {}} onCancel={() => {}} onRemove={() => {}} />);
        expect(screen.queryByRole('region', { name: 'Card icon' })).not.toBeInTheDocument();
    });
});

describe('HeaderMenuEditor', () => {
    const launcher = { apps: [app('One'), app('Two')], links: [{ name: 'Docs', url: 'http://docs', icon: 'lu-Book' }], links_title: 'More' };

    it('arranges apps, adds links and saves', () => {
        const onSave = vi.fn();
        render(<HeaderMenuEditor launcher={launcher} onSave={onSave} onCancel={() => {}} />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'ArrowRight', shiftKey: true });
        fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
        fireEvent.change(within(screen.getByRole('region', { name: 'Selected link' })).getByLabelText('Name'), { target: { value: 'Wiki' } });
        fireEvent.change(screen.getByLabelText('Links heading'), { target: { value: 'Tools' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const saved = onSave.mock.calls[0][0];
        expect(saved.apps.map(a => a.name)).toEqual(['Two', 'One']);
        expect(saved.links.map(l => l.name)).toEqual(['Docs', 'Wiki']);
        expect(saved.links_title).toBe('Tools');
    });

    it('keeps apps past the first 12 in a tray', () => {
        const apps = Array.from({ length: 13 }, (_, i) => app(`App${i}`));
        render(<HeaderMenuEditor launcher={{ apps, links: [] }} onSave={() => {}} onCancel={() => {}} />);
        expect(screen.getByText(/Won't show: 1/)).toBeInTheDocument();
        expect(document.querySelector('.arrange-tray')).toHaveTextContent('App12');
    });

    it('stores a color on an app in the object form', () => {
        const onSave = vi.fn();
        render(<HeaderMenuEditor launcher={launcher} onSave={onSave} onCancel={() => {}} />);
        fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'Enter' });
        fireEvent.click(within(screen.getByRole('region', { name: 'Selected app' })).getByRole('button', { name: 'Red icon color' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave.mock.calls[0][0].apps[0].icon).toEqual({ source: 'lucide', value: 'Globe', color: 'var(--system-red)' });
    });

    it('edits as YAML', () => {
        const onSave = vi.fn();
        render(<HeaderMenuEditor launcher={launcher} onSave={onSave} onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('tab', { name: 'YAML' }));
        fireEvent.change(screen.getByLabelText('Header menu YAML'), { target: { value: 'apps: [unclosed' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });
});
