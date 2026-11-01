import zlib from 'zlib';
import { findCard, getAllCards } from '../config.js';
import { HttpError, upstreamError } from '../errors.js';
import { getEntityState, haFetchRaw, haRequest } from './homeassistant.js';

/** Robots a multi-robot card shows; further ones are ignored. */
export const MAX_ROBOTS = 6;
const ENTITY = /^[a-z_]+\.[\w-]+$/;
const validId = (id) => typeof id === 'string' && ENTITY.test(id);
const MAP_CACHE_MS = 3000;
// A camera that isn't a Valetudo map stays that way; no need to load its picture to find out
const IMAGE_KIND_CACHE_MS = 60000;

/**
 * Reads the list settings of a robot: entries may be plain entity ids in YAML.
 * @param {*} list - The configured list.
 * @returns {Array<Object>} Entries with a valid `entity_id`.
 */
const entries = (list) => (Array.isArray(list) ? list : [])
    .map(e => (typeof e === 'string' ? { entity_id: e } : e))
    .filter(e => e && validId(e.entity_id));

/**
 * The settings of a robot, with invalid entries left out.
 * @param {Object} raw - A `vacuum` card, or a robot of a `vacuums` card.
 * @returns {Object} `entity_id`, `name`, `battery`, `progress`, `wetness`, `camera`, `map`,
 *   `stats`, `rooms` and `consumables`.
 */
export function robotSettings(raw) {
    const optional = (id) => (validId(id) ? id : null);
    return {
        entity_id: optional(raw?.entity_id),
        name: typeof raw?.name === 'string' ? raw.name : null,
        battery: optional(raw?.battery),
        progress: optional(raw?.progress),
        wetness: optional(raw?.wetness),
        camera: optional(raw?.camera),
        map: optional(raw?.map),
        stats: entries(raw?.stats),
        rooms: (Array.isArray(raw?.rooms) ? raw.rooms : []).filter(r => r && typeof r.area === 'string' && r.area),
        consumables: entries(raw?.consumables),
    };
}

/**
 * The robots of a vacuum card.
 * @param {Object} card - A `vacuum` or `vacuums` card.
 * @returns {Array<Object>} Their settings.
 */
export function robotsOf(card) {
    if (card?.type === 'vacuum') return [robotSettings(card)].filter(r => r.entity_id);
    if (card?.type === 'vacuums') {
        return (Array.isArray(card.robots) ? card.robots : [])
            .map(r => robotSettings(typeof r === 'string' ? { entity_id: r } : r))
            .filter(r => r.entity_id)
            .slice(0, MAX_ROBOTS);
    }
    return [];
}

/** Every entity on vacuum cards; their states may be read like other card entities. */
export function getVacuumEntityIds() {
    const ids = new Set();
    getAllCards().forEach(card => robotsOf(card).forEach(r => {
        [r.entity_id, r.battery, r.progress, r.wetness, r.camera, r.map].forEach(id => id && ids.add(id));
        r.stats.forEach(s => ids.add(s.entity_id));
        r.consumables.forEach(c => {
            ids.add(c.entity_id);
            if (validId(c.percent)) ids.add(c.percent);
        });
    }));
    return ids;
}

/**
 * Finds a vacuum card and, optionally, one of its robots.
 * @param {*} cardId - The card id.
 * @param {*} [entityId] - The robot's entity id.
 * @returns {{card: Object, robots: Array<Object>, robot?: Object}} The card and its robots.
 * @throws {HttpError} 403 for anything that isn't on a vacuum card.
 */
function lookUp(cardId, entityId) {
    const card = findCard(cardId);
    const robots = robotsOf(card);
    if (robots.length === 0) throw new HttpError(403, `Not a vacuum card: ${cardId}`);
    if (entityId === undefined) return { card, robots };
    const robot = robots.find(r => r.entity_id === entityId);
    if (!robot) throw new HttpError(403, `Robot not on this card: ${entityId}`);
    return { card, robots, robot };
}

const toNumber = (v) => {
    const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
    return v === null || v === undefined || !Number.isFinite(n) ? null : n;
};

/**
 * Loads what the vacuum cards show for one robot.
 * @param {Object} robot - The robot's settings.
 * @returns {Promise<Object>} Its state, controls, stats, rooms and consumables.
 */
async function robotData(robot) {
    const ids = new Set([robot.entity_id, robot.battery, robot.progress, robot.wetness,
        ...robot.stats.map(s => s.entity_id),
        ...robot.consumables.flatMap(c => [c.entity_id, validId(c.percent) ? c.percent : null])]);
    ids.delete(null);
    const list = [...ids];
    const loaded = await Promise.all(list.map(id => getEntityState(id).catch(() => null)));
    const states = Object.fromEntries(list.map((id, i) => [id, loaded[i]]));
    const main = states[robot.entity_id];
    const a = main?.attributes || {};
    const percentOf = (id) => {
        const n = toNumber(states[id]?.state);
        return n === null ? null : Math.min(100, Math.max(0, n));
    };

    const stats = robot.stats.map(s => {
        const state = states[s.entity_id];
        const value = s.attribute ? state?.attributes?.[s.attribute] : state?.state;
        return {
            name: s.name || (s.attribute ? s.attribute.replace(/_/g, ' ') : state?.attributes?.friendly_name) || s.entity_id,
            value: value ?? null,
            unit: s.unit ?? (s.attribute ? '' : state?.attributes?.unit_of_measurement || ''),
            battery: !s.attribute && state?.attributes?.device_class === 'battery',
        };
    });
    // The battery: its own setting, else the first battery among the stats, else the robot's attribute
    const batteryId = robot.battery || robot.stats.find(s => !s.attribute && states[s.entity_id]?.attributes?.device_class === 'battery')?.entity_id;
    const battery = batteryId ? percentOf(batteryId) : toNumber(a.battery_level);

    const wet = robot.wetness ? states[robot.wetness] : null;
    return {
        entity_id: robot.entity_id,
        name: robot.name || a.friendly_name || robot.entity_id,
        state: main?.state ?? 'unavailable',
        battery,
        progress: robot.progress ? percentOf(robot.progress) : null,
        fan: { value: a.fan_speed ?? null, options: Array.isArray(a.fan_speed_list) ? a.fan_speed_list : [] },
        wetness: robot.wetness ? { value: wet?.state ?? null, options: Array.isArray(wet?.attributes?.options) ? wet.attributes.options : [] } : null,
        stats,
        rooms: robot.rooms.map(r => ({ name: r.name || r.area, area: r.area, segment: r.segment === undefined ? null : String(r.segment) })),
        consumables: robot.consumables.map((c, index) => {
            const state = states[c.entity_id];
            const value = c.attribute ? state?.attributes?.[c.attribute] : state?.state;
            return {
                index,
                name: c.name || state?.attributes?.friendly_name || c.entity_id,
                value: value ?? null,
                unit: c.unit ?? (c.attribute ? '' : state?.attributes?.unit_of_measurement || ''),
                percent: validId(c.percent) ? percentOf(c.percent) : null,
                resettable: validId(c.reset),
            };
        }),
        camera: robot.camera,
        map: robot.map,
    };
}

/**
 * Loads a vacuum card's robots.
 * @param {Object} params - `card_id`.
 * @returns {Promise<{robots: Array<Object>}>} The robots.
 */
export async function vacuumData(params) {
    const { robots } = lookUp(params.card_id);
    return { robots: await Promise.all(robots.map(robotData)) };
}

/**
 * Validates a vacuum action against the card and returns the Home Assistant service to call.
 * Only the card's robots, rooms, fan speeds, wetness options and reset buttons can be used.
 * @param {Object} params - `card_id`, `entity_id`, `action` and its value: `areas` for `clean_rooms`,
 *   `value` for `set_fan` and `set_wetness`, `index` for `reset_consumable`.
 * @param {(id: string) => Promise<Object|null>} [readState] - Reads a state (for tests).
 * @returns {Promise<{domain: string, service: string, body: Object}>} The call.
 * @throws {HttpError} 403 for anything not on the card, 400 for invalid values.
 */
export async function vacuumCall(params, readState = getEntityState) {
    const { robot } = lookUp(params.card_id, params.entity_id);
    const entity_id = robot.entity_id;
    const { action } = params;
    const simple = { start: 'start', pause: 'pause', stop: 'stop', return_to_base: 'return_to_base', locate: 'locate' };
    if (Object.hasOwn(simple, action)) return { domain: 'vacuum', service: simple[action], body: { entity_id } };

    if (action === 'clean_rooms') {
        const areas = params.areas;
        if (!Array.isArray(areas) || areas.length === 0) throw new HttpError(400, 'areas must list at least one room');
        const stranger = areas.find(area => !robot.rooms.some(r => r.area === area));
        if (stranger !== undefined) throw new HttpError(403, `Room not on this robot: ${stranger}`);
        return { domain: 'vacuum', service: 'clean_area', body: { entity_id, cleaning_area_id: areas } };
    }
    if (action === 'set_fan') {
        const state = await readState(entity_id);
        if (!(state?.attributes?.fan_speed_list || []).includes(params.value)) throw new HttpError(400, `Unknown fan speed: ${params.value}`);
        return { domain: 'vacuum', service: 'set_fan_speed', body: { entity_id, fan_speed: params.value } };
    }
    if (action === 'set_wetness') {
        if (!robot.wetness) throw new HttpError(403, 'This robot has no wetness control');
        const state = await readState(robot.wetness);
        if (!(state?.attributes?.options || []).includes(params.value)) throw new HttpError(400, `Unknown wetness: ${params.value}`);
        return { domain: 'select', service: 'select_option', body: { entity_id: robot.wetness, option: params.value } };
    }
    if (action === 'reset_consumable') {
        const reset = robot.consumables[Number(params.index)]?.reset;
        if (!validId(reset)) throw new HttpError(403, 'This consumable has no reset button');
        return { domain: 'button', service: 'press', body: { entity_id: reset } };
    }
    throw new HttpError(400, `Unknown vacuum action: ${action}`);
}

/**
 * Runs a vacuum action (see vacuumCall).
 * @param {Object} params - The action.
 * @returns {Promise<*>} Home Assistant's response.
 */
export async function vacuumAction(params) {
    const { domain, service, body } = await vacuumCall(params);
    return haRequest(`/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Reads the map JSON Valetudo embeds in its camera image (a compressed PNG text chunk).
 * @param {Buffer} buf - The image.
 * @returns {Object|null} The map, or null for any other image.
 */
export function readValetudoMap(buf) {
    if (buf.length < 16 || buf.subarray(1, 4).toString('latin1') !== 'PNG') return null;
    let offset = 8;
    while (offset + 8 <= buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.subarray(offset + 4, offset + 8).toString('latin1');
        if (type === 'zTXt') {
            const data = buf.subarray(offset + 8, offset + 8 + length);
            const nul = data.indexOf(0);
            if (data.subarray(0, nul).toString('latin1') === 'ValetudoMap') {
                try {
                    // After the keyword: its terminator and one byte for the compression method
                    return JSON.parse(zlib.inflateSync(data.subarray(nul + 2)).toString());
                } catch {
                    return null;
                }
            }
        }
        if (type === 'IEND') return null;
        offset += 12 + length;
    }
    return null;
}

/** SVG path of a layer's pixels, which come as runs of `x, y, length`. */
function pixelsPath(layer) {
    const runs = Array.isArray(layer.compressedPixels) ? layer.compressedPixels : [];
    let d = '';
    for (let i = 0; i + 2 < runs.length; i += 3) d += `M${runs[i]} ${runs[i + 1]}h${runs[i + 2]}v1h-${runs[i + 2]}z`;
    return d;
}

/**
 * Reduces a Valetudo map to what the minimal map draws, in pixel coordinates.
 * @param {Object} map - The map from readValetudoMap.
 * @returns {Object} `kind`, `viewBox`, `segments` (`id`, `name`, `d`, `x`, `y`), `floor`, `walls`,
 *   `path`, `robot` and `charger`.
 */
export function simplifyValetudoMap(map) {
    const size = Number(map.pixelSize) || 5;
    const layers = Array.isArray(map.layers) ? map.layers : [];
    const entities = Array.isArray(map.entities) ? map.entities : [];
    const dims = layers.map(l => l.dimensions).filter(Boolean);
    const min = (axis) => Math.min(...dims.map(d => d[axis].min));
    const max = (axis) => Math.max(...dims.map(d => d[axis].max));
    const PAD = 4;
    const viewBox = dims.length ? [min('x') - PAD, min('y') - PAD, max('x') - min('x') + PAD * 2 + 1, max('y') - min('y') + PAD * 2 + 1] : [0, 0, 100, 100];
    const point = (type) => {
        const e = entities.find(x => x.type === type && x.points?.length >= 2);
        return e ? { x: e.points[0] / size, y: e.points[1] / size, angle: e.metaData?.angle ?? 0 } : null;
    };
    const path = entities.filter(e => e.type === 'path').map(e => {
        let d = '';
        for (let i = 0; i + 1 < e.points.length; i += 2) d += `${i ? 'L' : 'M'}${+(e.points[i] / size).toFixed(1)} ${+(e.points[i + 1] / size).toFixed(1)}`;
        return d;
    }).join('');
    return {
        kind: 'valetudo',
        viewBox,
        segments: layers.filter(l => l.type === 'segment').map(l => ({
            id: String(l.metaData?.segmentId ?? ''),
            name: l.metaData?.name || '',
            active: Boolean(l.metaData?.active),
            d: pixelsPath(l),
            x: l.dimensions?.x?.avg ?? 0,
            y: l.dimensions?.y?.avg ?? 0,
        })),
        floor: layers.filter(l => l.type === 'floor').map(pixelsPath).join(''),
        walls: layers.filter(l => l.type === 'wall').map(pixelsPath).join(''),
        path,
        robot: point('robot_position'),
        charger: point('charger_location'),
    };
}

/**
 * Loads the image of a robot's camera or map entity through the server, because Home
 * Assistant's picture URLs need its access token.
 * @param {*} cardId - The vacuum card.
 * @param {string} entityId - Its `camera` or `map` entity.
 * @returns {Promise<{contentType: string, body: Buffer}>} The image.
 */
export async function fetchRobotImage(cardId, entityId) {
    const { robots } = lookUp(cardId);
    if (!robots.some(r => r.camera === entityId || r.map === entityId)) throw new HttpError(403, `Camera not on this card: ${entityId}`);
    const response = await haFetchRaw(`/camera_proxy/${encodeURIComponent(entityId)}`);
    if (!response.ok) throw await upstreamError('Home Assistant camera', response);
    return { contentType: response.headers.get('content-type') || 'image/jpeg', body: Buffer.from(await response.arrayBuffer()) };
}

const mapCache = new Map();

/** Clears cached maps. Intended for tests. */
export function resetMapCache() {
    mapCache.clear();
}

/**
 * What a robot's camera or map entity shows: a Valetudo camera becomes a minimal map, and any
 * other camera is shown as its image.
 * @param {Object} params - `card_id` and `entity_id` (a `camera` or `map` entity of the card).
 * @returns {Promise<Object>} `{ kind: 'image' }`, or the map (see simplifyValetudoMap).
 */
export async function vacuumMap(params) {
    const key = `${params.card_id}|${params.entity_id}`;
    const hit = mapCache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.promise;
    const entry = { at: Date.now(), ttl: MAP_CACHE_MS, promise: null };
    const promise = fetchRobotImage(params.card_id, String(params.entity_id)).then(({ body }) => {
        const map = readValetudoMap(body);
        if (!map) entry.ttl = IMAGE_KIND_CACHE_MS;
        return map ? simplifyValetudoMap(map) : { kind: 'image' };
    });
    entry.promise = promise;
    mapCache.set(key, entry);
    promise.catch(() => mapCache.delete(key));
    return promise;
}
