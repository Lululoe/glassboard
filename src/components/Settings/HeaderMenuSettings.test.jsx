import { fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HeaderMenuSettings from './HeaderMenuSettings';
import { renderSection } from './sectionTestUtils';

const app = (name) => ({ name, url: `http://${name}`, icon: 'lu-Globe' });

describe('HeaderMenuSettings', () => {
    const launcher = { apps: [app('One'), app('Two')], links: [{ name: 'Docs', url: 'http://docs', icon: 'lu-Book' }], links_title: 'More' };

    it('sets when the header bar hides itself', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<HeaderMenuSettings launcher={launcher} headerAutoHide="always" onSave={onSave} />);
        expect(screen.getByRole('radio', { name: 'Always' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByRole('radio', { name: 'With Page Header' }));
        await save();
        expect(onSave.mock.calls[0][1]).toBe('with-page-header');
    });

    it('arranges apps, adds links and saves', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<HeaderMenuSettings launcher={launcher} onSave={onSave} />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'ArrowRight', shiftKey: true });
        fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
        fireEvent.change(within(screen.getByRole('region', { name: 'Selected link' })).getByLabelText('Name'), { target: { value: 'Wiki' } });
        fireEvent.change(screen.getByLabelText('Links heading'), { target: { value: 'Tools' } });
        await save();

        const saved = onSave.mock.calls[0][0];
        expect(saved.apps.map(a => a.name)).toEqual(['Two', 'One']);
        expect(saved.links.map(l => l.name)).toEqual(['Docs', 'Wiki']);
        expect(saved.links_title).toBe('Tools');
    });

    it('keeps apps past the first 12 in a tray', async () => {
        const apps = Array.from({ length: 13 }, (_, i) => app(`App${i}`));
        renderSection(<HeaderMenuSettings launcher={{ apps, links: [] }} onSave={() => {}} />);
        expect(screen.getByText(/Won't show: 1/)).toBeInTheDocument();
        expect(document.querySelector('.arrange-tray')).toHaveTextContent('App12');
    });

    it('stores a color on an app in the object form', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<HeaderMenuSettings launcher={launcher} onSave={onSave} />);
        fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'Enter' });
        fireEvent.click(within(screen.getByRole('region', { name: 'Selected app' })).getByRole('button', { name: 'Red icon color' }));
        await save();
        expect(onSave.mock.calls[0][0].apps[0].icon).toEqual({ source: 'lucide', value: 'Globe', color: 'var(--system-red)' });
    });

    it('edits as YAML', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<HeaderMenuSettings launcher={launcher} onSave={onSave} />);
        fireEvent.click(screen.getByRole('tab', { name: 'YAML' }));
        fireEvent.change(screen.getByLabelText('Header menu YAML'), { target: { value: 'apps: [unclosed' } });
        await expect(save()).rejects.toThrow();
        expect(onSave).not.toHaveBeenCalled();
    });
});
