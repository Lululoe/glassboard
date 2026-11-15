import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { iconGlow, sampleImageColor } from './iconGlow';
import { useTheme } from '../../context/ThemeContext';
import './AppIcon.css';

/**
 * AppIcon Component
 *
 * Renders an icon inside a squircle styled container (like a mobile app icon). It works out the
 * color the icon glows in (see `iconGlow`): its background's color, else the icon's own color;
 * in Neon, an image on the neutral background is read for its main color.
 *
 * @param {object} props
 * @param {string|Object} props.icon - Icon name, URL or icon config object.
 * @param {string} [props.background] - CSS background value.
 * @param {string} [props.color] - CSS color value for the icon.
 * @param {string} [props.className] - Additional classes.
 * @param {string|number} [props.size] - Size of the inner icon.
 * @param {(color: string|null) => void} [props.onGlow] - Told the glow color whenever it changes.
 * @returns {JSX.Element} The rendered icon container.
 */
const AppIcon = ({ icon, background, color, className = '', size = "100%", onGlow }) => {
    const { style } = useTheme();
    const ref = useRef(null);
    const iconColor = typeof icon === 'object' && icon ? icon.color : undefined;
    const known = iconGlow(background) ?? iconGlow(iconColor || color);
    const [sampled, setSampled] = useState(null);
    const sample = !known && style === 'neon';

    // An image icon on the neutral background glows in the image's own main color
    useEffect(() => {
        if (!sample) return undefined;
        const img = ref.current?.querySelector('img');
        const src = img?.currentSrc || img?.src;
        if (!src) return undefined;
        let current = true;
        sampleImageColor(src).then(found => { if (current) setSampled(found); });
        return () => { current = false; };
    }, [sample, icon]);

    const glow = known ?? (sample ? sampled : null);
    useEffect(() => { onGlow?.(glow); }, [glow, onGlow]);

    return (
        <div
            ref={ref}
            className={`app-icon-container${background === 'transparent' ? ' is-bare' : ''} ${className}`}
            style={/** @type {import('react').CSSProperties} */ ({ background: background || 'var(--icon-background)', '--icon-glow': glow ?? undefined })}
        >
            <Icon icon={icon} size={size} className="app-icon" color={color} />
        </div>
    );
};

export default AppIcon;
