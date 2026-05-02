import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransmissionCard from './TransmissionCard';
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

        render(<TransmissionCard config={{ service: 'transmission' }} />);

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

        render(<TransmissionCard config={{ service: 'transmission' }} />);

        await waitFor(() => {
            expect(screen.getByText(/Error loading Transmission data/i)).toBeInTheDocument();
        });
    });
});
