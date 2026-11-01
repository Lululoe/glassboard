import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { House, LocateFixed, Pause, Play, Square, X } from 'lucide-react';
import Icon from '../../components/Shared/Icon';
import VacuumView from './VacuumView';
import { RobotConsumables, RobotControls, RobotRooms, RobotStatsGrid } from './VacuumParts';
import { canDock, canStop, isRunning, statusText } from './vacuumModel';

/** Stops events from reaching the dashboard behind the dialog (page swipes, card gestures). */
const stop = (e) => e.stopPropagation();

/**
 * Details of a robot: its map and camera, all its stats and consumables, and its controls,
 * which stay at the bottom. On phones it's a bottom sheet.
 * @param {Object} props
 * @param {Object} props.robot - The robot.
 * @param {*} props.cardId - The card.
 * @param {Object} props.run - Actions from `useVacuums`.
 * @param {string[]} props.selected - Areas of the picked rooms.
 * @param {(robot: Object, area: string) => void} props.onToggleRoom - Picks or unpicks a room.
 * @param {() => void} props.onClose - Closes the dialog.
 * @returns {JSX.Element} The dialog, rendered into `document.body`.
 */
const RobotDialog = ({ robot, cardId, run, selected, onToggleRoom, onClose }) => {
    const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
    const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
    const pressedBackdrop = useRef(false);
    const views = [
        robot.map && { key: 'map', label: 'Map', entity: robot.map },
        robot.camera && { key: 'camera', label: 'Camera', entity: robot.camera },
    ].filter(Boolean);
    const [viewKey, setViewKey] = useState(views[0]?.key);
    const view = views.find(v => v.key === viewKey) || views[0];
    const running = isRunning(robot);

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        const opener = /** @type {HTMLElement|null} */ (document.activeElement);
        if (!dialog.open) {
            if (dialog.showModal) dialog.showModal();
            else dialog.setAttribute('open', '');
        }
        closeRef.current?.focus();
        return () => {
            // The page stays inert until the modal closes, so close it before moving focus back
            if (dialog.open) dialog.close?.();
            opener?.focus?.();
        };
    }, []);

    return createPortal(
        <dialog
            ref={dialogRef}
            className="vac-overlay"
            aria-labelledby="vac-dialog-title"
            onCancel={(e) => { e.preventDefault(); onClose(); }}
            onKeyDown={stop}
            onPointerUp={stop}
            onTouchStart={stop}
            onTouchMove={stop}
            onTouchEnd={stop}
            onContextMenu={stop}
            onPointerDown={(e) => {
                e.stopPropagation();
                pressedBackdrop.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
                pressedBackdrop.current = false;
            }}
        >
            <div className={`vac-panel${view ? '' : ' single'}`}>
                <div className="vac-grabber" aria-hidden="true" />
                <header className="vac-head">
                    <span className="vac-head-icon" aria-hidden="true"><Icon icon="mdi:robot-vacuum" size={22} /></span>
                    <div className="vac-head-titles">
                        <h2 id="vac-dialog-title" className="vac-head-title">{robot.name}</h2>
                        <div className="vac-head-sub">{statusText(robot)}</div>
                    </div>
                    <button type="button" className="button-reset vac-round" aria-label="Locate: play a sound on the robot" onClick={() => run.locate(robot)}>
                        <LocateFixed size={19} aria-hidden="true" />
                    </button>
                    <button type="button" ref={closeRef} className="button-reset vac-round" aria-label="Close" onClick={onClose}>
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                <div className="vac-panes">
                    {view && (
                        <div className="vac-view-pane">
                            {views.length > 1 && (
                                <div className="vac-seg" role="group" aria-label="View">
                                    {views.map(v => (
                                        <button key={v.key} type="button" className="button-reset" aria-pressed={v.key === view.key} onClick={() => setViewKey(v.key)}>{v.label}</button>
                                    ))}
                                </div>
                            )}
                            <div className="vac-viewer">
                                <VacuumView key={view.entity} cardId={cardId} entityId={view.entity} robot={robot} selected={selected} onToggle={onToggleRoom} />
                            </div>
                        </div>
                    )}
                    <div className="vac-side">
                        <div className="vac-side-scroll">
                            <RobotStatsGrid robot={robot} />
                            <RobotConsumables robot={robot} run={run} />
                        </div>
                        <div className="vac-primary">
                            <RobotRooms robot={robot} selected={selected} onToggle={onToggleRoom} />
                            <RobotControls robot={robot} run={run} />
                            <div className="vac-actions">
                                <button type="button" className="button-reset vac-action accent" onClick={() => run.startOrPause(robot)}>
                                    {running ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
                                    {running ? 'Pause' : 'Start'}
                                </button>
                                <button type="button" className="button-reset vac-action" disabled={!canStop(robot)} onClick={() => run.stop(robot)}>
                                    <Square size={16} fill="currentColor" aria-hidden="true" />
                                    Stop
                                </button>
                                <button type="button" className="button-reset vac-action" disabled={!canDock(robot)} onClick={() => run.dock(robot)}>
                                    <House size={18} aria-hidden="true" />
                                    Dock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </dialog>,
        document.body,
    );
};

export default RobotDialog;
