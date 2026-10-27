/**
 * Error returned by the Glassboard API, carrying the HTTP status.
 */
export class ApiError extends Error {
    /**
     * @param {string} message - Error message from the server.
     * @param {number} status - HTTP status code.
     */
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

const inflight = new Map();

/**
 * Sends a request to the central `/api` endpoint.
 * @param {string} body - JSON request body.
 * @returns {Promise<*>} Parsed response data.
 */
async function post(body) {
    const res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
    return data;
}

/**
 * Calls a backend service through `/api`. Identical concurrent calls share one request,
 * so several cards of the same type only hit the backend once per poll.
 * @param {string} service - Service name registered on the server (e.g. 'proxmox').
 * @param {Object} [params] - Additional parameters for the service.
 * @returns {Promise<*>} The service's response data.
 */
export function callService(service, params = {}) {
    const body = JSON.stringify({ ...params, service });
    if (!inflight.has(body)) {
        inflight.set(body, post(body).finally(() => inflight.delete(body)));
    }
    return inflight.get(body);
}
