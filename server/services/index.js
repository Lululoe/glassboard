import { handleGitRequest } from './git.js';
import { handleHaRequest } from './homeassistant.js';
import { handleMediaRequest } from './media.js';
import { handleProxmoxRequest } from './proxmox.js';
import { handleServerStatsRequest } from './serverstats.js';
import { handleTransmissionRequest } from './transmission.js';
import { handleWeatherRequest } from './weather.js';

/**
 * Handlers for the `/api` endpoint, keyed by the `service` request parameter.
 * Each handler receives the merged query and body parameters and returns JSON-serializable data.
 * To add a service, implement a handler in this directory and register it here.
 * @type {Object<string, (params: Object) => Promise<*>>}
 */
export const serviceHandlers = {
    git: handleGitRequest,
    homeassistant: handleHaRequest,
    media: handleMediaRequest,
    proxmox: handleProxmoxRequest,
    serverstats: handleServerStatsRequest,
    transmission: handleTransmissionRequest,
    weather: handleWeatherRequest,
};
