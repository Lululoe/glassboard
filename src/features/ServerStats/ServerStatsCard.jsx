import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import UsageBar from '../../components/Shared/UsageBar';
import { formatUsage } from '../../lib/format';
import useServerStats from './useServerStats';
import './ServerStatsCard.css';

/** Temperatures from which the reading warns, then signals a problem, in °C. */
const TEMP_WARN = 70;
const TEMP_HIGH = 85;

/**
 * One metric: its icon, name and value, with what is below it.
 * @param {Object} props
 * @param {string} props.title - The metric's name.
 * @param {string} props.iconName - Icon name.
 * @param {import('react').ReactNode} props.value - The current value.
 * @param {string} [props.tone] - Extra class for the value, for warnings.
 * @param {import('react').ReactNode} [props.children] - Shown under the row, such as a bar.
 * @returns {JSX.Element} The row.
 */
const StatRow = ({ title, iconName, value, tone = '', children }) => (
    <div className="stat-row">
        <div className="stat-row-head">
            <Icon icon={iconName} size={16} className="stat-row-icon" />
            <span className="stat-title">{title}</span>
            <span className={`stat-value ${tone}`.trim()}>{value}</span>
        </div>
        {children}
    </div>
);

/**
 * A metric with a usage bar.
 * @param {Object} props
 * @param {string} props.title - The metric's name.
 * @param {string} props.iconName - Icon name.
 * @param {number} props.value - The current value.
 * @param {number} props.max - The largest possible value.
 * @param {string} [props.label] - Text for the value; defaults to the percentage.
 * @returns {JSX.Element} The row.
 */
const BarRow = ({ title, iconName, value, max, label }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    return (
        <StatRow title={title} iconName={iconName} value={label || `${Math.round(percent)}%`}>
            <UsageBar percent={percent} label={title} />
        </StatRow>
    );
};

/**
 * Network traffic in and out.
 * @param {Object} props
 * @param {number} props.netIn - Traffic in, in bytes per second.
 * @param {number} props.netOut - Traffic out, in bytes per second.
 * @returns {JSX.Element} The row.
 */
const NetworkRow = ({ netIn, netOut }) => {
    const speed = (bytes) => (bytes / 1024 / 1024).toFixed(1);
    return (
        <StatRow
            title="Network"
            iconName="lu-Network"
            value={(
                <span className="stat-network">
                    <Icon icon="lu-ArrowDown" size={13} /> {speed(netIn)}
                    <Icon icon="lu-ArrowUp" size={13} /> {speed(netOut)} MB/s
                </span>
            )}
        />
    );
};

/**
 * The temperature with its recent history as small bars.
 * @param {Object} props
 * @param {Array<number>} props.data - Readings in °C, oldest first.
 * @returns {JSX.Element} The row.
 */
const TemperatureRow = ({ data }) => {
    const current = data[data.length - 1] ?? 0;
    const max = Math.max(...data, 60);
    const min = Math.min(...data, 30);
    const tone = current >= TEMP_HIGH ? 'high' : current >= TEMP_WARN ? 'warn' : '';
    return (
        <StatRow title="Temperature" iconName="lu-Thermometer" value={`${current}°C`} tone={tone}>
            <div className="stat-history" aria-hidden="true">
                {data.map((value, index) => (
                    <div key={index} style={{ height: `${Math.max(10, ((value - min) / (max - min || 1)) * 100)}%` }} />
                ))}
            </div>
        </StatRow>
    );
};

/**
 * Shows the host's CPU, memory, storage, network and temperature as compact rows, so all of
 * them fit a one-wide card without scrolling.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`data.sensors`, `icon`, `iconColor`, `iconBackground`).
 * @returns {JSX.Element} The server stats card.
 */
const ServerStatsCard = ({ config }) => {
    const stats = useServerStats();
    const sensors = config.data?.sensors || ['cpu', 'ram', 'storage', 'network', 'temp'];

    return (
        <TwoToneBase
            className={`server-stats-card col-span-${config.colSpan || 1}`}
            title={stats.info.hostname}
            subtitle={stats.info.ip}
            icon={config.icon || 'lu-Server'}
            iconBackground={config.iconBackground}
            iconColor={config.iconColor}
        >
            <div className="server-stats-grid">
                {sensors.includes('cpu') && <BarRow title="CPU Load" iconName="lu-Cpu" value={stats.cpu} max={100} />}
                {sensors.includes('ram') && (
                    <BarRow
                        title="RAM Usage"
                        iconName="lu-MemoryStick"
                        value={stats.ram.used}
                        max={stats.ram.total}
                        label={formatUsage(stats.ram.used, stats.ram.total)}
                    />
                )}
                {sensors.includes('storage') && (
                    <BarRow
                        title="Storage"
                        iconName="lu-HardDrive"
                        value={stats.storage.used}
                        max={stats.storage.total}
                        label={formatUsage(stats.storage.used, stats.storage.total)}
                    />
                )}
                {sensors.includes('network') && <NetworkRow netIn={stats.network.in} netOut={stats.network.out} />}
                {sensors.includes('temp') && <TemperatureRow data={stats.temp} />}
            </div>
        </TwoToneBase>
    );
};

export default ServerStatsCard;
