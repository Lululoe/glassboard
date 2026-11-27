import { loadPlugins } from '../plugins/registry';
import appGrid from './AppGrid/plugin';
import container from './Container/plugin';
import git from './Git/plugin';
import graph from './Graph/plugin';
import entity from './HomeAssistant/plugin';
import media from './Media/plugin';
import mediaPlayer from './MediaPlayer/plugin';
import proxmox from './Proxmox/plugin';
import serverStats from './ServerStats/plugin';
import spacer from './Spacer/plugin';
import thermostat from './Thermostat/plugin';
import transmission from './Transmission/plugin';
import vacuum from './Vacuum/plugin';
import weather from './Weather/plugin';

/**
 * The plugins built into Glassboard. Each feature folder has a `plugin.js` that registers its
 * card types the same way a plugin from outside would. To add a card, create it under
 * `src/features/<Name>/` with a `plugin.js`, and list the plugin here.
 * @type {import('../plugins/registry').GlassboardPlugin[]}
 */
export const builtinPlugins = [
    weather,
    entity,
    thermostat,
    graph,
    vacuum,
    appGrid,
    mediaPlayer,
    media,
    transmission,
    serverStats,
    proxmox,
    git,
    container,
    spacer,
];

// A plugin that fails is skipped and listed in the settings window. Hot module reloading runs
// this again with the edited plugins, which then replace the old ones.
loadPlugins(builtinPlugins, { replace: Boolean(import.meta.hot), builtIn: true });

export {
    getCardComponent, getCardInfo, getCardSizes, getCardTypes, getPluginFailures, getPlugins, useCardTypes, usePluginFailures, usePlugins,
} from '../plugins/registry';
