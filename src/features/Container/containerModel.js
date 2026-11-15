import { isSubTile, sizeOf } from '../../components/Grid/gridLayout';

/** How much smaller the cards inside are drawn, unless the container sets `scale`. */
export const DEFAULT_SCALE = 0.88;

/** The smallest scale a container draws its cards at. */
export const MIN_SCALE = 0.6;

/**
 * Returns the scale the container draws its cards at.
 * @param {Object} config - The container's config.
 * @returns {number} A factor between 0.6 and 1.
 */
export function scaleOf(config) {
    const value = Number(config?.scale);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_SCALE;
    return Math.min(1, Math.max(MIN_SCALE, value));
}

/**
 * Returns the number of columns inside a container: as many as it is wide.
 * @param {Object} config - The container's config, as shown.
 * @returns {number} 1 to 3.
 */
export function columnsOf(config) {
    const size = sizeOf(config);
    return isSubTile(size) ? 1 : Number(size);
}

/**
 * Creates an id for a card added to a container that no other card uses.
 * @param {string} type - The card type.
 * @param {Set<string>} taken - Ids already in use.
 * @returns {string} A new id such as `weather-k3f9`.
 */
export function newChildId(type, taken) {
    for (;;) {
        const id = `${type}-${Math.random().toString(36).slice(2, 6)}`;
        if (!taken.has(id)) return id;
    }
}
