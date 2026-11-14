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

/**
 * Starts refracting every element matching a selector, now and as elements come and go or
 * change size. Elements of the same size and corner radius share one filter.
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

    /** @type {Map<string, {id: string, users: number}>} Filters by size and radius. */
    const filters = new Map();
    /** @type {Map<Element, string>} The filter key each element uses. */
    const elements = new Map();
    let count = 0;

    const release = (key) => {
        const filter = filters.get(key);
        if (!filter || --filter.users > 0) return;
        host.querySelector(`#${filter.id}`)?.remove();
        filters.delete(key);
    };

    const filterFor = (w, h, r) => {
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
        filters.set(key, { id, users: 1 });
        return key;
    };

    const update = (el) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        const r = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
        const key = w > 0 && h > 0 ? `${w}x${h}x${r}` : null;
        const previous = elements.get(el);
        if (key === previous) return;
        if (previous) release(previous);
        const next = key ? filterFor(w, h, r) : null;
        elements.set(el, next);
        if (next) el.style.setProperty('--refraction', `url(#${filters.get(next).id})`);
        else el.style.removeProperty('--refraction');
    };

    const resize = new ResizeObserver(entries => entries.forEach(entry => update(entry.target)));

    const scan = () => {
        const found = new Set(document.querySelectorAll(selector));
        elements.forEach((key, el) => {
            if (found.has(el)) return;
            resize.unobserve(el);
            if (key) release(key);
            el.style.removeProperty('--refraction');
            elements.delete(el);
        });
        found.forEach(el => {
            if (elements.has(el)) return;
            elements.set(el, null);
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
        cancelAnimationFrame(frame);
        mutations.disconnect();
        resize.disconnect();
        elements.forEach((key, el) => el.style.removeProperty('--refraction'));
        host.remove();
    };
}
