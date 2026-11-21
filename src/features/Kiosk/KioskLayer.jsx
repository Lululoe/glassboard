import { useCallback, useEffect, useRef, useState } from 'react';
import ClockFace from './ClockFace';
import ControlCenter from './ControlCenter';
import NowPlaying from './NowPlaying';
import { useKiosk } from './useKiosk';
import './Kiosk.css';

/** A pull that starts this close to the top edge, in px, can open the control center. */
const PULL_ZONE = 56;
/** How far down it must be pulled, in px. */
const PULL_DISTANCE = 64;

/**
 * Opens the control center when the screen is pulled down from its top edge.
 * @param {boolean} enabled - Whether pulling opens it.
 * @param {() => void} onPull - Opens it.
 */
function usePullDown(enabled, onPull) {
    const start = useRef(/** @type {{id: number, x: number, y: number}|null} */ (null));
    useEffect(() => {
        if (!enabled) return undefined;
        const down = (e) => {
            start.current = e.clientY <= PULL_ZONE ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
        };
        const move = (e) => {
            const s = start.current;
            if (!s || s.id !== e.pointerId) return;
            const dy = e.clientY - s.y;
            if (dy > PULL_DISTANCE && dy > Math.abs(e.clientX - s.x)) {
                start.current = null;
                onPull();
            }
        };
        const end = () => { start.current = null; };
        window.addEventListener('pointerdown', down, true);
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', end, true);
        return () => {
            window.removeEventListener('pointerdown', down, true);
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            window.removeEventListener('pointercancel', end, true);
        };
    }, [enabled, onPull]);
}

/**
 * Kiosk mode over the dashboard: the clock while nobody uses the screen, black while the room is
 * empty (the screen is switched off too), the full-screen player while music plays, and the
 * control center pulled down from the top. A touch on the clock shows the dashboard.
 * @param {Object} props
 * @param {Object} props.config - The dashboard config.
 * @param {boolean} [props.suspended] - Keeps the dashboard and hides the overlays, e.g. while editing.
 * @returns {JSX.Element} The overlays.
 */
const KioskLayer = ({ config, suspended = false }) => {
    const kiosk = useKiosk(config, { suspended });
    const [controlCenter, setControlCenter] = useState(false);
    const open = useCallback(() => setControlCenter(true), []);
    usePullDown(!suspended && !controlCenter, open);

    const { mode, now, night, weather, takeoverPlayer } = kiosk;
    const clockShown = mode === 'clock';

    return (
        <>
            <div className={`kiosk-clock${clockShown ? ' is-shown' : ''}`} aria-hidden={!clockShown}>
                <ClockFace face={kiosk.kiosk.clock} now={now} night={night} weather={weather} />
            </div>
            {takeoverPlayer && !suspended && mode !== 'off' && (
                <NowPlaying
                    key={takeoverPlayer.id}
                    player={takeoverPlayer}
                    actions={kiosk.media}
                    now={now}
                    onDismiss={kiosk.actions.dismissPlayer}
                />
            )}
            <div className={`kiosk-off${mode === 'off' ? ' is-shown' : ''}`} aria-hidden="true" />
            {controlCenter && !suspended && <ControlCenter kiosk={kiosk} onClose={() => setControlCenter(false)} />}
        </>
    );
};

export default KioskLayer;
