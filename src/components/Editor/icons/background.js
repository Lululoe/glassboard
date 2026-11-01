/** Backgrounds every icon can pick, besides the card's default and the user's own presets. */
export const BACKGROUND_PRESETS = [
    { value: '#0a84ff', name: 'Blue' },
    { value: '#40c8e0', name: 'Teal' },
    { value: '#30d158', name: 'Green' },
    { value: '#ff9f0a', name: 'Orange' },
    { value: '#ff453a', name: 'Red' },
    { value: '#bf5af2', name: 'Purple' },
    { value: '#ff375f', name: 'Pink' },
    { value: 'linear-gradient(45deg, #03a9f4, #03ecf4, #03f4c4)', name: 'Ocean' },
    { value: 'linear-gradient(45deg, #ff7b00, #ffb700)', name: 'Sunset' },
    { value: 'linear-gradient(45deg, #16a34a, #4ade80)', name: 'Forest' },
    { value: 'linear-gradient(180deg, #5ac8fa, #0a84ff)', name: 'Sky' },
];

/** Most colors a gradient can have in the builder. */
export const MAX_STOPS = 4;

const COLOR = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi;

/**
 * Splits a CSS color into a 6-digit hex value and an opacity.
 * @param {string} color - A hex, rgb() or rgba() color.
 * @returns {{hex: string, opacity: number}} The color, and its opacity from 0 to 100.
 */
function parseColor(color) {
    if (color.startsWith('#')) {
        if (color.length === 4) return { hex: `#${[...color.slice(1)].map(c => c + c).join('')}`.toLowerCase(), opacity: 100 };
        const opacity = color.length === 9 ? Math.round(parseInt(color.slice(7), 16) / 2.55) : 100;
        return { hex: color.slice(0, 7).toLowerCase(), opacity };
    }
    const [r, g, b, a = 1] = color.match(/[\d.]+/g).map(Number);
    return {
        hex: `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`,
        opacity: Math.round(a * 100),
    };
}

/**
 * Reads a CSS background into the builder's fields. What the fields can't represent, such as
 * theme variables or images, stays editable as plain CSS.
 * @param {string} [value] - The CSS background.
 * @returns {{type: ('none'|'solid'|'linear'|'radial'|'css'), stops: string[], angle: number, opacity: number, css: string}} The fields.
 */
export function parseBackground(value) {
    const fields = {
        type: /** @type {'none'|'solid'|'linear'|'radial'|'css'} */ ('linear'),
        stops: ['#3a3a3c', '#1c1c1e'],
        angle: 180,
        opacity: 100,
        css: '',
    };
    if (!value) return fields;
    if (value === 'transparent') return { ...fields, type: 'none' };

    const type = /^linear-gradient/.test(value) ? 'linear'
        : /^radial-gradient/.test(value) ? 'radial'
        : /^(#|rgb)/.test(value) ? 'solid'
        : null;
    const colors = value.match(COLOR);
    const rest = type === 'solid' ? value.replace(COLOR, '').trim() : '';
    if (!type || !colors || rest) return { ...fields, type: 'css', css: value };

    const parsed = colors.map(parseColor);
    return {
        ...fields,
        type,
        stops: type === 'solid' ? [parsed[0].hex] : parsed.map(c => c.hex),
        angle: Number(value.match(/(\d+)deg/)?.[1] ?? 180),
        opacity: parsed[0].opacity,
        css: value,
    };
}

/**
 * Writes the builder's fields as a CSS background.
 * @param {{type: string, stops: string[], angle: number, opacity: number, css: string}} fields - The fields.
 * @returns {string} The CSS background.
 */
export function composeBackground({ type, stops, angle, opacity, css }) {
    if (type === 'none') return 'transparent';
    if (type === 'css') return css;
    const alpha = opacity < 100 ? Math.round(opacity * 2.55 + 0.01).toString(16).padStart(2, '0') : '';
    const colors = stops.map(color => color + alpha);
    if (type === 'solid') return colors[0];
    return type === 'radial'
        ? `radial-gradient(circle at 30% 30%, ${colors.join(', ')})`
        : `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

/**
 * Changes the builder's style, keeping the colors that still apply.
 * @param {Object} fields - The current fields.
 * @param {string} type - The new style.
 * @returns {Object} The updated fields.
 */
export function withBackgroundType(fields, type) {
    const next = { ...fields, type };
    if (type === 'css') next.css = fields.type === 'none' ? '' : composeBackground(fields);
    if (type === 'solid') next.stops = fields.stops.slice(0, 1);
    if ((type === 'linear' || type === 'radial') && fields.stops.length < 2) next.stops = [fields.stops[0], '#1c1c1e'];
    return next;
}
