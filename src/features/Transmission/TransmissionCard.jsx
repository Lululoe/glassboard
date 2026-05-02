import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import EmptyState from '../../components/Shared/EmptyState';
import './TransmissionCard.css';
import { formatSpeed, useTransmission } from './useTransmission';

/**
 * Renders an individual torrent item with its current progress and speeds.
 * @param {Object} props
 * @param {Object} props.torrent - Torrent data object.
 * @returns {JSX.Element} The rendered torrent item.
 */
const TorrentItem = ({ torrent }) => {
    const getProgressBarClass = () => {
        if (torrent.state === 'seeding') return 'progress-fill seeding';
        if (torrent.state === 'downloading') return 'progress-fill downloading';
        return 'progress-fill';
    };

    return (
        <div className="torrent-item">
            <div className="torrent-header">
                <div className="torrent-name-wrap">
                    <span className="torrent-name">{torrent.name}</span>
                </div>
                {torrent.state !== 'seeding' && (
                    <div className="torrent-left">{torrent.left_until_done}</div>
                )}
            </div>

            <div className="torrent-secondary-info">
                <div className="torrent-secondary-left">
                    <span>{torrent.size}</span>
                    <span>
                        {torrent.state === 'seeding' ? (
                            <>
                                <Icon icon="lu-ArrowUpFromLine" size={12} /> {torrent.speedUp || ''}
                            </>
                        ) : (
                            <>
                                <Icon icon="lu-ArrowDownToLine" size={12} /> {torrent.speedDown || ''}{' '}
                                <Icon icon="lu-ArrowUpFromLine" size={12} className="upload-icon" />{' '}
                                {torrent.speedUp || ''}
                            </>
                        )}
                    </span>
                </div>
                <div className="torrent-secondary-right">
                    Ratio: {torrent.ratio != null ? torrent.ratio : '-'}
                </div>
            </div>

            <div className="progress-row">
                <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(torrent.progress || 0)}
                >
                    <div
                        className={getProgressBarClass()}
                        style={{
                            width: `${Math.max(0, Math.min(100, torrent.progress || 0))}%`,
                        }}
                    />
                </div>
                <div className="progress-percent">
                    {torrent.progress != null ? `${Math.round(torrent.progress)}%` : ''}
                </div>
            </div>
        </div>
    );
};

/**
 * TransmissionCard component displaying active torrents and global transfer speeds.
 * @param {Object} props
 * @param {Object} props.config - Card configuration object.
 * @returns {JSX.Element} The rendered Transmission card.
 */
const TransmissionCard = ({ config }) => {
    // Pass configured service or default to 'transmission'
    const service = config?.service || 'transmission';
    const { torrents, totals, error } = useTransmission(service);
    const url = (config && config.url) || '';
    const icon = (config && config.icon) || "sh-transmission";
    const iconColor = config && config.iconColor;
    const iconBackground = config && config.iconBackground;
    const downloadsUrl = config && config.downloadsUrl;

    return (
        <TwoToneBase
            colSpan={(config && config.colSpan) || 1}
            title="Transmission"
            url={url}
            subtitle={
                <>
                    <span className="subtitle-item"><Icon icon="lu-ArrowDownToLine" size={12} /> {error ? '-' : formatSpeed(totals.totalDown)}</span>
                    <span className="subtitle-item"><Icon icon="lu-ArrowUpFromLine" size={12} /> {error ? '-' : formatSpeed(totals.totalUp)}</span>
                    <span className="subtitle-item last">{error ? '• 0 torrents' : `${totals.count} torrents`}</span>
                </>
            }
            icon={icon}
            iconColor={iconColor}
            iconBackground={iconBackground}
            actions={
                downloadsUrl && (
                    <a
                        className="two-tone-header-action"
                        href={downloadsUrl}
                        title="Open Downloads"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Icon icon="lu-FolderOpen" size={20} />
                    </a>
                )
            }
        >
            {error ? (
                <EmptyState message={`Error loading Transmission data: ${error}`} />
            ) : !torrents || torrents.length === 0 ? (
                <EmptyState message="No active torrents" />
            ) : (
                <div className="torrents-list">
                    {torrents.map((torrent, i) => (
                        <TorrentItem key={torrent.id ?? i} torrent={torrent} />
                    ))}
                </div>
            )}
        </TwoToneBase>
    );
};

export default TransmissionCard;
