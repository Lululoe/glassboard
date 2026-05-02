import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeatherCard from './WeatherCard';
import React from 'react';

// Mock fetch global
window.fetch = vi.fn();

const mockConfig = {
    service: 'weather',
    entity_id: 'weather.home'
};

const mockWeather = {
    "weather.home": {
        forecast: [
            { datetime: '2023-10-25T12:00:00', condition: 'sunny', temperature: 20, templow: 10, precipitation: 0 },
            { datetime: '2023-10-26T12:00:00', condition: 'rainy', temperature: 18, templow: 12, precipitation: 50 }
        ]
    }
};

describe('Weather Feature', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders weather forecast', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => mockWeather
        });

        render(<WeatherCard config={mockConfig} />);

        await waitFor(() => {
            expect(screen.getByText('Today')).toBeInTheDocument();
        });

        expect(screen.getByText('20°')).toBeInTheDocument();
        expect(screen.getByText('10°')).toBeInTheDocument();
        // Check condition text (might appear multiple times, e.g. header + day)
        expect(screen.getAllByText('sunny').length).toBeGreaterThan(0);
    });
});
