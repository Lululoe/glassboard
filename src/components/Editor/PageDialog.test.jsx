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
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Garden ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(onSave).toHaveBeenCalledWith('Garden');
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
