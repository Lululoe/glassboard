import WeatherCard from './WeatherCard';
import WeatherEditor from './WeatherEditor';

/**
 * The Weather plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'weather',
    name: 'Weather',
    register(api) {
        api.registerCard('weather', {
            Component: WeatherCard,
            headerIcon: true,
            name: 'Weather',
            description: 'Daily or hourly forecast for a place',
            icon: 'lu-CloudSun',
            defaults: { colSpan: 2, location: 'Berlin' },
            Editor: WeatherEditor,
        });
    },
};

export default plugin;
