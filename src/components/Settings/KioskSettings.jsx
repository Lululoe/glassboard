import { useEffect, useId, useMemo, useState } from 'react';
import { Field, Group, NumberField } from '../Editor/EditorFields';
import { listKioskEntities, saveKiosk } from '../../lib/api';
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
 * @typedef {{entity_id: string, name: string, device_class?: string, unit?: string}} ListedEntity
 */

/**
 * Whether a listed entity is one of the domains.
 * @param {ListedEntity} entity - The entity.
 * @param {string[]} domains - The domains.
 * @returns {boolean} True when it is.
 */
const inDomains = (entity, domains) => domains.includes(entity.entity_id.split('.')[0]);

/**
 * A choice of one entity, or none.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string|undefined} props.value - The chosen entity.
 * @param {ListedEntity[]} props.entities - Entities to choose from.
 * @param {(value: string|undefined) => void} props.onChange - Receives the choice.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
const EntitySelect = ({ label, value, entities, onChange, hint }) => {
    const id = useId();
    const known = !value || entities.some(e => e.entity_id === value);
    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <select id={id} className="editor-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
                <option value="">None</option>
                {!known && <option value={value}>{value}</option>}
                {entities.map(e => <option key={e.entity_id} value={e.entity_id}>{e.name} ({e.entity_id})</option>)}
            </select>
        </Field>
    );
};

/**
 * A list of entities to tick, with a search box. The ticked ones come first, in their order.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string[]} props.value - The ticked entities.
 * @param {ListedEntity[]} props.entities - Entities to choose from.
 * @param {(value: string[]) => void} props.onChange - Receives the ticked entities.
 * @param {number} props.max - Most that can be ticked.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
const EntityChecklist = ({ label, value, entities, onChange, max, hint }) => {
    const id = useId();
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const byId = new Map(entities.map(e => [e.entity_id, e]));
    const ticked = value.map(entityId => byId.get(entityId) ?? { entity_id: entityId, name: entityId });
    const rest = entities.filter(e => !value.includes(e.entity_id)
        && (!q || e.entity_id.includes(q) || e.name.toLowerCase().includes(q)));
    const full = value.length >= max;

    return (
        <Field label={label} hint={hint ?? `Up to ${max}.`} htmlFor={id}>
            <input
                id={id}
                className="editor-input"
                type="search"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div className="kiosk-checklist" role="group" aria-label={label}>
                {[...ticked, ...rest].map(e => {
                    const on = value.includes(e.entity_id);
                    return (
                        <label key={e.entity_id} className={`kiosk-check${on ? ' is-on' : ''}`}>
                            <input
                                type="checkbox"
                                checked={on}
                                disabled={!on && full}
                                onChange={() => onChange(on ? value.filter(v => v !== e.entity_id) : [...value, e.entity_id])}
                            />
                            <span className="kiosk-check-name">{e.name}</span>
                            <span className="kiosk-check-id">{e.entity_id}</span>
                        </label>
                    );
                })}
                {ticked.length === 0 && rest.length === 0 && <p className="kiosk-check-empty">Nothing found.</p>}
            </div>
        </Field>
    );
};

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
    const [entities, setEntities] = useState(/** @type {ListedEntity[]|null} */ (null));
    const [loadError, setLoadError] = useState(/** @type {string|null} */ (null));
    const [previewNight, setPreviewNight] = useState(false);
    const now = useNow('minute');
    const isKiosk = kioskFromUrl(window.location.search);

    useEffect(() => {
        let cancelled = false;
        listKioskEntities()
            .then(list => { if (!cancelled) setEntities(list); })
            .catch(err => { if (!cancelled) setLoadError(err.message); });
        return () => { cancelled = true; };
    }, []);

    const all = entities ?? [];
    const of = (domains) => all.filter(e => inDomains(e, domains));
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
                    {loadError && <p className="editor-error" role="alert">Couldn’t load the Home Assistant entities: {loadError}</p>}

                    <Group title="Media Player" description="When one of these starts playing, it takes over the screen until it is swiped away.">
                        <EntityChecklist
                            label="Players"
                            value={draft.media_players}
                            entities={of(['media_player'])}
                            max={MAX_PLAYERS}
                            onChange={(value) => set('media_players', value)}
                        />
                        <EntitySelect
                            label="Volume"
                            value={draft.volume_entity}
                            entities={of(['media_player'])}
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
                        <EntitySelect
                            label="Light sensor"
                            value={draft.illuminance_entity}
                            entities={of(['sensor']).filter(e => e.device_class === 'illuminance' || e.unit === 'lx')}
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
                        <EntitySelect
                            label="Weather"
                            value={draft.weather_entity}
                            entities={of(['weather'])}
                            onChange={(value) => set('weather_entity', value)}
                        />
                    </Group>

                    <Group title="Control Center" description="Pull down from the top of the screen to open it.">
                        <EntitySelect
                            label="Screen brightness"
                            value={draft.brightness_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.brightness_entity)}
                            onChange={(value) => set('brightness_entity', value)}
                        />
                        <EntityChecklist
                            label="Toggles"
                            value={draft.toggles}
                            entities={of(TOGGLE_DOMAINS)}
                            max={MAX_TOGGLES}
                            onChange={(value) => set('toggles', value)}
                        />
                    </Group>

                    <Group title="Presence" description="The screen turns off when nobody is in the room, shows the clock when someone is, and the dashboard when someone looks at it or touches it.">
                        <EntitySelect
                            label="Someone in the room"
                            value={draft.presence_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.presence_entity)}
                            onChange={(value) => set('presence_entity', value)}
                            hint="Without it the screen stays on."
                        />
                        <EntitySelect
                            label="Someone looking at the screen"
                            value={draft.face_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.face_entity)}
                            onChange={(value) => set('face_entity', value)}
                            hint="A face or motion sensor of the tablet. Without it only a touch shows the dashboard."
                        />
                        <EntitySelect
                            label="Screen switch"
                            value={draft.screen_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.screen_entity)}
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
                        <EntitySelect
                            label="Person logged in"
                            value={draft.user_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.user_entity)}
                            onChange={(value) => set('user_entity', value)}
                            hint="Its state is the person’s name, or none when nobody is logged in. Optional since and expires attributes show when the login started and ends."
                        />
                        <EntitySelect
                            label="Log out"
                            value={draft.logout_entity}
                            entities={of(KIOSK_ENTITY_FIELDS.logout_entity)}
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
