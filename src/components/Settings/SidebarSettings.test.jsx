import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SidebarSettings from './SidebarSettings';
import { renderSection } from './sectionTestUtils';

const pages = [
    { key: 'home', name: 'Home' },
    { key: 'garden', name: 'Garden' },
    { key: 'office', name: 'Office', hidden: true },
];

const order = () => within(screen.getByRole('list', { name: 'Pages and folders' }))
    .getAllByRole('listitem')
    .map(li => li.querySelector('.sidebar-editor-row-name')?.textContent);

describe('SidebarSettings', () => {
    it('lists every page, in order, and the rail as it will look', () => {
        renderSection(<SidebarSettings enabled pages={pages} onSave={() => {}} />);
        expect(order()).toEqual(['Home', 'Garden', 'Office']);
        const preview = screen.getByRole('complementary', { name: 'Preview' });
        expect(within(preview).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Home', 'Garden', 'Office']);
        expect(screen.getByLabelText('Hidden page')).toBeInTheDocument();
    });

    it('saves nothing when nothing changed', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<SidebarSettings enabled pages={pages} onSave={onSave} />);
        await save();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('moves pages and keeps the order with Save', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<SidebarSettings enabled pages={pages} onSave={onSave} />);
        fireEvent.click(screen.getByRole('button', { name: 'Move Office up' }));
        expect(order()).toEqual(['Home', 'Office', 'Garden']);
        expect(screen.getByRole('button', { name: 'Move Home up' })).toBeDisabled();
        await save();
        expect(onSave).toHaveBeenCalledWith({
            enabled: true,
            items: [{ page: 'home' }, { page: 'office' }, { page: 'garden' }],
        });
    });

    it('puts a page in a new folder with the next one, and takes it out again', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<SidebarSettings enabled pages={pages} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Folder of Garden'), { target: { value: '\u0000new' } });
        expect(order()).toEqual(['Home', 'Folder', 'Garden', 'Office']);
        // The page stays selected, and the folder's pages show beside the rail
        expect(screen.getByRole('button', { name: 'Garden', pressed: true })).toBeInTheDocument();
        expect(screen.getByLabelText('Folder', { selector: '.sidebar-settings-folder' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Folder of Garden'), { target: { value: '\u0000none' } });
        // A folder needs two pages, so the one left goes back to the top
        expect(order()).toEqual(['Home', 'Office', 'Garden']);
        await save();
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ items: [{ page: 'home' }, { page: 'office' }, { page: 'garden' }] }));
    });

    it("changes a page's icon", async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<SidebarSettings enabled={false} pages={pages} onSave={onSave} />);
        fireEvent.click(screen.getByRole('button', { name: 'Garden', pressed: false }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show sidebar' }));
        fireEvent.change(screen.getByLabelText('Search Lucide icons'), { target: { value: 'flower' } });
        fireEvent.click(await screen.findByRole('button', { name: 'Flower' }));
        await save();
        expect(onSave).toHaveBeenCalledWith({
            enabled: true,
            items: [{ page: 'home' }, { page: 'garden', icon: 'lu-Flower' }, { page: 'office' }],
        });
    });

    it('shows a page added meanwhile at the end, and adds one', () => {
        const onAddPage = vi.fn();
        const { rerender } = renderSection(<SidebarSettings enabled pages={pages} onSave={() => {}} onAddPage={onAddPage} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
        expect(onAddPage).toHaveBeenCalled();
        rerender(<SidebarSettings enabled pages={[...pages, { key: 'attic', name: 'Attic' }]} onSave={() => {}} onAddPage={onAddPage} />);
        expect(order()).toEqual(['Home', 'Garden', 'Office', 'Attic']);
    });
});
