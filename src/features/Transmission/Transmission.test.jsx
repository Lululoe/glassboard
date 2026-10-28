import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransmissionCard from './TransmissionCard';
import { determineState } from './useTransmission';
import React from 'react';

// Mock fetch global
global.fetch = vi.fn();

const mockTorrents = {
    torrents: [
        { id: 1, name: 'Ubuntu.iso', progress: 100, status: 6, size: '2 GB', speedDown: 0, speedUp: 1000 },
        { id: 2, name: 'Debian.iso', progress: 50, status: 4, size: '1 GB', speedDown: 500000, speedUp: 0 }
    ],
    totalRateDown: 500000,
    totalRateUp: 1000,
    totalCount: 2
};

describe('Transmission Feature', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders torrents after fetching from API', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => mockTorrents
        });

        render(<TransmissionCard config={{ id: 'transmission' }} />);

        // Wait for torrents to appear
        await waitFor(() => {
            expect(screen.getByText('Ubuntu.iso')).toBeInTheDocument();
        });

        expect(screen.getByText('Debian.iso')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();

        // Check if API was called correctly
        expect(fetch).toHaveBeenCalledWith('/api', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"service":"transmission"')
        }));
    });

    it('handles error state', async () => {
        fetch.mockRejectedValueOnce(new Error('API Error'));

        render(<TransmissionCard config={{ id: 'transmission' }} />);

        await waitFor(() => {
            expect(screen.getByText(/Error loading Transmission data/i)).toBeInTheDocument();
        });
    });

    it('names stalled downloads and errors instead of only coloring them', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                torrents: [
                    { id: 1, name: 'stuck.iso', progress: 30, status: 4, isStalled: true },
                    { id: 2, name: 'broken.iso', progress: 10, status: 0, error: 'No data found' },
                ],
                totalCount: 2,
            }),
        });

        const { container } = render(<TransmissionCard config={{ id: 'transmission' }} />);

        await waitFor(() => expect(screen.getByText('Stalled')).toBeInTheDocument());
        expect(screen.getByText('No data found')).toBeInTheDocument();
        expect(container.querySelector('.progress-fill.stalled')).toBeInTheDocument();
        expect(container.querySelector('.progress-fill.error')).toBeInTheDocument();
    });

    it('only treats stalled downloads as a problem, not stalled seeds', () => {
        expect(determineState({ status: 4, isStalled: true })).toBe('stalled');
        expect(determineState({ status: 6, isStalled: true })).toBe('seeding');
        expect(determineState({ status: 4, error: 'Tracker gave an error' })).toBe('error');
        expect(determineState({ status: 4 })).toBe('downloading');
    });
});
