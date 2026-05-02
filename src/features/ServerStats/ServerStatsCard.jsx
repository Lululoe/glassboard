import React from 'react';
import BaseCard from '../../components/Shared/BaseCard';
import Icon from '../../components/Shared/Icon';
import useServerStats from './useServerStats';
import './ServerStatsCard.css';

// Sub-components
/**
 * Displays basic server information such as hostname and IP.
 * @param {Object} props
 * @param {string} props.hostname - Server hostname.
 * @param {string} props.ip - Server IP address.
 * @returns {JSX.Element} The info tile.
 */
const InfoTile = ({ hostname, ip }) => {
    return (
        <div className="stat-tile stat-info">
            <div className="stat-info-content">
                <div className="stat-hostname">{hostname}</div>
                <div className="stat-ip">{ip}</div>
            </div>
            <div className="stat-icon-circle" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white' }}>
                <Icon icon="lu-Server" size={24} />
            </div>
        </div>
    );
};

/**
 * Displays a statistic as a percentage bar (e.g., CPU, RAM).
 * @param {Object} props
 * @param {string} props.title - Tile title.
 * @param {string} props.iconName - Lucide icon name.
 * @param {number} props.value - Current value.
 * @param {number} props.max - Maximum possible value.
 * @param {string} [props.label] - Optional custom text for the value label.
 * @param {string} props.colorClass - CSS class for bar color.
 * @returns {JSX.Element} The bar tile.
 */
const BarTile = ({ title, iconName, value, max, label, colorClass }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={`stat-tile ${colorClass}`}>
            <div className="stat-header">
                <div className="stat-icon-circle">
                    <Icon icon={iconName} size={24} />
                </div>
                <div style={{ flex: 1 }}>
                    <div className="stat-title">{title}</div>
                    <div className="stat-value-text">{label || `${Math.round(percentage)}%`}</div>
                </div>
            </div>
            <div className="stat-bar-container">
                <div className="stat-bar-fill" style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
};

/**
 * Displays network usage statistics (In/Out).
 * @param {Object} props
 * @param {string} props.title - Tile title.
 * @param {string} props.iconName - Lucide icon name.
 * @param {number} props.netIn - Network traffic in (bytes).
 * @param {number} props.netOut - Network traffic out (bytes).
 * @returns {JSX.Element} The network tile.
 */
const NetworkTile = ({ title, iconName, netIn, netOut }) => {
    const formatSpeed = (bytes) => {
        const mb = bytes / 1024 / 1024;
        return mb.toFixed(1);
    };

    return (
        <div className="stat-tile stat-network">
            <div className="stat-header">
                <div className="stat-icon-circle">
                    <Icon icon={iconName} size={24} />
                </div>
                <div className="stat-title">{title}</div>
            </div>
            <div className="stat-meta" style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon icon="lu-ArrowDown" size={14} /> {formatSpeed(netIn)} MB
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon icon="lu-ArrowUp" size={14} /> {formatSpeed(netOut)} MB
                </div>
            </div>
        </div>
    );
};

/**
 * Displays a historical graph for a metric (e.g., Temperature).
 * @param {Object} props
 * @param {string} props.title - Tile title.
 * @param {string} props.iconName - Lucide icon name.
 * @param {Array<number>} props.data - Array of historical data points.
 * @param {string} [props.unit='°C'] - Unit label.
 * @param {string} props.colorClass - CSS class for styling.
 * @returns {JSX.Element} The graph tile.
 */
const GraphTile = ({ title, iconName, data, unit = '°C', colorClass }) => {
    const current = data[data.length - 1] || 0;
    const maxVal = Math.max(...data, 60); // dynamic scale max
    const minVal = Math.min(...data, 30); // dynamic scale min

    return (
        <div className={`stat-tile ${colorClass}`}>
            <div className="stat-header">
                <div className="stat-icon-circle">
                    <Icon icon={iconName} size={24} />
                </div>
                <div style={{ flex: 1 }}>
                    <div className="stat-title">{title}</div>
                    <div className="stat-value-text">{current}{unit}</div>
                </div>
            </div>
            <div className="stat-graph-container">
                {data.map((val, idx) => {
                    const height = ((val - minVal) / (maxVal - minVal || 1)) * 100;
                    return (
                        <div
                            key={idx}
                            className="stat-graph-bar"
                            style={{ height: `${Math.max(10, height)}%` }}
                            title={`${val}${unit}`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

/**
 * ServerStatsCard component renders various server metrics like CPU, RAM, Network, and Temperature.
 * @param {Object} props
 * @param {Object} props.config - Configuration object.
 * @returns {JSX.Element} The server stats card.
 */
const ServerStatsCard = ({ config }) => {
    const stats = useServerStats();

    // Default sensors if not provided
    const sensors = config.data?.sensors || ['cpu', 'ram', 'storage', 'network', 'temp'];

    return (
        <BaseCard
            colSpan={config.colSpan}
            className={`server-stats-card col-span-${config.colSpan || 1}`}
            hoverable={false}
        >
            <div className="server-stats-grid">
                <InfoTile hostname={stats.info.hostname} ip={stats.info.ip} />

                {sensors.includes('cpu') && (
                    <BarTile
                        title="CPU Load"
                        iconName="lu-Cpu"
                        value={stats.cpu}
                        max={100}
                        colorClass="stat-cpu"
                    />
                )}

                {sensors.includes('ram') && (
                    <BarTile
                        title="RAM Usage"
                        iconName="lu-MemoryStick"
                        value={stats.ram.used}
                        max={stats.ram.total}
                        label={`${stats.ram.used} / ${stats.ram.total} GB`}
                        colorClass="stat-ram"
                    />
                )}

                {sensors.includes('storage') && (
                    <BarTile
                        title="Storage"
                        iconName="lu-HardDrive"
                        value={stats.storage.used}
                        max={stats.storage.total}
                        label={`${stats.storage.used}GB Used / ${stats.storage.free}GB Free`}
                        colorClass="stat-storage"
                    />
                )}

                {sensors.includes('temp') && (
                    <GraphTile
                        title="Temperature"
                        iconName="lu-Thermometer"
                        data={stats.temp}
                        colorClass="stat-temp"
                    />
                )}

                {sensors.includes('network') && (
                    <NetworkTile
                        title="Network"
                        iconName="lu-Network"
                        netIn={stats.network.in}
                        netOut={stats.network.out}
                    />
                )}
            </div>
        </BaseCard>
    );
};

export default ServerStatsCard;


