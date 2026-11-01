import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import EmptyState from '../../components/Shared/EmptyState';
import RobotDialog from './RobotDialog';
import { RobotButtons, RobotControls, RobotRooms, RobotStatus } from './VacuumParts';
import { useVacuums } from './useVacuums';
import { capitalize, isRunning, statusText } from './vacuumModel';
import './VacuumCard.css';

const ICON_BACKGROUND = 'linear-gradient(180deg, #5fd8ea, #1aa3c0)';

/**
 * Multi-robot card: start, stop and dock in the header act on all robots. Each robot shows the
 * content of its half height card, or of its full height card when there's a column for each.
 * Tapping a robot opens its details.
 * @param {Object} props
 * @param {Object} props.config - Card configuration, see the docs.
 * @returns {JSX.Element} The rendered card.
 */
const VacuumsCard = ({ config }) => {
    const hasRobots = Array.isArray(config.robots) && config.robots.length > 0;
    const { robots, loading, error, selection, toggleRoom, run } = useVacuums(config.id, hasRobots);
    const [openId, setOpenId] = useState(/** @type {string|null} */ (null));
    const openRobot = robots.find(r => r.entity_id === openId);
    const columns = (config.colSpan || 1) >= 2 && robots.length <= (config.colSpan || 1);

    const cleaning = robots.filter(isRunning).length;
    const docked = robots.filter(r => r.state === 'docked').length;
    const returning = robots.filter(r => r.state === 'returning').length;
    const others = robots.length - cleaning - docked - returning;
    const summary = [
        cleaning && `${cleaning} cleaning`,
        returning && `${returning} returning`,
        others && `${others} stopped`,
        docked && `${docked} docked`,
    ].filter(Boolean).join(' · ');

    let body;
    if (!hasRobots) body = <EmptyState message="Add robots in the card settings." />;
    else if (robots.length === 0) body = <EmptyState message={loading ? 'Loading…' : `Couldn't load the robots${error ? `: ${error}` : ''}`} />;
    else {
        body = (
            <div className={`vac-robots${columns ? ' columns' : ''}`}>
                {robots.map(robot => (
                    <div className="vac-robot" key={robot.entity_id}>
                        <button type="button" className="button-reset vac-robot-head" aria-label={`${robot.name} details, ${statusText(robot)}`} onClick={() => setOpenId(robot.entity_id)}>
                            <span className="vac-robot-name">{capitalize(robot.name)}</span>
                            <span className="vac-robot-state">{statusText(robot)}</span>
                            <ChevronRight size={15} aria-hidden="true" />
                        </button>
                        <RobotStatus robot={robot} />
                        {columns && <RobotControls robot={robot} run={run} />}
                        {columns && <RobotRooms robot={robot} selected={selection[robot.entity_id] || []} onToggle={toggleRoom} />}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <TwoToneBase
                className="vacuum-card vacuums-card"
                title={config.title || 'Robots'}
                subtitle={summary || undefined}
                icon={config.icon || 'mdi:robot-vacuum-variant'}
                iconBackground={config.iconBackground || ICON_BACKGROUND}
                iconColor={config.iconColor || '#fff'}
                actions={robots.length > 0 && <RobotButtons robots={robots} suffix="all robots" onStart={run.startOrPause} onStop={run.stop} onDock={run.dock} />}
            >
                <div className="vac-body">{body}</div>
            </TwoToneBase>
            {openRobot && (
                <RobotDialog robot={openRobot} cardId={config.id} run={run} selected={selection[openRobot.entity_id] || []} onToggleRoom={toggleRoom} onClose={() => setOpenId(null)} />
            )}
        </>
    );
};

export default VacuumsCard;
