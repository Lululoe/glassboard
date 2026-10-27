import { Agent, fetch as undiciFetch } from 'undici';
import { findCard, getConfig } from '../config.js';
import { HttpError } from '../errors.js';

const CACHE_DURATION = 30 * 1000;
const TIMEOUT = 5000;
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
const cache = new Map();

/**
 * Returns the apps shown by an app grid card: its own `data.apps`, or the launcher apps.
 * Mirrors the fallback used by the frontend so indices line up.
 * @param {Object} card - The app grid card config.
 * @returns {Array<Object>} Configured apps.
 */
export function getGridApps(card) {
    const apps = card.data?.apps;
    if (Array.isArray(apps) && apps.length > 0) return apps;
    const launcherApps = getConfig().launcher?.apps;
    return Array.isArray(launcherApps) ? launcherApps : [];
}

/**
 * Checks whether a URL answers. Any HTTP response below 500 counts as online, since
 * 401/403/405 still mean the service is running; 5xx usually comes from a reverse proxy
 * whose backend is down. TLS certificates are not verified, as homelab services often use
 * self-signed ones.
 * @param {string} url - URL to check.
 * @returns {Promise<boolean>} Whether the service is reachable.
 */
export async function checkUrl(url) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.online;

    let online;
    try {
        const response = await undiciFetch(url, {
            method: 'HEAD',
            redirect: 'manual',
            dispatcher: insecureAgent,
            signal: AbortSignal.timeout(TIMEOUT),
        });
        online = response.status < 500;
    } catch {
        online = false;
    }
    cache.set(url, { timestamp: Date.now(), online });
    return online;
}

/**
 * Returns the reachability of each app on an app grid card. The URLs are read from the
 * server-side config, never from the request, so this cannot be used to probe arbitrary hosts.
 * An app is checked at `statusUrl` if set, otherwise at `url`; `statusCheck: false` on the
 * card or an app disables checking.
 * @param {Object} params
 * @param {string} params.cardId - Id of the app grid card.
 * @returns {Promise<{statuses: Array<boolean|null>}>} Online state per app index; null when not checked.
 */
export async function handleAppStatusRequest({ cardId }) {
    const card = cardId !== undefined ? findCard(cardId) : undefined;
    if (!card || String(card.type).toLowerCase() !== 'appgrid') {
        throw new HttpError(404, `App grid card not found: ${cardId}`);
    }
    if (card.statusCheck === false) return { statuses: [] };

    const statuses = await Promise.all(getGridApps(card).map(app => {
        const url = app?.statusUrl || app?.url;
        if (app?.statusCheck === false || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
        return checkUrl(url);
    }));
    return { statuses };
}
