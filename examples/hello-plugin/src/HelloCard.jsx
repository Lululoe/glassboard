import { TwoToneBase, callService, formatRelativeTime, usePolling } from '@glassboard/sdk';
import './HelloCard.css';

/**
 * Shows the greeting the `hello` service sends, and when the server sent it.
 * @param {Object} props
 * @param {Object} props.config - The card's settings from config.yaml.
 * @returns {JSX.Element} The card.
 */
const HelloCard = ({ config }) => {
    const { data, error } = usePolling(
        () => callService('hello', { cardId: config.id }),
        { interval: 30000, key: config.id },
    );
    return (
        <TwoToneBase title={config.title || 'Hello'} icon={config.icon || 'lu-Hand'} subtitle="Example plugin">
            <div className="hello-card">
                {error && <p className="hello-card-error">{error}</p>}
                <p className="hello-card-greeting">{data?.greeting ?? '…'}</p>
                {data?.time && <p className="hello-card-time">Server time, {formatRelativeTime(data.time)}</p>}
            </div>
        </TwoToneBase>
    );
};

export default HelloCard;
