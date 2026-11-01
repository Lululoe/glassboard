/**
 * Shared helpers of the vacuum cards: states, value formatting and consumable levels.
 */

export const MAX_ROBOTS = 6;

const STATE_LABELS = {
    cleaning: 'Cleaning',
    paused: 'Paused',
    returning: 'Returning to dock',
    docked: 'Docked',
    idle: 'Stopped',
    error: 'Error',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
};

/**
 * Status line of a robot.
 * @param {Object} robot - The robot.
 * @returns {string} E.g. `Cleaning` or `Docked · 78%`.
 */
export function statusText(robot) {
    const label = STATE_LABELS[robot.state] || capitalize(robot.state);
    return robot.state === 'docked' && Number.isFinite(robot.battery) ? `${label} · ${Math.round(robot.battery)}%` : label;
}

export const isRunning = (robot) => robot.state === 'cleaning';
export const canStop = (robot) => ['cleaning', 'paused', 'returning', 'error'].includes(robot.state);
export const canDock = (robot) => ['cleaning', 'paused', 'idle', 'error'].includes(robot.state);

/** First letter in upper case, and underscores as spaces: `vacuum_and_mop` → `Vacuum and mop`. */
export function capitalize(text) {
    const s = String(text ?? '').replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const round = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString();

/**
 * Formats a state with its unit, in the unit people expect: seconds and minutes become minutes
 * or hours, and square centimeters become square meters.
 * @param {*} value - The state or attribute.
 * @param {string} [unit] - Its unit.
 * @returns {string} E.g. `12 min`, `136 h`, `9 m²`, `78%`, `No error`, or `–` without a value.
 */
export function formatValue(value, unit = '') {
    if (value === null || value === undefined || value === '' || value === 'unavailable' || value === 'unknown') return '–';
    const n = typeof value === 'boolean' ? NaN : Number(value);
    if (!Number.isFinite(n)) return capitalize(value);
    let amount = n;
    let label = unit;
    if (unit === 's' && Math.abs(n) >= 60) {
        amount = n / 60;
        label = 'min';
    }
    if ((unit === 's' || unit === 'min') && label === 'min' && Math.abs(amount) >= 90) {
        amount /= 60;
        label = 'h';
    }
    if (unit === 'cm²') {
        amount = n / 10000;
        label = 'm²';
    }
    if (!label) return round(amount);
    return /^[°%]/.test(label) ? `${round(amount)}${label}` : `${round(amount)} ${label}`;
}

/**
 * The bar of a consumable. With a percentage, the bar shows it and warns when low. Without one,
 * the bar is full and green as long as the sensor isn't zero.
 * @param {{value: *, percent: number|null}} part - The consumable.
 * @returns {{width: number, level: 'ok'|'low'|'empty'}} The bar's width in percent and its color.
 */
export function consumableLevel({ value, percent }) {
    if (Number.isFinite(percent)) {
        return { width: percent, level: percent <= 10 ? 'empty' : percent <= 20 ? 'low' : 'ok' };
    }
    const unknown = value === null || value === undefined || value === 'unavailable' || value === 'unknown';
    return unknown || Number(value) === 0 ? { width: 0, level: 'empty' } : { width: 100, level: 'ok' };
}

/**
 * What's left of a consumable, as text: its value and percentage, or just one of them when the
 * value is that percentage.
 * @param {{value: *, unit: string, percent: number|null}} part - The consumable.
 * @returns {string} E.g. `136 h`, `136 h · 15%` or `100%`.
 */
export function consumableText({ value, unit, percent }) {
    if (!Number.isFinite(percent)) return formatValue(value, unit);
    const share = `${Math.round(percent)}%`;
    return Number(value) === percent ? share : `${formatValue(value, unit)} · ${share}`;
}

/**
 * The extra sections of a two or three wide card, and how they share its columns beside the
 * main one: a column each if they fit, else the map beside the others, else a switch.
 * @param {Object} config - The card config (`show_map`, `show_stats`, `show_consumables`, `colSpan`).
 * @param {Object} robot - The robot; a section without content is left out.
 * @returns {{columns: string[][], tabs: boolean}} The sections per column, and whether the
 *   sections of the single column take turns.
 */
export function wideLayout(config, robot) {
    const free = (config.colSpan || 1) - 1;
    const sections = [
        config.show_map && robot.map && 'map',
        config.show_stats && robot.stats.length > 0 && 'stats',
        config.show_consumables && robot.consumables.length > 0 && 'consumables',
    ].filter(Boolean);
    if (free < 1 || sections.length === 0) return { columns: [], tabs: false };
    if (sections.length <= free) return { columns: sections.map(s => [s]), tabs: false };
    if (free === 1) return { columns: [sections], tabs: true };
    return { columns: [[sections[0]], sections.slice(1)], tabs: false };
}

/**
 * The room of a map segment: by the room's `segment` setting, else by name.
 * @param {{id: string, name: string}} segment - The map segment.
 * @param {Array<{name: string, segment: string|null}>} rooms - The robot's rooms.
 * @returns {Object|undefined} The room.
 */
export function roomOfSegment(segment, rooms) {
    return rooms.find(r => (r.segment !== null && r.segment !== undefined ? r.segment === segment.id : segment.name && r.name.toLowerCase() === segment.name.toLowerCase()));
}

/**
 * The URL of a robot's camera or map image, served through Glassboard's server.
 * @param {*} cardId - The card.
 * @param {string} entityId - The camera entity.
 * @param {number} tick - Changes to load a new picture.
 * @returns {string} The URL.
 */
export const cameraUrl = (cardId, entityId, tick) => `/api/ha/camera?card_id=${encodeURIComponent(cardId)}&entity_id=${encodeURIComponent(entityId)}&t=${tick}`;
