import ContainerCard from './ContainerCard';
import ContainerEditor from './ContainerEditor';

/**
 * The Container plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'container',
    name: 'Container',
    register(api) {
        api.registerCard('container', {
            Component: ContainerCard,
            name: 'Container',
            description: 'Groups several cards in one panel, drawn a little smaller',
            icon: 'lu-Group',
            rows: true,
            defaults: { colSpan: 2, cards: [] },
            Editor: ContainerEditor,
        });
    },
};

export default plugin;
