import logger from '../logger.js';

/**
 * Global error handling middleware for Express.
 * Logs the error and returns a formatted JSON response.
 * @param {Error} err - The thrown error object.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next function.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

    // Log the error
    logger.error(`${req.method} ${req.originalUrl} - Error: ${err.message}`);
    if (err.stack) {
        logger.debug(err.stack);
    }

    res.status(statusCode).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};
