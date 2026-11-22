import { useId, useMemo, useState } from 'react';
import { Group, NumberField } from '../Editor/EditorFields';
import { EntityListPicker, EntityPicker } from '../Editor/EntityPicker';
import { saveKiosk } from '../../lib/api';
import { useNow } from '../../hooks/useNow';
import { useMediaPlayers } from '../../features/MediaPlayer/useMediaPlayers';
import { KIOSK_ENTITY_FIELDS, MAX_PLAYERS, MAX_TOGGLES, TOGGLE_DOMAINS, kioskFromUrl, normalizeKiosk } from '../../../shared/kiosk.js';
import ClockFace from '../../features/Kiosk/ClockFace';
import { CLOCK_FACE_INFO } from '../../features/Kiosk/kioskModel';
import NowPlaying from '../../features/Kiosk/NowPlaying';
import { useSectionCommit } from './settingsSection';
import '../Editor/CardEditor.css';
import './KioskSettings.css';

/**
 * The full-screen player as kiosk mode shows it, for the saved players: the one playing, or the first.
 * @param {Object} props
 * @param {string[]} props.players - Saved media players.
 * @returns {JSX.Element} The preview.
 */
const PlayerPreview = ({ players }) => {
    const media = useMediaPlayers({ entities: players });
    const now = useNow('second');
    const player = media.players.find(p => p.playing) ?? media.players.find(p => p.active) ?? media.players[0];
    if (!player) return <p className="card-editor-no-preview">Choose a media player and save to see it here.</p>;
    return (
        <div className="kiosk-preview-screen">
            <NowPlaying player={player} actions={media.actions} now={now} preview />
        </div>
    );
};

/**
 * The clock faces to pick from, each drawn as it looks on the tablet.
 * @param {Object} props
 * @param {string} props.value - The face picked.
 * @param {Date} props.now - The time the faces show.
 * @param {boolean} props.night - Whether they show their night colours.
 * @param {(face: string) => void} props.onChange - Receives the face picked.
 * @returns {JSX.Element} The field.
 */
const ClockFacePicker = ({ value, now, night, onChange }) => {
    const id = useId();
    const info = CLOCK_FACE_INFO.find(f => f.value === value);
    return (
        <div className="editor-field">
            <span className="editor-label" id={id}>Face</span>
            <div className="kiosk-faces" role="radiogroup" aria-labelledby={id}>
                {CLOCK_FACE_INFO.map(face => (
                    <button
                        key={face.value}
                        type="button"
                        role="radio"
                        aria-checked={value === face.value}
                        aria-label={face.label}
                        className="button-reset kiosk-face"
                        onClick={() => onChange(face.value)}
                    >
                        <span className="kiosk-face-screen" aria-hidden="true">
                            <ClockFace face={face.value} now={now} night={night} weather={null} />
                        </span>
                        <span className="kiosk-face-name">{face.label}</span>
                    </button>
                ))}
            </div>
            {info && <div className="editor-hint">{info.description}</div>}
        </div>
    );
};

/**
 * Kiosk Mode section of the settings window, there whether or not this screen is a kiosk: the media
 * players that take over the screen, the clock face, the control center's switches and the
 * sensors that tell whether someone is there. The preview shows the full-screen player and the clock.
 * The window's Save stores the options on the server, if they changed.
 * @param {Object} props
 * @param {Object|undefined} props.kiosk - The saved options (`config.kiosk`).
 * @returns {JSX.Element} The section.
 */
const KioskSettings = ({ kiosk }) => {
    const saved = useMemo(() => normalizeKiosk(kiosk), [kiosk]);
    const [draft, setDraft] = useState(saved);
    const [previewNight, setPreviewNight] = useState(false);
    const now = useNow('minute');
    const isKiosk = kioskFromUrl(window.location.search);

    const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    useSectionCommit(async () => {
        if (JSON.stringify(draft) === JSON.stringify(saved)) return;
        const body = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value ?? null]));
        Object.keys(KIOSK_ENTITY_FIELDS).forEach(key => { if (!(key in body)) body[key] = null; });
        await saveKiosk(body);
    });

    return (
        <div className="settings-columns kiosk-settings">
            <aside className="card-editor-preview kiosk-preview" aria-label="Preview">
                <p className="card-editor-preview-label">Player</p>
                <PlayerPreview players={saved.media_players} />
                <p className="card-editor-preview-label">
                    Clock
                    <button type="button" className="button-reset kiosk-preview-night" aria-pressed={previewNight} onClick={() => setPreviewNight(n => !n)}>
                        {previewNight ? 'Night' : 'Day'}
                    </button>
                </p>
                <div className="kiosk-preview-screen">
                    <ClockFace face={draft.clock} now={now} night={previewNight} weather={null} />
                </div>
            </aside>
            <div className="settings-columns-main">
                <div className="settings-form">
                    <p className="editor-note kiosk-note">
                        Kiosk mode runs on screens opened with <code>?kiosk</code> at the end of the address.
                        {isKiosk ? ' This screen is one.' : ' This screen is not.'}
                    </p>

                    <Group title="Media Player" description="When one of these starts playing, it takes over the screen until it is swiped away.">
                        <EntityListPicker
                            label="Players"
                            value={draft.media_players}
                            domains={['media_player']}
                            max={MAX_PLAYERS}
                            onChange={(value) => set('media_players', value)}
                        />
                        <EntityPicker
                            label="Volume"
                            value={draft.volume_entity}
                            domains={['media_player']}
                            onChange={(value) => set('volume_entity', value)}
                            hint="The player whose volume the control center sets. None uses the first player."
                        />
                        <NumberField
                            label="Paused player stays for (seconds)"
                            value={draft.pause_timeout}
                            min={0}
                            step={10}
                            onChange={(value) => set('pause_timeout', value ?? 300)}
                        />
                    </Group>

                    <Group title="Clock" description="Shown while someone is in the room but not using the screen.">
                        <ClockFacePicker value={draft.clock} now={now} night={previewNight} onChange={(value) => set('clock', value)} />
                        <EntityPicker
                            label="Light sensor"
                            value={draft.illuminance_entity}
                            domains={['sensor']}
                            filter={(e) => e.device_class === 'illuminance' || e.unit === 'lx'}
                            onChange={(value) => set('illuminance_entity', value)}
                            hint="Night colours below the level below. Without a sensor, night is 21:00 to 7:00."
                        />
                        <NumberField
                            label="Night below (lx)"
                            value={draft.night_below}
                            min={0}
                            step={1}
                            onChange={(value) => set('night_below', value ?? 10)}
                        />
                        <EntityPicker
                            label="Weather"
                            value={draft.weather_entity}
                            domains={['weather']}
                            onChange={(value) => set('weather_entity', value)}
                        />
                    </Group>

                    <Group title="Control Center" description="Pull down from the top of the screen to open it.">
                        <EntityPicker
                            label="Screen brightness"
                            value={draft.brightness_entity}
                            domains={KIOSK_ENTITY_FIELDS.brightness_entity}
                            onChange={(value) => set('brightness_entity', value)}
                        />
                        <EntityListPicker
                            label="Toggles"
                            value={draft.toggles}
                            domains={TOGGLE_DOMAINS}
                            max={MAX_TOGGLES}
                            onChange={(value) => set('toggles', value)}
                        />
                    </Group>

                    <Group title="Presence" description="The screen turns off when nobody is in the room, shows the clock when someone is, and the dashboard when someone looks at it or touches it.">
                        <EntityPicker
                            label="Someone in the room"
                            value={draft.presence_entity}
                            domains={KIOSK_ENTITY_FIELDS.presence_entity}
                            onChange={(value) => set('presence_entity', value)}
                            hint="Without it the screen stays on."
                        />
                        <EntityPicker
                            label="Someone looking at the screen"
                            value={draft.face_entity}
                            domains={KIOSK_ENTITY_FIELDS.face_entity}
                            onChange={(value) => set('face_entity', value)}
                            hint="A face or motion sensor of the tablet. Without it only a touch shows the dashboard."
                        />
                        <EntityPicker
                            label="Screen switch"
                            value={draft.screen_entity}
                            domains={KIOSK_ENTITY_FIELDS.screen_entity}
                            onChange={(value) => set('screen_entity', value)}
                            hint="Turned off when the room is empty and on when someone comes in."
                        />
                        <NumberField
                            label="Back to the clock after (seconds)"
                            value={draft.idle_timeout}
                            min={5}
                            step={5}
                            onChange={(value) => set('idle_timeout', value ?? 60)}
                        />
                    </Group>

                    <Group title="Logged In" description="A bubble next to the app menu shows who is logged in on this tablet, for example from face recognition.">
                        <EntityPicker
                            label="Person logged in"
                            value={draft.user_entity}
                            domains={KIOSK_ENTITY_FIELDS.user_entity}
                            onChange={(value) => set('user_entity', value)}
                            hint="Its state is the person’s name, or none when nobody is logged in. Optional since and expires attributes show when the login started and ends."
                        />
                        <EntityPicker
                            label="Log out"
                            value={draft.logout_entity}
                            domains={KIOSK_ENTITY_FIELDS.logout_entity}
                            onChange={(value) => set('logout_entity', value)}
                            hint="A button or script that logs the person out. Without it the bubble has no Log Out button."
                        />
                    </Group>
                </div>
            </div>
        </div>
    );
};

export default KioskSettings;
