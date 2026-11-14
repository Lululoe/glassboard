/*
 * Liquid glass refraction for the mockups.
 *
 * Builds one SVG displacement filter per element: a map that pushes the backdrop inward near the
 * rounded edge (like the rim of a lens) and leaves the middle untouched. The element then uses
 * `backdrop-filter: url(#filter)`. Only Chromium renders SVG filters as backdrop filters; other
 * browsers keep the element's CSS blur, which is the fallback the real implementation would use.
 */
(function () {
    const NS = 'http://www.w3.org/2000/svg';
    const supported = /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox|FxiOS/.test(navigator.userAgent);
    const DEFAULTS = { scale: 50, bezel: 24, blur: 4, saturate: 1.7 };
    const tracked = new Map();
    let host;
    let count = 0;

    function svgHost() {
        if (!host) {
            host = document.createElementNS(NS, 'svg');
            host.setAttribute('width', '0');
            host.setAttribute('height', '0');
            host.setAttribute('aria-hidden', 'true');
            host.style.position = 'absolute';
            document.body.appendChild(host);
        }
        return host;
    }

    /** Displacement map for a rounded rectangle: red = x offset, green = y offset, 128 = none. */
    function displacementMap(w, h, r, bezel) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, h);
        const d = img.data;
        const hw = w / 2;
        const hh = h / 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const px = x + 0.5 - hw;
                const py = y + 0.5 - hh;
                const qx = Math.abs(px) - (hw - r);
                const qy = Math.abs(py) - (hh - r);
                // Signed distance to the rounded rectangle, negative inside
                const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
                const inside = -sd;
                let nx = 0;
                let ny = 0;
                if (qx > 0 && qy > 0) {
                    const l = Math.hypot(qx, qy) || 1;
                    nx = qx / l;
                    ny = qy / l;
                } else if (qx > qy) nx = 1;
                else ny = 1;
                nx *= Math.sign(px) || 1;
                ny *= Math.sign(py) || 1;
                let m = 0;
                if (inside < bezel) {
                    const t = 1 - Math.max(inside, 0) / bezel;
                    m = t * t;
                }
                const i = (y * w + x) * 4;
                // Sample from further inside: the rim magnifies and bends what is behind it
                d[i] = 128 - nx * m * 127;
                d[i + 1] = 128 - ny * m * 127;
                d[i + 2] = 128;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL();
    }

    function build(el) {
        const entry = tracked.get(el);
        if (!entry) return;
        const rect = el.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (!w || !h) return;
        const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
        const o = entry.opts;
        let filter = document.getElementById(entry.id);
        if (!filter) {
            filter = document.createElementNS(NS, 'filter');
            filter.id = entry.id;
            svgHost().appendChild(filter);
        }
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(w));
        filter.setAttribute('height', String(h));
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        filter.innerHTML =
            `<feImage href="${displacementMap(w, h, r, Math.min(o.bezel, Math.min(w, h) / 2))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
            `<feGaussianBlur in="SourceGraphic" stdDeviation="${o.blur}" result="blur"/>` +
            `<feDisplacementMap in="blur" in2="map" scale="${o.scale}" xChannelSelector="R" yChannelSelector="G" result="bent"/>` +
            `<feColorMatrix in="bent" type="saturate" values="${o.saturate}"/>`;
        el.style.backdropFilter = `url(#${entry.id})`;
        el.style.webkitBackdropFilter = `url(#${entry.id})`;
    }

    function attach(el, opts) {
        if (!supported) return false;
        if (tracked.has(el)) {
            tracked.get(el).opts = { ...DEFAULTS, ...opts };
            build(el);
            return true;
        }
        let frame = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => build(el));
        });
        tracked.set(el, { id: `lg-${++count}`, opts: { ...DEFAULTS, ...opts }, ro });
        ro.observe(el);
        build(el);
        return true;
    }

    function detach(el) {
        const entry = tracked.get(el);
        if (!entry) return;
        entry.ro.disconnect();
        document.getElementById(entry.id)?.remove();
        el.style.backdropFilter = '';
        el.style.webkitBackdropFilter = '';
        tracked.delete(el);
    }

    function detachAll() {
        [...tracked.keys()].forEach(detach);
    }

    window.Refraction = { supported, attach, detach, detachAll, DEFAULTS };
})();
