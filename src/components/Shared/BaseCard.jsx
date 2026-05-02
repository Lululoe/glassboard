import React from 'react';
import './BaseCard.css';

/**
 * A foundational card component that applies standard glassmorphism styling and hover effects.
 * @param {Object} props
 * @param {string} [props.title] - Optional title displayed in the card header.
 * @param {React.ReactNode} props.children - Content to be rendered inside the card.
 * @param {string} [props.className] - Additional CSS classes.
 * @param {boolean} [props.hoverable=true] - Whether the card should scale up slightly on hover.
 * @returns {JSX.Element} The rendered base card.
 */
const BaseCard = ({ title, children, className = '', hoverable = true }) => {
    return (
        <div className={`glass-card ${hoverable ? 'hoverable' : ''} ${className}`.trim()}>
            {title && (
                <div className="card-header">
                    {/* Simple icon or header logic could go here */}
                    <span className="card-title">{title}</span>
                </div>
            )}
            <div className="card-content">
                {children}
            </div>
        </div>
    );
};

export default BaseCard;
