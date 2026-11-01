import React from 'react';
import Icon from './Icon';
import './AppIcon.css';

/**
 * AppIcon Component
 * 
 * Renders an icon inside a squircle styled container (like a mobile app icon).
 * 
 * @param {object} props
 * @param {string|Object} props.icon - Icon name, URL or icon config object.
 * @param {string} [props.background] - CSS background value.
 * @param {string} [props.color] - CSS color value for the icon.
 * @param {string} [props.className] - Additional classes.
 * @param {string|number} [props.size] - Size of the inner icon.
 * @returns {JSX.Element} The rendered icon container.
 */
const AppIcon = ({ icon, background, color, className = '', size = "100%" }) => {
    return (
        <div
            className={`app-icon-container${background === 'transparent' ? ' is-bare' : ''} ${className}`}
            style={{ background: background || 'var(--icon-background)' }}
        >
            <Icon icon={icon} size={size} className="app-icon" color={color} />
        </div>
    );
};

export default AppIcon;
