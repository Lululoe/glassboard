import { getAllCards, getServiceConfig } from '../config.js';
import { HttpError } from '../errors.js';
import logger from '../logger.js';

const DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Collects the configured Sonarr/Radarr instances. A `services` list on the media card
 * takes precedence; otherwise `services.sonarr` / `services.radarr` (or env vars) are used.
 * @returns {Array<{type: string, url: string, apiKey: string}>} Media services.
 */
export function getMediaServices() {
    const mediaCard = getAllCards().find(c => c.type === 'media');
    const fromCard = (Array.isArray(mediaCard?.services) ? mediaCard.services : [])
        .map(s => ({ type: String(s.type || '').toLowerCase(), url: s.url, apiKey: s.apiKey || s.apikey }))
        .filter(s => s.type && s.url && s.apiKey);
    if (fromCard.length > 0) return fromCard;

    return ['sonarr', 'radarr']
        .map(type => {
            const { url, apiKey } = getServiceConfig(type, {
                url: { env: [`${type.toUpperCase()}_URL`] },
                apiKey: { env: [`${type.toUpperCase()}_API_KEY`], aliases: ['api_key'] },
            });
            return { type, url, apiKey };
        })
        .filter(s => s.url && s.apiKey);
}

/**
 * Normalizes a raw Sonarr or Radarr calendar item into a common event format.
 * @param {string} type - 'sonarr' or 'radarr'.
 * @param {Object} item - Raw API item.
 * @param {string} baseUrl - Base URL of the service, used for links.
 * @returns {Object} Normalized event.
 */
function normalizeEvent(type, item, baseUrl) {
    const datetime = item.airDateUtc || item.airDate || item.physicalRelease || item.inCinemas;
    const event = {
        id: `${type}-${item.id}`,
        type,
        datetime,
        hasFile: !!item.hasFile,
        status: item.hasFile ? 'downloaded' : new Date(datetime) > new Date() ? 'upcoming' : 'missing',
        url: null,
    };

    if (type === 'sonarr') {
        event.title = item.series?.title || item.seriesTitle || 'Unknown Series';
        event.secondary = `${item.seasonNumber}x${String(item.episodeNumber).padStart(2, '0')}`;
        if (item.series?.titleSlug) event.url = `${baseUrl}/series/${item.series.titleSlug}`;
    } else {
        event.title = item.title;
        event.secondary = item.year ? String(item.year) : '';
        if (item.titleSlug) event.url = `${baseUrl}/movie/${item.titleSlug}`;
    }
    return event;
}

/**
 * Fetches calendar events from a Sonarr or Radarr instance. Failures are logged and
 * produce an empty list so one broken instance does not hide the others.
 * @param {{type: string, url: string, apiKey: string}} service - The media service.
 * @param {string} start - Start date (YYYY-MM-DD).
 * @param {string} end - End date (YYYY-MM-DD).
 * @returns {Promise<Array<Object>>} Normalized events.
 */
async function fetchCalendar({ type, url, apiKey }, start, end) {
    const base = url.replace(/\/$/, '');
    const apiUrl = new URL(`${base}/api/v3/calendar`);
    apiUrl.searchParams.set('start', start);
    apiUrl.searchParams.set('end', end);
    if (type === 'sonarr') {
        apiUrl.searchParams.set('includeSeries', 'true');
        apiUrl.searchParams.set('includeEpisodeFile', 'true');
    }

    try {
        const res = await fetch(apiUrl, { headers: { 'X-Api-Key': apiKey } });
        if (!res.ok) {
            logger.warn(`[${type}] Failed to fetch calendar: ${res.status}`);
            return [];
        }
        const data = await res.json();
        return (data || []).map(item => normalizeEvent(type, item, base));
    } catch (e) {
        logger.error(`[${type}] Fetch error: ${e.message}`);
        return [];
    }
}

/**
 * Returns calendar events from all configured media services, sorted by date.
 * @param {Object} params
 * @param {string} params.start - Start date (YYYY-MM-DD).
 * @param {string} params.end - End date (YYYY-MM-DD).
 * @returns {Promise<Array<Object>>} Sorted events.
 */
export async function handleMediaRequest({ start, end }) {
    if (!DATE.test(start || '') || !DATE.test(end || '')) {
        throw new HttpError(400, 'start and end dates (YYYY-MM-DD) are required');
    }
    const results = await Promise.all(getMediaServices().map(s =>
        fetchCalendar(s, start.slice(0, 10), end.slice(0, 10))));
    return results.flat().sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
}
