import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { setIn } from './setIn';
import './EditorFields.css';

/**
 * A labelled row in an editor form.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string} [props.hint] - Help text under the field.
 * @param {string} [props.htmlFor] - Id of the input the label belongs to.
 * @param {import('react').ReactNode} props.children - The input.
 * @returns {JSX.Element} The field.
 */
export const Field = ({ label, hint, htmlFor, children }) => (
    <div className="editor-field">
        <label className="editor-label" htmlFor={htmlFor}>{label}</label>
        {children}
        {hint && <div className="editor-hint">{hint}</div>}
    </div>
);

/**
 * Single-line text input. An empty value is reported as `undefined`.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {string} [props.value] - Current value.
 * @param {(value: string|undefined) => void} props.onChange - Receives the new value.
 * @param {string} [props.placeholder] - Placeholder text.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
export const TextField = ({ label, value, onChange, placeholder, hint }) => {
    const id = useId();
    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <input
                id={id}
                className="editor-input"
                type="text"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
            />
        </Field>
    );
};

/**
 * Number input. An empty value is reported as `undefined`.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {number} [props.value] - Current value.
 * @param {(value: number|undefined) => void} props.onChange - Receives the new value.
 * @param {string} [props.placeholder] - Placeholder text.
 * @param {string} [props.hint] - Help text.
 * @param {number} [props.min] - Minimum value.
 * @param {number} [props.step] - Step size.
 * @returns {JSX.Element} The field.
 */
export const NumberField = ({ label, value, onChange, placeholder, hint, min, step }) => {
    const id = useId();
    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <input
                id={id}
                className="editor-input"
                type="number"
                inputMode="decimal"
                value={value ?? ''}
                min={min}
                step={step ?? 'any'}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            />
        </Field>
    );
};

/**
 * Segmented control for picking one of a few options.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {*} props.value - Selected value.
 * @param {Array<{value: *, label: string}>} props.options - The options.
 * @param {(value: *) => void} props.onChange - Receives the picked value.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
export const SegmentedField = ({ label, value, options, onChange, hint }) => {
    const id = useId();
    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <div className="editor-segmented" role="radiogroup" id={id} aria-label={label}>
                {options.map(option => (
                    <button
                        key={String(option.value)}
                        type="button"
                        role="radio"
                        aria-checked={value === option.value}
                        className="button-reset"
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </Field>
    );
};

/**
 * On/off switch.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {boolean} props.checked - Whether it is on.
 * @param {(checked: boolean) => void} props.onChange - Receives the new state.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
export const ToggleField = ({ label, checked, onChange, hint }) => (
    <div className="editor-field">
        <label className="editor-toggle">
            <span className="editor-label">{label}</span>
            <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="editor-switch" aria-hidden="true" />
        </label>
        {hint && <div className="editor-hint">{hint}</div>}
    </div>
);

/**
 * Editable list of objects, one row of inputs per item.
 * @param {Object} props
 * @param {string} props.label - Field label.
 * @param {Array<Object>} props.items - The items.
 * @param {(items: Array<Object>) => void} props.onChange - Receives the new list.
 * @param {Array<{key: string, label: string, placeholder?: string}>} props.columns - Text inputs per row.
 * @param {(item: Object, key: string, value: string|undefined) => Object} [props.onItemChange] - Updates an item; defaults to setting the key.
 * @param {() => Object} [props.newItem] - Creates the item added by "Add".
 * @param {string} [props.addLabel] - Label of the add button.
 * @param {string} [props.hint] - Help text.
 * @returns {JSX.Element} The field.
 */
export const ListField = ({ label, items, onChange, columns, onItemChange, newItem = () => ({}), addLabel = 'Add', hint }) => {
    const update = (index, key, value) => {
        const item = items[index];
        const next = onItemChange ? onItemChange(item, key, value) : setIn(item, [key], value);
        onChange(items.map((it, i) => (i === index ? next : it)));
    };
    return (
        <div className="editor-field">
            <div className="editor-label">{label}</div>
            <div className="editor-list">
                {items.map((item, index) => (
                    <div className="editor-list-row" key={index}>
                        <div className="editor-list-inputs">
                            {columns.map(col => (
                                <input
                                    key={col.key}
                                    className="editor-input"
                                    type="text"
                                    aria-label={`${col.label} ${index + 1}`}
                                    placeholder={col.placeholder || col.label}
                                    value={item?.[col.key] ?? ''}
                                    onChange={(e) => update(index, col.key, e.target.value === '' ? undefined : e.target.value)}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            className="button-reset editor-icon-button"
                            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                            onClick={() => onChange(items.filter((_, i) => i !== index))}
                        >
                            <Trash2 size={18} aria-hidden="true" />
                        </button>
                    </div>
                ))}
                <button type="button" className="button-reset editor-add-button" onClick={() => onChange([...items, newItem()])}>
                    <Plus size={16} aria-hidden="true" />
                    {addLabel}
                </button>
            </div>
            {hint && <div className="editor-hint">{hint}</div>}
        </div>
    );
};
