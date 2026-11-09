import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
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
 * A titled group of related fields, drawn as one panel so a form reads in clear sections.
 * @param {Object} props
 * @param {string} props.title - Group title.
 * @param {string} [props.description] - One line about what the group is for.
 * @param {import('react').ReactNode} props.children - The fields.
 * @returns {JSX.Element} The group.
 */
export const Group = ({ title, description, children }) => (
    <section className="editor-group">
        <header className="editor-group-header">
            <h3 className="editor-group-title">{title}</h3>
            {description && <p className="editor-group-description">{description}</p>}
        </header>
        <div className="editor-group-body">{children}</div>
    </section>
);

/**
 * Text input of one property of a list item, with its own label.
 * @param {Object} props
 * @param {{key: string, label: string, placeholder?: string, hint?: string}} props.column - The property.
 * @param {*} props.value - Current value.
 * @param {(value: string|undefined) => void} props.onChange - Receives the new value.
 * @returns {JSX.Element} The field.
 */
const ItemInput = ({ column, value, onChange }) => {
    const id = useId();
    return (
        <Field label={column.label} hint={column.hint} htmlFor={id}>
            <input
                id={id}
                className="editor-input"
                type="text"
                placeholder={column.placeholder}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
            />
        </Field>
    );
};

/**
 * Editable list of objects, such as the sensors of a graph or the rooms of a thermostat. Each
 * item is a row that names it; opening a row shows its properties as labelled fields. Items
 * can be reordered and removed, and a new item opens right away.
 * @param {Object} props
 * @param {string} props.label - Title of the list.
 * @param {Array<Object>} props.items - The items.
 * @param {(items: Array<Object>) => void} props.onChange - Receives the new list.
 * @param {Array<{key: string, label: string, placeholder?: string, hint?: string}>} props.columns - Properties
 *   of an item. The first one names the item when it has no `name`.
 * @param {(item: Object, key: string, value: string|undefined) => Object} [props.onItemChange] - Updates an item; defaults to setting the key.
 * @param {() => Object} [props.newItem] - Creates the item added by "Add".
 * @param {string} [props.addLabel] - Label of the add button, such as "Add sensor".
 * @param {string} [props.hint] - Help text.
 * @param {number} [props.max] - Most items the card uses; more are marked as not shown.
 * @returns {JSX.Element} The list.
 */
export const ListField = ({
    label, items, onChange, columns, onItemChange, newItem = () => ({}), addLabel = 'Add', hint, max,
}) => {
    const [open, setOpen] = useState(/** @type {number|null} */ (null));
    const noun = addLabel.replace(/^Add\s+/i, '') || 'item';

    const update = (index, key, value) => {
        const item = items[index];
        const next = onItemChange ? onItemChange(item, key, value) : setIn(item, [key], value);
        onChange(items.map((it, i) => (i === index ? next : it)));
    };
    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
        if (open === index) setOpen(target);
        else if (open === target) setOpen(index);
    };
    const remove = (index) => {
        onChange(items.filter((_, i) => i !== index));
        if (open === index) setOpen(null);
        else if (open !== null && open > index) setOpen(open - 1);
    };
    const add = () => {
        onChange([...items, newItem()]);
        setOpen(items.length);
    };

    /**
     * Names an item in its row: its name, else its first property, else its position.
     * @param {Object} item - The item.
     * @param {number} index - Its position.
     * @returns {{title: string, detail: string|undefined, empty: boolean}} The row's text.
     */
    const describe = (item, index) => {
        const first = item?.[columns[0].key];
        const name = columns[0].key !== 'name' ? item?.name : undefined;
        if (name) return { title: String(name), detail: first !== undefined ? String(first) : undefined, empty: false };
        if (first !== undefined && first !== '') return { title: String(first), detail: undefined, empty: false };
        return { title: `New ${noun.toLowerCase()} ${index + 1}`, detail: undefined, empty: true };
    };

    return (
        <section className="editor-group">
            <header className="editor-group-header">
                <h3 className="editor-group-title">
                    {label}
                    {items.length > 0 && <span className="editor-group-count">{items.length}</span>}
                </h3>
                {hint && <p className="editor-group-description">{hint}</p>}
            </header>
            <div className="editor-group-body editor-items">
                {items.length === 0 && <p className="editor-items-empty">Nothing added yet.</p>}
                {items.map((item, index) => {
                    const { title, detail, empty } = describe(item, index);
                    const expanded = open === index;
                    const unused = max !== undefined && index >= max;
                    return (
                        <div className={`editor-item${expanded ? ' open' : ''}${unused ? ' unused' : ''}`} key={index}>
                            <div className="editor-item-head">
                                <button
                                    type="button"
                                    className="button-reset editor-item-toggle"
                                    aria-expanded={expanded}
                                    onClick={() => setOpen(expanded ? null : index)}
                                >
                                    <span className="editor-item-number" aria-hidden="true">{index + 1}</span>
                                    <span className="editor-item-text">
                                        <span className={`editor-item-title${empty ? ' empty' : ''}`}>{title}</span>
                                        {(detail || unused) && (
                                            <span className="editor-item-detail">{unused ? 'Not shown, the card has no room for it' : detail}</span>
                                        )}
                                    </span>
                                    <ChevronDown className="editor-item-chevron" size={18} aria-hidden="true" />
                                </button>
                                <div className="editor-item-actions">
                                    <button
                                        type="button"
                                        className="button-reset editor-item-action"
                                        aria-label={`Move ${title} up`}
                                        disabled={index === 0}
                                        onClick={() => move(index, -1)}
                                    >
                                        <ArrowUp size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        className="button-reset editor-item-action"
                                        aria-label={`Move ${title} down`}
                                        disabled={index === items.length - 1}
                                        onClick={() => move(index, 1)}
                                    >
                                        <ArrowDown size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        className="button-reset editor-item-action destructive"
                                        aria-label={`Remove ${title}`}
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                            {expanded && (
                                <div className="editor-item-fields">
                                    {columns.map(col => (
                                        <ItemInput
                                            key={col.key}
                                            column={col}
                                            value={item?.[col.key]}
                                            onChange={(value) => update(index, col.key, value)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                <button type="button" className="button-reset editor-add-button" onClick={add}>
                    <Plus size={16} aria-hidden="true" />
                    {addLabel}
                </button>
            </div>
        </section>
    );
};
