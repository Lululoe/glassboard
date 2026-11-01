import { useRef, useState } from 'react';
import { Battery, BatteryFull, BatteryLow, BatteryMedium, Droplet, Fan, House, Pause, Play, Square } from 'lucide-react';
import { capitalize, canDock, canStop, consumableLevel, consumableText, formatValue, isRunning } from './vacuumModel';

const CONFIRM_MS = 4000;

/**
 * Battery icon that shows the level: its bars follow the charge, and it warns when low.
 * @param {Object} props
 * @param {*} props.value - The charge in percent.
 * @returns {JSX.Element} The icon.
 */
const BatteryIcon = ({ value }) => {
    const level = Number(value);
    const known = value !== null && value !== '' && Number.isFinite(level);
    let Shape = Battery;
    if (known) Shape = level > 66 ? BatteryFull : level > 33 ? BatteryMedium : level > 10 ? BatteryLow : Battery;
    const tone = !known ? '' : level <= 10 ? ' empty' : level <= 20 ? ' low' : '';
    return <Shape className={`vac-battery${tone}`} size={17} aria-hidden="true" />;
};

/** Stops room scrolling from changing the dashboard page. */
const stop = (e) => e.stopPropagation();

/**
 * Start (or pause), stop and return to dock.
 * @param {Object} props
 * @param {Array<Object>} props.robots - The robots the buttons act on.
 * @param {(robot: Object) => void} props.onStart - Starts or pauses a robot.
 * @param {(robot: Object) => void} props.onStop - Stops a robot.
 * @param {(robot: Object) => void} props.onDock - Sends a robot to its dock.
 * @param {string} [props.suffix] - Added to the buttons' names, e.g. `all robots`.
 * @returns {JSX.Element} The buttons.
 */
export const RobotButtons = ({ robots, onStart, onStop, onDock, suffix = '' }) => {
    const running = robots.some(isRunning);
    const label = (text) => (suffix ? `${text} ${suffix}` : text);
    return (
        <div className="vac-buttons">
            <button
                type="button"
                className="button-reset vac-round accent"
                aria-label={label(running ? 'Pause' : 'Start')}
                onClick={() => robots.filter(r => (running ? isRunning(r) : true)).forEach(onStart)}
            >
                {running ? <Pause size={19} fill="currentColor" aria-hidden="true" /> : <Play size={19} fill="currentColor" aria-hidden="true" />}
            </button>
            <button
                type="button"
                className="button-reset vac-round"
                aria-label={label('Stop')}
                disabled={!robots.some(canStop)}
                onClick={() => robots.filter(canStop).forEach(onStop)}
            >
                <Square size={17} fill="currentColor" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="button-reset vac-round"
                aria-label={label('Return to dock')}
                disabled={!robots.some(canDock)}
                onClick={() => robots.filter(canDock).forEach(onDock)}
            >
                <House size={19} aria-hidden="true" />
            </button>
        </div>
    );
};

/**
 * Stats and the bar: progress while cleaning, if the robot reports it, and the battery otherwise.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @returns {JSX.Element} The first three stats and the bar.
 */
export const RobotStatus = ({ robot }) => {
    // Without configured stats, the battery is what's known
    const stats = robot.stats.length ? robot.stats : (Number.isFinite(robot.battery) ? [{ name: 'Battery', value: robot.battery, unit: '%', battery: true }] : []);
    const active = robot.state === 'cleaning' || robot.state === 'paused';
    const showProgress = active && Number.isFinite(robot.progress);
    const width = showProgress ? robot.progress : (robot.battery ?? 0);
    return (
        <>
            {stats.length > 0 && (
                <div className="vac-stats">
                    {stats.slice(0, 3).map((s, i) => (
                        <div key={i}>
                            <span className="vac-stat-name">{s.name}</span>
                            <b>
                                {s.battery && <BatteryIcon value={s.value} />}
                                {formatValue(s.value, s.unit)}
                            </b>
                        </div>
                    ))}
                </div>
            )}
            <div
                className={`vac-bar${showProgress ? ' progress' : ''}`}
                role="progressbar"
                aria-label={showProgress ? 'Cleaning progress' : 'Battery'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(width)}
            >
                <div style={{ width: `${width}%` }} />
            </div>
        </>
    );
};

/** A row of options: buttons up to five, a list beyond that. */
const OptionRow = ({ icon, label, value, options, onChange }) => (
    <div className="vac-control">
        {icon}
        {options.length <= 5 ? (
            <div className="vac-seg" role="group" aria-label={label}>
                {options.map(o => (
                    <button key={o} type="button" className="button-reset" aria-pressed={o === value} onClick={() => onChange(o)}>
                        {capitalize(o)}
                    </button>
                ))}
            </div>
        ) : (
            <select className="vac-select" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
                {options.map(o => <option key={o} value={o}>{capitalize(o)}</option>)}
            </select>
        )}
    </div>
);

/**
 * Fan speed and, for robots with a mop, wetness.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @param {Object} props.run - Actions from `useVacuums`.
 * @returns {JSX.Element} The controls.
 */
export const RobotControls = ({ robot, run }) => (
    <>
        {robot.fan.options.length > 0 && (
            <OptionRow
                icon={<Fan size={18} aria-hidden="true" />}
                label="Fan speed"
                value={robot.fan.value}
                options={robot.fan.options}
                onChange={(v) => run.setFan(robot, v)}
            />
        )}
        {robot.wetness && robot.wetness.options.length > 0 && (
            <OptionRow
                icon={<Droplet size={18} aria-hidden="true" />}
                label="Mop wetness"
                value={robot.wetness.value}
                options={robot.wetness.options}
                onChange={(v) => run.setWetness(robot, v)}
            />
        )}
    </>
);

/**
 * Rooms to clean, in a row that scrolls sideways. With none picked, everything is cleaned; with
 * fewer than two rooms there's nothing to pick and the section is hidden.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @param {string[]} props.selected - Areas of the picked rooms.
 * @param {(robot: Object, area: string) => void} props.onToggle - Picks or unpicks a room.
 * @returns {JSX.Element|null} The rooms.
 */
export const RobotRooms = ({ robot, selected, onToggle }) => {
    if (robot.rooms.length < 2) return null;
    return (
        <div className="vac-rooms-section">
            <div className="vac-rooms-head">
                <span>Rooms</span>
                <span>{selected.length ? `${selected.length} of ${robot.rooms.length}` : 'All rooms'}</span>
            </div>
            <div className="vac-rooms" role="group" aria-label="Rooms to clean" onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
                {robot.rooms.map(r => (
                    <button key={r.area} type="button" className="button-reset vac-room" aria-pressed={selected.includes(r.area)} onClick={() => onToggle(robot, r.area)}>
                        {r.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

/**
 * All of a robot's stats.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @returns {JSX.Element|null} The section.
 */
export const RobotStatsGrid = ({ robot }) => {
    if (robot.stats.length === 0) return null;
    return (
        <>
            <div className="vac-section">Stats</div>
            <div className="vac-detail-stats">
                {robot.stats.map((s, i) => (
                    <div key={i}>
                        <span className="vac-stat-name">{s.name}</span>
                        <b>{formatValue(s.value, s.unit)}</b>
                    </div>
                ))}
            </div>
        </>
    );
};

/**
 * One consumable: what's left, a bar, and a reset button that asks once more before pressing.
 * @param {Object} props
 * @param {Object} props.part - The consumable.
 * @param {() => void} props.onReset - Presses its reset button.
 * @returns {JSX.Element} The row.
 */
const Consumable = ({ part, onReset }) => {
    const [confirming, setConfirming] = useState(false);
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const { width, level } = consumableLevel(part);
    const press = () => {
        clearTimeout(timer.current);
        if (confirming) {
            setConfirming(false);
            onReset();
            return;
        }
        setConfirming(true);
        timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
    };
    return (
        <div className={`vac-part ${level}`}>
            <div className="vac-part-head">
                <span className="vac-part-name">{part.name}</span>
                <span className="vac-part-value">{consumableText(part)}</span>
                {part.resettable && (
                    <button type="button" className={`button-reset vac-reset${confirming ? ' confirm' : ''}`} aria-label={confirming ? `Confirm reset of ${part.name}` : `Reset ${part.name}`} onClick={press}>
                        {confirming ? 'Confirm' : 'Reset'}
                    </button>
                )}
            </div>
            <div className="vac-part-bar"><div style={{ width: `${width}%` }} /></div>
        </div>
    );
};

/**
 * All of a robot's consumables.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @param {Object} props.run - Actions from `useVacuums`.
 * @returns {JSX.Element|null} The section.
 */
export const RobotConsumables = ({ robot, run }) => {
    if (robot.consumables.length === 0) return null;
    return (
        <>
            <div className="vac-section">Consumables</div>
            {robot.consumables.map(part => (
                <Consumable key={part.index} part={part} onReset={() => run.resetConsumable(robot, part.index)} />
            ))}
        </>
    );
};
