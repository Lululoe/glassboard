import { useEffect, useRef, useState } from 'react';
import { Check, Music, Pause, Play, SkipBack, SkipForward, Speaker, Volume2 } from 'lucide-react';
import { hashText, livePosition, useMediaPlayers } from './useMediaPlayers';
import './MediaPlayerCard.css';

const KEY_COMMIT_DELAY = 500;

/**
 * Formats seconds as `m:ss` or `h:mm:ss`.
 * @param {number} seconds - Duration in seconds.
 * @returns {string} The formatted time.
 */
const formatTime = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

/**
 * Cover art, or a gradient generated from the track (or player) name when there is none.
 * @param {Object} props
 * @param {Object} props.player - The player.
 * @param {string} props.className - Placement class.
 * @returns {JSX.Element} The artwork.
 */
const Artwork = ({ player, className }) => {
    const [failed, setFailed] = useState(/** @type {string|null} */ (null));
    const seed = parseInt(hashText(player.title || player.album || player.name), 36);
    const hue = seed % 360;
    const style = {
        background: [
            `radial-gradient(circle at 22% 25%, hsl(${hue} 85% 68%) 0, transparent 55%)`,
            `radial-gradient(circle at 80% 28%, hsl(${(hue + 50) % 360} 90% 70%) 0, transparent 50%)`,
            `radial-gradient(circle at 50% 95%, hsl(${(hue + 200) % 360} 75% 58%) 0, transparent 62%)`,
            `hsl(${(hue + 260) % 360} 45% 22%)`,
        ].join(', '),
    };
    const showImage = player.art && failed !== player.art;

    return (
        <div className={`mp-art ${className}`} style={showImage ? undefined : style} aria-hidden="true">
            {showImage
                ? <img src={player.art} alt="" draggable={false} onError={() => setFailed(player.art)} />
                : !player.active && <Music className="mp-art-icon" size={28} />}
        </div>
    );
};

/**
 * Previous, play/pause and next. Buttons the player does not support are left out.
 * @param {Object} props
 * @param {Object} props.player - The player.
 * @param {Object} props.actions - Actions from useMediaPlayers.
 * @param {boolean} [props.compact] - Smaller buttons for the half tile.
 * @returns {JSX.Element} The controls.
 */
const Transport = ({ player, actions, compact = false }) => (
    <div className={`mp-transport${compact ? ' compact' : ''}`}>
        {player.can.previous && (
            <button type="button" className="button-reset mp-skip" aria-label={`Previous on ${player.name}`} disabled={!player.available} onClick={() => actions.previous(player)}>
                <SkipBack size={compact ? 20 : 22} aria-hidden="true" />
            </button>
        )}
        <button
            type="button"
            className="button-reset mp-play"
            aria-label={`${player.playing ? 'Pause' : 'Play'} ${player.name}`}
            disabled={!player.available || !player.can.playPause}
            onClick={() => actions.playPause(player)}
        >
            {player.playing ? <Pause size={compact ? 20 : 22} aria-hidden="true" /> : <Play size={compact ? 20 : 22} aria-hidden="true" />}
        </button>
        {player.can.next && (
            <button type="button" className="button-reset mp-skip" aria-label={`Next on ${player.name}`} disabled={!player.available} onClick={() => actions.next(player)}>
                <SkipForward size={compact ? 20 : 22} aria-hidden="true" />
            </button>
        )}
    </div>
);

/**
 * Progress through the track. On the full card it can be dragged to seek, when the player
 * supports it; the position is sent once on release.
 * @param {Object} props
 * @param {Object} props.player - The player.
 * @param {number} props.now - Current time in ms.
 * @param {Object} [props.actions] - Actions; omit for a display-only bar.
 * @returns {JSX.Element|null} The progress bar.
 */
const Progress = ({ player, now, actions }) => {
    const ref = useRef(null);
    const drag = useRef(/** @type {{id: number, value: number}|null} */ (null));
    const keyTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const [preview, setPreview] = useState(/** @type {number|null} */ (null));
    useEffect(() => () => clearTimeout(keyTimer.current), []);
    if (!player.active || !player.duration) return null;

    const position = preview ?? livePosition(player, now);
    const percent = Math.min(100, (position / player.duration) * 100);
    const seekable = Boolean(actions) && player.can.seek;

    if (!seekable) {
        return (
            <div className="mp-bar" aria-hidden="true">
                <div style={{ width: `${percent}%` }} />
            </div>
        );
    }

    const fromPointer = (e) => {
        const rect = ref.current.getBoundingClientRect();
        return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * player.duration;
    };
    const commit = (seconds) => {
        actions.seek(player, Math.round(seconds));
        setPreview(null);
    };

    return (
        <div
            ref={ref}
            className={`mp-scrub${preview !== null ? ' active' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label={`Position in ${player.title || 'track'}`}
            aria-valuemin={0}
            aria-valuemax={Math.round(player.duration)}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${formatTime(position)} of ${formatTime(player.duration)}`}
            onPointerDown={(e) => {
                if (e.button !== 0) return;
                try { ref.current.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
                drag.current = { id: e.pointerId, value: fromPointer(e) };
                setPreview(drag.current.value);
            }}
            onPointerMove={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                drag.current.value = fromPointer(e);
                setPreview(drag.current.value);
            }}
            onPointerUp={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                commit(drag.current.value);
                drag.current = null;
            }}
            onPointerCancel={() => { drag.current = null; setPreview(null); }}
            onKeyDown={(e) => {
                const delta = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[e.key];
                if (!delta) return;
                e.preventDefault();
                const next = Math.min(player.duration, Math.max(0, position + delta));
                setPreview(next);
                clearTimeout(keyTimer.current);
                keyTimer.current = setTimeout(() => commit(next), KEY_COMMIT_DELAY);
            }}
        >
            <div className="mp-scrub-track"><div style={{ width: `${percent}%` }} /></div>
        </div>
    );
};

/**
 * Horizontal volume capsule for one speaker in the output sheet. It previews while dragging
 * and sends the level once on release.
 * @param {Object} props
 * @param {Object} props.speaker - The speaker.
 * @param {(level: number) => void} props.onChange - Receives the new level (0–1).
 * @param {boolean} props.dimmed - Shown faded when the speaker is not in the group.
 * @returns {JSX.Element} The slider.
 */
const VolumeSlider = ({ speaker, onChange, dimmed }) => {
    const ref = useRef(null);
    const drag = useRef(/** @type {{id: number, value: number}|null} */ (null));
    const keyTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const [preview, setPreview] = useState(/** @type {number|null} */ (null));
    useEffect(() => () => clearTimeout(keyTimer.current), []);
    const level = preview ?? speaker.volume ?? 0;
    const enabled = speaker.available && speaker.can.volume && speaker.volume !== null;

    const fromPointer = (e) => {
        const rect = ref.current.getBoundingClientRect();
        return Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 100) / 100;
    };

    return (
        <div
            ref={ref}
            className={`mp-volume${dimmed ? ' dimmed' : ''}`}
            role="slider"
            tabIndex={enabled ? 0 : -1}
            aria-label={`${speaker.name} volume`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            aria-disabled={!enabled || undefined}
            onPointerDown={(e) => {
                if (!enabled || e.button !== 0) return;
                try { ref.current.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
                drag.current = { id: e.pointerId, value: fromPointer(e) };
                setPreview(drag.current.value);
            }}
            onPointerMove={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                drag.current.value = fromPointer(e);
                setPreview(drag.current.value);
            }}
            onPointerUp={(e) => {
                if (drag.current?.id !== e.pointerId) return;
                onChange(drag.current.value);
                drag.current = null;
                setPreview(null);
            }}
            onPointerCancel={() => { drag.current = null; setPreview(null); }}
            onKeyDown={(e) => {
                const delta = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
                if (!delta || !enabled) return;
                e.preventDefault();
                const next = Math.round(Math.min(1, Math.max(0, level + delta)) * 100) / 100;
                setPreview(next);
                clearTimeout(keyTimer.current);
                keyTimer.current = setTimeout(() => { onChange(next); setPreview(null); }, KEY_COMMIT_DELAY);
            }}
        >
            <div className="mp-volume-fill" style={{ width: `${level * 100}%` }} />
            <Speaker size={17} aria-hidden="true" />
            <span className="mp-volume-name">{speaker.name}</span>
            <span className="mp-volume-value">{speaker.volume === null ? '–' : `${Math.round(level * 100)}%`}</span>
        </div>
    );
};

/**
 * Output sheet over the card: volume per speaker, and a check to add a speaker to the
 * player's group or remove it (for players that support grouping).
 * @param {Object} props
 * @param {Object} props.player - The player whose output is shown.
 * @param {Array<Object>} props.speakers - Speakers from useMediaPlayers.
 * @param {Object} props.actions - Actions from useMediaPlayers.
 * @param {() => void} props.onClose - Closes the sheet.
 * @returns {JSX.Element} The sheet.
 */
const SpeakerSheet = ({ player, speakers, actions, onClose }) => {
    const ref = useRef(null);
    const list = speakers.some(s => s.id === player.id) ? speakers : [player, ...speakers];

    useEffect(() => {
        ref.current?.querySelector('button')?.focus();
    }, []);

    return (
        <div
            ref={ref}
            className="mp-sheet"
            role="dialog"
            aria-label={`Speakers for ${player.name}`}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            <div className="mp-sheet-head">
                <div className="mp-sheet-titles">
                    <span className="mp-sheet-title">Play on</span>
                    <span className="mp-sheet-sub">{player.title || player.name}</span>
                </div>
                <button type="button" className="button-reset mp-sheet-done" onClick={onClose}>Done</button>
            </div>
            <div className="mp-sheet-list">
                {list.map(speaker => {
                    const self = speaker.id === player.id;
                    const inGroup = self || player.group.includes(speaker.id);
                    const canGroup = !self && player.can.group && speaker.can.group && speaker.available;
                    return (
                        <div className="mp-sheet-row" key={speaker.id}>
                            <VolumeSlider speaker={speaker} dimmed={!inGroup} onChange={(level) => actions.setVolume(speaker, level)} />
                            {player.can.group && (
                                <button
                                    type="button"
                                    className="button-reset mp-check"
                                    aria-pressed={inGroup}
                                    aria-label={self ? `${speaker.name} is playing` : `Play on ${speaker.name}`}
                                    disabled={!canGroup}
                                    onClick={() => actions.setGrouped(player, speaker, !inGroup)}
                                >
                                    <Check size={18} strokeWidth={2.6} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Button that opens the speaker sheet, with the number of grouped speakers.
 * @param {Object} props
 * @param {Object} props.player - The player.
 * @param {() => void} props.onClick - Opens the sheet.
 * @returns {JSX.Element} The button.
 */
const OutputButton = ({ player, onClick }) => (
    <button type="button" className="button-reset mp-output" aria-label={`Speakers for ${player.name}`} aria-haspopup="dialog" onClick={onClick}>
        <Volume2 size={18} aria-hidden="true" />
        {player.group.length > 1 && <span className="mp-badge">{player.group.length}</span>}
    </button>
);

/**
 * Media player card for Home Assistant media players, in three sizes:
 * - one wide: cover art fills the card, with a frosted panel for progress, title and controls,
 * - half: cover on the left, title, controls and progress on the right,
 * - quarter: cover as background with the title and a play key.
 * With several players the card swipes between them (the quarter tile shows the first).
 * The speaker button opens the volume and grouping sheet.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`entities` or `entity_id`, `speakers`).
 * @returns {JSX.Element} The rendered card.
 */
const MediaPlayerCard = ({ config }) => {
    const m = useMediaPlayers(config);
    const size = config.tileSize === 'quarter' || config.tileSize === 'half' ? config.tileSize : 'full';
    const shown = size === 'quarter' ? m.players.slice(0, 1) : m.players;
    const [index, setIndex] = useState(0);
    const [sheetFor, setSheetFor] = useState(/** @type {string|null} */ (null));
    const [now, setNow] = useState(0);
    const pagerRef = useRef(null);
    const anyPlaying = shown.some(p => p.playing);

    // Advance the progress bars once a second while something plays
    useEffect(() => {
        if (!anyPlaying) return undefined;
        const tick = () => setNow(Date.now());
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [anyPlaying]);

    if (shown.length === 0) {
        return (
            <div className={`glass-card media-player-card size-${size} empty`}>
                <div className="mp-message">
                    <Music size={22} aria-hidden="true" />
                    <span>Add a media_player entity to this card.</span>
                </div>
            </div>
        );
    }

    const sheetPlayer = shown.find(p => p.id === sheetFor);
    const swipe = shown.length > 1;
    // Keep swipes between players from also changing the dashboard page
    const stop = swipe ? (e) => e.stopPropagation() : undefined;

    const page = (player) => {
        const title = player.active ? player.title || player.app || 'Playing' : player.available ? 'Nothing playing' : 'Unavailable';
        const subtitle = player.active ? player.artist || player.album || player.app : player.app;

        if (size === 'quarter') {
            return (
                <>
                    <Artwork player={player} className="mp-bg" />
                    <div className="mp-q-name">{player.name}</div>
                    <div className="mp-q-bottom">
                        <div className="mp-meta">
                            <div className="mp-title mp-two-lines">{title}</div>
                            {subtitle && <div className="mp-artist">{subtitle}</div>}
                        </div>
                        <Transport player={{ ...player, can: { ...player.can, previous: false, next: false } }} actions={m.actions} compact />
                    </div>
                    <Progress player={player} now={now} />
                </>
            );
        }

        if (size === 'half') {
            return (
                <>
                    <Artwork player={player} className="mp-cover" />
                    <div className="mp-half-side">
                        <div className="mp-half-top">
                            <span className="mp-name">{player.name}</span>
                            <OutputButton player={player} onClick={() => setSheetFor(player.id)} />
                        </div>
                        <div className="mp-meta">
                            <div className="mp-title">{title}</div>
                            {subtitle && <div className="mp-artist">{subtitle}</div>}
                        </div>
                        <Transport player={player} actions={m.actions} compact />
                    </div>
                    <Progress player={player} now={now} />
                </>
            );
        }

        return (
            <>
                <Artwork player={player} className="mp-bg" />
                <div className="mp-top">
                    <span className="mp-chip"><Speaker size={15} aria-hidden="true" /><span className="mp-chip-name">{player.name}</span></span>
                    <OutputButton player={player} onClick={() => setSheetFor(player.id)} />
                </div>
                <div className="mp-panel">
                    <Progress player={player} now={now} actions={m.actions} />
                    <div className="mp-row">
                        <div className="mp-meta">
                            <div className="mp-title">{title}</div>
                            {subtitle && <div className="mp-artist">{subtitle}</div>}
                        </div>
                        <Transport player={player} actions={m.actions} />
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className={`glass-card media-player-card size-${size}`}>
            <div
                ref={pagerRef}
                className="mp-pager"
                onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}
                onTouchStart={stop}
                onTouchMove={stop}
                onTouchEnd={stop}
            >
                {shown.map(player => (
                    <div className={`mp-page${player.playing ? ' playing' : ''}`} key={player.id} aria-label={player.name} role="group">
                        {page(player)}
                    </div>
                ))}
            </div>
            {swipe && (
                <div className="mp-dots" role="tablist" aria-label="Players">
                    {shown.map((player, i) => (
                        <button
                            key={player.id}
                            type="button"
                            role="tab"
                            className="button-reset mp-dot"
                            aria-label={player.name}
                            aria-selected={i === index}
                            onClick={() => pagerRef.current?.scrollTo({ left: i * pagerRef.current.clientWidth, behavior: 'smooth' })}
                        />
                    ))}
                </div>
            )}
            {sheetPlayer && (
                <SpeakerSheet player={sheetPlayer} speakers={m.speakers} actions={m.actions} onClose={() => setSheetFor(null)} />
            )}
        </div>
    );
};

export default MediaPlayerCard;
