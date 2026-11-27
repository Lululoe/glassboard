import HAControlCard from './HAControlCard';
import HAControlEditor from './HAControlEditor';

/**
 * The Entity plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'entity',
    name: 'Entity',
    register(api) {
        api.registerCard('hacontrol', {
            Component: HAControlCard,
            name: 'Entity',
            description: 'A light, plug, fan or cover as a quarter tile',
            icon: 'lu-Lightbulb',
            sizes: ['quarter'],
            defaults: { tileSize: 'quarter', data: { entities: [{}] } },
            Editor: HAControlEditor,
        });
    },
};

export default plugin;
