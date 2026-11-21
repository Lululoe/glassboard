import { useRef, useState } from 'react';
import { ChevronDown, Speaker } from 'lucide-react';
import { Artwork, Progress, Transport, VolumeSlider } from '../MediaPlayer/MediaPlayerCard';
import { livePosition } from '../MediaPlayer/useMediaPlayers';
import './NowPlaying.css';

/** How far the player must be swiped, in px, to go away. */
const DISMISS_DISTANCE = 140;
/** A quicker swipe goes away with less distance, in px per ms. */
const DISMISS_SPEED = 0.6;

/**
 * Formats seconds as `m:ss`, or `h:mm:ss` from an hour on.
 * @param {number} seconds - The time.
 * @returns {string} The formatted time.
 */
const clockTime = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

/**
 * The full-screen player of kiosk mode, as Apple Music shows it on an iPad: the artwork on the
 * left, the track and its controls on the right, the artwork's colours blurred behind. It is
 * swiped down (or up) to go away; the chevron does the same for a mouse or keyboard.
 * @param {Object} props
 * @param {Object} props.player - The player, from useMediaPlayers.
 * @param {Object} props.actions - Media player actions from useMediaPlayers.
 * @param {Date} props.now - The time, for the clock and the progress.
 * @param {() => void} [props.onDismiss] - Swipes the player away; left out in a preview.
 * @param {boolean} [props.preview] - Drawn in a box instead of over the screen.
 * @returns {JSX.Element} The player.
 */
const NowPlaying = ({ player, actions, now, onDismiss, preview = false }) => {
    const drag = useRef(/** @type {{id: number, y: number, at: number}|null} */ (null));
    const [offset, setOffset] = useState(0);
    const [leaving, setLeaving] = useState(false);
    const [dragging, setDragging] = useState(false);
    const position = livePosition(player, now.getTime());
    const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const dismiss = () => {
        if (!onDismiss) return;
        setLeaving(true);
        setTimeout(onDismiss, 280);
    };

    const swipeHandlers = onDismiss ? {
        onPointerDown: (e) => {
            // Controls keep their own drags and taps
            if (e.button !== 0 || e.target.closest('button, [role="slider"]')) return;
            try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
            drag.current = { id: e.pointerId, y: e.clientY, at: performance.now() };
            setDragging(true);
        },
        onPointerMove: (e) => {
            if (drag.current?.id !== e.pointerId) return;
            setOffset(e.clientY - drag.current.y);
        },
        onPointerUp: (e) => {
            if (drag.current?.id !== e.pointerId) return;
            const distance = e.clientY - drag.current.y;
            const speed = Math.abs(distance) / Math.max(1, performance.now() - drag.current.at);
            drag.current = null;
            setDragging(false);
            if (Math.abs(distance) > DISMISS_DISTANCE || (Math.abs(distance) > 40 && speed > DISMISS_SPEED)) {
                setOffset(distance > 0 ? window.innerHeight : -window.innerHeight);
                dismiss();
            } else {
                setOffset(0);
            }
        },
        onPointerCancel: () => {
            drag.current = null;
            setDragging(false);
            setOffset(0);
        },
    } : {};

    const style = offset || leaving
        ? { transform: `translateY(${offset}px) scale(${1 - Math.min(Math.abs(offset) / 4000, 0.08)})`, opacity: leaving ? 0 : 1 - Math.min(Math.abs(offset) / 900, 0.5) }
        : undefined;

    return (
        <div
            className={`kiosk-now${preview ? ' is-preview' : ''}${player.playing ? '' : ' is-paused'}${dragging ? ' is-dragging' : ''}`}
            role={preview ? undefined : 'dialog'}
            aria-label={preview ? undefined : `Now playing on ${player.name}`}
            style={style}
            {...swipeHandlers}
        >
            <Artwork player={player} className="kn-bg" />
            <div className="kn-shade" />
            <div className="kn-top">
                {onDismiss ? (
                    <button type="button" className="button-reset kn-close" onClick={dismiss} aria-label="Close player">
                        <ChevronDown size={26} aria-hidden="true" />
                    </button>
                ) : <span />}
                <span className="kn-source"><Speaker size={16} aria-hidden="true" />{player.name}</span>
                <span className="kn-time">{time}</span>
            </div>
            <div className="kn-body">
                <Artwork player={player} className="kn-art" />
                <div className="kn-info">
                    <div className="kn-text">
                        <div className="kn-title">{player.title || (player.active ? player.name : 'Not Playing')}</div>
                        <div className="kn-artist">{[player.artist, player.album].filter(Boolean).join(' — ') || player.app}</div>
                    </div>
                    <div className="kn-progress">
                        <Progress player={player} now={now.getTime()} actions={actions} />
                        {player.active && player.duration > 0 && (
                            <div className="kn-times">
                                <span>{clockTime(position)}</span>
                                <span>-{clockTime(player.duration - position)}</span>
                            </div>
                        )}
                    </div>
                    <Transport player={player} actions={actions} />
                    {player.can.volume && player.volume !== null && (
                        <VolumeSlider speaker={player} onChange={(level) => actions.setVolume(player, level)} dimmed={false} />
                    )}
                </div>
            </div>
            {onDismiss && <div className="kn-grabber" aria-hidden="true" />}
        </div>
    );
};

export default NowPlaying;
