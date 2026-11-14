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
    if (/^[a-z]+$/i.test(background.trim()) && !['transparent', 'none', 'inherit', 'currentcolor'].includes(background.trim().toLowerCase())) {
        return background.trim();
    }
    return null;
}

/**
 * The most telling color of an image's pixels: their average, weighted toward saturated, opaque
 * pixels so white, black and grey parts of a logo count for little.
 * @param {Uint8ClampedArray} data - RGBA pixels.
 * @returns {string|null} `rgb(r, g, b)`, or null when the image has no color worth glowing in.
 */
export function dominantColor(data) {
    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] / 255;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const weight = alpha * saturation * saturation * (max / 255);
        r += data[i] * weight;
        g += data[i + 1] * weight;
        b += data[i + 2] * weight;
        total += weight;
    }
    // Almost nothing colored: a grey or monochrome logo
    if (total < (data.length / 4) * 0.02) return null;
    return `rgb(${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)})`;
}

/** Colors already read from images, by URL; null for images that have none or cannot be read. */
const sampled = new Map();

/**
 * Reads the color of an image, once per URL. Images from other sites can only be read when they
 * allow it (CORS); otherwise there is no color.
 * @param {string} src - The image URL.
 * @returns {Promise<string|null>} The color, or null.
 */
export function sampleImageColor(src) {
    if (sampled.has(src)) return sampled.get(src);
    const reading = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
            try {
                const size = 24;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, size, size);
                resolve(dominantColor(ctx.getImageData(0, 0, size, size).data));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
    sampled.set(src, reading);
    return reading;
}
