import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import yaml from 'js-yaml';
import { PageActiveContext } from '../../context/pageActive';
import { getCardComponent, getCardInfo, getCardSizes } from '../../features/registry';
import CardErrorBoundary from '../Grid/CardErrorBoundary';
import { DEVICES, MAX_ROWS, SIZES, isSubTile, rowSpanOf, sizeOf, usableSizes, withRows, withSize } from '../Grid/gridLayout';
import { Group, SegmentedField, ToggleField } from './EditorFields';
import { setIn } from './setIn';
import { boxOf } from './icons/cardBox';
import Stage from './icons/Stage';
import './CardEditor.css';

const SIZE_NAMES = { quarter: 'Quarter', half: 'Half', 1: '1 wide', 2: '2 wide', 3: '3 wide' };
const DEVICE_ICONS = { phone: Smartphone, tablet: Tablet, desktop: Monitor };
const PREVIEW_DELAY_MS = 600;

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
 * Returns a value that follows `value` after it has stopped changing for `delay` ms.
 * @template T
 * @param {T} value - The value.
 * @param {number} delay - Quiet time in ms.
 * @returns {T} The settled value.
 */
function useSettled(value, delay) {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return settled;
}

/**
 * The card as it will look, drawn at its real size on the page background and scaled to fit.
 * Its size follows the draft at once; its other settings once typing has paused, so the card
 * doesn't reload its data on every key press.
 * @param {Object} props
 * @param {Object} props.config - The card being edited.
 * @param {Object} [props.globalConfig] - The dashboard config.
 * @returns {JSX.Element} The preview.
 */
const CardPreview = ({ config, globalConfig }) => {
    const settled = useSettled(config, PREVIEW_DELAY_MS);
    const Card = getCardComponent(config.type);
    const box = boxOf(config);
    const { tileSize: _tileSize, colSpan: _colSpan, rowSpan: _rowSpan, ...content } = settled;
    const shown = {
        ...content,
        ...(config.tileSize ? { tileSize: config.tileSize } : { colSpan: config.colSpan }),
        ...(config.rowSpan ? { rowSpan: config.rowSpan } : {}),
    };

    return (
        <Stage width={box.width} height={box.height}>
            {() => (
                <div className={`icon-stage-card tile-${sizeOf(config)}`} style={{ height: box.height }} inert>
                    <PageActiveContext value>
                        <CardErrorBoundary label={config.id ?? config.type} resetKey={shown}>
                            {Card ? <Card config={shown} globalConfig={globalConfig} /> : <p className="card-editor-no-preview">No preview for this card type.</p>}
                        </CardErrorBoundary>
                    </PageActiveContext>
                </div>
            )}
        </Stage>
    );
};

/**
 * Picks a card size, each option drawn as the shape it takes on a tile.
 * @param {Object} props
 * @param {string} props.value - The selected size.
 * @param {string[]} props.sizes - Sizes to offer.
 * @param {(size: string) => void} props.onChange - Receives the picked size.
 * @returns {JSX.Element} The picker.
 */
const SizePicker = ({ value, sizes, onChange }) => (
    <div className="card-size-picker" role="radiogroup" aria-label="Size">
        {SIZES.filter(s => sizes.includes(s)).map(size => (
            <button
                key={size}
                type="button"
                role="radio"
                aria-checked={value === size}
                className="button-reset card-size-option"
                onClick={() => onChange(size)}
            >
                <span className={`card-size-shape size-${size}`} aria-hidden="true"><span /></span>
                <span className="card-size-name">{SIZE_NAMES[size]}</span>
            </button>
        ))}
    </div>
);

/**
 * Editor for one card, in a large dialog: the card as it will look on the left, and on the
 * right its settings in three tabs. Settings has the card type's own form, grouped into
 * sections; Layout has the size and on which screens the card shows; YAML edits every
 * property directly, for options the form does not cover. Card types with their own stage,
 * like the app grid, arrange their items directly on the card in place of the preview.
 * The header icon is edited separately, from the button on the icon in edit mode.
 * @param {Object} props
 * @param {Object} props.card - The card being edited.
 * @param {Object} [props.globalConfig] - The dashboard config, for the card preview.
 * @param {boolean} [props.isNew] - Whether the card was just added; Cancel then removes it again.
 * @param {number} [props.maxColumns=3] - Widest size offered, such as the width of the container the card is in.
 * @param {boolean} [props.nested] - The card is inside a container card: its screen visibility is the container's.
 * @param {(card: Object) => void} props.onSave - Receives the edited card.
 * @param {() => void} props.onCancel - Closes without changes.
 * @param {() => void} props.onRemove - Removes the card from the dashboard.
 * @returns {JSX.Element} The dialog.
 */
const CardEditor = ({ card, globalConfig, isNew = false, maxColumns = 3, nested = false, onSave, onCancel, onRemove }) => {
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
    const sizes = usableSizes(getCardSizes(draft.type), maxColumns);
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
        if (tab !== 'yaml') {
            setTab(next);
            return;
        }
        try {
            setDraft(fromYaml(yamlText, card.id));
            setSelection(null);
            setError(null);
            setTab(next);
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

    const tabs = [
        { key: 'settings', label: 'Settings' },
        { key: 'layout', label: 'Layout' },
        { key: 'yaml', label: 'YAML' },
    ];

    return (
        <dialog
            ref={dialogRef}
            className={`editor-dialog card-editor${stage ? ' has-card-stage' : ''}`}
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

            <div className="card-editor-columns">
                <aside className="card-editor-preview" aria-label={stage ? 'Arrange' : 'Preview'}>
                    {stage
                        ? <stage.Stage config={draft} globalConfig={globalConfig} onChange={setDraft} selection={selection} onSelect={setSelection} />
                        : (
                            <>
                                <p className="card-editor-preview-label">Preview</p>
                                <CardPreview config={draft} globalConfig={globalConfig} />
                            </>
                        )}
                </aside>

                <div className="card-editor-main">
                    <div className="editor-tabs" role="tablist" aria-label="Edit">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.key}
                                className="button-reset"
                                onClick={() => showTab(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="card-editor-scroll">
                        {error && <div className="editor-error" role="alert">{error}</div>}

                        {tab === 'settings' && (
                            <>
                                {stage && <stage.Inspector config={draft} onChange={setDraft} selection={selection} onSelect={setSelection} />}
                                {Editor
                                    ? <Editor config={draft} onChange={setDraft} globalConfig={globalConfig} />
                                    : <p className="editor-note">This card has no settings form. Its options can be changed in the YAML tab.</p>}
                            </>
                        )}

                        {tab === 'layout' && (
                            <>
                                {sizes.length > 1 && (
                                    <Group title="Size" description="Wider cards are narrowed automatically on tablets and phones.">
                                        <SizePicker value={sizeOf(draft)} sizes={sizes} onChange={(size) => setDraft(withSize(draft, size))} />
                                    </Group>
                                )}
                                {info?.rows && !isSubTile(sizeOf(draft)) && (
                                    <Group title="Height">
                                        <SegmentedField
                                            label="Rows"
                                            value={rowSpanOf(draft)}
                                            options={Array.from({ length: MAX_ROWS }, (_, i) => ({ value: i + 1, label: `${i + 1} ${i ? 'rows' : 'row'}` }))}
                                            onChange={(rows) => setDraft(withRows(draft, rows))}
                                        />
                                    </Group>
                                )}
                                {!nested && (
                                    <Group title="Show on" description="Hidden cards stay visible, dimmed, while editing.">
                                        {DEVICES.map(device => {
                                            const DeviceIcon = DEVICE_ICONS[device.key];
                                            return (
                                                <div className="card-editor-device" key={device.key}>
                                                    <DeviceIcon size={20} aria-hidden="true" />
                                                    <ToggleField
                                                        label={`Show on ${device.label.toLowerCase()}`}
                                                        checked={!hideOn.includes(device.key)}
                                                        onChange={(on) => setVisible(device.key, on)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </Group>
                                )}
                            </>
                        )}

                        {tab === 'yaml' && (
                            <section className="editor-section card-editor-yaml" aria-label="YAML">
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
                    </div>

                    <footer className="editor-remove">
                        {confirmRemove ? (
                            <>
                                <span>{isNew ? 'Discard this card?' : `Remove this card from the ${nested ? 'container' : 'dashboard'}?`}</span>
                                <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirmRemove(false)}>Keep</button>
                                <button type="button" className="button-reset editor-dialog-action destructive" onClick={onRemove}>Remove</button>
                            </>
                        ) : (
                            <button type="button" className="button-reset editor-dialog-action destructive" onClick={() => setConfirmRemove(true)}>
                                Remove card
                            </button>
                        )}
                    </footer>
                </div>
            </div>
        </dialog>
    );
};

export default CardEditor;
