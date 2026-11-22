import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SettingsSectionContext } from './settingsSection';
import '../Editor/CardEditor.css';
import './SettingsDialog.css';

/**
 * @typedef {Object} SettingsSection
 * @property {string} id - Its key.
 * @property {string} title - Its name in the list, and in the header bar on a phone.
 * @property {import('react').ComponentType<{size?: number}>} icon - Its icon.
 * @property {string} color - The color behind its icon.
 * @property {string} [group] - The heading it is listed under; sections without one are listed last.
 * @property {boolean} [danger] - Lists it in red.
 * @property {boolean} [wide] - Lets it use the whole pane, without padding, for a preview next to it.
 * @property {() => import('react').ReactNode} render - Its content.
 */

/**
 * The settings of the dashboard and the page shown, opened from the header in edit mode: a list
 * of sections on the left and the chosen one on the right; on a phone the list comes first and a
 * section slides in. Changes in every section wait for Save, which keeps them all (in the
 * dashboard's draft, or on the server for settings that aren't part of the layout). A section
 * that can't be saved is shown with the reason. Cards keep their own editors.
 * @param {Object} props
 * @param {SettingsSection[]} props.sections - The sections, in order.
 * @param {string} [props.initial] - The section shown first.
 * @param {() => void} props.onSaved - Called once every section is saved.
 * @param {() => void} props.onCancel - Closes without saving.
 * @returns {JSX.Element} The dialog.
 */
const SettingsDialog = ({ sections, initial, onSaved, onCancel }) => {
    const dialogRef = useRef(null);
    const [current, setCurrent] = useState(initial && sections.some(s => s.id === initial) ? initial : sections[0]?.id);
    // On a phone: whether the section is shown instead of the list
    const [detail, setDetail] = useState(false);
    const [visited, setVisited] = useState(() => new Set([current]));
    const [errors, setErrors] = useState(/** @type {Object<string, string>} */ ({}));
    const [saving, setSaving] = useState(false);
    const commits = useRef(/** @type {Map<string, () => (void|Promise<void>)>} */ (new Map()));

    // One register function per section, kept for as long as the dialog is open
    const [registerFor] = useState(() => {
        /** @type {Object<string, (commit: () => (void|Promise<void>)) => () => void>} */
        const cache = {};
        return (/** @type {string} */ id) => {
            cache[id] ??= (commit) => {
                commits.current.set(id, commit);
                return () => {
                    if (commits.current.get(id) === commit) commits.current.delete(id);
                };
            };
            return cache[id];
        };
    });

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    const show = (id) => {
        setCurrent(id);
        setDetail(true);
        setVisited(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    };

    const save = async () => {
        setSaving(true);
        setErrors({});
        for (const { id } of sections) {
            const commit = commits.current.get(id);
            if (!commit) continue;
            try {
                await commit();
            } catch (err) {
                setErrors({ [id]: err instanceof Error ? err.message : String(err) });
                show(id);
                setSaving(false);
                return;
            }
        }
        setSaving(false);
        onSaved();
    };

    const section = sections.find(s => s.id === current);
    let lastGroup = null;

    return (
        <dialog
            ref={dialogRef}
            className={`editor-dialog settings-dialog${detail ? ' is-detail' : ''}`}
            aria-labelledby="settings-dialog-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <span className="settings-dialog-leading">
                    <button type="button" className="button-reset editor-dialog-action settings-dialog-back" onClick={() => setDetail(false)}>
                        <ChevronLeft size={22} aria-hidden="true" />
                        Settings
                    </button>
                    <button type="button" className="button-reset editor-dialog-action settings-dialog-cancel" onClick={onCancel}>Cancel</button>
                </span>
                <h2 id="settings-dialog-title" className="editor-dialog-title">
                    <span className="settings-dialog-title-list">Settings</span>
                    <span className="settings-dialog-title-section">{section?.title}</span>
                </h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </header>

            <div className="settings-dialog-body">
                <nav className="settings-dialog-nav" aria-label="Settings">
                    {sections.map(s => {
                        const Icon = s.icon;
                        const heading = s.group && s.group !== lastGroup ? s.group : null;
                        if (s.group) lastGroup = s.group;
                        return (
                            <Fragment key={s.id}>
                                {heading && <div className="settings-nav-heading">{heading}</div>}
                                <button
                                    type="button"
                                    className={`button-reset settings-nav-item${s.danger ? ' is-danger' : ''}${s.group ? '' : ' is-last'}`}
                                    aria-current={s.id === current ? 'page' : undefined}
                                    onClick={() => show(s.id)}
                                >
                                    <span className="settings-nav-icon" style={{ background: s.color }}><Icon size={16} aria-hidden="true" /></span>
                                    <span className="settings-nav-label">{s.title}</span>
                                    {errors[s.id] && <span className="settings-nav-error" aria-label="Couldn't be saved" />}
                                    <ChevronRight className="settings-nav-chevron" size={18} aria-hidden="true" />
                                </button>
                            </Fragment>
                        );
                    })}
                </nav>

                {sections.filter(s => visited.has(s.id)).map(s => (
                    <section
                        key={s.id}
                        className={`settings-dialog-pane${s.wide ? ' is-wide' : ''}`}
                        hidden={s.id !== current}
                        aria-label={s.title}
                    >
                        {errors[s.id] && <div className="editor-error settings-pane-error" role="alert">{errors[s.id]}</div>}
                        <SettingsSectionContext value={registerFor(s.id)}>
                            {s.render()}
                        </SettingsSectionContext>
                    </section>
                ))}
            </div>
        </dialog>
    );
};

export default SettingsDialog;
