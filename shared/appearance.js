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

/**
 * Reads an appearance setting, dropping what isn't valid.
 * @param {*} value - The `appearance` of the config.
 * @returns {{style: string, accent: string|null}} The style (Glass when unset) and the accent (null for the theme's).
 */
export function normalizeAppearance(value) {
    const style = APPEARANCE_STYLES.includes(value?.style) ? value.style : 'glass';
    return { style, accent: isAccent(value?.accent) ? value.accent.toLowerCase() : null };
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
