import React, { useRef, useEffect } from 'react';
import './LauncherPopup.css';
import Icon from '../../components/Shared/Icon';
import AppIcon from '../../components/Shared/AppIcon';

/**
 * Renders a popup modal containing application shortcuts and quick links.
 * Automatically focuses and handles clicks outside the dialog to close it.
 * @param {Object} props
 * @param {Object} props.config - Application configuration object.
 * @param {Function} props.onClose - Callback triggered when the popup should be closed.
 * @returns {JSX.Element} The rendered dialog modal.
 */
const LauncherPopup = ({ config = {}, onClose }) => {
    const popupRef = useRef(null);
    const { apps = [], links = [], links_title } = config?.launcher || {};

    // Limit apps to 12 for 4x3 grid
    const displayApps = apps.slice(0, 12);

    useEffect(() => {
        const dialog = popupRef.current;
        if (dialog) {
            dialog.showModal();
            // Prevent the browser from auto-focusing the first app link
            dialog.focus();
        }
    }, []);

    const handleDialogClick = (e) => {
        const dialog = popupRef.current;
        if (dialog) {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (
                rect.top <= e.clientY &&
                e.clientY <= rect.top + rect.height &&
                rect.left <= e.clientX &&
                e.clientX <= rect.left + rect.width
            );
            if (!isInDialog) {
                onClose();
            }
        }
    };

    return (
        <dialog
            className="launcher-popup"
            ref={popupRef}
            onClick={handleDialogClick}
            onClose={onClose}
        >
            <div className="launcher-section-title">Apps</div>

            <div className="launcher-app-grid">
                {displayApps.map((app, idx) => (
                    <a key={idx} href={app.url} className="launcher-app" target="_blank" rel="noopener noreferrer">
                        <AppIcon
                            icon={app.icon}
                            background={app.bgColor}
                            className="launcher-app-icon-container"
                            size="100%"
                        />
                        <span className="launcher-app-name">{app.name}</span>
                    </a>
                ))}
            </div>

            {links.length > 0 && (
                <>
                    <div className="launcher-section-title">{links_title || "More"}</div>
                    <div className="launcher-link-list">
                        {links.map((link, idx) => {
                            return (
                                <a key={idx} href={link.url} className="launcher-link" target="_blank" rel="noopener noreferrer">
                                    <Icon icon={link.icon} size={20} className="launcher-link-icon" color="#0a84ff" />
                                    <span className="launcher-link-text">{link.name}</span>
                                </a>
                            );
                        })}
                    </div>
                </>
            )}
        </dialog>
    );
};

export default LauncherPopup;
