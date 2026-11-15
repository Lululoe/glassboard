/*
 * The dashboard's appearance: its style (design language) and accent color. Both apply to the
 * whole dashboard and are shared by the browser and the server. Light or dark and liquid glass
 * refraction are chosen per browser and are not part of it.
 */

/** Styles a dashboard can use. */
export const APPEARANCE_STYLES = ['glass', 'liquid', 'material', 'neon', 'terminal'];

/**
 * Styles the Theme menu offers, in its order. Terminal is held back for now: a dashboard set to it
 * in config.yaml still uses it, and the menu shows it only while it is chosen.
 */
export const MENU_STYLES = ['glass', 'liquid', 'material', 'neon'];

/** Names of the styles, as the Theme menu shows them. */
export const STYLE_NAMES = {
    glass: 'Glass',
    liquid: 'Liquid Glass',
    material: 'Material',
    neon: 'Neon',
    terminal: 'Terminal',
};

/** Accent colors offered in the Theme menu. Any `#rrggbb` color can be set in config.yaml. */
export const ACCENT_PRESETS = [
    { name: 'Blue', color: '#0a84ff' },
    { name: 'Indigo', color: '#5e5ce6' },
    { name: 'Purple', color: '#bf5af2' },
    { name: 'Pink', color: '#ff375f' },
    { name: 'Red', color: '#ff453a' },
    { name: 'Orange', color: '#ff9f0a' },
    { name: 'Green', color: '#30d158' },
    { name: 'Teal', color: '#40c8e0' },
    { name: 'Graphite', color: '#8e8e93' },
];

/**
 * Whether a value is an accent color.
 * @param {*} value - The value.
 * @returns {boolean} True for `#rrggbb`.
 */
export const isAccent = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/**
 * Relative luminance of a color, as WCAG defines it.
 * @param {string} hex - `#rrggbb`.
 * @returns {number} From 0 (black) to 1 (white).
 */
export function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map(i => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The ink for labels on a fill of the accent color, such as the Done button or a selected
 * segment. Those labels are bold, which needs a contrast of 3:1 (4.5:1 for regular text), so
 * white stays wherever it reaches 3:1, as on Apple's blue; lighter accents get near-black.
 * @param {string} accent - `#rrggbb`.
 * @returns {string} `#fff` or `#1c1c1e`.
 */
export function onAccent(accent) {
    return 1.05 / (luminance(accent) + 0.05) >= 3 ? '#fff' : '#1c1c1e';
}

/** Styles whose cards are see-through, with a transparency the Theme menu can change. */
export const TRANSPARENT_STYLES = ['glass', 'liquid'];

/** The transparency of a style's own look: the middle of the slider. */
export const DEFAULT_TRANSPARENCY = 0.5;

/**
 * Whether a value is a transparency.
 * @param {*} value - The value.
 * @returns {boolean} True for a number from 0 (solid) to 1 (clearest).
 */
export const isTransparency = (value) => typeof value === 'number' && value >= 0 && value <= 1;

/**
 * Reads an appearance setting, dropping what isn't valid.
 * @param {*} value - The `appearance` of the config.
 * @returns {{style: string, accent: string|null, transparency: number}} The style (Glass when unset), the accent
 *   (null for the theme's) and the transparency of Glass and Liquid Glass cards (0.5 when unset).
 */
export function normalizeAppearance(value) {
    const style = APPEARANCE_STYLES.includes(value?.style) ? value.style : 'glass';
    return {
        style,
        accent: isAccent(value?.accent) ? value.accent.toLowerCase() : null,
        transparency: isTransparency(value?.transparency) ? value.transparency : DEFAULT_TRANSPARENCY,
    };
}

/**
 * The two CSS variables the card surfaces of Glass and Liquid Glass are faded with (see
 * `fadeSurface`). Below the middle, `--surface-solid` brings their opacity up toward solid;
 * above it, `--surface-clear` takes it down to a quarter.
 * @param {string} style - The style.
 * @param {number} transparency - From 0 (solid) to 1 (clearest); 0.5 is the style's own look.
 * @returns {Object<string, string>} The variables, empty for styles without a transparency.
 */
export function transparencyVariables(style, transparency) {
    if (!TRANSPARENT_STYLES.includes(style)) return {};
    const t = isTransparency(transparency) ? transparency : DEFAULT_TRANSPARENCY;
    const solid = Math.max(0, (0.5 - t) * 2);
    const clear = 1 - Math.max(0, (t - 0.5) * 2) * 0.75;
    return { '--surface-solid': String(Math.round(solid * 1000) / 1000), '--surface-clear': String(Math.round(clear * 1000) / 1000) };
}

/** Theme colors of the card surfaces that the transparency fades. */
export const SURFACE_TOKENS = ['--bg-card-surface', '--bg-card-glass', '--bg-card-glass-header'];

/**
 * Makes the opacity of every rgba() color in a CSS value follow the transparency variables, so
 * a theme's own surface colors and gradients can be faded or made solid.
 * @param {string} value - A color or gradient, such as `rgba(0, 0, 0, 0.75)`.
 * @returns {string} The value, with each rgba() opacity a calc() of the variables.
 */
export function fadeSurface(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/rgba\(\s*([^,()]+),\s*([^,()]+),\s*([^,()]+),\s*([0-9.]+)\s*\)/g, (_m, r, g, b, a) => (
        `rgba(${r}, ${g}, ${b}, calc((${a} + (1 - ${a}) * var(--surface-solid, 0)) * var(--surface-clear, 1)))`
    ));
}

/**
 * The CSS variables an accent color sets: the primary color the dashboard uses for buttons,
 * highlights, switches and graphs, with a lighter and a darker shade.
 * @param {string|null} accent - The accent, `#rrggbb`, or null for the theme's own.
 * @returns {Object<string, string>} Variables to set on the document, empty without an accent.
 */
export function accentVariables(accent) {
    if (!isAccent(accent)) return {};
    return {
        '--color-primary': accent,
        '--on-accent': onAccent(accent),
        '--color-primary-light': `color-mix(in srgb, ${accent} 65%, #fff)`,
        '--color-primary-dark': `color-mix(in srgb, ${accent} 70%, #000)`,
        '--system-blue': accent,
        '--system-blue-text': `color-mix(in srgb, ${accent} 78%, var(--text-primary))`,
        '--focus-ring': `0 0 0 3px color-mix(in srgb, ${accent} 70%, transparent)`,
    };
}
