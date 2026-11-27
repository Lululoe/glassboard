import TransmissionCard from './TransmissionCard';

/**
 * The Transmission plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'transmission',
    name: 'Transmission',
    register(api) {
        api.registerCard('transmission', {
            Component: TransmissionCard,
            headerIcon: true,
            name: 'Transmission',
            description: 'Active downloads and transfer speeds',
            icon: 'lu-Download',
            defaults: { colSpan: 2 },
        });
    },
};

export default plugin;
