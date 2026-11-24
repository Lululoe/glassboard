import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StorageEditor from './StorageEditor';
import { cardInfo } from '../registry';

describe('Storage editor', () => {
    it('is the storage card editor', () => {
        expect(cardInfo.storage.Editor).toBe(StorageEditor);
    });

    it('picks the bar and the source', () => {
        const onChange = vi.fn();
        render(<StorageEditor config={{ type: 'storage' }} onChange={onChange} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Solid' }));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bar: 'solid' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Prometheus' }));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'prometheus' }));
    });

    it('shows the fields of the chosen source', () => {
        const onChange = vi.fn();
        const { rerender } = render(<StorageEditor config={{ source: 'prometheus' }} onChange={onChange} />);
        expect(screen.getByLabelText('ZFS pool')).toBeInTheDocument();
        rerender(<StorageEditor config={{ source: 'homeassistant', categories: [{ name: 'Media', entities: ['sensor.a', 'sensor.b'] }] }} onChange={onChange} />);
        expect(screen.queryByLabelText('ZFS pool')).toBeNull();
        fireEvent.change(screen.getByLabelText('Total'), { target: { value: '4000' } });
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ total: 4000 }));
        expect(screen.getByText('Media')).toBeInTheDocument();
    });
});
