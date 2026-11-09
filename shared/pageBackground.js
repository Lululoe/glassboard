/*
 * Page background settings, shared by the browser (which applies them while the dashboard
 * runs) and the server (which puts them into the page it sends, so the first paint already
 * shows them).
 */

/** Colors offered for the page gradient; the first is the default theme's. */
export const BACKGROUND_COLORS = ['#0061d4', '#5e3bd1', '#a0309c', '#c2372f', '#d26b12', '#1f8a4c', '#0f7c8c', '#3c4250'];

/**
 * Whether a value is a color the page gradient can be made from.
 * @param {*} value - The value.
 * @returns {boolean} True for `#rrggbb`.
 */
export const isBackgroundColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/**
 * Whether a value is a picture URL the page can show: a web address or a path on this server.
 * @param {*} value - The value.
 * @returns {boolean} True for `http(s)://…` and `/…`.
 */
export const isBackgroundImage = (value) => typeof value === 'string' && /^(https?:\/\/|\/)/.test(value);

/**
 * Builds the page gradient from one color, the way the default theme's gradient is built: a
 * darker shade top left, the color in the middle, and a lighter (light mode) or darker (dark
 * mode) shade bottom right.
 * @param {string} color - The color, `#rrggbb`.
 * @param {'light'|'dark'} mode - The appearance.
 * @returns {string} A CSS gradient.
 */
export function gradientFrom(color, mode) {
    const end = mode === 'dark' ? `color-mix(in srgb, ${color} 45%, #000)` : `color-mix(in srgb, ${color} 75%, #fff)`;
    return `linear-gradient(135deg, color-mix(in srgb, ${color} 55%, #000) 0%, ${color} 50%, ${end} 100%)`;
}

/**
 * Returns the CSS for a page background setting: the image layer that replaces the theme's
 * gradient, and how much to darken it. Settings that are missing or invalid give the theme's own.
 * @param {{color?: string, image?: string, dim?: number}|null|undefined} background - The setting.
 * @param {'light'|'dark'} mode - The appearance.
 * @returns {{image: string|null, dim: number}} The image layer (null for the theme's), and the dimming from 0 to 1.
 */
export function backgroundCss(background, mode) {
    if (isBackgroundImage(background?.image)) {
        const dim = Number(background.dim);
        // `<` is escaped so the value can also sit inside a <style> element
        const url = JSON.stringify(background.image).replace(/</g, '\\3c ');
        return { image: `url(${url})`, dim: Number.isFinite(dim) ? Math.min(0.8, Math.max(0, dim)) : 0 };
    }
    if (isBackgroundColor(background?.color)) return { image: gradientFrom(background.color, mode), dim: 0 };
    return { image: null, dim: 0 };
}
