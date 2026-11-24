import { useEffect, useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import EmptyState from '../../components/Shared/EmptyState';
import Icon from '../../components/Shared/Icon';
import LitterDialog from './LitterDialog';
import { CatTimelines, CleanButton, LitterLevels, LitterStats } from './LitterParts';
import { useLitterbox, useLitterHistory } from './useLitterbox';
import { formatTime, isBusy, statusOf, totalVisits, wasteLevel, withColors } from './litterModel';
import '../HomeAssistant/HAControlCard.css';
import './LitterboxCard.css';

const ICON = 'mdi:cat';
const ICON_BACKGROUND = 'linear-gradient(180deg, #d58cf7, #9b3fd6)';
const RING_COLORS = { '': 'var(--system-purple)', warn: 'var(--system-orange)', bad: 'var(--system-red)' };

/**
 * Litter box card for a Litter-Robot (or any litter box with a vacuum entity), in three sizes:
 * - quarter: the waste drawer as a ring, which starts a clean; the rest of the tile opens the details,
 * - half: visits today, the cat weighed last and the last visit, with the drawer and litter levels,
 * - full: the same, plus one timeline of today's visits per cat.
 * The header starts a clean, and tapping its title opens the details pop-up.
 * @param {Object} props
 * @param {Object} props.config - Card configuration, see the docs.
 * @returns {JSX.Element} The rendered card.
 */
const LitterboxCard = ({ config }) => {
    const size = config.tileSize === 'quarter' || config.tileSize === 'half' ? config.tileSize : 'full';
    const { box, loading, error, run } = useLitterbox(config.id, Boolean(config.entity_id));
    const cats = withColors(box?.cats);
    const { history: today } = useLitterHistory(config.id, 'today', Boolean(box) && cats.some(c => c.visits !== null) && size !== 'quarter');
    const [open, setOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (size !== 'full') return undefined;
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, [size]);

    const status = box ? statusOf(box) : null;
    const dialog = open && box && (
        <LitterDialog box={box} cats={cats} cardId={config.id} run={run} onClose={() => setOpen(false)} />
    );

    if (size === 'quarter') {
        const name = config.title || box?.name || 'Litter box';
        const level = box ? wasteLevel(box.waste) : '';
        const busy = box ? isBusy(box) : false;
        const stateText = !box ? (loading ? 'Loading…' : 'Unavailable')
            : busy || status.level === 'bad' || box.waste === null ? status.text : `Drawer ${Math.round(box.waste)}%`;
        return (
            <div className="ha-control-card litterbox-tile">
                <div className={`ha-tile has-dialog ${busy ? 'on' : 'off'}`}>
                    <button
                        type="button"
                        className="button-reset ha-tile-open"
                        aria-haspopup="dialog"
                        aria-label={`${name}, ${stateText}. Show details`}
                        disabled={!box}
                        onClick={() => setOpen(true)}
                    />
                    <button
                        type="button"
                        className="button-reset lb-ring"
                        style={/** @type {import('react').CSSProperties} */ ({ '--p': box?.waste ?? 0, '--c': RING_COLORS[level] })}
                        aria-label={`${name}: clean now`}
                        disabled={!box || busy}
                        onClick={run.clean}
                    >
                        <Icon icon={config.icon || ICON} size={18} />
                    </button>
                    <div className="ha-tile-content">
                        <div className="ha-tile-name" title={name}>{name}</div>
                        <div className="ha-tile-state">{stateText}</div>
                    </div>
                </div>
                {dialog}
            </div>
        );
    }

    let body;
    if (!config.entity_id) body = <EmptyState message="Choose the litter box's vacuum entity in the card settings." />;
    else if (!box) body = <EmptyState message={loading ? 'Loading…' : `Couldn't load the litter box${error ? `: ${error}` : ''}`} />;
    else {
        const showTimeline = size === 'full' && cats.some(c => c.visits !== null);
        body = (
            <>
                <LitterStats box={box} cats={cats} today={today} />
                <LitterLevels box={box} />
                {showTimeline && <CatTimelines cats={cats.filter(c => c.visits !== null)} today={today} now={now} />}
            </>
        );
    }

    const visits = box ? totalVisits(cats) : null;
    const subtitle = box
        ? [status.text, box.last_seen ? `last seen ${formatTime(box.last_seen)}` : visits !== null ? `${visits} visits today` : null].filter(Boolean).join(' · ')
        : undefined;

    return (
        <>
            <TwoToneBase
                className={`litterbox-card size-${size} status-${status?.level || 'none'}`}
                title={config.title || box?.name || 'Litter box'}
                subtitle={subtitle}
                icon={config.icon || ICON}
                iconBackground={config.iconBackground || ICON_BACKGROUND}
                iconColor={config.iconColor || '#fff'}
                onHeaderClick={box ? () => setOpen(true) : undefined}
                headerLabel={box ? `${box.name} details` : undefined}
                actions={box && <CleanButton box={box} onClean={run.clean} />}
            >
                <div className="lb-body">{body}</div>
            </TwoToneBase>
            {dialog}
        </>
    );
};

export default LitterboxCard;
