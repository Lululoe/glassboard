import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HAControlCard from './HAControlCard';
import React from 'react';

// Mock fetch global
global.fetch = vi.fn();

const mockConfig = {
    service: 'homeassistant',
    data: {
        entities: [
            {
                entity_id: 'light.living_room',
                name: 'Living Room',
                icon: 'Lightbulb',
                on_state: 'on',
                off_state: 'off',
                on_action: { service: 'light.turn_on' },
                off_action: { service: 'light.turn_off' }
            }
        ]
    }
};

const mockStateOn = { state: 'on', attributes: { brightness: 255 } };
const mockStateOff = { state: 'off', attributes: { brightness: 0 } };

describe('Home Assistant Feature', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders entity state', async () => {
        // Mock fetch state
        fetch.mockResolvedValue({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => mockStateOn
        });

        render(<HAControlCard config={mockConfig} />);

        await waitFor(() => {
            expect(screen.getByText('Living Room')).toBeInTheDocument();
            expect(screen.getByText('on')).toBeInTheDocument(); // Formatted state might differ?
            // "100%" brightness check?
            // The card logic: formatAttributeValue -> brightness / 255 * 100
        });

        // Wait for async state update
    });

    it('toggles entity on click', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockStateOff
        });

        render(<HAControlCard config={mockConfig} />);

        const tile = await screen.findByText('Living Room');
        fireEvent.click(tile);

        // Expect fetch to be called for action
        // Mock needs to handle the state fetch first, then the action call.
        // But fetch is called immediately on mount.

        // We can check if second call matches action

        // Let's refine mock to handle multiple calls if needed or just expect "any call" with correct params

        // Wait for click handler logic
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                '/api?service=homeassistant',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"service":"light.turn_on"')
                })
            );
        });
    });
});
