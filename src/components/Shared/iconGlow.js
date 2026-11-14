/** Colors written as hex, rgb() or hsl(), as they appear in a CSS background. */
const COLOR = /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi;

/**
 * The color an app icon glows in, worked out from its background: the color itself, or a mix of a
 * gradient's first and last colors. Styles that light icons up (Neon) use it.
 * @param {string|undefined} background - The icon's CSS background.
 * @returns {string|null} A CSS color, or null for no background, a variable or nothing to go by.
 */
export function iconGlow(background) {
    if (typeof background !== 'string' || !background.trim() || background.includes('var(')) return null;
    const colors = background.match(COLOR);
    if (colors?.length === 1) return colors[0];
    if (colors?.length > 1) return `color-mix(in srgb, ${colors[0]}, ${colors[colors.length - 1]})`;
    // A named color, such as `tomato`
    if (/^[a-z]+$/i.test(background.trim()) && background.trim() !== 'transparent') return background.trim();
    return null;
}
