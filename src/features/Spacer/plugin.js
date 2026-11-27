import SpacerCard from './SpacerCard';

/**
 * The Empty Space plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'spacer',
    name: 'Empty Space',
    register(api) {
        api.registerCard('spacer', {
            Component: SpacerCard,
            name: 'Empty Space',
            description: 'Invisible placeholder to shape the layout',
            icon: 'lu-SquareDashed',
            sizes: ['quarter', 'half', '1', '2', '3'],
            defaults: { hideOn: ['phone'] },
        });
    },
};

export default plugin;
