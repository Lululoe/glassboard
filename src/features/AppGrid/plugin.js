import AppGridCard from './AppGridCard';
import AppGridEditor from './AppGridEditor';
import { AppGridInspector, AppGridStage } from '../../components/Editor/icons/AppGridStage';

/**
 * The App Grid plugin: its card type and how edit mode shows it.
 * @type {import('../../plugins/registry').GlassboardPlugin}
 */
const plugin = {
    id: 'appgrid',
    name: 'App Grid',
    register(api) {
        api.registerCard('appgrid', {
            Component: AppGridCard,
            name: 'App Grid',
            description: 'Shortcuts to your apps with online status',
            icon: 'lu-LayoutGrid',
            Editor: AppGridEditor,
            stage: { Stage: AppGridStage, Inspector: AppGridInspector, split: true },
        });
    },
};

export default plugin;
