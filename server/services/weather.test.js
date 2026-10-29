// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setConfig } from '../config.js';
import { clearWeatherCache, describeWeatherCode, handleWeatherRequest } from './weather.js';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

const dailyResponse = {
    utc_offset_seconds: 3600,
    daily: {
        time: ['2026-10-27', '2026-10-28'],
        weather_code: [0, 63],
        temperature_2m_max: [14.2, 11],
        temperature_2m_min: [4.8, 6],
        precipitation_probability_max: [0, 80],
    },
};

describe('Weather service', () => {
    beforeEach(() => {
        clearWeatherCache();
        setConfig({
            pages: [{
                cards: [
                    { id: 'coords', type: 'weather', latitude: 52.52, longitude: 13.41 },
                    { id: 'named', type: 'weather', location: 'Berlin', units: 'imperial' },
                    { id: 'empty', type: 'weather' },
                    { id: 'other', type: 'proxmox' },
                ],
            }],
        });
        vi.stubGlobal('fetch', vi.fn(async (url) => okResponse(
            url.includes('geocoding') ? { results: [{ latitude: 52.5, longitude: 13.4 }] } : dailyResponse)));
    });

    it('validates the request', async () => {
        await expect(handleWeatherRequest({})).rejects.toMatchObject({ status: 400 });
        await expect(handleWeatherRequest({ cardId: 'coords', type: 'weekly' })).rejects.toMatchObject({ status: 400 });
        await expect(handleWeatherRequest({ cardId: 'other' })).rejects.toMatchObject({ status: 404 });
        await expect(handleWeatherRequest({ cardId: 'empty' })).rejects.toMatchObject({ status: 400 });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('normalizes the daily forecast and caches it', async () => {
        const result = await handleWeatherRequest({ cardId: 'coords' });
        expect(result.units).toBe('metric');
        expect(result.forecast[1]).toEqual({
            datetime: '2026-10-28T12:00:00+01:00', condition: 'Rain', temperature: 11, templow: 6, precipitation: 80,
        });
        const url = new URL(fetch.mock.calls[0][0]);
        expect(url.searchParams.get('latitude')).toBe('52.52');
        expect(url.searchParams.get('temperature_unit')).toBe('celsius');

        await handleWeatherRequest({ cardId: 'coords' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('geocodes location names and honors imperial units', async () => {
        await handleWeatherRequest({ cardId: 'named' });
        expect(fetch.mock.calls[0][0]).toContain('geocoding-api.open-meteo.com');
        const url = new URL(fetch.mock.calls[1][0]);
        expect(url.searchParams.get('latitude')).toBe('52.5');
        expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
    });

    it('maps upstream failures to 502', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
        await expect(handleWeatherRequest({ cardId: 'coords' })).rejects.toMatchObject({ status: 502 });
    });

    it('describes WMO codes', () => {
        expect(describeWeatherCode(2)).toBe('Partly cloudy');
        expect(describeWeatherCode(1234)).toBe('Unknown');
    });
});
