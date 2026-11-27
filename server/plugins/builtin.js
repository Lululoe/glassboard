import { handleAppStatusRequest } from '../services/appstatus.js';
import { demoCameraImage, demoServices } from '../services/demo.js';
import { handleGitRequest } from '../services/git.js';
import { fetchRobotImage, getVacuumEntityIds, handleVacuumRequest } from '../services/haVacuum.js';
import { handleHaRequest } from '../services/homeassistant.js';
import { handleMediaRequest } from '../services/media.js';
import { handleProxmoxRequest } from '../services/proxmox.js';
import { handleServerStatsRequest } from '../services/serverstats.js';
import { handleTransmissionRequest } from '../services/transmission.js';
import { handleWeatherRequest } from '../services/weather.js';

/**
 * A plugin with one service and its demo version of the same name.
 * @param {string} id - Plugin id, the same as its frontend plugin.
 * @param {string} service - Service name.
 * @param {import('./host.js').ServiceHandler} handler - The service.
 * @returns {import('./host.js').ServerPlugin} The plugin.
 */
const serviceOnly = (id, service, handler) => ({
    id,
    setup: () => ({ services: { [service]: handler }, demo: { [service]: demoServices[service] } }),
});

/**
 * The server side of the plugins built into Glassboard, keyed like their frontend plugins
 * (`src/features/<Name>/plugin.js`). Plugins whose cards need no backend have none here.
 * `core` holds the services the dashboard itself uses besides cards: Home Assistant (page
 * header, kiosk and the Home Assistant cards) and the weather (weather background).
 * @type {import('./host.js').ServerPlugin[]}
 */
export const builtinServerPlugins = [
    {
        id: 'core',
        setup: () => ({
            services: { homeassistant: handleHaRequest, weather: handleWeatherRequest },
            demo: { homeassistant: demoServices.homeassistant, weather: demoServices.weather },
        }),
    },
    serviceOnly('appgrid', 'appstatus', handleAppStatusRequest),
    serviceOnly('git', 'git', handleGitRequest),
    serviceOnly('media', 'media', handleMediaRequest),
    serviceOnly('proxmox', 'proxmox', handleProxmoxRequest),
    serviceOnly('serverstats', 'serverstats', handleServerStatsRequest),
    serviceOnly('transmission', 'transmission', handleTransmissionRequest),
    {
        id: 'vacuum',
        setup(ctx) {
            ctx.homeassistant.registerEntityIds(getVacuumEntityIds);
            return {
                services: { vacuum: handleVacuumRequest },
                demo: { vacuum: demoServices.vacuum },
                routes(router) {
                    /**
                     * `GET /api/plugins/vacuum/camera?card_id=&entity_id=`: the image of a robot's
                     * camera or map entity; the token stays on the server.
                     */
                    router.get('/camera', async (req, res, next) => {
                        try {
                            const cardId = String(req.query.card_id || '');
                            const entityId = String(req.query.entity_id || '');
                            if (!cardId || !entityId) throw new ctx.errors.HttpError(400, 'card_id and entity_id are required');
                            const image = ctx.isDemoMode() ? demoCameraImage(cardId, entityId) : await fetchRobotImage(cardId, entityId);
                            res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'no-store' }).send(image.body);
                        } catch (err) {
                            next(err);
                        }
                    });
                },
            };
        },
    },
];
