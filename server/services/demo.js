import { findCard, getAllCards, getConfig } from '../config.js';
import { HttpError } from '../errors.js';
import { getGridApps } from './appstatus.js';

/**
 * Demo mode answers every `/api` service with simulated data instead of calling real backends,
 * so the dashboard can be shown or developed without any services configured. Values drift
 * slowly over time so the cards look alive, and Home Assistant toggles are kept in memory.
 */

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Returns true when demo mode is on, via `demo: true` in config.yaml or the
 * `GLASSBOARD_DEMO` environment variable.
 * @returns {boolean} Whether simulated data should be served.
 */
export function isDemoMode() {
    const env = process.env.GLASSBOARD_DEMO;
    if (env !== undefined && env !== '') return ['true', '1', 'yes'].includes(env.toLowerCase());
    return getConfig().demo === true;
}

/**
 * A smooth value that drifts between `min` and `max` over time.
 * @param {number} min - Lowest value.
 * @param {number} max - Highest value.
 * @param {number} periodSeconds - Length of one full cycle.
 * @param {number} [phase=0] - Offset so different values don't move in lockstep.
 * @returns {number} The current value.
 */
function drift(min, max, periodSeconds, phase = 0) {
    const t = Date.now() / 1000 / periodSeconds * 2 * Math.PI + phase;
    return min + (max - min) * (0.5 + 0.5 * Math.sin(t));
}

const round = (value, digits = 1) => Number(value.toFixed(digits));

/**
 * Returns a date `days` from today at the given local time, as an ISO string.
 * @param {number} days - Offset from today.
 * @param {number} hours - Hour of the day.
 * @param {number} [minutes=0] - Minute of the hour.
 * @returns {string} ISO timestamp.
 */
function dayAt(days, hours, minutes = 0) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
}

/**
 * Formats a byte count the way the Transmission service does.
 * @param {number} bytes - Byte count.
 * @returns {string} Human-readable size.
 */
function formatBytes(bytes) {
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

function serverstats() {
    const ramTotal = 64;
    const storageTotal = 1863;
    const storageUsed = 1204;
    return {
        info: { hostname: 'homelab', ip: '192.168.1.10' },
        cpu: round(drift(12, 46, 90)),
        ram: { used: round(drift(21, 29, 300, 1)), total: ramTotal },
        storage: { used: storageUsed, free: storageTotal - storageUsed, total: storageTotal },
        network: { in: Math.round(drift(2, 38, 45, 2) * MB), out: Math.round(drift(0.5, 6, 60, 3) * MB) },
        temp: round(drift(44, 58, 120, 4), 0),
    };
}

const GUESTS = [
    { id: 100, name: 'homeassistant', type: 'vm', status: 'running', cpu: [3, 14], ram: 58, disk: 31 },
    { id: 101, name: 'docker', type: 'vm', status: 'running', cpu: [18, 42], ram: 71, disk: 64 },
    { id: 102, name: 'media', type: 'lxc', status: 'running', cpu: [6, 28], ram: 46, disk: 82 },
    { id: 103, name: 'pihole', type: 'lxc', status: 'running', cpu: [1, 4], ram: 22, disk: 18 },
    { id: 104, name: 'backup', type: 'lxc', status: 'stopped', cpu: [0, 0], ram: 0, disk: 47 },
    { id: 105, name: 'win11', type: 'vm', status: 'stopped', cpu: [0, 0], ram: 0, disk: 39 },
];

function proxmox() {
    const nodes = GUESTS.map((g, i) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        status: g.status,
        cpu: round(drift(g.cpu[0], g.cpu[1], 70, i)),
        ram: g.status === 'running' ? round(g.ram + drift(-3, 3, 200, i)) : 0,
        disk: g.disk,
    }));
    const running = nodes.filter(n => n.status === 'running');
    return {
        nodes,
        summary: {
            running: running.length,
            total: nodes.length,
            cpuAvg: Math.round(running.reduce((sum, n) => sum + n.cpu, 0) / running.length),
        },
    };
}

const TORRENTS = [
    { id: 1, name: 'ubuntu-24.04.3-desktop-amd64.iso', size: 6.1 * GB, minutes: 0 },
    { id: 2, name: 'debian-13.1.0-amd64-DVD-1.iso', size: 3.9 * GB, minutes: 40 },
    { id: 3, name: 'archlinux-2026.10.01-x86_64.iso', size: 1.4 * GB, minutes: 12 },
    // Stuck without peers, so the stalled state can be seen
    { id: 4, name: 'fedora-workstation-43-x86_64.iso', size: 2.3 * GB, minutes: 25, stalled: true },
];

function transmission() {
    const rates = TORRENTS.map((t, i) => {
        // Downloads loop over their duration; a duration of 0 means the torrent is seeding
        const progress = t.minutes === 0 ? 100 : Math.floor((Date.now() / 60000 / t.minutes * 100 + i * 23) % 100);
        const seeding = progress === 100;
        return {
            progress: t.stalled ? 37 : progress,
            seeding,
            down: seeding || t.stalled ? 0 : Math.round(drift(1.5, 9, 30, i) * MB),
            up: t.stalled ? 0 : Math.round((seeding ? drift(0.2, 1.2, 40, i) : drift(0, 0.2, 40, i)) * MB),
        };
    });
    return {
        torrents: TORRENTS.map((t, i) => {
            const { progress, seeding, down, up } = rates[i];
            return {
                id: t.id,
                name: t.name,
                progress,
                size: formatBytes(t.size),
                downloaded: formatBytes(t.size * progress / 100),
                speedDown: `${formatBytes(down)}/s`,
                speedUp: `${formatBytes(up)}/s`,
                ratio: seeding ? 1.84 : round(progress / 250, 2),
                isFinished: seeding,
                isStalled: !!t.stalled,
                status: seeding ? 6 : 4,
                error: null,
            };
        }),
        totalRateDown: rates.reduce((sum, r) => sum + r.down, 0),
        totalRateUp: rates.reduce((sum, r) => sum + r.up, 0),
        totalCount: TORRENTS.length,
    };
}

// Episodes and films relative to today, so the calendar is never empty
const SCHEDULE = [
    { type: 'sonarr', title: 'Severance', secondary: '2x09', day: -1, hour: 3, hasFile: true },
    { type: 'radarr', title: 'Dune: Part Two', secondary: '2024', day: -1, hour: 0, hasFile: false },
    { type: 'sonarr', title: 'The Bear', secondary: '4x04', day: 0, hour: 2, hasFile: true },
    { type: 'sonarr', title: 'Slow Horses', secondary: '5x02', day: 0, hour: 21, hasFile: false },
    { type: 'sonarr', title: 'Andor', secondary: '2x10', day: 1, hour: 20, hasFile: false },
    { type: 'radarr', title: 'Sinners', secondary: '2025', day: 1, hour: 0, hasFile: false },
    { type: 'sonarr', title: 'Shrinking', secondary: '3x06', day: 2, hour: 9, hasFile: false },
    { type: 'sonarr', title: 'The Last of Us', secondary: '2x07', day: 4, hour: 3, hasFile: false },
    { type: 'radarr', title: 'Mickey 17', secondary: '2025', day: 5, hour: 0, hasFile: false },
    { type: 'sonarr', title: 'Foundation', secondary: '3x08', day: 6, hour: 9, hasFile: false },
];

function media({ start, end }) {
    if (!DATE.test(start || '') || !DATE.test(end || '')) {
        throw new HttpError(400, 'start and end dates (YYYY-MM-DD) are required');
    }
    const from = Date.parse(`${start.slice(0, 10)}T00:00:00`);
    const to = Date.parse(`${end.slice(0, 10)}T23:59:59`);
    return SCHEDULE
        .map((item, i) => {
            const datetime = dayAt(item.day, item.hour);
            const status = item.hasFile ? 'downloaded' : Date.parse(datetime) > Date.now() ? 'upcoming' : 'missing';
            const { day: _day, hour: _hour, ...rest } = item;
            return { ...rest, id: `${item.type}-demo-${i}`, datetime, status, url: null };
        })
        .filter(e => Date.parse(e.datetime) >= from && Date.parse(e.datetime) <= to)
        .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
}

const PULL_REQUESTS = [
    { title: 'Add demo mode with simulated card data', state: 'open', author: 'luks', hours: 1, comments: 3, checks: 'success' },
    { title: 'Weather card: show hourly precipitation', state: 'open', author: 'luks', hours: 5, comments: 0, checks: 'pending' },
    { title: 'chore(deps): bump vite from 7.2.4 to 7.3.0', state: 'open', author: 'dependabot[bot]', hours: 9, comments: 1, checks: 'failed' },
    { title: 'Proxmox: sort guests by CPU usage', state: 'draft', author: 'luks', hours: 26, comments: 2, checks: 'success' },
    { title: 'Fix offline badge position on small tiles', state: 'merged', author: 'luks', hours: 30, comments: 4, checks: 'success' },
];

const CHECKS = {
    success: { status: 'success', passing: 6, total: 6 },
    pending: { status: 'pending', passing: 3, total: 6 },
    failed: { status: 'failed', passing: 5, total: 6 },
};

function git({ cardId }) {
    const card = cardId !== undefined ? findCard(cardId) : undefined;
    if (!card || card.type !== 'git') throw new HttpError(404, `Git card not found: ${cardId}`);

    const repo = card.repositories?.[0];
    const repoName = repo?.owner && repo?.repo ? `${repo.owner}/${repo.repo}` : 'glassboard/glassboard';
    const statuses = [card.filterStatus || card.status || []].flat().map(String);
    const prs = PULL_REQUESTS
        .map((pr, i) => ({
            id: `demo-${i}`,
            title: pr.title,
            number: 128 - i * 3,
            state: pr.state,
            author: pr.author,
            updatedAt: new Date(Date.now() - pr.hours * 3600 * 1000).toISOString(),
            url: '#',
            comments: pr.comments,
            labels: [],
            checks: CHECKS[pr.checks],
            repo: repoName,
            platform: repo?.type || 'github',
        }))
        .filter(pr => statuses.length === 0 || statuses.includes(pr.state));
    return { prs, stats: { count: prs.length, open: prs.filter(p => p.state === 'open').length } };
}

function appstatus({ cardId }) {
    const card = cardId !== undefined ? findCard(cardId) : undefined;
    if (!card || String(card.type).toLowerCase() !== 'appgrid') {
        throw new HttpError(404, `App grid card not found: ${cardId}`);
    }
    if (card.statusCheck === false) return { statuses: [] };
    // Everything is up except the fifth app, so the offline badge can be seen
    return { statuses: getGridApps(card).map((_app, i) => i !== 4) };
}

// Home Assistant entity states, kept in memory so toggles stick for the session
const haStates = new Map();

function findEntity(entityId) {
    for (const card of getAllCards()) {
        if (card.type !== 'hacontrol') continue;
        const entity = (card.data?.entities || []).find(e => e.entity_id === entityId);
        if (entity) return entity;
    }
    return undefined;
}

function entityState(entityId, index) {
    if (!haStates.has(entityId)) {
        const entity = findEntity(entityId);
        // Alternate initial states so both on and off tiles show
        const on = index % 3 !== 1;
        haStates.set(entityId, on ? (entity?.on_state || 'on') : (entity?.off_state || 'off'));
    }
    return { entity_id: entityId, state: haStates.get(entityId), attributes: {} };
}

function homeassistant(params) {
    const { endpoint } = params;
    if (!endpoint) throw new HttpError(400, 'Home Assistant service requires endpoint parameter');

    if (endpoint === 'states') {
        const ids = Array.isArray(params.entity_ids) ? params.entity_ids : [];
        return Object.fromEntries(ids.map((id, i) => [id, entityState(id, i)]));
    }
    if (endpoint.startsWith('states/')) {
        return entityState(endpoint.slice('states/'.length), 0);
    }
    if (endpoint === 'services') {
        const { entity_id: entityId, action } = params;
        const entity = findEntity(entityId);
        if (!entity) throw new HttpError(403, 'Action not authorized for this entity');
        if (action === entity.on_action?.service) haStates.set(entityId, entity.on_state || 'on');
        else if (action === entity.off_action?.service) haStates.set(entityId, entity.off_state || 'off');
        else throw new HttpError(403, 'Action not authorized for this entity');
        return [entityState(entityId, 0)];
    }
    throw new HttpError(400, `Unknown Home Assistant endpoint: ${endpoint}`);
}

const CONDITIONS = ['Clear', 'Partly cloudy', 'Overcast', 'Rain', 'Partly cloudy', 'Clear', 'Heavy rain'];

function weather({ cardId, type = 'daily' }) {
    if (cardId === undefined) throw new HttpError(400, 'cardId is required');
    const forecast = type === 'hourly'
        ? Array.from({ length: 24 }, (_v, h) => {
            const date = new Date();
            date.setMinutes(0, 0, 0);
            date.setHours(date.getHours() + h);
            const hour = date.getHours();
            return {
                datetime: date.toISOString(),
                condition: hour < 6 || hour > 20 ? 'Clear' : CONDITIONS[Math.floor(h / 6) % CONDITIONS.length],
                temperature: round(9 + 6 * Math.sin((hour - 9) / 24 * 2 * Math.PI), 0),
                precipitation: h >= 12 && h < 16 ? 40 : 0,
            };
        })
        : CONDITIONS.map((condition, d) => ({
            datetime: dayAt(d, 12),
            condition,
            temperature: 14 - (d % 4),
            templow: 6 - (d % 3),
            precipitation: condition === 'Rain' ? 60 : condition === 'Heavy rain' ? 90 : 0,
        }));
    return { forecast, units: 'metric' };
}

/**
 * Simulated handlers, keyed like `serviceHandlers`.
 * @type {Object<string, (params: Object) => Promise<*>>}
 */
export const demoHandlers = Object.fromEntries(Object.entries({
    appstatus,
    git,
    homeassistant,
    media,
    proxmox,
    serverstats,
    transmission,
    weather,
}).map(([name, handler]) => [name, async params => /** @type {(params: Object) => *} */ (handler)(params)]));

/**
 * Clears the simulated Home Assistant states. Intended for tests.
 */
export function resetDemoState() {
    haStates.clear();
}
