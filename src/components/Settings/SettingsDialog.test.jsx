import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Palette, PanelLeft, Wallpaper } from 'lucide-react';
import { ThemeProvider } from '../../context/ThemeContext';
import SettingsDialog from './SettingsDialog';
import SidebarSettings from './SidebarSettings';
import PageSettings from './PageSettings';
import AppearanceSettings from './AppearanceSettings';
import { useSectionCommit } from './settingsSection';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

/**
 * A section whose Save fails with the message given.
 * @param {{message: string}} props
 * @returns {JSX.Element} The section.
 */
const Failing = ({ message }) => {
    useSectionCommit(() => {
        throw new Error(message);
    });
    return <p>Failing section</p>;
};

const sidebar = (onSave) => ({
    id: 'sidebar', group: 'Dashboard', title: 'Sidebar', icon: PanelLeft, color: '#30d158',
    render: () => <SidebarSettings enabled={false} pages={[{ key: 'home', name: 'Home' }]} onSave={onSave} />,
});

describe('SettingsDialog', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.documentElement.removeAttribute('data-style');
    });

    it('lists the sections under their headings and shows the first', () => {
        render(
            <SettingsDialog
                sections={[
                    { id: 'page', group: 'This Page', title: 'Page', icon: Wallpaper, color: '#888', render: () => <p>Page content</p> },
                    sidebar(() => {}),
                ]}
                onSaved={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByText('This Page')).toBeInTheDocument();
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Page' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('Page content')).toBeVisible();
    });

    it('keeps changes in every section shown until Save, then saves them all', async () => {
        const onSidebar = vi.fn();
        const onRename = vi.fn();
        const onSaved = vi.fn();
        render(
            <SettingsDialog
                sections={[
                    {
                        id: 'page', group: 'This Page', title: 'Page', icon: Wallpaper, color: '#888',
                        render: () => <PageSettings page={{ id: 'garden', name: 'Garden', addedInEditor: true }} onRename={onRename} />,
                    },
                    sidebar(onSidebar),
                ]}
                onSaved={onSaved}
                onCancel={() => {}}
            />,
        );
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Yard' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sidebar' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show sidebar' }));
        // The page's name is still there, waiting for Save
        expect(screen.getByLabelText('Name')).toHaveValue('Yard');
        expect(onRename).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(onRename).toHaveBeenCalledWith('Yard');
        expect(onSidebar).toHaveBeenCalledWith({ enabled: true });
    });

    it("shows the section that couldn't be saved, with the reason, and stays open", async () => {
        const onSaved = vi.fn();
        render(
            <SettingsDialog
                sections={[
                    sidebar(() => {}),
                    { id: 'kiosk', group: 'Dashboard', title: 'Kiosk Mode', icon: Palette, color: '#f90', render: () => <Failing message="Server said no" /> },
                ]}
                onSaved={onSaved}
                onCancel={() => {}}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Kiosk Mode' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sidebar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
        expect(screen.getByRole('button', { name: /Kiosk Mode/ })).toHaveAttribute('aria-current', 'page');
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('asks before deleting a page', () => {
        const onDelete = vi.fn();
        render(
            <SettingsDialog
                sections={[{
                    id: 'page', group: 'This Page', title: 'Page', icon: Wallpaper, color: '#888',
                    render: () => <PageSettings page={{ id: 'garden', name: 'Garden', addedInEditor: true }} cardCount={3} onRename={() => {}} onDelete={onDelete} />,
                }]}
                onSaved={() => {}}
                onCancel={() => {}}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        expect(screen.getByText('Delete this page and its 3 cards?')).toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(onDelete).toHaveBeenCalled();
    });

    it('adds a page from the Page section', () => {
        const onAddPage = vi.fn();
        render(
            <SettingsDialog
                sections={[{
                    id: 'page', group: 'This Page', title: 'Page', icon: Wallpaper, color: '#888',
                    render: () => <PageSettings page={{ id: 'home', name: 'Home' }} onRename={() => {}} onAddPage={onAddPage} />,
                }]}
                onSaved={() => {}}
                onCancel={() => {}}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
        expect(onAddPage).toHaveBeenCalled();
    });

    it('shows a page from config.yaml without renaming or deleting it', () => {
        render(
            <SettingsDialog
                sections={[{
                    id: 'page', group: 'This Page', title: 'Page', icon: Wallpaper, color: '#888',
                    render: () => <PageSettings page={{ id: 'home', name: 'Home' }} onRename={() => {}} />,
                }]}
                onSaved={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        expect(screen.getByText(/set up in config.yaml/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete page' })).not.toBeInTheDocument();
    });
});

describe('AppearanceSettings', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.documentElement.removeAttribute('data-style');
    });

    const appearance = (onSaved = () => {}, onCancel = () => {}) => (
        <ThemeProvider config={{ editable: true }}>
            <SettingsDialog
                sections={[{ id: 'appearance', group: 'Dashboard', title: 'Appearance', icon: Palette, color: '#f37', wide: true, render: () => <AppearanceSettings /> }]}
                onSaved={onSaved}
                onCancel={onCancel}
            />
        </ThemeProvider>
    );

    it('shows a picked style on the dashboard and in the preview, and saves it with Save', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));
        const onSaved = vi.fn();
        render(appearance(onSaved));
        expect(screen.getByRole('complementary', { name: 'Preview' })).toHaveTextContent('Ceiling Light');

        fireEvent.click(screen.getByRole('radio', { name: /Neon/ }));
        expect(document.documentElement.getAttribute('data-style')).toBe('neon');
        expect(fetch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(fetch).toHaveBeenCalledWith('/api/config/appearance', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ style: 'neon' }) }));
    });

    it('shows the saved style again when closed without saving', () => {
        vi.stubGlobal('fetch', vi.fn());
        const { rerender } = render(appearance());
        fireEvent.click(screen.getByRole('radio', { name: /Neon/ }));
        expect(document.documentElement.getAttribute('data-style')).toBe('neon');

        act(() => rerender(<ThemeProvider config={{ editable: true }}><div /></ThemeProvider>));
        expect(document.documentElement.getAttribute('data-style')).toBe('glass');
        expect(fetch).not.toHaveBeenCalled();
    });
});
