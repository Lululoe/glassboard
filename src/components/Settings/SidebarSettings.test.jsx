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
        fireEvent.click(screen.getByRole('button', { name: /^Office/, pressed: false }));
        fireEvent.click(screen.getByRole('button', { name: 'Move Office up' }));
        expect(order()).toEqual(['Home', 'Office', 'Garden']);
        fireEvent.click(screen.getByRole('button', { name: 'Home', pressed: false }));
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
        fireEvent.click(screen.getByRole('button', { name: 'Garden', pressed: false }));
        fireEvent.change(screen.getByLabelText('Folder of Garden'), { target: { value: '\u0000new' } });
        expect(order()).toEqual(['Home', 'Folder', 'Garden', 'Office']);
        // The page stays selected, and the folder's pages show beside the rail
        expect(screen.getByRole('button', { name: /^Garden/, pressed: true })).toBeInTheDocument();
        expect(screen.getByLabelText('Folder', { selector: '.sidebar-settings-folder' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Folder of Garden'), { target: { value: '\u0000none' } });
        // A folder needs two pages, so the one left goes back to the top
        expect(order()).toEqual(['Home', 'Office', 'Garden']);
        await save();
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ items: [{ page: 'home' }, { page: 'office' }, { page: 'garden' }] }));
    });

    it('reorders by dragging a handle, and with the arrow keys on it', () => {
        renderSection(<SidebarSettings enabled pages={pages} onSave={() => {}} />);
        const rows = screen.getAllByRole('listitem');
        rows.forEach((row, i) => {
            row.getBoundingClientRect = () => /** @type {DOMRect} */ ({ top: i * 50, height: 50, bottom: i * 50 + 50, left: 0, right: 300, width: 300 });
        });
        const handle = screen.getByRole('button', { name: 'Reorder Home' });
        fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 25 });
        fireEvent.pointerMove(window, { pointerId: 1, clientY: 140 });
        fireEvent.pointerUp(window, { pointerId: 1, clientY: 140 });
        expect(order()).toEqual(['Garden', 'Office', 'Home']);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Office' }), { key: 'ArrowUp' });
        expect(order()).toEqual(['Office', 'Garden', 'Home']);
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
