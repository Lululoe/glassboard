import React, { useRef } from 'react';
import BaseCard from '../../components/Shared/BaseCard';
import AppIcon from '../../components/Shared/AppIcon';
import { useAppStatus } from './useAppStatus';
import { useGridCapacity } from './useGridCapacity';
import './AppGridCard.css';

const SIZES = new Set(['small', 'medium', 'large']);

/**
 * Grid of app shortcuts. Uses `data.apps`, falling back to the launcher apps.
 * Tiles flow from the top left; the number of columns follows the card width unless
 * `columns` is set, and only as many apps as fit completely are shown.
 * Apps that fail their status check get an offline badge.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`data.apps`, `size`, `showLabels`, `columns`, `maxApps`, `statusCheck`).
 * @param {Object} props.globalConfig - Full dashboard config, used for the launcher fallback.
 * @returns {JSX.Element} The rendered app grid.
 */
const AppGridCard = ({ config, globalConfig }) => {
    let { apps = [] } = config.data || {};

    // Fallback to launcher apps if no apps defined in card data
    if (apps.length === 0 && globalConfig?.launcher?.apps) {
        apps = globalConfig.launcher.apps;
    }

    const size = SIZES.has(config.size) ? config.size : 'medium';
    const showLabels = config.showLabels !== false;
    const statuses = useAppStatus(config.id, { enabled: config.statusCheck !== false && apps.length > 0 });

    const gridRef = useRef(null);
    const capacity = useGridCapacity(gridRef, `${size}|${showLabels}|${config.columns}`);
    const limit = config.maxApps > 0 ? Math.min(config.maxApps, capacity) : capacity;
    const displayApps = apps.slice(0, limit);
    const gridStyle = config.columns > 0
        ? { gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }
        : undefined;

    return (
        <BaseCard className={`app-grid-card app-grid-${size}${showLabels ? '' : ' app-grid-no-labels'}`} hoverable={false}>
            <div className="app-grid-container" style={gridStyle} ref={gridRef}>
                {displayApps.map((app, index) => {
                    const offline = statuses[index] === false;
                    return (
                        <a
                            key={index}
                            href={app.url}
                            className={`app-item${offline ? ' offline' : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={offline ? `${app.name} (offline)` : app.name}
                            aria-label={offline ? `${app.name} (offline)` : app.name}
                        >
                            <div className="app-icon-wrap">
                                <AppIcon
                                    icon={app.icon}
                                    background={app.bgColor}
                                    className="app-grid-icon"
                                    size="100%"
                                />
                                {offline && <span className="app-status-badge" aria-hidden="true">!</span>}
                            </div>
                            {showLabels && <span className="app-name">{app.name}</span>}
                        </a>
                    );
                })}
            </div>
        </BaseCard>
    );
};

export default AppGridCard;
