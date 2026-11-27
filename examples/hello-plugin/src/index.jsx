import HelloCard from './HelloCard';
import HelloEditor from './HelloEditor';

/**
 * The browser part of the Hello plugin. Its default export is the plugin; its id must match
 * `plugin.json`. `register` adds the card types, the same way Glassboard's own cards do.
 */
export default {
    id: 'hello',
    name: 'Hello',
    register(api) {
        api.registerCard('hello', {
            Component: HelloCard,
            name: 'Hello',
            description: 'A greeting from the server, from the example plugin',
            icon: 'lu-Hand',
            sizes: ['1', '2'],
            defaults: { name: '' },
            Editor: HelloEditor,
            headerIcon: true,
        });
    },
};
