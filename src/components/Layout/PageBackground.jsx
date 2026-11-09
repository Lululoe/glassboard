import { useLayoutEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { backgroundCss } from '../../../shared/pageBackground.js';

/** Shown under a picture while it loads, instead of the theme's blue. */
const PICTURE_BASE = '#101012';

/**
 * Puts the dashboard's own page background in place of the theme's gradient: a gradient made
 * from a color, or a picture, darkened by `dim`. It sets `--bg-page-custom`, `--bg-page-base`
 * (the color under a picture) and `--bg-page-dim` on the document, which the page and the
 * editors' stages read. Without a setting the theme's gradient shows. The server puts the same
 * values into the page it sends (see `server/initialHead.js`), so the first paint matches.
 * @param {Object} props
 * @param {{color?: string, image?: string, dim?: number}} [props.background] - The setting.
 * @returns {null} Renders nothing.
 */
const PageBackground = ({ background }) => {
    const { mode } = useTheme();

    useLayoutEffect(() => {
        const { image, dim } = backgroundCss(background, mode);
        const style = document.documentElement.style;
        // `initial` rather than removing the property: the page the server sent may set these
        // too, for the first paint, and a background changed since must replace those values
        style.setProperty('--bg-page-custom', image || 'initial');
        style.setProperty('--bg-page-base', image?.startsWith('url') ? PICTURE_BASE : 'initial');
        style.setProperty('--bg-page-dim', String(dim));
    }, [background, mode]);

    useLayoutEffect(() => () => {
        ['--bg-page-custom', '--bg-page-base', '--bg-page-dim'].forEach(name => document.documentElement.style.removeProperty(name));
    }, []);

    return null;
};

export default PageBackground;
