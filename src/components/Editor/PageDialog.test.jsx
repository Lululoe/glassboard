import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import PageDialog from './PageDialog';
import { pageIdFor } from '../../hooks/useDashboardEditing';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});

describe('PageDialog', () => {
    it('adds a page with a name', () => {
        const onSave = vi.fn();
        render(<PageDialog onSave={onSave} onCancel={() => {}} />);
        expect(screen.getByRole('heading', { name: 'New Page' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete page' })).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Garden ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(onSave).toHaveBeenCalledWith('Garden');
    });

    it('renames a page and asks before deleting it with its cards', () => {
        const onSave = vi.fn();
        const onDelete = vi.fn();
        render(<PageDialog page={{ id: 'garden', name: 'Garden', addedInEditor: true }} cardCount={3} onSave={onSave} onDelete={onDelete} onCancel={() => {}} />);
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Yard' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith('Yard');

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        expect(screen.getByText('Delete this page and its 3 cards?')).toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(onDelete).toHaveBeenCalled();
    });
});

describe('PageDialog for pages from config.yaml', () => {
    it('shows where the page comes from, without renaming or deleting, and opens its background', () => {
        const onEditBackground = vi.fn();
        const onSave = vi.fn();
        render(<PageDialog page={{ id: 'home', name: 'Home' }} onSave={onSave} onDelete={undefined} onEditBackground={onEditBackground} onCancel={() => {}} />);
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        expect(screen.getByText(/set up in config.yaml/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete page' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Page background…' }));
        expect(onEditBackground).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });
});

describe('pageIdFor', () => {
    it('makes a readable id that no other page uses', () => {
        expect(pageIdFor('Garten & Hof', new Set())).toBe('garten-hof');
        expect(pageIdFor('Café', new Set())).toBe('cafe');
        expect(pageIdFor('Home', new Set(['home', 'home-2']))).toBe('home-3');
        expect(pageIdFor('', new Set())).toBe('page');
        expect(pageIdFor('!!!', new Set(['page']))).toBe('page-2');
    });
});
