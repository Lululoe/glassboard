/* Page backgrounds for the mockups: builds the layers and runs the canvas ones. */
(function () {
    const BLOBS = [
        { s: '34vmax', x: '-6vmax', y: '-8vmax', c: '#ff7a59', tx: '30vmax', ty: '18vmax', d: '19s' },
        { s: '26vmax', x: '60vw', y: '8vh', c: '#ffd166', tx: '-24vmax', ty: '26vmax', d: '23s' },
        { s: '30vmax', x: '20vw', y: '55vh', c: '#06d6a0', tx: '26vmax', ty: '-22vmax', d: '27s' },
        { s: '22vmax', x: '75vw', y: '60vh', c: '#ef476f', tx: '-30vmax', ty: '-14vmax', d: '21s' },
        { s: '18vmax', x: '40vw', y: '20vh', c: '#118ab2', tx: '18vmax', ty: '30vmax', d: '17s' },
        { s: '14vmax', x: '5vw', y: '70vh', c: '#9b5de5', tx: '40vmax', ty: '-10vmax', d: '25s' },
    ];
    const TEXT = [
        'Backups finished at 03:12 — 14 snapshots kept',
        'Living room 21.4 °C · humidity 46 %',
        'jellyfin: 2 active streams',
        'Pull request #212 merged into main',
        'Proxmox node pve-01 · load 0.42 0.38 0.31',
        'Front door locked · garage closed',
        'Download complete: ubuntu-26.04.iso',
        'Grafana alert resolved: disk /srv below 85 %',
    ];
    const HUES = ['#7cc4ff', '#ffb86b', '#9ef0a8', '#ff8fb1', '#d6a8ff', '#ffe27a'];

    let el;
    let matrix = null;

    function mount() {
        el = document.createElement('div');
        el.className = 'bg';
        el.setAttribute('aria-hidden', 'true');
        const lines = [];
        // Each line strings several messages together so it runs across the whole page
        for (let i = 0; i < 48; i++) {
            const words = [0, 1, 2, 3].map(k => TEXT[(i + k * 3) % TEXT.length]).join('  ·  ');
            lines.push(`<div style="color:${HUES[i % HUES.length]};white-space:nowrap">${words}</div>`);
        }
        el.innerHTML =
            '<div class="bg-gradient"></div><div class="bg-plain"></div>' +
            '<div class="bg-aurora"><i></i><i></i><i></i></div>' +
            `<div class="bg-blobs">${BLOBS.map(b => `<i style="--s:${b.s};--x:${b.x};--y:${b.y};--c:${b.c};--tx:${b.tx};--ty:${b.ty};--d:${b.d}"></i>`).join('')}</div>` +
            '<div class="bg-wallpaper"><div class="stars"></div><div class="sun"></div><div class="m m1"></div><div class="m m2"></div><div class="m m3"></div></div>' +
            `<div class="bg-text"><div class="roll">${lines.join('')}</div></div>` +
            '<canvas class="bg-matrix"></canvas>';
        document.body.prepend(el);
    }

    /** Falling characters in the accent color, at 20 frames a second, paused when hidden. */
    function startMatrix() {
        const canvas = el.querySelector('.bg-matrix');
        const ctx = canvas.getContext('2d');
        const size = 16;
        const chars = '01<>/{}[]=+*#$%&;:~|';
        let drops = [];
        const resize = () => {
            canvas.width = innerWidth;
            canvas.height = innerHeight;
            drops = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -60);
            const light = document.documentElement.dataset.mode === 'light';
            ctx.fillStyle = light ? '#f2f2ea' : '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };
        resize();
        addEventListener('resize', resize);
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tick = () => {
            if (document.hidden) return;
            const root = document.documentElement;
            const light = root.dataset.mode === 'light';
            ctx.fillStyle = light ? 'rgba(242,242,234,0.14)' : 'rgba(0,0,0,0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = getComputedStyle(root).getPropertyValue('--accent').trim() || '#33ff66';
            ctx.globalAlpha = light ? 0.45 : 0.75;
            ctx.font = `${size - 2}px "JetBrains Mono", ui-monospace, monospace`;
            drops.forEach((y, i) => {
                ctx.fillText(chars[(Math.random() * chars.length) | 0], i * size, y * size);
                drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
            });
            ctx.globalAlpha = 1;
        };
        for (let i = 0; i < 80; i++) tick();
        const timer = reduced ? 0 : setInterval(tick, 50);
        return () => {
            clearInterval(timer);
            removeEventListener('resize', resize);
        };
    }

    function set(name) {
        if (!el) mount();
        el.dataset.bg = name;
        if (name === 'matrix' && !matrix) matrix = startMatrix();
        if (name !== 'matrix' && matrix) {
            matrix();
            matrix = null;
        }
    }

    window.Backgrounds = { set };
})();
