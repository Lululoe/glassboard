/**
 * Converts between the icon values cards store (`lu-Clock`, or `{ source, value, color }` in
 * Icon.jsx's object form) and what the icon editor works with: a reference string and a color.
 */

const OBJECT_PREFIX = { lucide: 'lu-', mdi: 'mdi:', sh: 'sh-', local: 'local-', url: '' };

/** Color of a monochrome icon that follows the text color, instead of the file's own white. */
export const FOLLOW_TEXT = 'currentColor';

/**
 * Reads a stored icon.
 * @param {string|Object} [icon] - The value from the config.
 * @returns {{ref: string, color: (string|undefined)}} Its reference string and color.
 */
export function readIcon(icon) {
    if (icon && typeof icon === 'object') {
        const prefix = OBJECT_PREFIX[icon.source] ?? '';
        return { ref: `${prefix}${icon.value ?? ''}`, color: icon.color };
    }
    return { ref: icon || '', color: undefined };
}

/**
 * Writes an icon as apps and links store it: a string, or the object form when it has a color.
 * @param {string} ref - The reference string.
 * @param {string} [color] - The icon color.
 * @returns {string|Object} The value for the config.
 */
export function writeIcon(ref, color) {
    if (!color) return ref;
    const entry = Object.entries(OBJECT_PREFIX).find(([, prefix]) => prefix && ref.startsWith(prefix));
    return entry
        ? { source: entry[0], value: ref.slice(entry[1].length), color }
        : { source: 'url', value: ref, color };
}

/**
 * Tells which tab of the icon picker an icon belongs to.
 * @param {string} ref - The reference string.
 * @returns {'lucide'|'mdi'|'selfhst'|'image'} The tab.
 */
export function iconTab(ref) {
    if (ref.startsWith('mdi:') || ref.startsWith('mdi-')) return 'mdi';
    if (ref.startsWith('sh-')) return 'selfhst';
    if (/^https?:/.test(ref) || ref.startsWith('local-')) return 'image';
    return 'lucide';
}

/**
 * Whether a reference is a monochrome selfh.st icon.
 * @param {string} ref - The reference string.
 * @returns {boolean} True for e.g. `sh-plex-light`.
 */
export const isMonochrome = (ref) => /^sh-.+-(light|dark)$/.test(ref);

/**
 * Whether an icon can take a color: drawn icons and SVGs, but not full-color icons or PNGs.
 * @param {string} ref - The reference string.
 * @returns {boolean} Whether the icon color applies.
 */
export function canTakeColor(ref) {
    const tab = iconTab(ref);
    if (tab === 'lucide' || tab === 'mdi') return Boolean(ref);
    if (tab === 'selfhst') return isMonochrome(ref);
    return ref.startsWith('local-') ? !ref.endsWith('-png') : /\.svg(\?|$)/i.test(ref);
}

/**
 * Works out the color to store for an icon. A monochrome file is white, which disappears on a
 * light tile, so without a chosen color it follows the text color.
 * @param {string} ref - The reference string.
 * @param {string} [color] - The chosen color.
 * @returns {string|undefined} The color to store.
 */
export function storedColor(ref, color) {
    if (isMonochrome(ref)) return color || FOLLOW_TEXT;
    return canTakeColor(ref) && color !== FOLLOW_TEXT ? color : undefined;
}
