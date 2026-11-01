import { useContext, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconBackgroundsContext } from '../../../context/iconBackgrounds';
import { Field, SegmentedField, TextField } from '../EditorFields';
import { BACKGROUND_PRESETS, MAX_STOPS, composeBackground, parseBackground, withBackgroundType } from './background';

const STYLES = [
    { value: 'none', label: 'None' },
    { value: 'solid', label: 'Solid' },
    { value: 'linear', label: 'Linear' },
    { value: 'radial', label: 'Radial' },
    { value: 'css', label: 'CSS' },
];

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A labelled slider with its value next to the label.
 * @param {Object} props
 * @param {string} props.label - The label.
 * @param {number} props.value - The value.
 * @param {number} props.max - The largest value.
 * @param {string} props.unit - Shown after the value.
 * @param {(value: number) => void} props.onChange - Receives the new value.
 * @returns {JSX.Element} The slider.
 */
const Slider = ({ label, value, max, unit, onChange }) => {
    const id = useId();
    return (
        <div className="icon-slider">
            <label className="editor-label" htmlFor={id}>{label}</label>
            <output htmlFor={id}>{value}{unit}</output>
            <input id={id} type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
    );
};

/**
 * One color of a background: a color well and its hex value, which may be typed partially.
 * @param {Object} props
 * @param {number} props.number - Position, for labels.
 * @param {string} props.value - The color as 6-digit hex.
 * @param {(color: string) => void} props.onChange - Receives a complete new color.
 * @param {() => void} [props.onRemove] - Removes the color; left out when it is needed.
 * @returns {JSX.Element} The row.
 */
const ColorStop = ({ number, value, onChange, onRemove }) => {
    const [typed, setTyped] = useState(null);
    return (
        <div className="icon-color-row">
            <input
                type="color"
                className="icon-color-well"
                value={value}
                aria-label={`Color ${number}`}
                onChange={(e) => { setTyped(null); onChange(e.target.value); }}
            />
            <input
                className="editor-input"
                value={typed ?? value}
                aria-label={`Color ${number} as hex`}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => {
                    setTyped(e.target.value);
                    if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase());
                }}
                onBlur={() => setTyped(null)}
            />
            {onRemove && (
                <button type="button" className="button-reset icon-color-remove" aria-label={`Remove color ${number}`} onClick={onRemove}>
                    <Minus size={18} aria-hidden="true" />
                </button>
            )}
        </div>
    );
};

/**
 * Builds a background from a style, colors, direction and opacity, or from plain CSS.
 * @param {Object} props
 * @param {Object} props.fields - The builder's fields, see `parseBackground`.
 * @param {(fields: Object) => void} props.onChange - Receives the updated fields.
 * @param {() => void} props.onDone - Closes the builder.
 * @param {() => void} props.onDelete - Deletes the preset being edited.
 * @returns {JSX.Element} The builder.
 */
const BackgroundBuilder = ({ fields, onChange, onDone, onDelete }) => {
    const { type, stops, angle, opacity, css } = fields;
    const usesColors = type === 'solid' || type === 'linear' || type === 'radial';
    const setStop = (index, color) => onChange({ ...fields, stops: stops.map((c, i) => (i === index ? color : c)) });

    return (
        <div className="icon-builder">
            <SegmentedField label="Style" value={type} options={STYLES} onChange={(next) => onChange(withBackgroundType(fields, next))} />
            {usesColors && (
                <>
                    <Field label={type === 'solid' ? 'Color' : 'Colors'}>
                        {stops.map((color, index) => (
                            <ColorStop
                                key={index}
                                number={index + 1}
                                value={color}
                                onChange={(next) => setStop(index, next)}
                                onRemove={stops.length > 2 ? () => onChange({ ...fields, stops: stops.filter((_, i) => i !== index) }) : undefined}
                            />
                        ))}
                        {type !== 'solid' && stops.length < MAX_STOPS && (
                            <button
                                type="button"
                                className="button-reset editor-add-button"
                                onClick={() => onChange({ ...fields, stops: [...stops, stops[stops.length - 1]] })}
                            >
                                <Plus size={16} aria-hidden="true" />
                                Add color
                            </button>
                        )}
                    </Field>
                    {type === 'linear' && (
                        <Slider label="Direction" value={angle} max={360} unit="°" onChange={(next) => onChange({ ...fields, angle: next })} />
                    )}
                    <Slider label="Opacity" value={opacity} max={100} unit="%" onChange={(next) => onChange({ ...fields, opacity: next })} />
                    <code className="icon-code">{composeBackground(fields)}</code>
                </>
            )}
            {type === 'css' && (
                <TextField
                    label="CSS background"
                    value={css}
                    placeholder="var(--color-primary-light)"
                    hint="Any CSS background: theme variables, several layers or an image with url()."
                    onChange={(next = '') => onChange({ ...fields, css: next })}
                />
            )}
            {type === 'none' && <p className="editor-note">The icon stands directly on the card, with no tile behind it.</p>}
            <div className="icon-builder-actions">
                <button type="button" className="button-reset editor-dialog-action destructive" onClick={onDelete}>Delete preset</button>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={onDone}>Done</button>
            </div>
        </div>
    );
};

/**
 * Picks an icon's background: Default, the built-in presets and the user's own. The + adds a
 * preset, starting from the current background; selecting one of the user's own edits it.
 * @param {Object} props
 * @param {string} [props.value] - The CSS background; empty means the default.
 * @param {(background: (string|undefined)) => void} props.onChange - Receives the new background.
 * @returns {JSX.Element} The field.
 */
const BackgroundField = ({ value, onChange }) => {
    const { presets, onChange: onPresetsChange } = useContext(IconBackgroundsContext);
    const [editing, setEditing] = useState(/** @type {{index: number, fields: Object}|null} */ (null));

    const add = () => {
        const fields = parseBackground(value);
        const css = composeBackground(fields);
        setEditing({ index: presets.length, fields });
        onPresetsChange([...presets, css]);
        onChange(css);
    };

    const edit = (fields) => {
        const css = composeBackground(fields);
        setEditing({ ...editing, fields });
        onPresetsChange(presets.map((preset, i) => (i === editing.index ? css : preset)));
        onChange(css);
    };

    const remove = () => {
        if (presets[editing.index] === value) onChange(undefined);
        onPresetsChange(presets.filter((_, i) => i !== editing.index));
        setEditing(null);
    };

    return (
        <Field label="Background">
            <div className="icon-swatches">
                <button
                    type="button"
                    className="button-reset icon-swatch"
                    style={{ background: 'var(--icon-background)' }}
                    aria-pressed={!value}
                    aria-label="Default background"
                    title="Default"
                    onClick={() => { setEditing(null); onChange(undefined); }}
                />
                {BACKGROUND_PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        type="button"
                        className="button-reset icon-swatch"
                        style={{ background: preset.value }}
                        aria-pressed={value === preset.value}
                        aria-label={`${preset.name} background`}
                        title={preset.name}
                        onClick={() => { setEditing(null); onChange(preset.value); }}
                    />
                ))}
                {presets.map((preset, index) => (
                    <button
                        key={index}
                        type="button"
                        className="button-reset icon-swatch"
                        style={{ background: preset }}
                        aria-pressed={value === preset}
                        aria-label={`My background ${index + 1}`}
                        title={`My background ${index + 1}. Select it to edit it.`}
                        onClick={() => { setEditing({ index, fields: parseBackground(preset) }); onChange(preset); }}
                    />
                ))}
                <button
                    type="button"
                    className="button-reset icon-swatch icon-swatch-add"
                    aria-label="Add a background"
                    title="Add a background"
                    onClick={add}
                >
                    <Plus size={20} aria-hidden="true" />
                </button>
            </div>
            {editing && <BackgroundBuilder fields={editing.fields} onChange={edit} onDone={() => setEditing(null)} onDelete={remove} />}
        </Field>
    );
};

export default BackgroundField;
