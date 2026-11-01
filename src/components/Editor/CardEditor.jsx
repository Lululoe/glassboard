import { useEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import { getCardInfo, getCardSizes } from '../../features/registry';
import { DEVICES, SIZES, sizeOf, usableSizes, withSize } from '../Grid/gridLayout';
import { SegmentedField, ToggleField } from './EditorFields';
import { setIn } from './setIn';
import { CardIconInspector, CardIconStage } from './icons/CardIconStage';
import './CardEditor.css';

const SIZE_NAMES = { quarter: 'Quarter', half: 'Half', 1: '1 wide', 2: '2 wide', 3: '3 wide' };

/**
 * Converts a card to the YAML shown in the editor; the id is fixed and left out.
 * @param {Object} card - The card config.
 * @returns {string} YAML text.
 */
const toYaml = (card) => {
    const { id: _id, ...rest } = card;
    return yaml.dump(rest, { lineWidth: -1, noRefs: true });
};

/**
 * Parses the editor's YAML back into a card.
 * @param {string} text - YAML text.
 * @param {string|number} id - The card's id.
 * @returns {Object} The card config.
 * @throws {Error} When the YAML is invalid or does not describe a card.
 */
const fromYaml = (text, id) => {
    const parsed = yaml.load(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The card must be a list of `key: value` settings.');
    }
    const { id: _ignored, ...rest } = /** @type {Object} */ (parsed);
    if (typeof rest.type !== 'string' || !rest.type) throw new Error('`type` is required.');
    return { id, ...rest };
};

/**
 * Modal editor for one card. The Settings tab has the size and screen-size visibility of
 * every card plus the card type's own form, if it has one; the YAML tab edits every
 * property directly, for options the form does not cover. Cards with a header show the real
 * card with its icon's settings; card types with their own stage, like the app grid, arrange
 * their items directly on the card.
 * @param {Object} props
 * @param {Object} props.card - The card being edited.
 * @param {Object} [props.globalConfig] - The dashboard config, for the card preview.
 * @param {boolean} [props.isNew] - Whether the card was just added; Cancel then removes it again.
 * @param {(card: Object) => void} props.onSave - Receives the edited card.
 * @param {() => void} props.onCancel - Closes without changes.
 * @param {() => void} props.onRemove - Removes the card from the dashboard.
 * @returns {JSX.Element} The dialog.
 */
const CardEditor = ({ card, globalConfig, isNew = false, onSave, onCancel, onRemove }) => {
    const dialogRef = useRef(null);
    const [draft, setDraft] = useState(card);
    const [tab, setTab] = useState('settings');
    const [yamlText, setYamlText] = useState('');
    const [error, setError] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [selection, setSelection] = useState(null);

    const info = getCardInfo(draft.type);
    const Editor = info?.Editor;
    const stage = info?.stage;
    const hasStage = Boolean(stage || info?.headerIcon);
    const sizes = usableSizes(getCardSizes(draft.type), 3);
    const hideOn = Array.isArray(draft.hideOn) ? draft.hideOn : [];

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    const showTab = (next) => {
        if (next === tab) return;
        if (next === 'yaml') {
            setYamlText(toYaml(draft));
            setError(null);
            setTab('yaml');
            return;
        }
        try {
            setDraft(fromYaml(yamlText, card.id));
            setSelection(null);
            setError(null);
            setTab('settings');
        } catch (err) {
            setError(err.message);
        }
    };

    const save = () => {
        try {
            onSave(tab === 'yaml' ? fromYaml(yamlText, card.id) : draft);
        } catch (err) {
            setError(err.message);
        }
    };

    const setVisible = (device, visible) => {
        const next = visible ? hideOn.filter(d => d !== device) : [...hideOn, device];
        setDraft(setIn(draft, ['hideOn'], next));
    };

    return (
        <dialog
            ref={dialogRef}
            className={`editor-dialog${hasStage ? ' has-stage' : ''}${stage?.split ? ' is-split' : ''}`}
            aria-labelledby="card-editor-title"
            onCancel={(e) => {
                e.preventDefault();
                if (selection) setSelection(null);
                else onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="card-editor-title" className="editor-dialog-title">
                    {isNew ? `Add ${info?.name || draft.type}` : info?.name || draft.type}
                    <span className="editor-dialog-subtitle">{String(card.id)}</span>
                </h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save}>
                    {isNew ? 'Add' : 'Save'}
                </button>
            </header>

            <div className="editor-tabs" role="tablist" aria-label="Edit as">
                <button type="button" role="tab" aria-selected={tab === 'settings'} className="button-reset" onClick={() => showTab('settings')}>Settings</button>
                <button type="button" role="tab" aria-selected={tab === 'yaml'} className="button-reset" onClick={() => showTab('yaml')}>YAML</button>
            </div>

            <div className={hasStage && tab === 'settings' ? 'editor-workspace' : 'editor-dialog-scroll'}>
            {tab === 'settings' && info?.headerIcon && (
                <div className="editor-workspace-stage">
                    <CardIconStage config={draft} savedConfig={card} globalConfig={globalConfig} />
                </div>
            )}
            {tab === 'settings' && stage && (
                <div className="editor-workspace-stage">
                    <stage.Stage config={draft} globalConfig={globalConfig} onChange={setDraft} selection={selection} onSelect={setSelection} />
                </div>
            )}
            <div className="editor-dialog-body">
                {error && <div className="editor-error" role="alert">{error}</div>}

                {tab === 'settings' ? (
                    <>
                        {info?.headerIcon && <CardIconInspector config={draft} onChange={setDraft} />}
                        {stage && <stage.Inspector config={draft} onChange={setDraft} selection={selection} onSelect={setSelection} />}
                        <section className="editor-section" aria-label="Layout">
                            <h3 className="editor-section-title">Layout</h3>
                            {sizes.length > 1 && (
                                <SegmentedField
                                    label="Size"
                                    value={sizeOf(draft)}
                                    options={SIZES.filter(s => sizes.includes(s)).map(s => ({ value: s, label: SIZE_NAMES[s] }))}
                                    onChange={(size) => setDraft(withSize(draft, size))}
                                    hint="Wider cards are narrowed automatically on tablets and phones."
                                />
                            )}
                            {DEVICES.map(device => (
                                <ToggleField
                                    key={device.key}
                                    label={`Show on ${device.label.toLowerCase()}`}
                                    checked={!hideOn.includes(device.key)}
                                    onChange={(on) => setVisible(device.key, on)}
                                />
                            ))}
                        </section>
                        <section className="editor-section" aria-label="Card settings">
                            <h3 className="editor-section-title">Card</h3>
                            {Editor
                                ? <Editor config={draft} onChange={setDraft} />
                                : <p className="editor-note">This card has no settings form. Its options can be changed in the YAML tab.</p>}
                        </section>
                    </>
                ) : (
                    <section className="editor-section" aria-label="YAML">
                        <textarea
                            className="editor-textarea editor-yaml"
                            value={yamlText}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                            aria-label="Card YAML"
                            onChange={(e) => setYamlText(e.target.value)}
                        />
                        <p className="editor-note">
                            Every option from the card documentation works here. Secrets such as API keys are not shown
                            and are kept when you save.
                        </p>
                    </section>
                )}

                <div className="editor-remove">
                    {confirmRemove ? (
                        <>
                            <span>{isNew ? 'Discard this card?' : 'Remove this card from the dashboard?'}</span>
                            <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirmRemove(false)}>Keep</button>
                            <button type="button" className="button-reset editor-dialog-action destructive" onClick={onRemove}>Remove</button>
                        </>
                    ) : (
                        <button type="button" className="button-reset editor-dialog-action destructive" onClick={() => setConfirmRemove(true)}>
                            Remove card
                        </button>
                    )}
                </div>
            </div>
            </div>
        </dialog>
    );
};

export default CardEditor;
