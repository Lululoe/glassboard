import { findCard, getAllCards, getConfig, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';
import logger from '../logger.js';
import { isDemoMode } from '../services/demo.js';
import {
    getEntityState, haFetchRaw, haRequest, liveCommand, prepareHaRequest, registerEntityIds,
} from '../services/homeassistant.js';

/**
 * @typedef {Object} PluginContext
 *   What the server gives a plugin's `setup`. Plugins use these instead of importing
 *   Glassboard's own modules, so they keep working when those change.
 * @property {string} id - The plugin's id.
 * @property {{getConfig: typeof getConfig, getAllCards: typeof getAllCards, findCard: typeof findCard, getServiceConfig: typeof getServiceConfig}} config
 *   - The dashboard config. Read a card's settings with `findCard(cardId)`, and credentials
 *   with `getServiceConfig` (environment variables, then `services.yaml`).
 * @property {{HttpError: typeof HttpError, upstreamError: typeof upstreamError}} errors
 *   - Errors whose status and message the client sees.
 * @property {{info: Function, warn: Function, error: Function, debug: Function}} logger
 *   - The server log, with the plugin's id in front of each line.
 * @property {typeof isDemoMode} isDemoMode - Whether the dashboard runs on simulated data.
 * @property {Object} homeassistant - Home Assistant, through the connection the dashboard has.
 * @property {typeof prepareHaRequest} homeassistant.prepare - Call first in every request that
 *   reads Home Assistant: fails with 503 when it isn't configured.
 * @property {typeof haRequest} homeassistant.request - A REST API request, parsed as JSON.
 * @property {typeof haFetchRaw} homeassistant.fetchRaw - A REST API request, as a raw response.
 * @property {typeof getEntityState} homeassistant.getEntityState - An entity's state, live when watched.
 * @property {typeof liveCommand} homeassistant.liveCommand - A WebSocket API command.
 * @property {typeof registerEntityIds} homeassistant.registerEntityIds - Adds the entities the
 *   plugin's cards read, which the API may then read and the live connection watches.
 * @property {() => void} dispose - Undoes what the plugin registered through the context. Called
 *   by the plugin host when the plugin fails to set up; plugins don't call it.
 */

/**
 * Creates the API a plugin's `setup` receives.
 * @param {string} id - The plugin's id.
 * @returns {PluginContext} The context.
 */
export function createPluginContext(id) {
    const tag = `[${id}]`;
    /** @type {Array<() => void>} */
    const undo = [];
    return {
        id,
        config: { getConfig, getAllCards, findCard, getServiceConfig },
        errors: { HttpError, upstreamError },
        logger: {
            info: (...args) => logger.info(tag, ...args),
            warn: (...args) => logger.warn(tag, ...args),
            error: (...args) => logger.error(tag, ...args),
            debug: (...args) => logger.debug(tag, ...args),
        },
        isDemoMode,
        homeassistant: {
            prepare: prepareHaRequest,
            request: haRequest,
            fetchRaw: haFetchRaw,
            getEntityState,
            liveCommand,
            registerEntityIds: (source) => {
                const remove = registerEntityIds(source);
                undo.push(remove);
                return remove;
            },
        },
        dispose: () => undo.splice(0).forEach(remove => remove()),
    };
}
