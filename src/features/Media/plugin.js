import MediaCard from './MediaCard';

/**
 * The Media Calendar plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'media',
    name: 'Media Calendar',
    register(api) {
        api.registerCard('media', {
            Component: MediaCard,
            headerIcon: true,
            name: 'Media Calendar',
            description: 'Upcoming episodes and movies from Sonarr and Radarr',
            icon: 'lu-Tv',
            defaults: { colSpan: 2 },
        });
    },
};

export default plugin;
