/*
 * The canvas effects of the weather background: rain running down a misted window, and falling
 * snow. Both draw at a reduced resolution and at most 30 frames a second, pause while the tab is
 * hidden, and draw one still frame for people who asked for less motion, so they run on a
 * Raspberry Pi too.
 */

/** Frames per second of the effects. */
const FPS = 30;
/** The canvas is drawn at this share of the screen's size and stretched to fill it. */
const RESOLUTION = 0.6;

/**
 * Runs a drawing loop on a canvas that fills its parent.
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {(ctx: CanvasRenderingContext2D, size: {w: number, h: number}) => {frame: (t: number) => void, resize?: () => void}} setup -
 *   Prepares the effect for a size and returns its frame function.
 * @returns {() => void} Stops it.
 */
function runLoop(canvas, setup) {
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return () => {};
    let effect = null;
    const resize = () => {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION));
        effect = setup(ctx, { w: canvas.width, h: canvas.height });
    };
    resize();
    window.addEventListener('resize', resize);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    if (still) {
        // One settled frame: run the effect a little while, then stop
        for (let i = 0; i < 90; i++) effect.frame(i * 1000 / FPS);
    } else {
        effect.frame(0);
        timer = setInterval(() => { if (!document.hidden) effect.frame(performance.now()); }, 1000 / FPS);
    }
    return () => {
        clearInterval(timer);
        window.removeEventListener('resize', resize);
    };
}

/**
 * Makes an offscreen canvas.
 * @param {number} w - Width.
 * @param {number} h - Height.
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} The canvas and its context.
 */
function layer(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d') };
}

/**
 * Draws a drop of water on glass: clear, like a little lens, lit from the top and shadowed at its
 * lower edge. It is a bit taller than wide, and rounder at the bottom.
 * @param {CanvasRenderingContext2D} ctx - Where to draw.
 * @param {number} x - Center.
 * @param {number} y - Center.
 * @param {number} r - Radius.
 * @param {boolean} light - Whether the page is light.
 * @param {number} [stretch=1.1] - How much taller than wide it is.
 */
function drawDrop(ctx, x, y, r, light, stretch = 1.1) {
    const ry = r * stretch;
    // Clear the mist where the drop is, so the page shows through it sharply
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // The lens gathers light: brighter than the misted pane, most of all at its lower half
    const body = ctx.createLinearGradient(x, y - ry, x, y + ry);
    body.addColorStop(0, light ? 'rgba(255, 255, 255, 0.25)' : 'rgba(225, 235, 255, 0.1)');
    body.addColorStop(1, light ? 'rgba(255, 255, 255, 0.6)' : 'rgba(225, 235, 255, 0.34)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // A thin dark edge along the top, where the drop bends the light away
    if (r > 1.5) {
        ctx.strokeStyle = light ? 'rgba(30, 50, 80, 0.28)' : 'rgba(0, 8, 24, 0.45)';
        ctx.lineWidth = Math.max(0.8, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.93, ry * 0.93, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
    }

    // Light caught at the bottom, and a highlight at the top
    if (r > 2) {
        ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.7)' : 'rgba(240, 246, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + ry * 0.5, r * 0.6, ry * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - ry * 0.4, r * 0.24, ry * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Rain on a window: a misted pane covered in tiny droplets, with drops that gather, grow and
 * run down, wiping a clear trail that slowly mists over again.
 * @param {HTMLCanvasElement} canvas - The canvas, filling the page.
 * @param {{intensity: number, light: boolean}} options - How hard it rains (0 to 1), and whether the page is light.
 * @returns {() => void} Stops it.
 */
export function startRain(canvas, { intensity, light }) {
    return runLoop(canvas, (ctx, { w, h }) => {
        const scale = Math.max(0.7, Math.min(w, h) / 420);
        const mistColor = light ? 'rgba(255, 255, 255, 0.4)' : 'rgba(200, 214, 236, 0.2)';
        // Trails mist over again within half a minute or so
        const refog = light ? 'rgba(255, 255, 255, 0.0012)' : 'rgba(200, 214, 236, 0.0007)';

        // The mist on the pane, and the tiny droplets in it
        const mist = layer(w, h);
        mist.ctx.fillStyle = mistColor;
        mist.ctx.fillRect(0, 0, w, h);
        const droplets = layer(w, h);
        /**
         * Puts a droplet on the pane: clear of mist, shaded like a lens.
         * @param {number} x - Center.
         * @param {number} y - Center.
         * @param {number} r - Radius.
         * @param {number} [stretch=1] - How much taller than wide it is.
         */
        const droplet = (x, y, r, stretch = 1) => {
            mist.ctx.globalCompositeOperation = 'destination-out';
            mist.ctx.beginPath();
            mist.ctx.ellipse(x, y, r, r * stretch, 0, 0, Math.PI * 2);
            mist.ctx.fill();
            mist.ctx.globalCompositeOperation = 'source-over';
            drawDrop(droplets.ctx, x, y, r, light, stretch);
        };
        const sprinkle = (count) => {
            for (let i = 0; i < count; i++) {
                droplet(Math.random() * w, Math.random() * h, (0.5 + Math.random() ** 2.5 * 2.6) * scale);
            }
        };
        sprinkle(Math.round((w * h) / 420 * (0.4 + intensity * 0.6)));

        /** Larger drops: gathering in place, or running down. */
        const drops = [];
        const maxDrops = Math.round((w * h) / 4500 * (0.3 + intensity));
        const spawn = (y = Math.random() * h) => drops.push({
            x: Math.random() * w,
            y,
            r: (1.6 + Math.random() ** 2 * 4.5) * scale,
            grow: (0.008 + Math.random() * 0.025) * scale * (0.5 + intensity),
            vy: 0,
            running: false,
            trail: 0,
        });
        for (let i = 0; i < maxDrops * 0.6; i++) spawn();

        /**
         * Wipes the mist and droplets along a running drop's path.
         * @param {number} x - Center.
         * @param {number} y - Center.
         * @param {number} r - Radius.
         */
        const wipe = (x, y, r) => {
            for (const target of [mist.ctx, droplets.ctx]) {
                target.globalCompositeOperation = 'destination-out';
                target.beginPath();
                target.ellipse(x, y, r * 0.85, r * 1.2, 0, 0, Math.PI * 2);
                target.fill();
                target.globalCompositeOperation = 'source-over';
            }
        };

        let last = 0;
        return {
            frame(t) {
                const dt = Math.min(3, last ? (t - last) / (1000 / FPS) : 1);
                last = t;

                // The pane mists over again, and new droplets land on it
                mist.ctx.fillStyle = refog;
                mist.ctx.fillRect(0, 0, w, h);
                if (Math.random() < 0.3 * intensity) sprinkle(Math.ceil(1.5 * intensity * dt));
                if (drops.length < maxDrops && Math.random() < 0.25 * (0.3 + intensity) * dt) spawn();

                for (let i = drops.length - 1; i >= 0; i--) {
                    const d = drops[i];
                    if (!d.running) {
                        d.r += d.grow * dt;
                        // Heavy enough, a drop starts to run
                        if (d.r > 5 * scale && Math.random() < 0.03 * dt) d.running = true;
                        continue;
                    }
                    // Running drops speed up with size, stall now and then, and wander a little
                    d.vy = Math.min(d.vy + 0.05 * d.r / scale * dt, 3.2 * scale * (d.r / (6 * scale)));
                    if (Math.random() < 0.04) d.vy *= 0.2;
                    d.y += d.vy * dt;
                    d.x += (Math.random() - 0.5) * 0.6 * scale;
                    wipe(d.x, d.y, d.r);
                    // They leave droplets behind and lose a little water doing so
                    d.trail += d.vy * dt;
                    if (d.trail > d.r * 1.6) {
                        d.trail = 0;
                        if (Math.random() < 0.7) {
                            const r = d.r * (0.18 + Math.random() * 0.18);
                            droplet(d.x + (Math.random() - 0.5) * d.r * 0.5, d.y - d.r * 1.6, r, 1.05);
                        }
                        d.r = Math.max(2 * scale, d.r * 0.985);
                    }
                    // And take in the drops they run into
                    for (let j = drops.length - 1; j >= 0; j--) {
                        const o = drops[j];
                        if (o === d || o.running) continue;
                        if (Math.abs(o.x - d.x) < d.r + o.r * 0.6 && Math.abs(o.y - d.y) < d.r + o.r) {
                            d.r = Math.min(14 * scale, Math.hypot(d.r, o.r));
                            drops.splice(j, 1);
                            if (j < i) i--;
                        }
                    }
                    if (d.y - d.r > h) drops.splice(i, 1);
                }

                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(mist.canvas, 0, 0);
                ctx.drawImage(droplets.canvas, 0, 0);
                for (const d of drops) drawDrop(ctx, d.x, d.y, d.r, light, d.running ? 1.25 : 1.1);
            },
        };
    });
}

/**
 * Falling snow: soft flakes at three depths, nearer ones bigger, brighter and faster, drifting
 * from side to side.
 * @param {HTMLCanvasElement} canvas - The canvas, filling the page.
 * @param {{intensity: number, light: boolean}} options - How hard it snows (0 to 1), and whether the page is light.
 * @returns {() => void} Stops it.
 */
export function startSnow(canvas, { intensity, light }) {
    return runLoop(canvas, (ctx, { w, h }) => {
        const scale = Math.max(0.6, Math.min(w, h) / 600);
        // One soft flake, drawn once and stamped for every flake
        const sprite = layer(32, 32);
        const glow = sprite.ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
        glow.addColorStop(0.45, 'rgba(255, 255, 255, 0.85)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        sprite.ctx.fillStyle = glow;
        sprite.ctx.fillRect(0, 0, 32, 32);

        const count = Math.round(Math.min(360, (w * h) / 2200 * (0.35 + intensity)));
        const flakes = Array.from({ length: count }, () => {
            const z = Math.random() ** 1.5;
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                z,
                r: (1.4 + z * 6) * scale,
                vy: (0.25 + z * 1.1) * scale,
                sway: (0.2 + Math.random() * 0.8) * scale,
                phase: Math.random() * Math.PI * 2,
                freq: 0.4 + Math.random() * 0.8,
            };
        });

        let last = 0;
        return {
            frame(t) {
                const dt = Math.min(3, last ? (t - last) / (1000 / FPS) : 1);
                last = t;
                ctx.clearRect(0, 0, w, h);
                const wind = Math.sin(t / 9000) * 0.3 * scale;
                for (const f of flakes) {
                    f.y += f.vy * dt;
                    f.x += (Math.sin(t / 1000 * f.freq + f.phase) * f.sway * 0.4 + wind * f.z) * dt;
                    if (f.y - f.r > h) {
                        f.y = -f.r;
                        f.x = Math.random() * w;
                    }
                    if (f.x < -f.r) f.x += w + f.r * 2;
                    if (f.x > w + f.r) f.x -= w + f.r * 2;
                    // Near flakes are bigger and softer, far ones small and faint
                    ctx.globalAlpha = (light ? 0.55 : 0.35) + f.z * 0.5;
                    const size = f.r * 2;
                    ctx.drawImage(sprite.canvas, f.x - f.r, f.y - f.r, size, size);
                }
                ctx.globalAlpha = 1;
            },
        };
    });
}
