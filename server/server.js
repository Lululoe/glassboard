import logger from './logger.js';
import { getBaseConfig, loadConfig, onConfigChange, watchConfig } from './config.js';
import { announceEditing } from './editAccess.js';
import { createApp } from './app.js';
import { startLiveStates } from './services/homeassistant.js';
import { isDemoMode } from './services/demo.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Loads the configuration, builds the app and starts listening.
 * @returns {Promise<void>}
 */
async function start() {
    loadConfig();
    watchConfig();
    startLiveStates({ isActive: () => !isDemoMode() });

    const app = await createApp();
    app.listen(PORT, HOST, () => {
        logger.info(`App listening on http://${HOST}:${PORT} (env=${process.env.NODE_ENV || 'development'})`);
        announceEditing();
    });

    // Say how to unlock editing again when config.yaml turns it on while running
    let editable = getBaseConfig().editable === true;
    onConfigChange(() => {
        const now = getBaseConfig().editable === true;
        if (now && !editable) announceEditing();
        editable = now;
    });
}

start().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
