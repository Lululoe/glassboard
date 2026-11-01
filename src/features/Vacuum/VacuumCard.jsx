import { useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import EmptyState from '../../components/Shared/EmptyState';
import RobotDialog from './RobotDialog';
import VacuumView from './VacuumView';
import { RobotButtons, RobotConsumables, RobotControls, RobotRooms, RobotStatsGrid, RobotStatus } from './VacuumParts';
import { useVacuums } from './useVacuums';
import { statusText, wideLayout } from './vacuumModel';
import './VacuumCard.css';

const ICON_BACKGROUND = 'linear-gradient(180deg, #5fd8ea, #1aa3c0)';

const SECTION_LABELS = { map: 'Map', stats: 'Stats', consumables: 'Consumables' };

/**
 * The extra columns of a two or three wide card. With more sections than columns, a switch
 * chooses what the one column shows.
 * @param {Object} props
 * @param {{columns: string[][], tabs: boolean}} props.layout - From `wideLayout`.
 * @param {Object} props.robot - The robot.
 * @param {*} props.cardId - The card.
 * @param {Object} props.run - Actions from `useVacuums`.
 * @param {string[]} props.selected - Areas of the picked rooms.
 * @param {(robot: Object, area: string) => void} props.onToggleRoom - Picks or unpicks a room.
 * @returns {JSX.Element[]} The columns.
 */
const WideSections = ({ layout, robot, cardId, run, selected, onToggleRoom }) => {
    const [picked, setPicked] = useState(/** @type {string|null} */ (null));
    return layout.columns.map((sections) => {
        const shown = layout.tabs ? [sections.includes(picked) ? picked : sections[0]] : sections;
        return (
            <div className="vac-column" key={sections.join()}>
                {layout.tabs && (
                    <div className="vac-seg" role="group" aria-label="Section">
                        {sections.map(s => (
                            <button key={s} type="button" className="button-reset" aria-pressed={s === shown[0]} onClick={() => setPicked(s)}>{SECTION_LABELS[s]}</button>
                        ))}
                    </div>
                )}
                {shown[0] === 'map' ? (
                    <div className="vac-viewer">
                        <VacuumView cardId={cardId} entityId={robot.map} robot={robot} selected={selected} onToggle={onToggleRoom} />
                    </div>
                ) : (
                    <div className="vac-column-scroll">
                        {shown.includes('stats') && <RobotStatsGrid robot={robot} />}
                        {shown.includes('consumables') && <RobotConsumables robot={robot} run={run} />}
                    </div>
                )}
            </div>
        );
    });
};

/**
 * Single robot card: start, stop and dock in the header; stats and the bar below. From full
 * height it adds fan speed, wetness and rooms, and two and three wide it can also show the map,
 * all stats and the consumables. The header opens the robot's details.
 * @param {Object} props
 * @param {Object} props.config - Card configuration, see the docs.
 * @returns {JSX.Element} The rendered card.
 */
const VacuumCard = ({ config }) => {
    const half = config.tileSize === 'half';
    const { robots, loading, error, selection, toggleRoom, run } = useVacuums(config.id, Boolean(config.entity_id));
    const robot = robots[0];
    const [open, setOpen] = useState(false);
    const selected = robot ? selection[robot.entity_id] || [] : [];

    const layout = robot && !half ? wideLayout(config, robot) : { columns: [], tabs: false };
    const hasColumns = layout.columns.length > 0;

    let body;
    if (!config.entity_id) body = <EmptyState message="Choose a vacuum in the card settings." />;
    else if (!robot) body = <EmptyState message={loading ? 'Loading…' : `Couldn't load the robot${error ? `: ${error}` : ''}`} />;
    else {
        body = (
            <>
                <RobotStatus robot={robot} />
                {!half && <RobotControls robot={robot} run={run} />}
                {!half && <RobotRooms robot={robot} selected={selected} onToggle={toggleRoom} />}
            </>
        );
    }

    return (
        <>
            <TwoToneBase
                className={`vacuum-card${half ? ' half' : ''}${hasColumns ? ' wide' : ''}`}
                title={config.title || robot?.name || 'Vacuum'}
                subtitle={robot ? statusText(robot) : undefined}
                icon={config.icon || 'mdi:robot-vacuum'}
                iconBackground={ICON_BACKGROUND}
                iconColor="#fff"
                onHeaderClick={robot ? () => setOpen(true) : undefined}
                headerLabel={robot ? `${robot.name} details` : undefined}
                actions={robot && <RobotButtons robots={[robot]} onStart={run.startOrPause} onStop={run.stop} onDock={run.dock} />}
            >
                {hasColumns ? (
                    <div
                        className="vac-wide"
                        style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${layout.columns.length}, minmax(0, ${(config.colSpan - 1) / layout.columns.length}fr))` }}
                    >
                        <div className="vac-body">{body}</div>
                        <WideSections layout={layout} robot={robot} cardId={config.id} run={run} selected={selected} onToggleRoom={toggleRoom} />
                    </div>
                ) : <div className="vac-body">{body}</div>}
            </TwoToneBase>
            {open && robot && (
                <RobotDialog robot={robot} cardId={config.id} run={run} selected={selected} onToggleRoom={toggleRoom} onClose={() => setOpen(false)} />
            )}
        </>
    );
};

export default VacuumCard;
