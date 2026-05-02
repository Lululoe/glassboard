import React from 'react';
import './BentoGrid.css';

/**
 * Fallback component rendered when a specified card type is not found.
 * @returns {JSX.Element} The fallback card UI.
 */
const FallbackCard = () => <div className="glass-card"><div className="card-content">Unknown Card Type</div></div>;

// Eagerly load all *Card.jsx files in the ../../features directory (recursive)
const cardsModules = import.meta.glob('../../features/**/*Card.jsx', { eager: true });

// Normalize the map: { 'Profile': Component, 'Calendar': Component }
const cardComponents = Object.keys(cardsModules).reduce((acc, path) => {
    // path is like "../Cards/ProfileCard.jsx"
    // extract "ProfileCard"
    const fileName = path.split('/').pop().replace('.jsx', '');
    // extract "Profile" from "ProfileCard" by removing "Card" suffix if present
    // or just map key to the component default export
    const key = fileName.replace(/Card$/, '').toLowerCase();
    // Map "profile" -> ProfileCard

    acc[key] = cardsModules[path].default;
    return acc;
}, {});

/**
 * Renders a grid layout of dashboard cards based on the provided configuration.
 * @param {Object} props
 * @param {Object} props.config - The page/global configuration object containing the cards array.
 * @returns {JSX.Element|null} The rendered grid or null if config is missing.
 */
const BentoGrid = ({ config }) => {
    if (!config || !config.cards) return null;

    return (
        <div className="bento-grid-container">
            {config.cards.map((cardConfig, idx) => {
                const typeKey = cardConfig.type.toLowerCase();

                // Dynamically select component or fallback to GenericCard
                const CardComponent = cardComponents[typeKey] || FallbackCard;

                // Apply column span classes dynamically
                const colSpanClass = `col-span-${cardConfig.colSpan || 1}`;

                const style = cardConfig.primaryColor
                    ? { '--card-primary': cardConfig.primaryColor, '--i': idx }
                    : { '--i': idx };

                return (
                    <div key={cardConfig.id} className={`grid-item ${colSpanClass}`} style={style}>
                        <CardComponent config={cardConfig} globalConfig={config} />
                    </div>
                );
            })}
        </div>
    );
};

export default BentoGrid;
