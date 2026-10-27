import React from 'react';
import BaseCard from '../../components/Shared/BaseCard';
import AppIcon from '../../components/Shared/AppIcon';
import './AppGridCard.css';

/**
 * Grid of app shortcuts. Uses `data.apps`, falling back to the launcher apps.
 * Shows at most 12 apps.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`data.apps`, `columns`).
 * @param {Object} props.globalConfig - Full dashboard config, used for the launcher fallback.
 * @returns {JSX.Element} The rendered app grid.
 */
const AppGridCard = ({ config, globalConfig }) => {
    let { apps = [] } = config.data || {};

    // Fallback to launcher apps if no apps defined in card data
    if (apps.length === 0 && globalConfig?.launcher?.apps) {
        apps = globalConfig.launcher.apps;
    }

    const columns = config.columns || 4;

    const displayApps = apps.slice(0, 12);

    const gridStyle = {
        gridTemplateColumns: `repeat(${columns}, 1fr)`
    };

    return (
        <BaseCard className="app-grid-card" hoverable={false}>
            <div className="app-grid-container" style={gridStyle}>
                {displayApps.map((app, index) => (
                    <a key={index} href={app.url} className="app-item" target="_blank" rel="noopener noreferrer">
                        <AppIcon
                            icon={app.icon}
                            background={app.bgColor}
                            className="app-grid-icon"
                            size="100%"
                        />
                        <span className="app-name">{app.name}</span>
                    </a>
                ))}
            </div>
        </BaseCard>
    );
};

export default AppGridCard;
