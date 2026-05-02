import React from 'react';
import BaseCard from '../../components/Shared/BaseCard';
import AppIcon from '../../components/Shared/AppIcon';
import './AppGridCard.css';

/**
 * AppGridCard Features
 * - Configurable columns (default 3)
 * - Renders list of apps
 */
const AppGridCard = ({ config, globalConfig }) => {
    let { apps = [] } = config.data || {};

    // Fallback to launcher apps if no apps defined in card data
    if (apps.length === 0 && globalConfig?.launcher?.apps) {
        apps = globalConfig.launcher.apps;
    }

    const columns = config.columns || 4;

    // Calculate limit based on columns x 3 rows (or just generic limit)
    // User requested default 3.
    // If we want to keep a 4x3 grid feel but dynamic:
    // Let's assume we want to show enough items to fill rows. 
    // Maybe still cap at 12 or dynamic. 
    // Original was: const displayApps = apps.slice(0, 12); (4x3)
    // If cols=3, 3x4=12 still works.
    const displayApps = apps.slice(0, 12);

    const gridStyle = {
        gridTemplateColumns: `repeat(${columns}, 1fr)`
    };

    return (
        <BaseCard colSpan={config.colSpan} className="app-grid-card" hoverable={false}>
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
