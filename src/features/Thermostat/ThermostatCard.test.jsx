import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import ThermostatCard from './ThermostatCard';

const climate = (overrides = {}, attributes = {}) => ({
    'climate.living': {
        entity_id: 'climate.living',
        state: 'heat',
        attributes: {
            friendly_name: 'Living Room',
            current_temperature: 19.8,
            temperature: 21,
            hvac_action: 'heating',
            preset_mode: 'comfort',
            preset_modes: ['none', 'comfort', 'eco', 'away'],
            min_temp: 7,
            max_temp: 30,
            target_temp_step: 0.5,
            ...attributes,
        },
        ...overrides,
    },
});

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

/**
 * Returns the climate actions sent so far.
 * @returns {Array<Object>} Request bodies of climate calls.
 */
const climateCalls = () => fetch.mock.calls
    .map(([, init]) => JSON.parse(init.body))
    .filter(body => body.endpoint === 'climate');

describe('Thermostat card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
            const body = JSON.parse(init.body);
            return jsonResponse(body.endpoint === 'states' ? climate() : []);
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('shows target, room temperature, state and the Home Assistant presets', async () => {
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living' }} />);

        expect(await screen.findByText('21.0°')).toBeInTheDocument();
        expect(screen.getByText('Now 19.8°')).toBeInTheDocument();
        expect(screen.getByText('Heating')).toBeInTheDocument();
        const presets = screen.getAllByRole('button').map(b => b.textContent);
        expect(presets).toEqual(['Comfort', 'Eco', 'Away', 'Off']);
        expect(screen.getByRole('button', { name: 'Comfort' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('uses presets from the card config instead', async () => {
        render(<ThermostatCard config={{
            id: 't', entity_id: 'climate.living',
            presets: [{ name: 'Cozy', temperature: 22, icon: 'Sun' }, { name: 'Saver', preset: 'eco' }],
        }} />);

        await screen.findByText('21.0°');
        expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Cozy22°', 'Saver', 'Off']);

        fireEvent.click(screen.getByRole('button', { name: /Cozy/ }));
        expect(screen.getByText('22.0°')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Saver' }));
        await waitFor(() => expect(climateCalls()).toHaveLength(2));
        expect(climateCalls()).toEqual([
            { endpoint: 'climate', entity_id: 'climate.living', action: 'set_temperature', temperature: 22, service: 'homeassistant' },
            { endpoint: 'climate', entity_id: 'climate.living', action: 'set_preset_mode', preset_mode: 'eco', service: 'homeassistant' },
        ]);
    });

    it('turns off with the Off preset and back on before applying a preset', async () => {
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living', tileSize: 'half' }} />);
        await screen.findByText('21.0°');

        fireEvent.click(screen.getByRole('button', { name: 'Off' }));
        expect(screen.getByText('Off', { selector: '.thermo-target' })).toBeInTheDocument();
        await waitFor(() => expect(climateCalls()).toHaveLength(1));

        fireEvent.click(screen.getByRole('button', { name: 'Eco' }));
        await waitFor(() => expect(climateCalls()).toHaveLength(3));
        expect(climateCalls().map(c => [c.action, c.hvac_mode ?? c.preset_mode])).toEqual([
            ['set_hvac_mode', 'off'], ['set_hvac_mode', 'heat'], ['set_preset_mode', 'eco'],
        ]);
    });

    it('toggles on and off when the quarter tile is tapped', async () => {
        fetch.mockImplementation(async (_url, init) => jsonResponse(
            JSON.parse(init.body).endpoint === 'states' ? climate({ state: 'off' }, { hvac_action: 'off' }) : [],
        ));
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living', tileSize: 'quarter', hvac_mode: 'heat_cool' }} />);

        const tile = await screen.findByRole('button', { name: /Living Room, off/ });
        expect(tile).toHaveTextContent('Off · 19.8°');
        fireEvent.click(tile);
        expect(screen.getByRole('button', { name: /Living Room, on, 21.0°/ })).toBeInTheDocument();
        await waitFor(() => expect(climateCalls()[0]).toMatchObject({ action: 'set_hvac_mode', hvac_mode: 'heat_cool' }));
    });

    it('sets the target from the keyboard after a short pause', async () => {
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living' }} />);
        const slider = await screen.findByRole('slider');
        vi.useFakeTimers();

        fireEvent.keyDown(slider, { key: 'ArrowUp' });
        fireEvent.keyDown(slider, { key: 'ArrowUp' });
        expect(slider).toHaveAttribute('aria-valuetext', '22.0°');
        expect(climateCalls()).toHaveLength(0);

        await act(async () => { vi.advanceTimersByTime(700); });
        expect(climateCalls()).toEqual([expect.objectContaining({ action: 'set_temperature', temperature: 22 })]);
    });

    it('previews while dragging the slider and sends the target once on release', async () => {
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living' }} />);
        const slider = await screen.findByRole('slider');
        // 7–30° over 230px: every 10px is 1°
        slider.getBoundingClientRect = () => ({ top: 0, bottom: 230, left: 0, right: 92, height: 230, width: 92 });

        fireEvent.pointerDown(slider, { pointerId: 1, button: 0, clientY: 100 });
        fireEvent.pointerMove(slider, { pointerId: 1, clientY: 60 });
        fireEvent.pointerMove(slider, { pointerId: 1, clientY: 50 });
        expect(screen.getByText('25.0°')).toBeInTheDocument();
        expect(climateCalls()).toHaveLength(0);

        fireEvent.pointerUp(slider, { pointerId: 1, clientY: 50 });
        await waitFor(() => expect(climateCalls()).toEqual([expect.objectContaining({ action: 'set_temperature', temperature: 25 })]));
    });

    it('explains a missing or unavailable entity', async () => {
        const { unmount } = render(<ThermostatCard config={{ id: 't' }} />);
        expect(screen.getByText(/Set a climate entity_id/)).toBeInTheDocument();
        unmount();

        fetch.mockImplementation(async () => jsonResponse(climate({ state: 'unavailable' })));
        render(<ThermostatCard config={{ id: 't', entity_id: 'climate.living' }} />);
        expect(await screen.findByText('Living Room is unavailable')).toBeInTheDocument();
    });
});
