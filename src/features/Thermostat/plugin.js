import MultiThermostatCard from './MultiThermostatCard';
import MultiThermostatEditor from './MultiThermostatEditor';
import ThermostatCard from './ThermostatCard';
import ThermostatEditor from './ThermostatEditor';

/**
 * The Thermostat plugin: its card types and how edit mode shows them.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'thermostat',
    name: 'Thermostat',
    register(api) {
        api.registerCard('thermostat', {
            Component: ThermostatCard,
            name: 'Single Thermostat',
            description: 'Target temperature, presets and on/off for one climate entity',
            icon: 'lu-Thermometer',
            sizes: ['quarter', 'half', '1'],
            defaults: { entity_id: '' },
            Editor: ThermostatEditor,
        });
        api.registerCard('thermostats', {
            Component: MultiThermostatCard,
            headerIcon: true,
            name: 'Multiroom Thermostat',
            description: 'Targets, presets and on/off for up to six rooms',
            icon: 'lu-Heater',
            defaults: { colSpan: 2, rooms: [] },
            Editor: MultiThermostatEditor,
        });
    },
};

export default plugin;
