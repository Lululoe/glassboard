/**
 * Error carrying the HTTP status code the API should respond with.
 */
export class HttpError extends Error {
    /**
     * @param {number} status - HTTP status code (e.g. 400, 403, 502).
     * @param {string} message - Message returned to the client.
     */
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

/**
 * Builds the error thrown when an upstream service responds with a non-OK status.
 * Upstream failures map to 502 so they are not confused with errors in the request itself.
 * @param {string} service - Human-readable service name.
 * @param {{status: number, text: () => Promise<string>}} response - The failed fetch response.
 * @returns {Promise<HttpError>} Error describing the upstream failure.
 */
export async function upstreamError(service, response) {
    const text = await response.text().catch(() => '');
    const detail = text ? `: ${text.slice(0, 200)}` : '';
    return new HttpError(502, `${service} returned ${response.status}${detail}`);
}
