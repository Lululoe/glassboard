import React, { useLayoutEffect, useRef, useState } from 'react';
import AppIcon from '../../components/Shared/AppIcon';
import './TwoToneBase.css';

/**
 * Follows whether a scrollable element has more content below what is visible. Cards that
 * set their content to not scroll never report any.
 * @param {import('react').RefObject<HTMLElement>} ref - The element.
 * @returns {boolean} Whether there is more to scroll to.
 */
function useHasMoreBelow(ref) {
    const [more, setMore] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => setMore(
            getComputedStyle(el).overflowY !== 'hidden' && el.scrollHeight - el.scrollTop - el.clientHeight > 4,
        );
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        Array.from(el.children).forEach(child => observer.observe(child));
        el.addEventListener('scroll', measure, { passive: true });
        return () => {
            observer.disconnect();
            el.removeEventListener('scroll', measure);
        };
    }, [ref]);

    return more;
}

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
 * @param {() => void} [props.onHeaderClick] - When set, the header is a button that does this.
 * @param {string} [props.headerLabel] - Accessible name of that button.
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
    onHeaderClick,
    headerLabel,
    className = ''
}) => {
    const contentRef = useRef(null);
    const hasMore = useHasMoreBelow(contentRef);
    // The color of the card's icon, which styles can tint the card with (Neon does)
    const [hue, setHue] = useState(null);
    const HeaderInfo = url ? 'a' : onHeaderClick ? 'button' : 'div';
    /** @type {Object} */
    const headerProps = onHeaderClick && !url
        ? { type: 'button', onClick: onHeaderClick, 'aria-label': headerLabel }
        : { href: url || undefined };

    return (
        <div className={`glass-card two-tone-card${hue ? ' has-hue' : ''} ${className}`} style={hue ? /** @type {import('react').CSSProperties} */ ({ '--card-hue': hue }) : undefined}>
            <div className="two-tone-header">
                <HeaderInfo className={`two-tone-header-info${onHeaderClick && !url ? ' button-reset' : ''}`} {...headerProps}>
                    {icon && (
                        <AppIcon
                            icon={icon}
                            background={iconBackground}
                            color={iconColor}
                            size="100%"
                            onGlow={setHue}
                        />
                    )}
                    <div className="two-tone-titles">
                        <div className="two-tone-title">{title}</div>
                        {subtitle && (
                            <div className="two-tone-subtitle">
                                {typeof subtitle === 'string' ? <span className="two-tone-subtitle-text">{subtitle}</span> : subtitle}
                            </div>
                        )}
                    </div>
                </HeaderInfo>
                {actions && (
                    <div className="two-tone-header-actions">
                        {actions}
                    </div>
                )}
            </div>
            <div className={`two-tone-content scrollable${hasMore ? ' has-more' : ''}`} ref={contentRef}>
                {children}
            </div>
            {hasMore && <div className="two-tone-more" aria-hidden="true" />}
        </div>
    );
};

export default TwoToneBase;
