import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StorageCard from './StorageCard';
import { callService } from '../../lib/api';
import { cardInfo, getCardComponent } from '../registry';

vi.mock('../../lib/api', () => ({ callService: vi.fn() }));

const DATA = { total: 512, categories: [{ name: 'Apps', size: 52.6 }, { name: 'Photos', size: 58.6 }, { name: 'Music', size: 12.1 }] };

/**
 * Renders a card whose source answers with a volume, once it has loaded.
 * @param {Object} config - The card's settings.
 * @param {Object} volume - What the server answers.
 * @returns {Promise<ReturnType<typeof render>>} The rendered card.
 */
async function show(config, volume = DATA) {
    callService.mockResolvedValueOnce(volume);
    const view = render(<StorageCard config={{ id: 'disk', source: 'prometheus', target: 'node', ...config }} />);
    await waitFor(() => expect(view.container.querySelector('.storage-percent')).not.toBeNull());
    return view;
}

describe('Storage card', () => {
    it('is registered with half to three-wide sizes', () => {
        expect(getCardComponent('storage')).toBe(StorageCard);
        expect(cardInfo.storage.sizes).toEqual(['half', '1', '2', '3']);
    });

    it('shows the volume in its header and the categories with their share', async () => {
        const { container } = await show({ colSpan: 2, title: 'Fast SSD' });
        expect(container.querySelector('.two-tone-card.storage-dots.size-2')).not.toBeNull();
        expect(screen.getByText('Fast SSD')).toBeInTheDocument();
        expect(screen.getByText('123 GB of 512 GB used')).toBeInTheDocument();
        expect(screen.getByText('24')).toBeInTheDocument();
        expect(screen.getByText('Photos')).toBeInTheDocument();
        expect(screen.getByText('11%')).toBeInTheDocument();
    });

    it('draws solid blocks with bar: solid', async () => {
        const { container } = await show({ bar: 'solid' });
        expect(container.querySelectorAll('.solid-bar-segment')).toHaveLength(3);
        expect(container.querySelector('.solid-bar-free')).not.toBeNull();
        expect(container.querySelector('.dot-matrix')).toBeNull();
    });

    it('draws dots for an unknown bar', async () => {
        const { container } = await show({ bar: 'nope' });
        expect(container.querySelector('.dot-matrix')).not.toBeNull();
    });

    it('keeps the bar and a line about the free space at half height', async () => {
        const { container } = await show({ tileSize: 'half' });
        expect(container.querySelector('.storage-list')).toBeNull();
        expect(screen.getByText('389 GB free')).toBeInTheDocument();
        expect(screen.getByText('Photos is largest')).toBeInTheDocument();
    });

    it('highlights a category from its block and from its list row, and names it in the header', async () => {
        const { container } = await show({ bar: 'solid', colSpan: 2 });
        const block = Array.from(container.querySelectorAll('.solid-bar-segment'))[1];
        fireEvent.pointerEnter(block);
        expect(block.className).toContain('is-active');
        expect(container.querySelector('.storage-list li.is-active .storage-list-name').textContent).toBe('Photos');
        expect(container.querySelectorAll('.solid-bar-segment.is-dim')).toHaveLength(2);
        expect(screen.getByText('11% of the disk')).toBeInTheDocument();

        fireEvent.pointerLeave(container.querySelector('.solid-bar'));
        expect(container.querySelector('.is-active')).toBeNull();
        expect(screen.getByText('123 GB of 512 GB used')).toBeInTheDocument();

        fireEvent.pointerEnter(screen.getByText('Music').closest('li'));
        expect(container.querySelectorAll('.solid-bar-segment')[2].className).toContain('is-active');
    });

    it('lights every block of the categories under Other', async () => {
        const many = { total: 100, categories: ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ name, size: 10 - i })) };
        const { container } = await show({ bar: 'solid' }, many);
        fireEvent.pointerEnter(screen.getByText('Other').closest('li'));
        expect(container.querySelectorAll('.solid-bar-segment.is-active')).toHaveLength(3);
    });

    it('shows a category\'s description while it is pointed at', async () => {
        const data = { total: 10, categories: [{ name: 'Photos', size: 5, description: 'Kept on this device' }] };
        const { container } = await show({ bar: 'solid' }, data);
        fireEvent.pointerEnter(container.querySelector('.solid-bar-segment'));
        expect(screen.getByText('Kept on this device')).toBeInTheDocument();
    });

    it('says when stale data was last updated', async () => {
        const updated = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        await show({}, { ...DATA, updated });
        expect(screen.getByText(/Updated 3 days ago/)).toBeInTheDocument();
    });

    it('reads its volume from the server when it has a source', async () => {
        callService.mockResolvedValueOnce({ total: 3720, categories: [{ name: 'Media', size: 1480 }, { name: 'Snapshots & other', size: 140, color: 'gray' }] });
        render(<StorageCard config={{ id: 'tank', source: 'prometheus', pool: 'tank' }} />);
        expect(await screen.findByText('1.62 TB of 3.72 TB used')).toBeInTheDocument();
        expect(screen.getByText('Snapshots & other')).toBeInTheDocument();
        expect(callService).toHaveBeenCalledWith('storage', { card_id: 'tank' });
    });

    it('shows sample data until it has a source, without asking the server', () => {
        callService.mockClear();
        render(<StorageCard config={{ id: 'new', data: DATA }} />);
        expect(screen.getByText('3.25 TB of 4 TB used')).toBeInTheDocument();
        expect(callService).not.toHaveBeenCalled();
    });

    it('says when its source fails instead of showing made-up data', async () => {
        callService.mockRejectedValueOnce(new Error('Prometheus is unreachable'));
        render(<StorageCard config={{ id: 'nas', source: 'homeassistant' }} />);
        expect(await screen.findByText("Couldn't load the storage: Prometheus is unreachable")).toBeInTheDocument();
        expect(screen.queryByText('Media')).toBeNull();
    });
});
