import MediaPlayerCard from './MediaPlayerCard';
import MediaPlayerEditor from './MediaPlayerEditor';

/**
 * The Media Player plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'mediaplayer',
    name: 'Media Player',
    register(api) {
        api.registerCard('mediaplayer', {
            Component: MediaPlayerCard,
            name: 'Media Player',
            description: 'Now playing, controls and speakers for Home Assistant players',
            icon: 'lu-Music',
            sizes: ['quarter', 'half', '1'],
            defaults: { entities: [] },
            Editor: MediaPlayerEditor,
        });
    },
};

export default plugin;
