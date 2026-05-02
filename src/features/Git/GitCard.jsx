import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import EmptyState from '../../components/Shared/EmptyState';
import './GitCard.css';
import { useGit } from './useGit';

/**
 * Displays an icon indicating the status of a PR's CI checks.
 * @param {Object} props
 * @param {Object} props.checks - Checks object containing status, passing, and total count.
 * @returns {JSX.Element|null} The check status indicator.
 */
const CheckStatus = ({ checks }) => {
    if (!checks) return null;

    let iconName = 'lu-Clock';
    let className = 'check-status pending';

    if (checks.status === 'success') {
        iconName = 'lu-CheckCircle';
        className = 'check-status success';
    } else if (checks.status === 'failed') {
        iconName = 'lu-XCircle';
        className = 'check-status failed';
    }

    return (
        <span className={className} title={`Checks: ${checks.status} (${checks.passing}/${checks.total})`}>
            <Icon icon={iconName} size={12} />
        </span>
    );
};



/**
 * Formats an ISO date string to a localized short string (DD.MM.YYYY HH:MM).
 * @param {string} isoString - The ISO date string.
 * @returns {string} The formatted date string.
 */
const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Format: dd.mm.yyyy HH:MM
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
};

/**
 * Renders an individual pull request list item.
 * @param {Object} props
 * @param {Object} props.pr - The pull request data object.
 * @returns {JSX.Element} The rendered PR item.
 */
const PrItem = ({ pr }) => {
    const isBot = pr.author.endsWith('[bot]');
    const authorName = isBot ? pr.author.replace('[bot]', '').trim() : pr.author;

    return (
        <div
            className="pr-item"
            onClick={() => window.open(pr.url, '_blank')}
            style={{ cursor: 'pointer' }}
        >
            <div className="pr-header">
                <div className="pr-title-wrap">
                    <span className="pr-repo">{pr.repo} #{pr.number}</span>
                    <span className="pr-title">{pr.title}</span>
                </div>
                <span className={`pr-status-badge ${pr.state}`}>
                    {pr.state.replace('_', ' ')}
                </span>
            </div>

            <div className="pr-meta">
                <span className="pr-meta-item">
                    by {authorName}{isBot ? <Icon icon="lu-Bot" size={12} className="bot-icon" /> : ''}
                </span>
                <span className="pr-meta-item">
                    • {formatDate(pr.updatedAt)}
                </span>
                {pr.comments > 0 && (
                    <span className="pr-meta-item pr-comments">
                        <Icon icon="lu-MessageSquare" size={12} /> {pr.comments}
                    </span>
                )}
                {pr.checks && (
                    <span className="pr-meta-item pr-checks">
                        <CheckStatus checks={pr.checks} />
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * GitCard component displays pull requests from integrated Git repositories.
 * Supports filtering by status and displaying CI check statuses.
 * @param {Object} props
 * @param {Object} props.config - Configuration for the GitCard.
 * @returns {JSX.Element|null} The rendered card or null if empty.
 */
const GitCard = ({ config }) => {
    const { prs, stats, loading, error } = useGit(config);

    if (config?.hideEmpty && !loading && prs.length === 0) {
        return null;
    }

    const url = (config && config.url) || 'https://github.com/pulls';
    const icon = (config && config.icon) || "sh-github-light";
    const iconColor = config && config.iconColor;
    const iconBackground = config && config.iconBackground;

    return (
        <TwoToneBase
            colSpan={(config && config.colSpan) || 1}
            title="Pull Requests"
            url={url}
            subtitle={
                <>
                    <span><Icon icon="lu-GitPullRequest" size={12} /> {stats.open} Open</span>
                    {stats.review_requested > 0 && (
                        <span style={{ marginLeft: 8 }}>• {stats.review_requested} Review Req.</span>
                    )}
                </>
            }
            icon={icon}
            iconColor={iconColor}
            iconBackground={iconBackground}
        >
            {error ? (
                <EmptyState message="Error loading Github data" />
            ) : prs.length === 0 ? (
                <EmptyState message="No active PRs" />
            ) : (
                <div className="pr-list">
                    {prs.map((pr) => (
                        <PrItem key={pr.id} pr={pr} />
                    ))}
                </div>
            )}
        </TwoToneBase>
    );
};

export default GitCard;
