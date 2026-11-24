import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LitterboxCard from './LitterboxCard';
import { cardInfo } from '../registry';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const bodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
const actions = () => bodies().filter(b => b.endpoint === 'litterbox_action');

const BOX = {
    entity_id: 'vacuum.lr4_litter_box', name: 'Litter-Robot', state: 'docked', status: 'rdy', waste: 75, litter: 82,
    last_seen: '2026-11-24T10:00:00Z', hopper: null, resettable: true,
    clean_delay: { value: '7', options: ['3', '7', '15'] }, globe_light: null, panel_lock: false, sleep: null, firmware: null,
    cats: [
        { index: 0, name: 'Pepper', color: null, weight: 3.32, weight_unit: 'kg', weighed_at: '2026-11-24T09:00:00Z', visits: 3 },
        { index: 1, name: 'Teddy', color: null, weight: 5.06, weight_unit: 'kg', weighed_at: '2026-11-24T08:00:00Z', visits: 2 },
    ],
};

describe('Litter box card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (_u, init) => {
            const body = JSON.parse(init.body);
            if (body.endpoint === 'litterbox') return jsonResponse(BOX);
            if (body.endpoint === 'litterbox_history') return jsonResponse({ range: body.range, start: 0, cats: [{ index: 0, visits: [], days: [], points: [] }, { index: 1, visits: [], days: [], points: [] }] });
            return jsonResponse([]);
        }));
        HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
        HTMLDialogElement.prototype.close = function close() { this.open = false; };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete HTMLDialogElement.prototype.showModal;
        delete HTMLDialogElement.prototype.close;
    });

    it('is registered with its sizes', () => {
        expect(cardInfo.litterbox.sizes).toEqual(['quarter', 'half', '1']);
    });

    it('shows visits, weight and levels, and a timeline per cat at full size', async () => {
        render(<LitterboxCard config={{ id: 'lb', entity_id: 'vacuum.lr4_litter_box' }} />);
        expect(await screen.findByText('Visits today')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText("Pepper's weight")).toBeInTheDocument();
        expect(screen.getByRole('meter', { name: 'Waste drawer' })).toHaveAttribute('aria-valuenow', '75');
        expect(screen.getByRole('img', { name: /Pepper: no visits yet/ })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Teddy/ })).toBeInTheDocument();
    });

    it('leaves the timelines out at half size', async () => {
        render(<LitterboxCard config={{ id: 'lb', entity_id: 'vacuum.lr4_litter_box', tileSize: 'half' }} />);
        expect(await screen.findByText('Visits today')).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /Pepper/ })).not.toBeInTheDocument();
    });

    it('starts a clean from the quarter tile ring', async () => {
        render(<LitterboxCard config={{ id: 'lb', entity_id: 'vacuum.lr4_litter_box', tileSize: 'quarter' }} />);
        expect(await screen.findByText('Drawer 75%')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /clean now/ }));
        await waitFor(() => expect(actions()).toEqual([expect.objectContaining({ card_id: 'lb', action: 'clean' })]));
    });

    it('opens the details, changes settings and resets after a second tap', async () => {
        render(<LitterboxCard config={{ id: 'lb', entity_id: 'vacuum.lr4_litter_box' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Litter-Robot details' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(within(dialog).getByRole('button', { name: /15/ }));
        await waitFor(() => expect(actions()).toContainEqual(expect.objectContaining({ action: 'set_clean_delay', value: '15' })));

        fireEvent.click(within(dialog).getByRole('switch', { name: 'Panel lock' }));
        await waitFor(() => expect(actions()).toContainEqual(expect.objectContaining({ action: 'set_panel_lock', value: true })));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
        expect(actions().some(a => a.action === 'reset')).toBe(false);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Tap to reset' }));
        await waitFor(() => expect(actions()).toContainEqual(expect.objectContaining({ action: 'reset' })));
    });

    it('asks for an entity while it has none', () => {
        render(<LitterboxCard config={{ id: 'lb' }} />);
        expect(screen.getByText(/Choose the litter box/)).toBeInTheDocument();
    });
});
