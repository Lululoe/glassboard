import logger from '../logger.js';

/**
 * Global error handling middleware for Express.
 * Responds with the error's `status` (default 500) and a JSON body `{ error }`.
 * Stack traces are included only outside production.
 * @param {Error & {status?: number, statusCode?: number}} err - The thrown error.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next callback (required for Express to treat this as an error handler).
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const log = status >= 500 ? logger.error : logger.warn;
    log(`${req.method} ${req.originalUrl} - ${status}: ${err.message}`);
    if (err.stack) logger.debug(err.stack);

    const body = { error: err.message };
    if (process.env.NODE_ENV !== 'production') body.stack = err.stack;
    res.status(status).json(body);
};
