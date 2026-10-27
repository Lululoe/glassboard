import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MediaCard from './MediaCard';
import React from 'react';

// Mock fetch global
global.fetch = vi.fn();

const mockEvents = [
    {
        id: 1,
        type: 'sonarr',
        title: 'Breaking Bad',
        secondary: '5x14',
        datetime: new Date().toISOString(), // Today
        status: 'upcoming',
        hasFile: false
    },
    {
        id: 2,
        type: 'radarr',
        title: 'Inception',
        secondary: '2010',
        datetime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        status: 'downloaded',
        hasFile: true
    }
];

describe('Media Feature', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders upcoming media events', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => mockEvents
        });

        render(<MediaCard config={{ id: 'media', colSpan: 1 }} />);

        // Wait for events to load using unique text
        await waitFor(() => {
            expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
        });

        expect(screen.getByText('5x14')).toBeInTheDocument();
        expect(screen.getByText('Inception')).toBeInTheDocument();

        // Check grouping headers (logic in component depends on current date)
        // Ideally we should mock system time to be deterministic, but "Today" should always be present if we use new Date()
        expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('requests the next range when navigating days', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => [] });

        render(<MediaCard config={{ id: 'media', colSpan: 1 }} />);
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const firstStart = JSON.parse(fetch.mock.calls[0][1].body).start;

        fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

        const nextStart = JSON.parse(fetch.mock.calls[1][1].body).start;
        expect(new Date(nextStart) - new Date(firstStart)).toBe(86400000);
    });
});
