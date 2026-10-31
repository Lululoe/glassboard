/**
 * Home Assistant leaves out brightness and color while a light is off. The control dialog
 * keeps showing the last ones it saw (also after a reload), so its sliders don't jump to
 * defaults when a light is switched off, and back when it comes on again.
 */

const STORAGE_KEY = 'glassboard.lastLightColors';
const colors = load();

/**
 * Reads the remembered colors from local storage.
 * @returns {Map<string, Object>} Last known values per entity id.
 */
function load() {
    try {
        return new Map(Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')));
    } catch {
        return new Map();
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(colors)));
    } catch {
        // Private mode or storage full: remembered for this visit only
    }
}

/**
 * The last brightness and color seen for a light.
 * @param {string} entityId - The light.
 * @returns {{bri?: number, h?: number, s?: number, ct?: number, mode?: 'hs'|'ct'}} Known values.
 */
export const lastColorOf = (entityId) => colors.get(entityId) || {};

/**
 * Remembers what a light's state reports about its brightness and color.
 * @param {string} entityId - The light.
 * @param {Object|null|undefined} state - Its Home Assistant state.
 */
export function rememberColor(entityId, state) {
    const a = state?.attributes;
    if (!a || state.state !== 'on') return;
    const next = { ...colors.get(entityId) };
    if (Number.isFinite(a.brightness)) next.bri = Math.max(1, Math.round(a.brightness / 2.55));
    if (Array.isArray(a.hs_color)) [next.h, next.s] = a.hs_color;
    if (Number.isFinite(a.color_temp_kelvin)) next.ct = a.color_temp_kelvin;
    if (a.color_mode === 'color_temp') next.mode = 'ct';
    else if (['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(a.color_mode)) next.mode = 'hs';
    const before = colors.get(entityId);
    if (before && Object.keys(next).every(k => before[k] === next[k])) return;
    colors.set(entityId, next);
    save();
}
