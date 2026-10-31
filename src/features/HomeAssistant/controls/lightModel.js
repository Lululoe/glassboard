/**
 * What the control dialogs know about lights: their abilities, colors and presets.
 * Works on Home Assistant states, so it can be used for any light, switch or group.
 */

/** Default color presets. White presets set a color temperature, the others a hue and saturation. */
export const PRESETS = [
    { name: 'Warm', ct: 2700 },
    { name: 'Neutral', ct: 4000 },
    { name: 'Daylight', ct: 6500 },
    { name: 'Sunset', h: 24, s: 85 },
    { name: 'Rose', h: 335, s: 60 },
    { name: 'Lavender', h: 268, s: 45 },
    { name: 'Ocean', h: 205, s: 80 },
    { name: 'Forest', h: 135, s: 60 },
];

const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];

/**
 * Reads what an entity can do from its state.
 * - `color`: hue and saturation (and white tones if supported),
 * - `ct`: white tones only,
 * - `dim`: brightness only,
 * - `onoff`: switch only (also every non-light entity).
 * @param {Object|null|undefined} state - The entity's Home Assistant state.
 * @param {string} entityId - The entity id.
 * @returns {'color'|'ct'|'dim'|'onoff'} The capability.
 */
export function capabilityOf(state, entityId) {
    if (!String(entityId).startsWith('light.')) return 'onoff';
    const modes = Array.isArray(state?.attributes?.supported_color_modes) ? state.attributes.supported_color_modes : [];
    if (modes.some(m => COLOR_MODES.includes(m))) return 'color';
    if (modes.includes('color_temp')) return 'ct';
    if (modes.includes('brightness') || modes.includes('white')) return 'dim';
    return 'onoff';
}

/**
 * Turns a Home Assistant state into the light the dialogs show. Values Home Assistant leaves
 * out while a light is off (brightness, color) keep sensible defaults.
 * @param {string} entityId - The entity id.
 * @param {Object|null|undefined} state - The entity's state.
 * @param {Object} [override] - Optimistic changes not yet confirmed by Home Assistant.
 * @param {string} [name] - Name from the card config.
 * @returns {Object} The light.
 */
export function toLight(entityId, state, override = {}, name) {
    const a = state?.attributes || {};
    const caps = capabilityOf(state, entityId);
    const ctMin = Number(a.min_color_temp_kelvin) || 2000;
    const ctMax = Number(a.max_color_temp_kelvin) || 6500;
    const [h = 30, s = 50] = Array.isArray(a.hs_color) ? a.hs_color : [];
    const base = {
        id: entityId,
        name: name || a.friendly_name || entityId,
        available: Boolean(state) && state.state !== 'unavailable' && state.state !== 'unknown',
        caps,
        on: state?.state === 'on',
        bri: Number.isFinite(a.brightness) ? Math.max(1, Math.round(a.brightness / 2.55)) : 100,
        mode: a.color_mode === 'color_temp' || caps === 'ct' ? 'ct' : COLOR_MODES.includes(a.color_mode) ? 'hs' : 'ct',
        h,
        s,
        ct: Number(a.color_temp_kelvin) || 3000,
        ctMin,
        ctMax,
    };
    return { ...base, ...override };
}

/** Whether the light can be dimmed. */
export const isDimmable = (light) => light.caps !== 'onoff';

/** Whether the light shows a white tone right now (or only has white tones). */
export const isWhite = (light) => light.caps !== 'color' || light.mode === 'ct';

/**
 * Approximate RGB of a color temperature, after Tanner Helland's formula.
 * @param {number} kelvin - Color temperature.
 * @returns {[number, number, number]} RGB, 0-255.
 */
export function kelvinToRgb(kelvin) {
    const t = kelvin / 100;
    let r;
    let g;
    let b;
    if (t <= 66) {
        r = 255;
        g = 99.47 * Math.log(t) - 161.12;
        b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    } else {
        r = 329.7 * (t - 60) ** -0.1332;
        g = 288.12 * (t - 60) ** -0.0755;
        b = 255;
    }
    return /** @type {[number, number, number]} */ ([r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v)))));
}

/** CSS color for a hue and saturation, kept light enough to read text on. */
export const hsCss = (h, s) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(68 - s * 0.18)}%)`;

/** CSS color of a light's current color. */
export const lightCss = (light) => (isWhite(light) ? `rgb(${kelvinToRgb(light.ct).join(' ')})` : hsCss(light.h, light.s));

/** CSS color of a preset swatch. */
export const presetCss = (preset) => (preset.ct ? `rgb(${kelvinToRgb(preset.ct).join(' ')})` : hsCss(preset.h, preset.s));

/** Background of the light's icon circle when on: its color for colored lights, yellow otherwise. */
export const iconCss = (light) => {
    if (!light.on) return undefined;
    return light.caps === 'color' && light.mode === 'hs' ? `hsl(${Math.round(light.h)} ${Math.round(Math.max(light.s, 55))}% 52%)` : 'var(--system-yellow)';
};

/** Presets a light can show: all for color lights, white ones for white lights, none otherwise. */
export const presetsFor = (light) => {
    if (light.caps === 'color') return PRESETS;
    if (light.caps === 'ct') return PRESETS.filter(p => p.ct);
    return [];
};

/** Whether a preset matches the light's current color. */
export function presetActive(light, preset) {
    if (!light.on) return false;
    if (preset.ct) return isWhite(light) && Math.abs(preset.ct - light.ct) < 150;
    return light.mode === 'hs' && Math.abs(preset.h - light.h) < 8 && Math.abs(preset.s - light.s) < 8;
}

/**
 * Short state line, e.g. `80% · Sunset`, `On` or `Off`.
 * @param {Object} light - The light.
 * @returns {string} The state text.
 */
export function stateText(light) {
    if (!light.available) return 'Unavailable';
    if (!light.on) return 'Off';
    if (!isDimmable(light)) return 'On';
    const preset = presetsFor(light).find(p => presetActive(light, p));
    let color = '';
    if (light.caps === 'color' || light.caps === 'ct') color = preset ? preset.name : isWhite(light) ? `${light.ct} K` : 'Custom color';
    return [`${light.bri}%`, color].filter(Boolean).join(' · ');
}
