import { backgroundCss } from '../shared/pageBackground.js';

/**
 * Picks light or dark before anything is drawn, the way the app does once it runs: the
 * appearance saved by the header toggle, else the system's.
 */
const MODE_SCRIPT = `<script>(function(){var m;try{m=localStorage.getItem('theme-mode')}catch(e){}`
    + `if(m!=='light'&&m!=='dark')m=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';`
    + `document.documentElement.setAttribute('data-theme',m)})()</script>`;

/**
 * Returns a CSS value that can't end the <style> element it is placed in.
 * @param {*} value - A CSS value from the config.
 * @returns {string|null} The value, or null when it isn't a string.
 */
const cssValue = (value) => (typeof value === 'string' ? value.replace(/</g, '\\3c ') : null);

/**
 * Returns the background of the page at an address: the page's own when it has one, else the
 * dashboard's. Like the app, an unknown address shows the first page that isn't hidden.
 * @param {Object} config - The dashboard config.
 * @param {string} [path] - The address, such as `/garden`.
 * @returns {Object|undefined} The background setting.
 */
export function backgroundForPath(config, path = '/') {
    const pages = Array.isArray(config.pages) ? config.pages : [];
    let key = '';
    try {
        key = decodeURIComponent(String(path).split('?')[0].slice(1));
    } catch {
        key = '';
    }
    const page = pages.find((p, index) => String(p?.id ?? index) === key) || pages.find(p => !p?.hidden);
    return page?.background !== undefined ? page.background : config.background;
}

/**
 * The page background of one appearance as CSS declarations: the theme's gradient, and the
 * dashboard's own background in its place when one is set.
 * @param {Object} config - The dashboard config.
 * @param {Object|undefined} background - The background setting of the page.
 * @param {'light'|'dark'} mode - The appearance.
 * @returns {string} CSS declarations.
 */
function declarations(config, background, mode) {
    const themes = Array.isArray(config.themes) ? config.themes : [];
    const active = themes.find(t => t?.id === (config.theme || 'default'));
    const fallback = themes.find(t => t?.id === 'default');
    const gradient = cssValue(active?.colors?.[mode]?.['--bg-page-gradient'] ?? fallback?.colors?.[mode]?.['--bg-page-gradient']);
    const { image, dim } = backgroundCss(background, mode);
    return [
        gradient && `--bg-page-gradient:${gradient}`,
        image && `--bg-page-custom:${image}`,
        image && /^url/.test(image) && '--bg-page-base:#101012',
        dim > 0 && `--bg-page-dim:${dim}`,
    ].filter(Boolean).join(';');
}

/**
 * Builds what goes into the <head> of the page the server sends, so the first paint shows the
 * dashboard's background instead of the default blue until the app has loaded its config: a
 * script that sets light or dark, and the background of the requested page for both.
 * @param {Object} config - The dashboard config.
 * @param {string} [path] - The requested address.
 * @returns {string} HTML for the <head>.
 */
export function initialHead(config = {}, path = '/') {
    const background = backgroundForPath(config, path);
    const style = `:root{${declarations(config, background, 'light')}}:root[data-theme="dark"]{${declarations(config, background, 'dark')}}`
        + 'html{background:var(--bg-page-base,#003780) var(--bg-page-custom,var(--bg-page-gradient)) center/cover fixed}'
        + 'body::before{content:"";position:fixed;inset:0;z-index:-1;background:rgba(0,0,0,var(--bg-page-dim,0));pointer-events:none}';
    return `${MODE_SCRIPT}<style id="glassboard-initial">${style}</style>`;
}

/**
 * Adds `initialHead` to an HTML page, just before </head>.
 * @param {string} html - The page.
 * @param {Object} config - The dashboard config.
 * @param {string} [path] - The requested address.
 * @returns {string} The page with the head added.
 */
export function withInitialHead(html, config = {}, path = '/') {
    return html.replace('</head>', `${initialHead(config, path)}</head>`);
}
