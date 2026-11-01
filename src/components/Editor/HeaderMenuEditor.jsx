import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import yaml from 'js-yaml';
import AppIcon from '../Shared/AppIcon';
import Icon from '../Shared/Icon';
import '../Header/LauncherPopup.css';
import { TextField } from './EditorFields';
import { Animated, StageHint } from './icons/AppGridStage';
import ArrangeSlot from './icons/ArrangeSlot';
import ItemInspector from './icons/ItemInspector';
import Stage from './icons/Stage';
import { useArrangeable, useArrangedList } from './icons/useArrangeable';
import './CardEditor.css';

/** Most apps the header menu shows, in its 4 × 3 grid. */
const MAX_APPS = 12;
const WIDTH = 323;

const NEW_APP = { name: '', url: '', icon: 'lu-Globe' };
const NEW_LINK = { name: '', url: '', icon: 'lu-Link' };

/**
 * Editor of the header menu (the launcher). The menu is drawn as it appears: apps and links are
 * arranged on it directly, and apps past the first 12 wait in a tray. Saving keeps the changes
 * in the dashboard's draft, like a card; "Done" stores them in layout.yaml.
 * @param {Object} props
 * @param {Object} [props.launcher] - The header menu config.
 * @param {(launcher: Object) => void} props.onSave - Receives the edited menu.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
const HeaderMenuEditor = ({ launcher, onSave, onCancel }) => {
    const dialogRef = useRef(null);
    const rootRef = useRef(null);
    const [draft, setDraft] = useState(() => ({ apps: [], links: [], ...launcher }));
    const [selection, setSelection] = useState(null);
    const [undo, setUndo] = useState(null);
    const [tab, setTab] = useState('settings');
    const [yamlText, setYamlText] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    const apps = useArrangedList({
        name: 'apps',
        items: draft.apps,
        onChange: (next) => setDraft(d => ({ ...d, apps: next })),
        selection,
        onSelect: setSelection,
    });
    const links = useArrangedList({
        name: 'links',
        items: draft.links,
        onChange: (next) => setDraft(d => ({ ...d, links: next })),
        selection,
        onSelect: setSelection,
    });
    const lists = { apps, links };

    const remove = (list, index) => {
        setUndo({ list, index, item: lists[list].items[index] });
        lists[list].removeAt(index);
    };

    const { dragging, itemProps } = useArrangeable({ rootRef, lists, selection, onSelect: setSelection, onRemove: remove });

    const parseYaml = () => {
        const parsed = yaml.load(yamlText);
        if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
            throw new Error('The header menu must be a list of `key: value` settings.');
        }
        return { apps: [], links: [], ...(/** @type {Object} */ (parsed)) };
    };

    const showTab = (next) => {
        if (next === tab) return;
        if (next === 'yaml') {
            setYamlText(yaml.dump(draft, { lineWidth: -1, noRefs: true }));
            setError(null);
            setTab('yaml');
            return;
        }
        try {
            setDraft(parseYaml());
            setSelection(null);
            setError(null);
            setTab('settings');
        } catch (err) {
            setError(err.message);
        }
    };

    const save = () => {
        try {
            onSave(tab === 'yaml' ? parseYaml() : draft);
        } catch (err) {
            setError(err.message);
        }
    };

    const tile = (app, index, inTray) => {
        const label = app.name || 'New app';
        return (
            <ArrangeSlot
                key={apps.ids[index]}
                id={apps.ids[index]}
                label={label}
                className={inTray ? 'app-item arrange-tray-item' : 'launcher-app'}
                selected={selection?.list === 'apps' && selection.index === index}
                dragging={dragging?.list === 'apps' && dragging.index === index}
                itemProps={itemProps('apps', index)}
                onRemove={inTray ? undefined : () => remove('apps', index)}
            >
                {inTray ? (
                    <>
                        <div className="app-icon-wrap"><AppIcon icon={app.icon} background={app.bgColor} size="100%" /></div>
                        <span className="app-name">{label}</span>
                    </>
                ) : (
                    <>
                        <AppIcon icon={app.icon} background={app.bgColor} className="launcher-app-icon-container" size="100%" />
                        <span className="launcher-app-name">{label}</span>
                    </>
                )}
            </ArrangeSlot>
        );
    };

    const overflow = draft.apps.slice(MAX_APPS);
    const item = selection ? lists[selection.list]?.items[selection.index] : undefined;
    const setItem = (next) => lists[selection.list].items === draft.apps
        ? setDraft({ ...draft, apps: draft.apps.map((a, i) => (i === selection.index ? next : a)) })
        : setDraft({ ...draft, links: draft.links.map((l, i) => (i === selection.index ? next : l)) });

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog has-stage is-split"
            aria-labelledby="header-menu-editor-title"
            onCancel={(e) => {
                e.preventDefault();
                if (selection) setSelection(null);
                else onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="header-menu-editor-title" className="editor-dialog-title">
                    Header Menu
                    <span className="editor-dialog-subtitle">launcher</span>
                </h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save}>Save</button>
            </header>

            <div className="editor-tabs" role="tablist" aria-label="Edit as">
                <button type="button" role="tab" aria-selected={tab === 'settings'} className="button-reset" onClick={() => showTab('settings')}>Settings</button>
                <button type="button" role="tab" aria-selected={tab === 'yaml'} className="button-reset" onClick={() => showTab('yaml')}>YAML</button>
            </div>

            {tab === 'settings' ? (
                <div className="editor-workspace">
                    <div className="editor-workspace-stage" ref={rootRef}>
                        <Stage
                            width={WIDTH}
                            tools={(
                                <div className="icon-stage-tools">
                                    <button
                                        type="button"
                                        className="button-reset icon-stage-add"
                                        onClick={() => { setUndo(null); apps.insertAt(draft.apps.length, { ...NEW_APP }); }}
                                    >
                                        <Plus size={18} aria-hidden="true" />Add app
                                    </button>
                                    <button
                                        type="button"
                                        className="button-reset icon-stage-add"
                                        onClick={() => { setUndo(null); links.insertAt(draft.links.length, { ...NEW_LINK }); }}
                                    >
                                        <Plus size={18} aria-hidden="true" />Add link
                                    </button>
                                    <StageHint
                                        undo={undo}
                                        onUndo={() => {
                                            lists[undo.list].insertAt(undo.index, undo.item);
                                            setUndo(null);
                                        }}
                                    />
                                </div>
                            )}
                            footer={overflow.length > 0 && (
                                <div className="arrange-tray">
                                    <div className="arrange-tray-title">
                                        Won't show: {overflow.length}{' '}
                                        <span>The header menu shows {MAX_APPS} apps. Drag one up to swap it in.</span>
                                    </div>
                                    <div className="arrange-tray-items">
                                        {overflow.map((app, i) => tile(app, MAX_APPS + i, true))}
                                    </div>
                                </div>
                            )}
                        >
                            {(zoom) => (
                                <Animated rootRef={rootRef} zoom={zoom}>
                                    <div className="launcher-preview">
                                        <div className="launcher-section-title">Apps</div>
                                        <div className="launcher-app-grid">
                                            {draft.apps.slice(0, MAX_APPS).map((app, index) => tile(app, index, false))}
                                        </div>
                                        {draft.links.length > 0 && (
                                            <>
                                                <div className="launcher-section-title">{draft.links_title || 'More'}</div>
                                                <div className="launcher-link-list">
                                                    {draft.links.map((link, index) => {
                                                        const label = link.name || 'New link';
                                                        return (
                                                            <ArrangeSlot
                                                                key={links.ids[index]}
                                                                id={links.ids[index]}
                                                                label={label}
                                                                className="launcher-link"
                                                                selected={selection?.list === 'links' && selection.index === index}
                                                                dragging={dragging?.list === 'links' && dragging.index === index}
                                                                itemProps={itemProps('links', index)}
                                                                onRemove={() => remove('links', index)}
                                                                removeAtEnd
                                                            >
                                                                <Icon icon={link.icon} size={20} className="launcher-link-icon" color="#0a84ff" />
                                                                <span className="launcher-link-text">{label}</span>
                                                            </ArrangeSlot>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </Animated>
                            )}
                        </Stage>
                    </div>
                    <div className="editor-dialog-body">
                        {item && (
                            <ItemInspector
                                key={`${selection.list}:${selection.index}`}
                                kind={selection.list === 'apps' ? 'App' : 'Link'}
                                item={item}
                                onChange={setItem}
                                onRemove={() => remove(selection.list, selection.index)}
                                onDone={() => setSelection(null)}
                            />
                        )}
                        <section className="editor-section" aria-label="Header menu">
                            <h3 className="editor-section-title">Header menu</h3>
                            {draft.links.length > 0 && (
                                <TextField
                                    label="Links heading"
                                    value={draft.links_title}
                                    placeholder="More"
                                    onChange={(title) => {
                                        const { links_title: _old, ...rest } = draft;
                                        setDraft(title ? { ...rest, links_title: title } : rest);
                                    }}
                                />
                            )}
                            <p className="editor-note">
                                An app grid set to the header menu's apps follows these.
                            </p>
                        </section>
                    </div>
                </div>
            ) : (
                <div className="editor-dialog-body">
                    {error && <div className="editor-error" role="alert">{error}</div>}
                    <section className="editor-section" aria-label="YAML">
                        <textarea
                            className="editor-textarea editor-yaml"
                            value={yamlText}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                            aria-label="Header menu YAML"
                            onChange={(e) => setYamlText(e.target.value)}
                        />
                    </section>
                </div>
            )}
        </dialog>
    );
};

export default HeaderMenuEditor;
