import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VacuumCard from './VacuumCard';
import VacuumsCard from './VacuumsCard';
import { VacuumEditor } from './VacuumEditor';
import { cardInfo } from '../registry';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const bodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
const actions = () => bodies().filter(b => b.endpoint === 'vacuum_action');

const robot = (over = {}) => ({
    entity_id: 'vacuum.robo', name: 'Robo', state: 'docked', battery: 80, progress: null,
    fan: { value: 'low', options: ['low', 'max'] },
    wetness: { value: 'high', options: ['low', 'high'] },
    stats: [
        { name: 'Battery', value: '80', unit: '%', battery: true },
        { name: 'Area', value: '90000', unit: 'cm²', battery: false },
        { name: 'Time', value: '720', unit: 's', battery: false },
        { name: 'Total runs', value: '298', unit: '', battery: false },
    ],
    rooms: [{ name: 'Kitchen', area: 'kitchen', segment: null }, { name: 'Office', area: 'office', segment: '4' }],
    consumables: [
        { index: 0, name: 'Brush', value: '8160', unit: 'min', percent: 15, resettable: true },
        { index: 1, name: 'Filter', value: '100', unit: 'min', percent: null, resettable: true },
        { index: 2, name: 'Sensors', value: '0', unit: 'min', percent: null, resettable: false },
    ],
    camera: 'camera.front',
    map: 'camera.map',
    ...over,
});
const MAP = {
    kind: 'valetudo', viewBox: [0, 0, 10, 10], floor: '', walls: 'M0 0h1v1h-1z', path: 'M1 1L2 2', robot: { x: 1, y: 1 }, charger: { x: 2, y: 2 },
    segments: [{ id: '1', name: 'Kitchen', d: 'M1 1h1v1h-1z', x: 1, y: 1 }, { id: '4', name: 'Den', d: 'M3 3h1v1h-1z', x: 3, y: 3 }, { id: '9', name: 'Attic', d: 'M5 5h1v1h-1z', x: 5, y: 5 }],
};

/** Answers the card's requests. */
const backend = (robots, map = MAP) => fetch.mockImplementation(async (_u, init) => {
    const body = JSON.parse(init.body);
    if (body.endpoint === 'vacuum') return jsonResponse({ robots });
    if (body.endpoint === 'vacuum_map') return jsonResponse(map);
    return jsonResponse([]);
});

describe('Vacuum cards', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
        HTMLDialogElement.prototype.close = function close() { this.open = false; };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete HTMLDialogElement.prototype.showModal;
        delete HTMLDialogElement.prototype.close;
    });

    it('shows stats, controls and rooms, and starts the picked rooms', async () => {
        backend([robot()]);
        render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);

        expect(await screen.findByText('Docked · 80%')).toBeInTheDocument();
        expect(screen.getByText('9 m²')).toBeInTheDocument();
        expect(screen.getByText('12 min')).toBeInTheDocument();
        // The first three stats only
        expect(screen.queryByText('Total runs')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Return to dock' })).toBeDisabled();

        expect(screen.getByText('All rooms')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Office' }));
        expect(screen.getByText('1 of 2')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Start' }));
        await waitFor(() => expect(actions()).toEqual([
            expect.objectContaining({ card_id: 'v', entity_id: 'vacuum.robo', action: 'clean_rooms', areas: ['office'] }),
        ]));
        // Shown right away: it can be paused and stopped now
        expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    });

    it('cleans everything with no room picked, and sends fan speed and wetness', async () => {
        backend([robot()]);
        render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
        await waitFor(() => expect(actions()[0]).toMatchObject({ action: 'start' }));

        fireEvent.click(within(screen.getByRole('group', { name: 'Fan speed' })).getByRole('button', { name: 'Max' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Mop wetness' })).getByRole('button', { name: 'Low' }));
        await waitFor(() => expect(actions().slice(1)).toEqual([
            expect.objectContaining({ action: 'set_fan', value: 'max' }),
            expect.objectContaining({ action: 'set_wetness', value: 'low' }),
        ]));
        expect(within(screen.getByRole('group', { name: 'Fan speed' })).getByRole('button', { name: 'Max' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows the charge in the battery icon', async () => {
        const icon = async (value) => {
            backend([robot({ stats: [{ name: 'Battery', value, unit: '%', battery: true }] })]);
            const { container, unmount } = render(<VacuumCard config={{ id: `b${value}`, entity_id: 'vacuum.robo' }} />);
            await screen.findByText('Battery');
            const classes = container.querySelector('svg.vac-battery').getAttribute('class');
            unmount();
            return classes;
        };
        expect(await icon('100')).toContain('lucide-battery-full');
        expect(await icon('50')).toContain('lucide-battery-medium');
        const low = await icon('15');
        expect(low).toContain('lucide-battery-low');
        expect(low).toContain(' low');
        expect(await icon('5')).toContain(' empty');
    });

    it('hides what a robot does not have', async () => {
        backend([robot({ rooms: [{ name: 'Only room', area: 'a', segment: null }], wetness: null })]);
        render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);
        await screen.findByRole('group', { name: 'Fan speed' });
        expect(screen.queryByText('Only room')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Mop wetness' })).not.toBeInTheDocument();
    });

    it('shows only the status at half height', async () => {
        backend([robot()]);
        render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo', tileSize: 'half' }} />);
        expect(await screen.findByText('9 m²')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Fan speed' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Kitchen' })).not.toBeInTheDocument();
    });

    it('shows progress while cleaning if reported, and the battery otherwise', async () => {
        backend([robot({ state: 'cleaning', progress: 42 })]);
        const { unmount } = render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);
        expect(await screen.findByRole('progressbar', { name: 'Cleaning progress' })).toHaveAttribute('aria-valuenow', '42');
        unmount();
        backend([robot({ state: 'cleaning', progress: null })]);
        render(<VacuumCard config={{ id: 'w', entity_id: 'vacuum.robo' }} />);
        expect(await screen.findByRole('progressbar', { name: 'Battery' })).toHaveAttribute('aria-valuenow', '80');
    });

    it('opens details with every stat, consumables and a map that picks rooms', async () => {
        backend([robot()]);
        const { container } = render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Robo details' }));
        const dialog = await screen.findByRole('dialog', { name: 'Robo' });
        const d = within(dialog);

        expect(d.getByText('Total runs')).toBeInTheDocument();
        expect(d.getByText('298')).toBeInTheDocument();

        // Percentage: its bar and warning color. Without one: full until the sensor is zero
        const parts = [...dialog.querySelectorAll('.vac-part')];
        expect(parts[0]).toHaveClass('low');
        expect(parts[0].querySelector('.vac-part-bar > div').style.width).toBe('15%');
        expect(parts[0]).toHaveTextContent('136 h · 15%');
        expect(parts[1]).toHaveClass('ok');
        expect(parts[1].querySelector('.vac-part-bar > div').style.width).toBe('100%');
        expect(parts[2].querySelector('.vac-part-bar > div').style.width).toBe('0%');

        // Reset is there at any level, except without a button entity; it asks once more
        fireEvent.click(d.getByRole('button', { name: 'Reset Filter' }));
        expect(actions()).toEqual([]);
        fireEvent.click(d.getByRole('button', { name: 'Confirm reset of Filter' }));
        await waitFor(() => expect(actions()).toEqual([expect.objectContaining({ action: 'reset_consumable', index: 1 })]));
        expect(d.queryByRole('button', { name: 'Reset Sensors' })).not.toBeInTheDocument();

        // The map: rooms by name or segment id; a segment that isn't on the card can't be picked
        await waitFor(() => expect(dialog.querySelectorAll('.vac-map-room')).toHaveLength(3));
        const rooms = dialog.querySelectorAll('.vac-map-room');
        fireEvent.click(rooms[1]);
        fireEvent.click(rooms[2]);
        expect(rooms[1]).toHaveClass('picked');
        expect(rooms[2]).not.toHaveClass('picked');
        expect(d.getByRole('button', { name: 'Office' })).toHaveAttribute('aria-pressed', 'true');
        // The card shows the same pick
        expect(within(container).getByText('1 of 2')).toBeInTheDocument();

        // Another camera: its picture through the server
        fetch.mockImplementation(async () => jsonResponse({ kind: 'image' }));
        fireEvent.click(d.getByRole('button', { name: 'Camera' }));
        const img = await d.findByRole('img', { name: /camera.front/ });
        expect(img.getAttribute('src')).toContain('/api/ha/camera?card_id=v&entity_id=camera.front');

        fireEvent.click(d.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the chosen sections beside the content on wide cards', async () => {
        backend([robot()]);
        const { container, unmount } = render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo', colSpan: 3, show_map: true, show_stats: true, show_consumables: true }} />);
        await waitFor(() => expect(container.querySelectorAll('.vac-map-room')).toHaveLength(3));
        // Three wide: every stat, the consumables and the map, with the usual controls
        expect(screen.getByText('Total runs')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset Brush' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Fan speed' })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Section' })).not.toBeInTheDocument();
        // Picking a room on the map shows on the room buttons
        fireEvent.click(container.querySelectorAll('.vac-map-room')[0]);
        expect(screen.getByRole('button', { name: 'Kitchen' })).toHaveAttribute('aria-pressed', 'true');
        unmount();

        // Two wide: they take turns
        render(<VacuumCard config={{ id: 'w', entity_id: 'vacuum.robo', colSpan: 2, show_map: true, show_stats: true, show_consumables: true }} />);
        const sections = within(await screen.findByRole('group', { name: 'Section' }));
        expect(screen.queryByText('Total runs')).not.toBeInTheDocument();
        fireEvent.click(sections.getByRole('button', { name: 'Stats' }));
        expect(screen.getByText('Total runs')).toBeInTheDocument();
        fireEvent.click(sections.getByRole('button', { name: 'Consumables' }));
        expect(screen.getByRole('button', { name: 'Reset Brush' })).toBeInTheDocument();
    });

    it('stays as it is without sections, and one wide', async () => {
        backend([robot()]);
        const { container } = render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo', colSpan: 1, show_map: true, show_stats: true }} />);
        await screen.findByRole('group', { name: 'Fan speed' });
        expect(container.querySelector('.vac-wide')).not.toBeInTheDocument();
        expect(screen.queryByText('Total runs')).not.toBeInTheDocument();
    });

    it('has no view switch with one view, and no view pane without any', async () => {
        backend([robot({ camera: null })]);
        const { unmount } = render(<VacuumCard config={{ id: 'v', entity_id: 'vacuum.robo' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Robo details' }));
        await screen.findByRole('dialog');
        expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
        unmount();

        backend([robot({ camera: null, map: null })]);
        render(<VacuumCard config={{ id: 'w', entity_id: 'vacuum.robo' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Robo details' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog.querySelector('.vac-view-pane')).not.toBeInTheDocument();
        expect(dialog.querySelector('.vac-panel')).toHaveClass('single');
    });

    it('controls all robots from the multi-robot header', async () => {
        const list = [robot(), robot({ entity_id: 'vacuum.two', name: 'Two', state: 'cleaning' })];
        backend(list);
        render(<VacuumsCard config={{ id: 'm', robots: ['vacuum.robo', 'vacuum.two'] }} />);

        expect(await screen.findByText('1 cleaning · 1 docked')).toBeInTheDocument();
        // One wide: the half height content per robot
        expect(screen.queryByRole('group', { name: 'Fan speed' })).not.toBeInTheDocument();

        // One is cleaning, so this pauses it; the docked robot isn't touched
        fireEvent.click(screen.getByRole('button', { name: 'Pause all robots' }));
        await waitFor(() => expect(actions()).toEqual([expect.objectContaining({ entity_id: 'vacuum.two', action: 'pause' })]));

        fireEvent.click(screen.getByRole('button', { name: 'Start all robots' }));
        await waitFor(() => expect(actions().slice(1).map(a => [a.entity_id, a.action])).toEqual([['vacuum.robo', 'start'], ['vacuum.two', 'start']]));

        fireEvent.click(screen.getByRole('button', { name: /^Two details/ }));
        expect(await screen.findByRole('dialog', { name: 'Two' })).toBeInTheDocument();
    });

    it('gives each robot its full content when there is a column for it', async () => {
        backend([robot(), robot({ entity_id: 'vacuum.two', name: 'Two' })]);
        render(<VacuumsCard config={{ id: 'm', colSpan: 2, robots: ['vacuum.robo', 'vacuum.two'] }} />);
        expect(await screen.findAllByRole('group', { name: 'Fan speed' })).toHaveLength(2);
        expect(screen.getAllByRole('group', { name: 'Rooms to clean' })).toHaveLength(2);
    });

    it('sets the sections in the card settings, and offers the wide sizes', () => {
        expect(cardInfo.vacuum.sizes).toEqual(['half', '1', '2', '3']);
        const onChange = vi.fn();
        const { rerender } = render(<VacuumEditor config={{ entity_id: 'vacuum.robo' }} onChange={onChange} />);
        fireEvent.click(screen.getByRole('switch', { name: 'Show the map' }));
        expect(onChange).toHaveBeenLastCalledWith({ entity_id: 'vacuum.robo', show_map: true });
        fireEvent.click(screen.getByRole('switch', { name: 'Show all stats' }));
        expect(onChange).toHaveBeenLastCalledWith({ entity_id: 'vacuum.robo', show_stats: true });
        fireEvent.click(screen.getByRole('switch', { name: 'Show consumables' }));
        expect(onChange).toHaveBeenLastCalledWith({ entity_id: 'vacuum.robo', show_consumables: true });

        rerender(<VacuumEditor config={{ entity_id: 'vacuum.robo', show_map: true }} onChange={onChange} />);
        expect(screen.getByRole('switch', { name: 'Show the map' })).toBeChecked();
        fireEvent.click(screen.getByRole('switch', { name: 'Show the map' }));
        expect(onChange.mock.lastCall[0].show_map).toBeUndefined();
    });

    it('asks for a robot when there is none', () => {
        render(<VacuumCard config={{ id: 'e' }} />);
        expect(screen.getByText('Choose a vacuum in the card settings.')).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });
});
