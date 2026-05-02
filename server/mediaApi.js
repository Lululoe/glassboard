import fetch from 'node-fetch';
import logger from './logger.js';

/**
 * Fetch calendar events from a media service (Sonarr/Radarr)
 * @param {string} type 'sonarr' or 'radarr'
 * @param {string} url Base URL
 * @param {string} apiKey API Key
 * @param {string} start ISO start date
 * @param {string} end ISO end date
 */
export async function fetchCalendar(type, url, apiKey, start, end) {
    if (!url || !apiKey) return [];

    const base = url.replace(/\/$/, '');
    // Both define /api/v3/calendar with start/end params
    const apiUrl = new URL(`${base}/api/v3/calendar`);

    // Normalize dates to YYYY-MM-DD for API
    apiUrl.searchParams.set('start', start.slice(0, 10));
    apiUrl.searchParams.set('end', end.slice(0, 10));

    // Sonarr specific
    if (type === 'sonarr') {
        apiUrl.searchParams.set('includeSeries', 'true');
        apiUrl.searchParams.set('includeEpisodeFile', 'true');
    }

    const headers = { 'X-Api-Key': apiKey };

    try {
        const res = await fetch(apiUrl.toString(), { headers });
        if (!res.ok) {
            logger.warn(`[${type}] Failed to fetch calendar: ${res.status}`);
            return [];
        }
        const data = await res.json();
        return (data || []).map(item => normalizeEvent(type, item, base));
    } catch (e) {
        logger.error(`[${type}] Fetch error:`, e.message);
        return [];
    }
}

/**
 * Normalizes a raw event from Sonarr or Radarr into a common Event format.
 * @param {string} type - Service type ('sonarr' or 'radarr')
 * @param {Object} item - Raw API item
 * @param {string} baseUrl - Base URL of the service
 * @returns {Object} Normalized event object
 */
function normalizeEvent(type, item, baseUrl) {
    const event = {
        id: item.id,
        type: type, // 'sonarr' | 'radarr'
        datetime: item.airDateUtc || item.airDate || item.physicalRelease || item.inCinemas,
        status: 'missing', // default
        hasFile: !!item.hasFile,
        url: null
    };

    if (type === 'sonarr') {
        event.title = item.series?.title || item.seriesTitle || 'Unknown Series';
        event.secondary = `${item.seasonNumber}x${String(item.episodeNumber).padStart(2, '0')}`;
        // Status logic
        if (item.hasFile) event.status = 'downloaded';
        else if (new Date(event.datetime) > new Date()) event.status = 'upcoming';

        if (item.series?.titleSlug) {
            event.url = `${baseUrl}/series/${item.series.titleSlug}`;
        }
    } else if (type === 'radarr') {
        event.title = item.title;
        event.secondary = item.year ? String(item.year) : '';
        // Status logic
        if (item.hasFile) event.status = 'downloaded';
        else if (new Date(event.datetime) > new Date()) event.status = 'upcoming';

        if (item.titleSlug) {
            event.url = `${baseUrl}/movie/${item.titleSlug}`;
        }
    }

    return event;
}
