import React from 'react';
import AppIcon from '../../components/Shared/AppIcon';
import './TwoToneBase.css';

/**
 * TwoToneBase Component
 * 
 * @param {object} props
 * @param {string} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {string|Object} [props.icon]
 * @param {string} [props.iconBackground]
 * @param {string} [props.iconColor]
 * @param {React.ReactNode} [props.actions]
 * @param {string} [props.url] - When set, the header links to this URL.
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element} The rendered card.
 */
const TwoToneBase = ({
    title,
    subtitle,
    icon,
    iconBackground,
    iconColor,
    actions,
    children,
    url,
    className = ''
}) => {
    const HeaderInfo = url ? 'a' : 'div';

    return (
        <div className={`glass-card two-tone-card ${className}`}>
            <div className="two-tone-header">
                <HeaderInfo className="two-tone-header-info" href={url || undefined}>
                    {icon && (
                        <AppIcon
                            icon={icon}
                            background={iconBackground}
                            color={iconColor}
                            size="100%"
                        />
                    )}
                    <div className="two-tone-titles">
                        <div className="two-tone-title">{title}</div>
                        {subtitle && <div className="two-tone-subtitle">{subtitle}</div>}
                    </div>
                </HeaderInfo>
                {actions && (
                    <div className="two-tone-header-actions">
                        {actions}
                    </div>
                )}
            </div>
            <div className="two-tone-content scrollable">
                {children}
            </div>
        </div>
    );
};

export default TwoToneBase;
