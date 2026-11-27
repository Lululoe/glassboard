import ServerStatsCard from './ServerStatsCard';

/**
 * The Server Stats plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'serverstats',
    name: 'Server Stats',
    register(api) {
        api.registerCard('serverstats', {
            Component: ServerStatsCard,
            headerIcon: true,
            name: 'Server Stats',
            description: 'CPU, memory, storage, network and temperature',
            icon: 'lu-Gauge',
            defaults: { colSpan: 2, data: { sensors: ['cpu', 'ram', 'storage', 'network', 'temp'] } },
        });
    },
};

export default plugin;
