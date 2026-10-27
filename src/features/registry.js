import AppGridCard from './AppGrid/AppGridCard';
import GitCard from './Git/GitCard';
import HAControlCard from './HomeAssistant/HAControlCard';
import MediaCard from './Media/MediaCard';
import ProxmoxCard from './Proxmox/ProxmoxCard';
import ServerStatsCard from './ServerStats/ServerStatsCard';
import TransmissionCard from './Transmission/TransmissionCard';
import WeatherCard from './Weather/WeatherCard';

/**
 * Card components keyed by the `type` used in config.yaml (lowercase).
 * To add a card, create it under `src/features/<Name>/` and register it here.
 * @type {Object<string, import('react').ComponentType<{config: Object, globalConfig: Object}>>}
 */
export const cardRegistry = {
    appgrid: AppGridCard,
    git: GitCard,
    hacontrol: HAControlCard,
    media: MediaCard,
    proxmox: ProxmoxCard,
    serverstats: ServerStatsCard,
    transmission: TransmissionCard,
    weather: WeatherCard,
};

/**
 * Looks up the component for a card type.
 * @param {string} type - Card type from the config (case-insensitive).
 * @returns {import('react').ComponentType<{config: Object, globalConfig: Object}>|null} The card component, or null if unknown.
 */
export function getCardComponent(type) {
    const key = String(type || '').toLowerCase();
    return Object.hasOwn(cardRegistry, key) ? cardRegistry[key] : null;
}
