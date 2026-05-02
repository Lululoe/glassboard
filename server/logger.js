const formatTime = () => new Date().toISOString();

/**
 * Standardized logging utility for the server.
 */
const logger = {
    info: (...args) => console.log(`[${formatTime()}] [INFO]`, ...args),
    warn: (...args) => console.warn(`[${formatTime()}] [WARN]`, ...args),
    error: (...args) => console.error(`[${formatTime()}] [ERROR]`, ...args),
    debug: (...args) => {
        if (process.env.DEBUG) console.debug(`[${formatTime()}] [DEBUG]`, ...args);
    }
};

export default logger;
