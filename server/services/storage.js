import { findCard, getServiceConfig } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';
import { getEntityState } from './homeassistant.js';

const TIMEOUT = 10000;
const ENTITY = /^[a-z_]+\.[\w-]+$/;
const UNAVAILABLE = new Set(['unavailable', 'unknown', 'none', '']);
const GB = 1e9;
/** Categories smaller than this, in GB, are left out: they would show as 0 GB. */
const SMALLEST = 0.01;

/** Gigabytes per unit, for the data size units Home Assistant knows. */
const UNITS = {
    b: 1 / GB, bit: 1 / 8 / GB,
    kb: 1e-6, mb: 1e-3, gb: 1, tb: 1e3, pb: 1e6,
    kib: 1024 / GB, mib: 1024 ** 2 / GB, gib: 1024 ** 3 / GB, tib: 1024 ** 4 / GB, pib: 1024 ** 5 / GB,
};

/** Names of the storage scanner's category labels (see docs/STORAGE_DATA_SOURCE.md). */
export const CATEGORY_NAMES = {
    system: 'System',
    app_data: 'Apps',
    docker_images: 'Docker images',
    docker_volumes: 'Docker volumes',
    docker_build_cache: 'Build cache',
    downloads: 'Downloads',
    downloads_incomplete: 'Downloads (incomplete)',
    journal: 'Journal',
    logs: 'Logs',
    cache: 'Cache',
    temp: 'Temp',
    home: 'Home',
    pve_backups: 'Proxmox backups',
    pve_templates: 'Templates',
    pve_import: 'Import',
    zfs_media: 'Media',
    zfs_photos: 'Photos',
    zfs_proxmox: 'VM disks & dumps',
    zfs_datashare: 'Data share',
    zfs_backups: 'Backups',
    zfs_paperless: 'Paperless',
};

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Quotes a value for a PromQL label matcher.
 * @param {string} value - The value.
 * @returns {string} The value in double quotes, escaped.
 */
const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Names a category label: from the card's `names`, the scanner's names, or the label itself
 * with underscores as spaces and a capital first letter.
 * @param {string} label - The label value.
 * @param {Object<string, string>} [names] - The card's own names.
 * @returns {string} The name.
 */
export function categoryName(label, names = {}) {
    if (text(names[label])) return names[label].trim();
    if (CATEGORY_NAMES[label]) return CATEGORY_NAMES[label];
    const words = String(label || 'other').replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The Prometheus queries of a storage card: its own `queries`, else those of the storage
 * scanner for a ZFS pool (`pool`) or a guest's filesystem (`target` and `mount`).
 * @param {Object} card - A `storage` card with `source: prometheus`.
 * @returns {{total: string|null, used: string|null, categories: string|null, updated: string|null, label: string, rest: string}}
 *   The queries, the label that names categories and the name of what the categories leave out.
 */
export function prometheusQueries(card) {
    const own = card?.queries && typeof card.queries === 'object' ? card.queries : {};
    const pool = text(card?.pool);
    const target = text(card?.target);
    const mount = text(card?.mount) || '/';
    let preset = {};
    if (pool) {
        preset = {
            total: `storage_zpool_size_bytes{pool=${quote(pool)}}`,
            used: `storage_zpool_allocated_bytes{pool=${quote(pool)}}`,
            categories: `sum by (category) (storage_content_bytes{target="proxmox", category=~"zfs_.*"})`,
            updated: 'storage_scan_last_success_timestamp_seconds{mode="content"}',
            rest: 'Snapshots & other',
        };
    } else if (target) {
        const where = `target=${quote(target)}, mount=${quote(mount)}`;
        preset = {
            total: `storage_fs_size_bytes{${where}}`,
            used: `storage_fs_used_bytes{${where}}`,
            categories: `sum by (category) (storage_content_bytes{${where}})`,
            updated: 'storage_scan_last_success_timestamp_seconds{mode="content"}',
        };
    }
    return {
        total: text(own.total) || preset.total || null,
        used: text(own.used) || preset.used || null,
        categories: text(own.categories) || preset.categories || null,
        updated: text(own.updated) || preset.updated || null,
        label: text(own.label) || 'category',
        rest: text(card?.rest) || preset.rest || 'Other',
    };
}

/**
 * Runs an instant query against Prometheus.
 * @param {string} url - Prometheus base URL.
 * @param {string} query - The PromQL query.
 * @returns {Promise<Array<{metric: Object, value: number}>>} The series, with their values as numbers.
 */
async function promQuery(url, query) {
    const endpoint = `${url.replace(/\/+$/, '')}/api/v1/query?query=${encodeURIComponent(query)}`;
    let response;
    try {
        response = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT) });
    } catch (err) {
        throw new HttpError(502, `Prometheus is unreachable: ${err.message}`);
    }
    if (!response.ok) throw await upstreamError('Prometheus', response);
    const body = await response.json();
    if (body?.status !== 'success') throw new HttpError(502, `Prometheus: ${body?.error || 'query failed'}`);
    return (body.data?.result || []).map(r => ({ metric: r.metric || {}, value: Number(r.value?.[1]) }))
        .filter(r => Number.isFinite(r.value));
}

/** Adds up the values of a query's series. */
const sumOf = (series) => series.reduce((sum, s) => sum + s.value, 0);

/**
 * Adds what the categories leave out of the used space as one more category, so the bar
 * shows as much as is used. Differences under 0.5% of the volume are left out.
 * @param {Array<Object>} categories - The categories, in GB.
 * @param {number|null} used - Used space in GB, when known.
 * @param {number} total - Size of the volume in GB.
 * @param {string} name - Name of the extra category.
 * @returns {Array<Object>} The categories.
 */
function withRest(categories, used, total, name) {
    if (used == null) return categories;
    const rest = used - categories.reduce((sum, c) => sum + c.size, 0);
    return rest > total * 0.005 ? [...categories, { name, size: rest, color: 'gray' }] : categories;
}

/**
 * Reads a storage card's volume from Prometheus.
 * @param {Object} card - The card.
 * @returns {Promise<{total: number, categories: Array<{name: string, size: number}>, updated?: number}>}
 *   The volume in GB; `updated` in Unix seconds.
 */
export async function prometheusVolume(card) {
    const { url } = getServiceConfig('prometheus', { url: { env: ['PROMETHEUS_URL'], aliases: ['host'] } });
    const base = text(card.url) || text(url);
    if (!base) throw new HttpError(503, 'Prometheus URL is not configured (services.prometheus.url or PROMETHEUS_URL)');
    const q = prometheusQueries(card);
    if (!q.total || !q.categories) throw new HttpError(400, 'Storage card needs pool, target or queries.total and queries.categories');

    const run = (query) => (query ? promQuery(base, query) : Promise.resolve(null));
    const [total, used, categories, updated] = await Promise.all([run(q.total), run(q.used), run(q.categories), run(q.updated)]);
    if (!total.length) throw new HttpError(502, `Prometheus has no data for ${q.total}`);

    const names = card.names && typeof card.names === 'object' ? card.names : {};
    const totalGb = sumOf(total) / GB;
    const list = categories
        .map(s => ({ name: categoryName(s.metric[q.label], names), size: s.value / GB }))
        .filter(c => c.size >= SMALLEST)
        .sort((a, b) => b.size - a.size);
    return {
        total: totalGb,
        categories: withRest(list, used?.length ? sumOf(used) / GB : null, totalGb, q.rest),
        ...(updated?.length ? { updated: Math.min(...updated.map(s => s.value)) } : {}),
    };
}

/**
 * Converts an entity's state to gigabytes, by its unit of measurement (or `unit`).
 * @param {Object|null} state - The entity's state.
 * @param {string} [unit] - A unit that overrides the entity's.
 * @returns {number|null} Gigabytes, or null when the entity has no number.
 */
export function stateToGb(state, unit) {
    if (!state || UNAVAILABLE.has(String(state.state).toLowerCase())) return null;
    const value = Number(state.state);
    if (!Number.isFinite(value)) return null;
    const key = String(unit || state.attributes?.unit_of_measurement || 'GB').toLowerCase();
    return value * (UNITS[key] ?? 1);
}

/** The entity ids of a category or a field: a list, or ids separated by commas; invalid ones left out. */
const entityList = (value) => (Array.isArray(value) ? value : [value])
    .flatMap(e => (typeof e === 'string' ? e.split(',') : [e?.entity_id]))
    .map(id => (typeof id === 'string' ? id.trim() : id))
    .filter(id => typeof id === 'string' && ENTITY.test(id));

/**
 * Every Home Assistant entity a storage card reads.
 * @param {Object} card - A `storage` card.
 * @returns {string[]} Entity ids.
 */
export function storageEntityIds(card) {
    if (card?.source !== 'homeassistant') return [];
    const categories = Array.isArray(card.categories) ? card.categories : [];
    return [...new Set([
        ...entityList(card.total), ...entityList(card.used),
        ...categories.flatMap(c => entityList(c?.entities ?? c?.entity)),
    ])];
}

/**
 * Reads a storage card's volume from Home Assistant: each category adds up its entities, `total`
 * is an entity (or the sum of several) or a number in GB, and an optional `used` entity adds what
 * the categories leave out as `rest`.
 * @param {Object} card - The card.
 * @returns {Promise<{total: number, categories: Array<Object>}>} The volume in GB.
 */
export async function homeAssistantVolume(card) {
    const states = new Map();
    await Promise.all(storageEntityIds(card).map(async id => {
        states.set(id, await getEntityState(id).catch(() => null));
    }));
    const unit = text(card.unit) || undefined;
    /** Adds up entities, null when none of them has a number. */
    const sum = (ids, own) => {
        const values = ids.map(id => stateToGb(states.get(id), own || unit)).filter(v => v != null);
        return values.length ? values.reduce((a, b) => a + b, 0) : null;
    };

    const categories = (Array.isArray(card.categories) ? card.categories : []).map((c, i) => {
        const size = sum(entityList(c?.entities ?? c?.entity), text(c?.unit));
        return size == null ? null : {
            name: text(c?.name) || `Category ${i + 1}`,
            size,
            ...(text(c?.color) ? { color: c.color.trim() } : {}),
            ...(text(c?.description) ? { description: c.description.trim() } : {}),
        };
    }).filter(c => c && c.size >= SMALLEST);

    const totalIds = entityList(card.total);
    const total = totalIds.length ? sum(totalIds) : Number(card.total) || null;
    if (totalIds.length && total == null) throw new HttpError(502, `Home Assistant has no size for ${totalIds.join(', ')}`);
    const used = entityList(card.used).length ? sum(entityList(card.used)) : null;
    const size = total ?? categories.reduce((s, c) => s + c.size, 0);
    return { total: size, categories: withRest(categories, used, size, text(card.rest) || 'Other') };
}

/**
 * Handles `storage` service requests: the volume of a storage card, read from the source its
 * config names (`prometheus` or `homeassistant`).
 * @param {Object} params - Request parameters; `card_id` is the card.
 * @returns {Promise<Object>} The volume in GB.
 */
export async function handleStorageRequest(params) {
    const card = findCard(params.card_id);
    if (card?.type !== 'storage') throw new HttpError(403, `Not a storage card: ${params.card_id}`);
    if (card.source === 'prometheus') return prometheusVolume(card);
    if (card.source === 'homeassistant') return homeAssistantVolume(card);
    throw new HttpError(400, 'Storage card has no source: set source to prometheus or homeassistant');
}
