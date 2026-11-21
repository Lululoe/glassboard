import { useEffect, useRef, useState } from 'react';
import { Clock, Music, Power, Sun, Volume1, Volume2, VolumeX } from 'lucide-react';
import Icon from '../../components/Shared/Icon';
import { Artwork, Transport } from '../MediaPlayer/MediaPlayerCard';
import './ControlCenter.css';

const KEY_STEP = 0.05;

/**
 * A tall slider tile, filled from the bottom like the ones in Apple's Control Center. Dragging
 * moves the level from where it was rather than jumping to the finger; the level is sent once
 * on release.
 * @param {Object} props
 * @param {string} props.label - What it sets, e.g. "Brightness".
 * @param {number|null} props.value - The level, 0–1; null while unknown.
 * @param {(level: number) => void} props.onCommit - Receives the new level.
 * @param {(level: number) => import('react').ReactNode} props.icon - The icon for a level.
 * @returns {JSX.Element} The slider.
 */
export const TallSlider = ({ label, value, onCommit, icon }) => {
    const ref = useRef(null);
    const drag = useRef(/** @type {{id: number, y: number, from: number, value: number}|null} */ (null));
    const keyTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const [preview, setPreview] = useState(/** @type {number|null} */ (null));
    useEffect(() => () => clearTimeout(keyTimer.current), []);
    const enabled = value !== null;
    const level = preview ?? value ?? 0;

    return (
        <div
            ref={ref}
            className={`kcc-tile kcc-tall${preview !== null ? ' is-dragging' : ''}`}
            role="slider"
            tabIndex={enabled ? 0 : -1}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            aria-disabled={!enabled || undefined}
            onPointerDown={(e) => {
                if (!enabled || e.button !== 0) return;
                try { ref.current.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
                drag.current = { id: e.pointerId, y: e.clientY, from: level, value: level };
                setPreview(level);
            }}
            onPointerMove={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                const height = ref.current.getBoundingClientRect().height || 1;
                drag.current.value = Math.min(1, Math.max(0, drag.current.from + (drag.current.y - e.clientY) / height));
                setPreview(drag.current.value);
            }}
            onPointerUp={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                onCommit(Math.round(drag.current.value * 100) / 100);
                drag.current = null;
                setPreview(null);
            }}
            onPointerCancel={() => { drag.current = null; setPreview(null); }}
            onKeyDown={(e) => {
                const delta = { ArrowUp: KEY_STEP, ArrowRight: KEY_STEP, ArrowDown: -KEY_STEP, ArrowLeft: -KEY_STEP }[e.key];
                if (!delta || !enabled) return;
                e.preventDefault();
                const next = Math.round(Math.min(1, Math.max(0, level + delta)) * 100) / 100;
                setPreview(next);
                clearTimeout(keyTimer.current);
                keyTimer.current = setTimeout(() => { onCommit(next); setPreview(null); }, 500);
            }}
        >
            <div className="kcc-tall-fill" style={{ height: `${level * 100}%` }} />
            <span className="kcc-tall-icon" aria-hidden="true">{icon(level)}</span>
            {preview !== null && <span className="kcc-tall-value">{Math.round(level * 100)}%</span>}
        </div>
    );
};

/**
 * The kiosk's control center, pulled down from the top of the screen: the music, brightness,
 * volume, the switches chosen in the kiosk options, and the clock.
 * @param {Object} props
 * @param {ReturnType<typeof import('./useKiosk').useKiosk>} props.kiosk - The kiosk.
 * @param {() => void} props.onClose - Closes the control center.
 * @returns {JSX.Element} The control center.
 */
const ControlCenter = ({ kiosk, onClose }) => {
    const { players, takeoverPlayer, volumePlayer, brightness, toggles, actions, media } = kiosk;
    const player = takeoverPlayer ?? players.find(p => p.playing) ?? players.find(p => p.active) ?? players[0] ?? null;
    const swipe = useRef(/** @type {{id: number, y: number}|null} */ (null));

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="kiosk-cc"
            role="dialog"
            aria-modal="true"
            aria-label="Control Center"
            onPointerDown={(e) => {
                if (e.target === e.currentTarget) swipe.current = { id: e.pointerId, y: e.clientY };
            }}
            onPointerUp={(e) => {
                // A tap or an upward swipe on the blurred dashboard closes it
                if (swipe.current?.id === e.pointerId && e.target === e.currentTarget) onClose();
                swipe.current = null;
            }}
        >
            <div className="kcc-panel">
                {player && (
                    <div className="kcc-tile kcc-now">
                        <button
                            type="button"
                            className="button-reset kcc-now-top"
                            onClick={() => {
                                actions.showPlayer(player.id);
                                onClose();
                            }}
                            aria-label={`Show ${player.name} full screen`}
                        >
                            <Artwork player={player} className="kcc-now-art" />
                            <span className="kcc-now-text">
                                <span className="kcc-now-title">{player.active ? player.title || player.name : 'Not Playing'}</span>
                                <span className="kcc-now-sub">{player.active ? player.artist || player.name : player.name}</span>
                            </span>
                        </button>
                        <Transport player={player} actions={media} compact />
                    </div>
                )}
                {brightness !== null && (
                    <TallSlider
                        label="Brightness"
                        value={brightness}
                        onCommit={actions.setBrightness}
                        icon={() => <Sun size={26} />}
                    />
                )}
                {volumePlayer && (
                    <TallSlider
                        label={`${volumePlayer.name} volume`}
                        value={volumePlayer.available && volumePlayer.volume !== null ? volumePlayer.volume : null}
                        onCommit={(level) => media.setVolume(volumePlayer, level)}
                        icon={(level) => (level === 0 ? <VolumeX size={26} /> : level < 0.5 ? <Volume1 size={26} /> : <Volume2 size={26} />)}
                    />
                )}
                {toggles.map(toggle => (
                    <button
                        key={toggle.id}
                        type="button"
                        className={`button-reset kcc-tile kcc-toggle${toggle.on ? ' is-on' : ''}`}
                        aria-pressed={toggle.on}
                        disabled={!toggle.available}
                        onClick={() => actions.toggle(toggle.id, !toggle.on)}
                    >
                        <span className="kcc-toggle-icon" aria-hidden="true">
                            {toggle.icon ? <Icon icon={toggle.icon} size={24} /> : <Power size={22} />}
                        </span>
                        <span className="kcc-toggle-name">{toggle.name}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className="button-reset kcc-tile kcc-wide"
                    onClick={() => {
                        actions.showClock();
                        onClose();
                    }}
                >
                    <span className="kcc-toggle-icon" aria-hidden="true"><Clock size={22} /></span>
                    <span>
                        Clock
                        <small>Show the screensaver now</small>
                    </span>
                </button>
                {players.length === 0 && (
                    <div className="kcc-tile kcc-wide kcc-hint">
                        <span className="kcc-toggle-icon" aria-hidden="true"><Music size={22} /></span>
                        <span>No players<small>Choose them in the kiosk options</small></span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ControlCenter;
