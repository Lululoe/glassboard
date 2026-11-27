import VacuumCard from './VacuumCard';
import VacuumsCard from './VacuumsCard';
import { VacuumEditor, VacuumsEditor } from './VacuumEditor';

/**
 * The Vacuum plugin: its card types and how edit mode shows them.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'vacuum',
    name: 'Vacuum',
    register(api) {
        api.registerCard('vacuum', {
            Component: VacuumCard,
            headerIcon: true,
            name: 'Vacuum',
            description: 'Start, rooms, fan speed, map, camera and consumables of one robot',
            icon: 'mdi:robot-vacuum',
            sizes: ['half', '1', '2', '3'],
            defaults: { entity_id: '' },
            Editor: VacuumEditor,
        });
        api.registerCard('vacuums', {
            Component: VacuumsCard,
            headerIcon: true,
            name: 'Multiple Vacuums',
            description: 'Control all your robots together, with details for each',
            icon: 'mdi:robot-vacuum-variant',
            defaults: { robots: [] },
            Editor: VacuumsEditor,
        });
    },
};

export default plugin;
