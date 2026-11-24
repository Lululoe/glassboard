import { RotateCw } from 'lucide-react';
import { dayFraction, formatTime, formatWeight, isBusy, lastVisit, lastWeighed, litterLevel, totalVisits, wasteLevel } from './litterModel';

/**
 * Visits today, the weight of the cat weighed last (its name in the label) and the last visit.
 * @param {Object} props
 * @param {Object} props.box - The litter box.
 * @param {Array<Object>} props.cats - Its cats, with colors.
 * @param {Object|null} props.today - Today's history, for the last visit.
 * @returns {JSX.Element} The stats.
 */
export const LitterStats = ({ box, cats, today }) => {
    const visits = totalVisits(cats);
    const weighed = lastWeighed(cats);
    const last = lastVisit(today);
    return (
        <div className="lb-stats">
            <div>
                <span className="lb-stat-name">Visits today</span>
                <b>{visits ?? '–'}</b>
            </div>
            <div>
                <span className="lb-stat-name">{weighed && cats.length > 1 ? `${weighed.name}'s weight` : 'Cat weight'}</span>
                <b>
                    {weighed ? formatWeight(weighed.weight) : '–'}
                    {weighed?.weight_unit && <small>{weighed.weight_unit}</small>}
                </b>
            </div>
            <div>
                <span className="lb-stat-name">Last visit</span>
                <b>{last ? formatTime(last.time) : box.last_seen && !cats.length ? formatTime(box.last_seen) : '–'}</b>
            </div>
        </div>
    );
};

/**
 * A level as a labelled bar.
 * @param {Object} props
 * @param {string} props.name - E.g. `Waste drawer`.
 * @param {number|null} props.value - Percent.
 * @param {string} props.level - `''`, `warn` or `bad`.
 * @returns {JSX.Element} The level.
 */
const Level = ({ name, value, level }) => (
    <div className={`lb-level ${level}`}>
        <div className="lb-level-head">
            <span>{name}</span>
            <b>{value === null ? '–' : `${Math.round(value)}%`}</b>
        </div>
        <div className="lb-bar" role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
            <div style={{ width: `${value ?? 0}%` }} />
        </div>
    </div>
);

/**
 * The waste drawer and litter levels side by side; those the card has no sensor for are left out.
 * @param {Object} props
 * @param {Object} props.box - The litter box.
 * @returns {JSX.Element|null} The levels.
 */
export const LitterLevels = ({ box }) => {
    const levels = [
        box.waste !== null && <Level key="waste" name="Waste drawer" value={box.waste} level={wasteLevel(box.waste)} />,
        box.litter !== null && <Level key="litter" name="Litter" value={box.litter} level={litterLevel(box.litter)} />,
    ].filter(Boolean);
    return levels.length ? <div className="lb-levels">{levels}</div> : null;
};

/**
 * One timeline per cat for today, with the cat's name before it and its visits after it: a mark
 * for each visit and a line for now.
 * @param {Object} props
 * @param {Array<Object>} props.cats - The cats, with colors.
 * @param {Object|null} props.today - Today's history.
 * @param {number} props.now - The current time in ms.
 * @returns {JSX.Element} The timelines.
 */
export const CatTimelines = ({ cats, today, now }) => {
    const nowAt = `${dayFraction(now) * 100}%`;
    return (
        <div className="lb-timelines" style={/** @type {import('react').CSSProperties} */ ({ '--rows': cats.length })}>
            <span className="lb-timelines-title">Today</span>
            {cats.map(cat => {
                const visits = today?.cats?.find(c => c.index === cat.index)?.visits || [];
                return (
                    <div className="lb-cat-row" key={cat.index} style={/** @type {import('react').CSSProperties} */ ({ '--cat': cat.color })}>
                        <b className="lb-cat-name">{cat.name}</b>
                        <div className="lb-track" role="img" aria-label={`${cat.name}: ${visits.length ? visits.map(formatTime).join(', ') : 'no visits yet'} today`}>
                            {visits.map((t, i) => <span key={`${t}-${i}`} className="lb-visit" style={{ left: `${dayFraction(t) * 100}%` }} />)}
                            <span className="lb-now" style={{ left: nowAt }} />
                        </div>
                        <span className="lb-cat-count">{cat.visits !== null ? `${cat.visits} ${cat.visits === 1 ? 'visit' : 'visits'}` : ''}</span>
                    </div>
                );
            })}
            <div className="lb-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        </div>
    );
};

/**
 * The header button that starts a clean cycle.
 * @param {Object} props
 * @param {Object} props.box - The litter box.
 * @param {() => void} props.onClean - Starts a clean.
 * @returns {JSX.Element} The button.
 */
export const CleanButton = ({ box, onClean }) => {
    const busy = isBusy(box);
    return (
        <button
            type="button"
            className="button-reset two-tone-header-action lb-clean"
            aria-label="Clean now"
            title="Clean now"
            disabled={busy || box.state === 'unavailable'}
            onClick={onClean}
        >
            <RotateCw size={19} aria-hidden="true" />
        </button>
    );
};
