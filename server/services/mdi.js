/**
 * Material Design Icons (the icons Home Assistant uses), served one by one as SVG so the
 * browser only loads the icons a dashboard shows.
 */

/** @type {Promise<*>|null} */
let paths = null;

/**
 * Turns an icon name like `lightbulb-off` into its export name in @mdi/js (`mdiLightbulbOff`).
 * @param {string} name - Icon name without the `mdi:` prefix.
 * @returns {string} The export name.
 */
export const exportName = (name) => `mdi${name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;

/**
 * Turns an export name in @mdi/js like `mdiPrinter3dNozzle` into its icon name (`printer-3d-nozzle`).
 * @param {string} key - The export name.
 * @returns {string} The icon name.
 */
export const iconName = (key) => key
    .slice(3)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])(?=[A-Z])/g, '$1-')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();

/**
 * Lists every MDI icon name, for searching them in the card editor.
 * @returns {Promise<string[]>} The icon names, sorted.
 */
export async function mdiNames() {
    paths ??= import('@mdi/js');
    return Object.keys(await paths).filter(key => key.startsWith('mdi')).map(iconName).sort();
}

/**
 * Returns the SVG of an MDI icon.
 * @param {string} name - Icon name without the `mdi:` prefix, e.g. `lightbulb-off`.
 * @returns {Promise<string|null>} The SVG, or null for unknown icons.
 */
export async function mdiSvg(name) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return null;
    // Loaded on first use: the full set is a few megabytes
    paths ??= import('@mdi/js');
    const path = (await paths)[exportName(name)];
    if (typeof path !== 'string') return null;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
}
