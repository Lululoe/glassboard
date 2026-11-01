import AppGridCard from './AppGrid/AppGridCard';
import AppGridEditor from './AppGrid/AppGridEditor';
import { AppGridInspector, AppGridStage } from '../components/Editor/icons/AppGridStage';
import GitCard from './Git/GitCard';
import GraphCard from './Graph/GraphCard';
import GraphEditor from './Graph/GraphEditor';
import HAControlCard from './HomeAssistant/HAControlCard';
import HAControlEditor from './HomeAssistant/HAControlEditor';
import MediaCard from './Media/MediaCard';
import MediaPlayerCard from './MediaPlayer/MediaPlayerCard';
import MediaPlayerEditor from './MediaPlayer/MediaPlayerEditor';
import PrinterCard from './Printer/PrinterCard';
import PrinterEditor from './Printer/PrinterEditor';
import ProxmoxCard from './Proxmox/ProxmoxCard';
import ServerStatsCard from './ServerStats/ServerStatsCard';
import SpacerCard from './Spacer/SpacerCard';
import MultiThermostatCard from './Thermostat/MultiThermostatCard';
import MultiThermostatEditor from './Thermostat/MultiThermostatEditor';
import ThermostatCard from './Thermostat/ThermostatCard';
import ThermostatEditor from './Thermostat/ThermostatEditor';
import TransmissionCard from './Transmission/TransmissionCard';
import VacuumCard from './Vacuum/VacuumCard';
import VacuumsCard from './Vacuum/VacuumsCard';
import { VacuumEditor, VacuumsEditor } from './Vacuum/VacuumEditor';
import WeatherCard from './Weather/WeatherCard';
import WeatherEditor from './Weather/WeatherEditor';

/**
 * Card components keyed by the `type` used in config.yaml (lowercase).
 * To add a card, create it under `src/features/<Name>/` and register it here.
 * @type {Object<string, import('react').ComponentType<{config: Object, globalConfig: Object}>>}
 */
export const cardRegistry = {
    appgrid: AppGridCard,
    git: GitCard,
    graph: GraphCard,
    hacontrol: HAControlCard,
    media: MediaCard,
    mediaplayer: MediaPlayerCard,
    printer: PrinterCard,
    proxmox: ProxmoxCard,
    serverstats: ServerStatsCard,
    spacer: SpacerCard,
    thermostat: ThermostatCard,
    thermostats: MultiThermostatCard,
    transmission: TransmissionCard,
    vacuum: VacuumCard,
    vacuums: VacuumsCard,
    weather: WeatherCard,
};

const ALL_SIZES = ['quarter', 'half', '1', '2', '3'];

/**
 * @typedef {Object} CardInfo
 * @property {string} name - Name shown when adding a card.
 * @property {string} description - One line about what the card shows.
 * @property {string} icon - Icon for the add-card list (`lu-` Lucide name).
 * @property {string[]} [sizes] - Sizes edit mode offers, from `quarter`, `half`, `1`, `2`, `3`
 *   (columns). Defaults to `1`, `2` and `3`. A size set in config.yaml is always rendered.
 * @property {Object} [defaults] - Properties of a newly added card, besides `id` and `type`.
 * @property {import('react').ComponentType<{config: Object, onChange: (config: Object) => void}>} [Editor]
 *   - Settings form shown in the card editor. Without one the card is edited as YAML only.
 * @property {boolean} [headerIcon] - The card has a header whose icon reads `icon`, `iconColor`
 *   and `iconBackground`. The card editor then shows the real card and edits that icon.
 * @property {{Stage: import('react').ComponentType<Object>, Inspector: import('react').ComponentType<Object>, split?: boolean}} [stage]
 *   - Arranges the card's own items directly on it, with the settings of the selected one.
 */

/**
 * Describes each card type for edit mode: how it appears in the add-card list, which sizes
 * it supports and which settings form it has.
 * @type {Object<string, CardInfo>}
 */
export const cardInfo = {
    weather: {
        headerIcon: true,
        name: 'Weather',
        description: 'Daily or hourly forecast for a place',
        icon: 'lu-CloudSun',
        defaults: { colSpan: 2, location: 'Berlin' },
        Editor: WeatherEditor,
    },
    hacontrol: {
        name: 'Home Assistant',
        description: 'Switch lights, plugs, fans and covers',
        icon: 'lu-Lightbulb',
        sizes: ALL_SIZES,
        defaults: { data: { entities: [] } },
        Editor: HAControlEditor,
    },
    thermostat: {
        name: 'Single Thermostat',
        description: 'Target temperature, presets and on/off for one climate entity',
        icon: 'lu-Thermometer',
        sizes: ['quarter', 'half', '1'],
        defaults: { entity_id: '' },
        Editor: ThermostatEditor,
    },
    thermostats: {
        headerIcon: true,
        name: 'Multiroom Thermostat',
        description: 'Targets, presets and on/off for up to six rooms',
        icon: 'lu-Heater',
        defaults: { colSpan: 2, rooms: [] },
        Editor: MultiThermostatEditor,
    },
    graph: {
        headerIcon: true,
        name: 'Graph',
        description: 'History of Home Assistant sensors as lines, bars or this week vs last',
        icon: 'lu-ChartLine',
        defaults: { entities: [] },
        Editor: GraphEditor,
    },
    vacuum: {
        headerIcon: true,
        name: 'Vacuum',
        description: 'Start, rooms, fan speed, map, camera and consumables of one robot',
        icon: 'mdi:robot-vacuum',
        sizes: ['half', '1', '2', '3'],
        defaults: { entity_id: '' },
        Editor: VacuumEditor,
    },
    vacuums: {
        headerIcon: true,
        name: 'Multiple Vacuums',
        description: 'Control all your robots together, with details for each',
        icon: 'mdi:robot-vacuum-variant',
        defaults: { robots: [] },
        Editor: VacuumsEditor,
    },
    printer: {
        headerIcon: true,
        name: '3D Printer',
        description: 'Progress, temperatures, spools and controls of a Bambu Lab printer',
        icon: 'mdi:printer-3d-nozzle',
        sizes: ['half', '1'],
        defaults: { printer: '' },
        Editor: PrinterEditor,
    },
    appgrid: {
        name: 'App Grid',
        description: 'Shortcuts to your apps with online status',
        icon: 'lu-LayoutGrid',
        Editor: AppGridEditor,
        stage: { Stage: AppGridStage, Inspector: AppGridInspector, split: true },
    },
    mediaplayer: {
        name: 'Media Player',
        description: 'Now playing, controls and speakers for Home Assistant players',
        icon: 'lu-Music',
        sizes: ['quarter', 'half', '1'],
        defaults: { entities: [] },
        Editor: MediaPlayerEditor,
    },
    media: {
        headerIcon: true,
        name: 'Media Calendar',
        description: 'Upcoming episodes and movies from Sonarr and Radarr',
        icon: 'lu-Tv',
        defaults: { colSpan: 2 },
    },
    transmission: {
        headerIcon: true,
        name: 'Transmission',
        description: 'Active downloads and transfer speeds',
        icon: 'lu-Download',
        defaults: { colSpan: 2 },
    },
    serverstats: {
        headerIcon: true,
        name: 'Server Stats',
        description: 'CPU, memory, storage, network and temperature',
        icon: 'lu-Gauge',
        defaults: { colSpan: 2, data: { sensors: ['cpu', 'ram', 'storage', 'network', 'temp'] } },
    },
    proxmox: {
        headerIcon: true,
        name: 'Proxmox',
        description: 'Nodes, VMs and containers of a Proxmox cluster',
        icon: 'lu-Server',
    },
    git: {
        headerIcon: true,
        name: 'Pull Requests',
        description: 'Open pull requests from GitHub, GitLab or Gitea',
        icon: 'lu-GitPullRequest',
        defaults: { repositories: [] },
    },
    spacer: {
        name: 'Empty Space',
        description: 'Invisible placeholder to shape the layout',
        icon: 'lu-SquareDashed',
        sizes: ALL_SIZES,
        defaults: { hideOn: ['phone'] },
    },
};

/**
 * Returns what edit mode knows about a card type.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {CardInfo|undefined} The type's info, or undefined for unknown types.
 */
export function getCardInfo(type) {
    const key = String(type || '').toLowerCase();
    return Object.hasOwn(cardInfo, key) ? cardInfo[key] : undefined;
}

/**
 * Returns the sizes a card type supports in edit mode.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {string[]|undefined} Supported sizes, or undefined for the default set.
 */
export function getCardSizes(type) {
    return getCardInfo(type)?.sizes;
}

/**
 * Looks up the component for a card type.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {import('react').ComponentType<{config: Object, globalConfig: Object}>|null} The card component, or null if unknown.
 */
export function getCardComponent(type) {
    const key = String(type || '').toLowerCase();
    return Object.hasOwn(cardRegistry, key) ? cardRegistry[key] : null;
}
