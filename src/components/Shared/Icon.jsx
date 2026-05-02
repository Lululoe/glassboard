import React from 'react';
import * as LucideIcons from 'lucide-react';



/**
 * Helper to render an image element or a masked div for SVGs to support CSS coloring.
 * @param {string} url - The image source URL.
 * @param {string} alt - Alternate text for accessibility.
 * @param {boolean} isPng - Whether the image is a PNG.
 * @param {number|string} size - CSS dimension for width and height.
 * @param {string} [color] - Optional color to apply via mask (SVGs only).
 * @param {string} className - Additional CSS classes.
 * @param {Object} style - Additional inline styles.
 * @returns {JSX.Element} The rendered image or mask element.
 */
const renderImageOrMask = (url, alt, isPng, size, color, className, style) => {
    const imgStyle = {
        width: size,
        height: size,
        ...style,
    };

    // Apply color masking for SVGs if color is provided
    if (!isPng && color) {
        return (
            <div
                className={className}
                style={{
                    ...imgStyle,
                    backgroundColor: color,
                    maskImage: `url(${url})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(${url})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                }}
                role="img"
                aria-label={alt}
            />
        );
    }

    return (
        <img
            src={url}
            alt={alt}
            className={className}
            style={imgStyle}
        />
    );
};

/**
 * A versatile icon component that renders Lucide React icons, Selfh.st icons, local icons, or standard URLs.
 * @param {Object} props
 * @param {string|Object} props.icon - Icon identifier string (e.g. 'lu-Home') or configuration object.
 * @param {number|string} [props.size=24] - Dimension in pixels.
 * @param {string} [props.color] - Override color for the icon.
 * @param {string} [props.className] - Additional CSS classes.
 * @param {Object} [props.style] - Additional inline styles.
 * @returns {JSX.Element|null} The rendered icon or null if invalid.
 */
const Icon = ({ icon, size = 24, color, className = '', style = {} }) => {
    if (!icon) return null;

    let iconConfig = {};

    // Normalize input to object format
    if (typeof icon === 'string') {
        if (icon.startsWith('lu-')) {
            iconConfig = { source: 'lucide', value: icon.replace('lu-', '') };
        } else if (icon.startsWith('sh-')) {
            iconConfig = { source: 'sh', value: icon.replace('sh-', '') };
        } else if (icon.startsWith('local-')) {
            iconConfig = { source: 'local', value: icon.replace('local-', '') };
        } else if (icon.startsWith('http://') || icon.startsWith('https://')) {
            iconConfig = { source: 'url', value: icon };
        } else {
            // Fallback/Legacy: Try to render as Lucide if just a name like "Mail"
            iconConfig = { source: 'lucide', value: icon };
        }
    } else if (typeof icon === 'object') {
        iconConfig = { ...icon };
    }

    const { source, value, color: configColor } = iconConfig;
    const finalColor = configColor || color;

    // Handle Lucide Icons
    if (source === 'lucide') {
        const IconComponent = LucideIcons[value];
        if (!IconComponent) {
            console.warn(`Lucide icon "${value}" not found.`);
            return null;
        }
        return (
            <IconComponent
                size={size}
                color={finalColor}
                className={className}
                style={style}
            />
        );
    }

    // Handle Selfh.st Icons
    if (source === 'sh') {
        let extension = '.svg';
        let cleanName = value;
        let isPng = false;

        if (value.endsWith('-png')) {
            extension = '.png';
            cleanName = value.slice(0, -4);
            isPng = true;
        } else if (value.endsWith('-svg')) {
            cleanName = value.slice(0, -4);
        }

        const url = `https://cdn.jsdelivr.net/gh/selfhst/icons@main/${isPng ? 'png' : 'svg'}/${cleanName}${extension}`;
        return renderImageOrMask(url, cleanName, isPng, size, finalColor, className, style);
    }

    // Handle Local Icons
    if (source === 'local') {
        let extension = '.svg';
        let cleanName = value;
        let isPng = false;

        if (value.endsWith('-png')) {
            extension = '.png';
            cleanName = value.slice(0, -4);
            isPng = true;
        } else if (value.endsWith('-svg')) {
            cleanName = value.slice(0, -4);
        }

        const url = `/icons/${cleanName}${extension}`;
        return renderImageOrMask(url, cleanName, isPng, size, finalColor, className, style);
    }

    // Handle Generic URLs
    if (source === 'url') {
        const isPng = value.endsWith('.png'); // extended heuristic could be added
        return renderImageOrMask(value, 'icon', isPng, size, finalColor, className, style);
    }

    return null;
};



export default Icon;
