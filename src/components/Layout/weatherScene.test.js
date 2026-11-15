import { describe, expect, it } from 'vitest';
import { weatherScene } from './weatherScene';

describe('weatherScene', () => {
    it('rains for rain, drizzle and storms, as heavily as the condition says', () => {
        expect(weatherScene({ condition: 'Light rain', isDay: true })).toMatchObject({ effect: 'rain', intensity: 0.4 });
        expect(weatherScene({ condition: 'Rain showers', isDay: true })).toMatchObject({ effect: 'rain', intensity: 0.7 });
        expect(weatherScene({ condition: 'Heavy rain', isDay: true })).toMatchObject({ effect: 'rain', intensity: 1 });
        expect(weatherScene({ condition: 'Drizzle', isDay: true })).toMatchObject({ effect: 'rain', intensity: 0.35 });
        expect(weatherScene({ condition: 'Thunderstorm', isDay: true })).toMatchObject({ effect: 'rain', intensity: 1 });
    });

    it('snows for snow', () => {
        expect(weatherScene({ condition: 'Heavy snow showers', isDay: true })).toMatchObject({ effect: 'snow', intensity: 1 });
        expect(weatherScene({ condition: 'Snow grains', isDay: true })).toMatchObject({ effect: 'snow', intensity: 0.4 });
    });

    it('shows the sun when it is clear or partly cloudy, with the clouds there are', () => {
        expect(weatherScene({ condition: 'Clear', isDay: true, cloudCover: 5 })).toEqual({ effect: 'sun', intensity: 0, clouds: 0.05, night: false, fog: false });
        expect(weatherScene({ condition: 'Partly cloudy', isDay: true, cloudCover: 50 })).toMatchObject({ effect: 'sun', clouds: 0.5 });
        expect(weatherScene({ condition: 'Clear', isDay: false })).toMatchObject({ effect: 'sun', night: true });
    });

    it('covers the sky when it is overcast or foggy', () => {
        expect(weatherScene({ condition: 'Overcast', isDay: true, cloudCover: 100 })).toMatchObject({ effect: 'cover', clouds: 1, fog: false });
        expect(weatherScene({ condition: 'Fog', isDay: true })).toMatchObject({ effect: 'cover', fog: true });
    });

    it('shows a fixed effect whatever the weather, and nothing without weather', () => {
        expect(weatherScene({ condition: 'Clear' }, 'snow')).toMatchObject({ effect: 'snow' });
        expect(weatherScene(null, 'rain')).toMatchObject({ effect: 'rain' });
        expect(weatherScene(null)).toBeNull();
        expect(weatherScene({})).toBeNull();
    });
});
