import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
            service: 'homeassistant', endpoint: 'states', entity_ids: ['light.living_room'],
        });
    });

    it('calls the configured action and shows the new state optimistically', async () => {
        fetch.mockResolvedValueOnce(jsonResponse({ 'light.living_room': { state: 'off', attributes: {} } }));
        render(<HAControlCard config={mockConfig} />);
        await screen.findByText('off');

        fetch.mockResolvedValueOnce(jsonResponse([]));
        fireEvent.click(screen.getByText('Living Room'));

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
        fireEvent.click(screen.getByText('Living Room'));

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
});
