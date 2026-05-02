import React from 'react';
import './EmptyState.css';

/**
 * Renders a placeholder state for empty data or missing configuration.
 * @param {Object} props
 * @param {string} props.message - Text explaining the empty state.
 * @param {React.ReactNode} [props.icon] - Optional icon to display above the message.
 * @param {React.ReactNode} [props.children] - Additional content (e.g. actions/buttons).
 * @returns {JSX.Element} The empty state container.
 */
const EmptyState = ({ message, icon, children }) => {
    return (
        <div className="empty-state">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <div className="empty-state-message">{message}</div>
            {children}
        </div>
    );
};

export default EmptyState;
