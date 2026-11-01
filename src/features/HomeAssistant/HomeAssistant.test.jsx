import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HAControlCard from './HAControlCard';

const mockConfig = {
    id: 'lights',
    data: {
        entities: [
            {
                entity_id: 'light.living_room',
                name: 'Living Room',
                icon: 'Lightbulb',
                on_state: 'on',
                off_state: 'off',
                on_action: { service: 'light.turn_on' },
                off_action: { service: 'light.turn_off' },
            },
        ],
    },
};

const jsonResponse = (body, ok = true) => ({ ok, status: ok ? 200 : 403, json: async () => body });

/**
 * Returns the parsed bodies of all mocked fetch calls.
 * @returns {Array<Object>} Request bodies.
 */
const requestBodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

describe('Home Assistant card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('loads all entity states in one request', async () => {
        fetch.mockResolvedValue(jsonResponse({ 'light.living_room': { state: 'on', attributes: {} } }));

        render(<HAControlCard config={mockConfig} />);

        expect(await screen.findByText('on')).toBeInTheDocument();
        expect(requestBodies()[0]).toEqual({
            service: 'homeassistant', endpoint: 'states', entity_ids: ['light.living_room'], icons: true,
        });
    });

    it('calls the configured action and shows the new state optimistically', async () => {
        fetch.mockResolvedValueOnce(jsonResponse({ 'light.living_room': { state: 'off', attributes: {} } }));
        render(<HAControlCard config={mockConfig} />);
        await screen.findByText('off');

        fetch.mockResolvedValueOnce(jsonResponse([]));
        fireEvent.click(screen.getByRole('button', { name: 'Living Room: Off' }));

        expect(await screen.findByText('on')).toBeInTheDocument();
        expect(requestBodies()[1]).toEqual({
            service: 'homeassistant', endpoint: 'services', entity_id: 'light.living_room', action: 'light.turn_on',
        });
    });

    it('reverts the optimistic state when the action fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetch.mockResolvedValueOnce(jsonResponse({ 'light.living_room': { state: 'off', attributes: {} } }));
        render(<HAControlCard config={mockConfig} />);
        await screen.findByText('off');

        fetch.mockResolvedValueOnce(jsonResponse({ error: 'Action not authorized' }, false));
        fireEvent.click(screen.getByRole('button', { name: 'Living Room: Off' }));

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('off')).toBeInTheDocument();
        console.error.mockRestore();
    });

    it('shows as many entities as fit the tile size', async () => {
        const entities = ['a', 'b', 'c', 'd', 'e'].map(n => ({ entity_id: `light.${n}`, name: `Light ${n}` }));
        fetch.mockResolvedValue(jsonResponse({}));

        const { rerender, container } = render(<HAControlCard config={{ id: 'l', tileSize: 'quarter', data: { entities } }} />);
        expect(container.querySelectorAll('.ha-tile')).toHaveLength(1);
        expect(container.querySelector('.ha-control-card')).toHaveClass('tile-quarter');

        rerender(<HAControlCard config={{ id: 'l', tileSize: 'half', data: { entities } }} />);
        expect(container.querySelectorAll('.ha-tile')).toHaveLength(2);

        rerender(<HAControlCard config={{ id: 'l', colSpan: 2, data: { entities } }} />);
        expect(container.querySelectorAll('.ha-tile')).toHaveLength(5);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
    });

    it("shows Home Assistant's icon unless the card sets one", async () => {
        fetch.mockResolvedValue(jsonResponse({
            'light.a': { state: 'on', attributes: {}, icon: 'mdi:ceiling-light' },
            'light.b': { state: 'off', attributes: {}, icon: 'mdi:lightbulb-off' },
        }));
        const entities = [{ entity_id: 'light.a', name: 'A' }, { entity_id: 'light.b', name: 'B', icon: 'lamp' }];
        render(<HAControlCard config={{ id: 'i', data: { entities } }} />);

        expect(await screen.findByRole('img', { name: 'ceiling-light' })).toBeInTheDocument();
        // The configured icon wins
        expect(screen.queryByRole('img', { name: 'lightbulb-off' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'B: Off' }).querySelector('svg.lucide')).toBeInTheDocument();
    });

    it('keeps toggling the whole tile for entities without a dialog', async () => {
        fetch.mockResolvedValue(jsonResponse({ 'script.movie': { state: 'off', attributes: {} } }));
        const entities = [{ entity_id: 'script.movie', name: 'Movie', on_action: { service: 'script.turn_on' }, off_action: { service: 'script.turn_off' } }];
        render(<HAControlCard config={{ id: 's', data: { entities } }} />);
        await screen.findByText('off');

        fireEvent.click(screen.getByRole('button', { name: /Movie/ }));
        await waitFor(() => expect(requestBodies().some(b => b.action === 'script.turn_on')).toBe(true));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

const LIGHT_DETAILS = {
    entity: {
        state: 'on',
        attributes: { friendly_name: 'Pendant', supported_color_modes: ['color_temp'], color_mode: 'color_temp', brightness: 128, color_temp_kelvin: 2700 },
    },
    members: {},
};

const GROUP_DETAILS = {
    entity: { state: 'on', attributes: { entity_id: ['light.lamp', 'light.shelf'] } },
    members: {
        'light.lamp': { state: 'on', attributes: { friendly_name: 'Lamp', supported_color_modes: ['hs', 'color_temp'], color_mode: 'hs', hs_color: [24, 85], brightness: 255 } },
        'light.shelf': { state: 'off', attributes: { friendly_name: 'Shelf', supported_color_modes: ['onoff'] } },
    },
};

/**
 * Answers the card's requests: states for the tiles, details for the dialog, and [] for changes.
 * @param {Object} details - Response of the details endpoint.
 */
const mockBackend = (details) => {
    fetch.mockImplementation(async (_url, init) => {
        const body = JSON.parse(init.body);
        if (body.endpoint === 'states') return jsonResponse({ [body.entity_ids[0]]: { state: 'on', attributes: {} } });
        if (body.endpoint === 'details') return jsonResponse(details);
        return jsonResponse([]);
    });
};

describe('Home Assistant control dialog', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    });

    afterEach(() => {
        delete HTMLDialogElement.prototype.showModal;
    });

    it('opens from the tile and switches from the icon', async () => {
        mockBackend(LIGHT_DETAILS);
        const entities = [{ entity_id: 'light.pendant', name: 'Pendant' }];
        render(<HAControlCard config={{ id: 'l', data: { entities } }} />);
        await screen.findByText('on');

        fireEvent.click(screen.getByRole('button', { name: 'Pendant: On' }));
        await waitFor(() => expect(requestBodies()).toContainEqual({
            service: 'homeassistant', endpoint: 'control', entity_ids: ['light.pendant'], action: 'turn_off',
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Show controls/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Pendant' });
        expect(await screen.findByRole('slider', { name: 'Brightness' })).toHaveAttribute('aria-valuenow', '50');
        expect(screen.getByRole('slider', { name: 'Temperature' })).toHaveAttribute('aria-valuetext', '2700 K');
        // White lights get white presets only, and no color sliders
        expect(screen.getByRole('button', { name: 'Warm' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', { name: 'Sunset' })).not.toBeInTheDocument();
        expect(screen.queryByRole('slider', { name: 'Hue' })).not.toBeInTheDocument();
        expect(dialog).not.toHaveTextContent(/Tap to/);

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('changes brightness and color right away and sends them', async () => {
        mockBackend(LIGHT_DETAILS);
        render(<HAControlCard config={{ id: 'l', data: { entities: [{ entity_id: 'light.pendant', name: 'Pendant' }] } }} />);
        fireEvent.click(await screen.findByRole('button', { name: /Show controls/ }));
        const brightness = await screen.findByRole('slider', { name: 'Brightness' });

        fireEvent.keyDown(brightness, { key: 'ArrowRight' });
        expect(brightness).toHaveAttribute('aria-valuenow', '51');
        expect(requestBodies()).toContainEqual({
            service: 'homeassistant', endpoint: 'control', entity_ids: ['light.pendant'], action: 'turn_on', brightness_pct: 51,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Daylight' }));
        expect(screen.getByRole('button', { name: 'Daylight' })).toHaveAttribute('aria-pressed', 'true');
        expect(requestBodies()).toContainEqual({
            service: 'homeassistant', endpoint: 'control', entity_ids: ['light.pendant'], action: 'turn_on', color_temp_kelvin: 6500,
        });
    });

    it('lists group members and controls them together or one by one', async () => {
        mockBackend(GROUP_DETAILS);
        render(<HAControlCard config={{ id: 'l', data: { entities: [{ entity_id: 'group.living_room', name: 'Living Room' }] } }} />);
        fireEvent.click(await screen.findByRole('button', { name: /Show controls/ }));

        expect(await screen.findByText('2 lights · 1 of 2 on')).toBeInTheDocument();
        // The first light that is on is shown, with its color controls
        expect(within(screen.getByRole('list', { name: 'Lights' })).getByRole('button', { name: /Lamp/ })).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('slider', { name: 'Hue' })).toHaveAttribute('aria-valuetext', '24°');

        // A light that only switches gets one power button and no sliders in its pane
        fireEvent.click(within(screen.getByRole('list', { name: 'Lights' })).getByRole('button', { name: /Shelf/ }));
        expect(screen.getByRole('button', { name: 'Shelf: Off' })).toHaveClass('big');
        expect(screen.queryByRole('slider', { name: 'Hue' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('switch', { name: 'All Living Room lights' }));
        expect(screen.getByRole('switch', { name: 'All Living Room lights' })).toHaveAttribute('aria-checked', 'false');
        expect(requestBodies()).toContainEqual({
            service: 'homeassistant', endpoint: 'control', entity_ids: ['light.lamp', 'light.shelf'], action: 'turn_off',
        });
    });
});
