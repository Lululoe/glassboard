import GraphCard from './GraphCard';
import GraphEditor from './GraphEditor';

/**
 * The Graph plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'graph',
    name: 'Graph',
    register(api) {
        api.registerCard('graph', {
            Component: GraphCard,
            headerIcon: true,
            name: 'Graph',
            description: 'History of Home Assistant sensors as lines, bars or this week vs last',
            icon: 'lu-ChartLine',
            defaults: { entities: [] },
            Editor: GraphEditor,
        });
    },
};

export default plugin;
