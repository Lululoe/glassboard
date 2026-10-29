import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import MultiThermostatCard from './MultiThermostatCard';

const ROOMS = {
    'climate.living': ['Living Room', 'heat', 19.8, 21, 'heating', 'comfort'],
    'climate.bedroom': ['Bedroom', 'heat', 18.9, 18.5, 'idle', 'sleep'],
    'climate.office': ['Office', 'off', 18.4, 20, 'off', 'none'],
};

/**
 * Builds Home Assistant states for the requested climate entities.
 * @param {string[]} ids - Requested entity ids.
 * @returns {Object} States keyed by entity id.
 */
const states = (ids) => Object.fromEntries(ids.map((id, i) => {
    const [name, state, current, target, action, preset] = ROOMS[id] || [`Room ${i}`, 'heat', 20, 20, 'idle', 'none'];
    return [id, {
        entity_id: id,
        state,
        attributes: {
            friendly_name: name, current_temperature: current, temperature: target, hvac_action: action,
            preset_mode: preset, preset_modes: ['none', 'comfort', 'eco', 'sleep'], target_temp_step: 0.5,
        },
    }];
}));

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

/**
 * Returns the request bodies sent so far.
 * @returns {Array<Object>} Request bodies.
 */
const bodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
const climateCalls = () => bodies().filter(b => b.endpoint === 'climate');

const rooms = Object.keys(ROOMS).map(entity_id => ({ entity_id }));

describe('Multiroom thermostat card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
            const body = JSON.parse(init.body);
            return jsonResponse(body.endpoint === 'states' ? states(body.entity_ids) : []);
        }));
    });

    afterEach(() => vi.unstubAllGlobals());

    it('loads every room in one request and shows them as rows when one wide', async () => {
        const { container } = render(<MultiThermostatCard config={{ id: 'c', rooms }} />);

        expect(await screen.findByText('Living Room')).toBeInTheDocument();
        expect(bodies().filter(b => b.endpoint === 'states')).toEqual([
            { endpoint: 'states', entity_ids: ['climate.living', 'climate.bedroom', 'climate.office'], service: 'homeassistant' },
        ]);
        expect(container.querySelectorAll('.mt-row')).toHaveLength(3);
        expect(screen.getByText('3 rooms · 1 heating')).toBeInTheDocument();
        expect(screen.getByText('Heating · 19.8° · Comfort')).toBeInTheDocument();
        expect(screen.getByText('Off', { selector: '.mt-value' })).toBeInTheDocument();
    });

    it('shows columns with a preset menu when two wide', async () => {
        const { container } = render(<MultiThermostatCard config={{ id: 'c', colSpan: 2, rooms }} />);
        await screen.findByText('Living Room');
        expect(container.querySelectorAll('.mt-col')).toHaveLength(3);

        fireEvent.click(screen.getByRole('button', { name: 'Bedroom preset: Sleep' }));
        const menu = screen.getByRole('menu', { name: 'Bedroom presets' });
        expect(within(menu).getAllByRole('menuitemradio').map(i => i.textContent)).toEqual(['Comfort', 'Eco', 'Sleep', 'Off']);
        expect(within(menu).getByRole('menuitemradio', { name: 'Sleep' })).toHaveFocus();

        fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Eco' }));
        expect(screen.queryByRole('menu')).toBeNull();
        await waitFor(() => expect(climateCalls()).toEqual([
            expect.objectContaining({ entity_id: 'climate.bedroom', action: 'set_preset_mode', preset_mode: 'eco' }),
        ]));
    });

    it('marks a temperature preset active when the target matches, whatever HA preset is set', async () => {
        render(<MultiThermostatCard config={{
            id: 'c', colSpan: 2,
            presets: [{ name: 'Warm', temperature: 21 }, { name: 'Saver', preset: 'eco' }],
            rooms: [{ entity_id: 'climate.living' }],
        }} />);
        expect(await screen.findByRole('button', { name: 'Living Room preset: Warm' })).toBeInTheDocument();
    });

    it('applies shared presets, with per-room overrides', async () => {
        render(<MultiThermostatCard config={{
            id: 'c', colSpan: 3,
            presets: [{ name: 'Warm', temperature: 22 }],
            rooms: [{ entity_id: 'climate.living' }, { entity_id: 'climate.bedroom', presets: [{ name: 'Cool', temperature: 16 }] }],
        }} />);
        await screen.findByText('Living Room');

        fireEvent.click(screen.getByRole('button', { name: /Living Room preset/ }));
        expect(screen.getAllByRole('menuitemradio').map(i => i.textContent)).toEqual(['Warm22°', 'Off']);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.getByRole('button', { name: /Living Room preset/ })).toHaveFocus();

        fireEvent.click(screen.getByRole('button', { name: /Bedroom preset/ }));
        expect(screen.getAllByRole('menuitemradio').map(i => i.textContent)).toEqual(['Cool16°', 'Off']);
    });

    it('steps the target, and turns an off room back on first', async () => {
        render(<MultiThermostatCard config={{ id: 'c', rooms }} />);
        await screen.findByText('Living Room');

        fireEvent.click(screen.getByRole('button', { name: 'Raise Living Room' }));
        expect(screen.getByText('21.5°', { selector: '.mt-value' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Raise Office' }));
        expect(screen.getByText('20.0°', { selector: '.mt-value' })).toBeInTheDocument();

        await waitFor(() => expect(climateCalls()).toHaveLength(2));
        expect(climateCalls().map(c => [c.entity_id, c.action, c.temperature ?? c.hvac_mode])).toEqual([
            ['climate.living', 'set_temperature', 21.5],
            ['climate.office', 'set_hvac_mode', 'heat'],
        ]);
    });

    it('opens the room presets from the row and turns a room off', async () => {
        render(<MultiThermostatCard config={{ id: 'c', rooms }} />);
        await screen.findByText('Living Room');

        fireEvent.click(screen.getByRole('button', { name: /^Living Room, Heating/ }));
        const menu = screen.getByRole('menu', { name: 'Living Room presets' });
        fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Off' }));
        await waitFor(() => expect(climateCalls()).toEqual([
            expect.objectContaining({ entity_id: 'climate.living', action: 'set_hvac_mode', hvac_mode: 'off' }),
        ]));
    });

    it('shows at most six rooms, in compact rows from five on', async () => {
        const many = Array.from({ length: 8 }, (_, i) => ({ entity_id: `climate.room_${i}` }));
        const { container } = render(<MultiThermostatCard config={{ id: 'c', rooms: many }} />);
        await screen.findByText('Room 0');

        expect(container.querySelectorAll('.mt-row.compact')).toHaveLength(6);
        expect(bodies()[0].entity_ids).toHaveLength(6);
    });

    it('asks for rooms when none are configured', () => {
        render(<MultiThermostatCard config={{ id: 'c' }} />);
        expect(screen.getByText(/Add up to 6 rooms/)).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });
});
