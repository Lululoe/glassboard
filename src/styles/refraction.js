/*
 * Liquid glass refraction: the rim of a glass surface bends what is behind it, like the edge of
 * a lens. Each surface gets an SVG displacement filter that pushes the backdrop inward near its
 * rounded edge and leaves the middle untouched, set as `--refraction` for its stylesheet to use
 * in `backdrop-filter`. Only Chromium draws SVG filters as backdrop filters; elsewhere the
 * stylesheet's plain blur stays.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** How the glass bends and frosts. */
export const REFRACTION_OPTIONS = { scale: 44, bezel: 22, blur: 2.5, saturate: 1.8 };

/**
 * Whether this browser draws SVG filters behind elements (`backdrop-filter: url(#…)`). Chromium
 * does; Safari, Firefox and every iOS browser (which all use WebKit) do not.
 * @param {string} [userAgent] - The user agent, the browser's own by default.
 * @returns {boolean} Whether refraction can be shown.
 */
export function refractionSupported(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
    if (/CriOS|FxiOS|EdgiOS|Firefox/.test(userAgent)) return false;
    return /Chrome\/|Chromium\//.test(userAgent);
}

/**
 * The displacement at one point of a rounded rectangle: how far, as a fraction of the filter's
 * scale, the backdrop there is taken from further inside. Zero in the middle, strongest at the rim.
 * @param {number} x - Distance from the left edge.
 * @param {number} y - Distance from the top edge.
 * @param {number} w - Width.
 * @param {number} h - Height.
 * @param {number} r - Corner radius.
 * @param {number} bezel - Width of the rim that bends.
 * @returns {{dx: number, dy: number}} Offsets from -1 to 1.
 */
export function displacementAt(x, y, w, h, r, bezel) {
    const px = x - w / 2;
    const py = y - h / 2;
    const qx = Math.abs(px) - (w / 2 - r);
    const qy = Math.abs(py) - (h / 2 - r);
    // Signed distance to the rounded rectangle, negative inside
    const inside = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
    if (inside >= bezel) return { dx: 0, dy: 0 };
    let nx = 0;
    let ny = 0;
    if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy) || 1;
        nx = qx / length;
        ny = qy / length;
    } else if (qx > qy) nx = 1;
    else ny = 1;
    const t = 1 - Math.max(inside, 0) / bezel;
    const strength = t * t;
    return { dx: -(Math.sign(px) || 1) * nx * strength, dy: -(Math.sign(py) || 1) * ny * strength };
}

/**
 * Draws the displacement map of a rounded rectangle: red is the x offset, green the y offset,
 * 128 no offset.
 * @param {number} w - Width in CSS pixels.
 * @param {number} h - Height in CSS pixels.
 * @param {number} r - Corner radius.
 * @param {number} bezel - Width of the rim that bends.
 * @returns {string|null} A PNG data URL, or null when the browser can't draw one.
 */
function displacementMap(w, h, r, bezel) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(w, h);
    const data = image.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const { dx, dy } = displacementAt(x + 0.5, y + 0.5, w, h, r, bezel);
            const i = (y * w + x) * 4;
            data[i] = 128 + dx * 127;
            data[i + 1] = 128 + dy * 127;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL();
}

/** How long an element's size must hold still before its filter is redrawn, in ms. */
const SETTLE_MS = 120;

/**
 * Glass inside these is left frosted: previews in editor windows are scaled with `zoom` and sit on
 * a window that blurs the page itself, where bent rims only cost redraws and flicker.
 */
const SKIPPED_INSIDE = 'dialog, [inert]';

/**
 * Starts refracting every element matching a selector, now and as elements come and go or
 * change size. Elements of the same size and corner radius share one filter.
 *
 * A filter's displacement map is an image the browser decodes on its own time, and until it has,
 * the filter draws nothing. So an element keeps the filter it has until the one for its new size
 * is decoded, and sizes are only followed once they have held still for a moment: an element being
 * resized or animated never switches filters frame by frame, which shows as flicker.
 * @param {string} selector - Elements to refract.
 * @param {Partial<typeof REFRACTION_OPTIONS>} [options] - How the glass bends and frosts.
 * @returns {() => void} Stops refracting and removes the filters.
 */
export function startRefraction(selector, options = {}) {
    const o = { ...REFRACTION_OPTIONS, ...options };
    const host = document.createElementNS(SVG_NS, 'svg');
    host.setAttribute('width', '0');
    host.setAttribute('height', '0');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'absolute';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    /** @type {Map<string, {id: string, users: number, ready: Promise<void>}>} Filters by size and radius. */
    const filters = new Map();
    /** @type {Map<HTMLElement, {key: string|null, wanted: string|null, timer: number}>} Each element's filter. */
    const elements = new Map();
    let count = 0;
    let stopped = false;

    const release = (key) => {
        const filter = key && filters.get(key);
        if (!filter || --filter.users > 0) return;
        host.querySelector(`#${filter.id}`)?.remove();
        filters.delete(key);
    };

    /**
     * Takes a use of the filter for a size and radius, making it if needed.
     * @returns {string|null} Its key, or null when the browser can't draw one.
     */
    const acquire = (w, h, r) => {
        const key = `${w}x${h}x${r}`;
        const existing = filters.get(key);
        if (existing) {
            existing.users++;
            return key;
        }
        const map = displacementMap(w, h, r, Math.min(o.bezel, Math.min(w, h) / 2));
        if (!map) return null;
        const id = `glassboard-refraction-${++count}`;
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.id = id;
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(w));
        filter.setAttribute('height', String(h));
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        filter.innerHTML = `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`
            + `<feGaussianBlur in="SourceGraphic" stdDeviation="${o.blur}" result="frost"/>`
            + `<feDisplacementMap in="frost" in2="map" scale="${o.scale}" xChannelSelector="R" yChannelSelector="G" result="bent"/>`
            + `<feColorMatrix in="bent" type="saturate" values="${o.saturate}"/>`;
        host.appendChild(filter);
        // Decoded once here, the map is in the browser's image cache before any element uses it
        const image = typeof Image === 'undefined' ? null : new Image();
        let ready = Promise.resolve();
        if (image?.decode) {
            image.src = map;
            ready = image.decode().catch(() => {});
        }
        filters.set(key, { id, users: 1, ready });
        return key;
    };

    /** Gives an element the filter it waits for, once that filter's map is decoded. */
    const apply = (el) => {
        const entry = elements.get(el);
        if (!entry || entry.wanted === entry.key) return;
        const wanted = entry.wanted;
        if (!wanted) {
            release(entry.key);
            entry.key = null;
            el.style.removeProperty('--refraction');
            return;
        }
        filters.get(wanted).ready.then(() => {
            if (stopped || elements.get(el) !== entry || entry.wanted !== wanted) return;
            const previous = entry.key;
            entry.key = wanted;
            el.style.setProperty('--refraction', `url(#${filters.get(wanted).id})`);
            // The old filter goes a frame later, after the element has been drawn with the new one
            requestAnimationFrame(() => release(previous));
        });
    };

    const measure = (el) => {
        const entry = elements.get(el);
        if (!entry) return;
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        const r = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
        const size = w > 0 && h > 0 ? `${w}x${h}x${r}` : null;
        if (size === entry.wanted) return;
        // A size that was waited for but never shown is let go
        if (entry.wanted !== entry.key) release(entry.wanted);
        entry.wanted = size ? acquire(w, h, r) : null;
        apply(el);
    };

    /** Follows a size once it holds still; the first size is taken at once. */
    const schedule = (el) => {
        const entry = elements.get(el);
        if (!entry) return;
        clearTimeout(entry.timer);
        if (!entry.key && !entry.wanted) measure(el);
        else entry.timer = window.setTimeout(() => measure(el), SETTLE_MS);
    };

    const resize = new ResizeObserver(entries => entries.forEach(entry => schedule(/** @type {HTMLElement} */ (entry.target))));

    const forget = (el) => {
        const entry = elements.get(el);
        if (!entry) return;
        clearTimeout(entry.timer);
        resize.unobserve(el);
        release(entry.key);
        if (entry.wanted !== entry.key) release(entry.wanted);
        el.style.removeProperty('--refraction');
        elements.delete(el);
    };

    const scan = () => {
        const found = new Set([.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector))]
            .filter(el => !el.closest(SKIPPED_INSIDE)));
        elements.forEach((_entry, el) => {
            if (!found.has(el)) forget(el);
        });
        found.forEach(el => {
            if (elements.has(el)) return;
            elements.set(el, { key: null, wanted: null, timer: 0 });
            resize.observe(el);
        });
    };

    let frame = 0;
    const mutations = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(scan);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
        stopped = true;
        cancelAnimationFrame(frame);
        mutations.disconnect();
        resize.disconnect();
        elements.forEach((entry, el) => {
            clearTimeout(entry.timer);
            el.style.removeProperty('--refraction');
        });
        host.remove();
    };
}
