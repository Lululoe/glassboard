import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import SidebarItemEditor from './SidebarItemEditor';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

describe('SidebarItemEditor', () => {
    it('picks a page icon with the same picker as other icons', async () => {
        const onSave = vi.fn();
        render(<SidebarItemEditor entry={{ page: 'home' }} pageName="Home" onSave={onSave} onCancel={vi.fn()} />);
        expect(screen.getByText('Rename the page in its settings.')).toBeInTheDocument();
        expect(screen.getByText('H')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search Lucide icons'), { target: { value: 'house' } });
        fireEvent.click(await screen.findByRole('button', { name: 'House' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ page: 'home', icon: 'lu-House' });
    });

    it('goes back to the first letter', () => {
        const onSave = vi.fn();
        render(<SidebarItemEditor entry={{ page: 'home', icon: 'lu-House', iconColor: '#ffffff' }} pageName="Home" onSave={onSave} onCancel={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Use first letter' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ page: 'home' });
    });

    it('renames a folder and can remove it', () => {
        const onSave = vi.fn();
        const onUngroup = vi.fn();
        const folder = { folder: 'f1', name: 'Folder', pages: [{ page: 'a' }, { page: 'b' }] };
        render(<SidebarItemEditor entry={folder} onSave={onSave} onCancel={vi.fn()} onUngroup={onUngroup} />);
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rooms' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ ...folder, name: 'Rooms' });
        fireEvent.click(screen.getByRole('button', { name: 'Remove Folder' }));
        expect(onUngroup).toHaveBeenCalled();
    });
});
