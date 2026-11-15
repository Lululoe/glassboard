import { useState } from 'react';
import { ENTITY_ID } from '../../../shared/pageHeader';
import { Group, NumberField, SegmentedField, TextField, ToggleField } from './EditorFields';
import { ColorField, HeaderDialog } from './HeaderEditorParts';
import IconPicker from './icons/IconPicker';
import { useHeaderEntities } from '../../context/headerEntities';
import {
    headerFor, isOn, newWidgetId, widgetForm, widgetFromForm, widgetsOf, widgetsSource, withPageWidgets, withWidgets,
} from './headerSettings';

const TYPE_OPTIONS = [
    { value: 'ring', label: 'Circle' },
    { value: 'gauge', label: 'Open Circle' },
    { value: 'number', label: 'Number' },
    { value: 'rectangle', label: 'Rectangle' },
];

const TYPE_HINTS = {
    ring: 'A ring filled up to the value.',
    gauge: 'An open ring with a dot at the value, between a lowest and a highest value.',
    number: 'The icon and the value, without a ring.',
    rectangle: 'One or two values, as wide as three circles.',
};

const OPERATOR_OPTIONS = [
    { value: 'above', label: 'Above' },
    { value: 'below', label: 'Below' },
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is Not' },
];

/**
 * Dialog that adds or changes one widget of the page header: its kind, the Home Assistant
 * entity it shows, its range, icon and color, and a condition on the entity's value that it is
 * only shown under. The widget belongs to the list the page shows: its own, or that of all
 * pages. Saving keeps it in the dashboard's draft; "Done" stores it in layout.yaml.
 * @param {Object} props
 * @param {number|null} props.index - The widget's position in its list; null adds one at the end.
 * @param {string} [props.initialType] - The kind of a new widget, picked before.
 * @param {*} props.pageHeader - The setting of all pages.
 * @param {*} [props.pageOwn] - The current page's own setting.
 * @param {boolean} [props.hasPage] - Whether the current page can have settings of its own.
 * @param {string} props.pageKey - The current page's key, for the preview.
 * @param {(saved: {pageHeader: *, pageOwn: *}) => void} props.onSave - Receives both settings.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
export default function HeaderWidgetEditor({ index, initialType, pageHeader, pageOwn, hasPage = false, pageKey, onSave, onCancel }) {
    const source = hasPage ? widgetsSource(pageOwn) : 'all';
    const list = widgetsOf(source === 'page' ? pageOwn : pageHeader);
    const adding = index === null || index === undefined || !list[index];
    const [form, setForm] = useState(() => {
        const initial = widgetForm(adding ? undefined : list[index], newWidgetId(list));
        return adding && initialType ? { ...initial, type: initialType } : initial;
    });
    const [confirmRemove, setConfirmRemove] = useState(false);
    const saved = useHeaderEntities();
    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

    /**
     * Both settings with the widget list changed.
     * @param {Array<Object>} widgets - The new list.
     * @returns {{pageHeader: *, pageOwn: *}} The settings.
     */
    const withList = (widgets) => (source === 'page'
        ? { pageHeader, pageOwn: withPageWidgets(pageOwn, widgets, isOn(pageHeader)) }
        : { pageHeader: withWidgets(pageHeader, widgets), pageOwn });

    const valid = ENTITY_ID.test(form.entity_id.trim())
        && (form.type !== 'rectangle' || !form.entity_id2.trim() || ENTITY_ID.test(form.entity_id2.trim()));
    const widget = widgetFromForm(form);
    const next = withList(adding ? [...list, widget] : list.map((w, i) => (i === index ? widget : w)));
    const preview = headerFor(next.pageHeader, next.pageOwn) ?? headerFor({ ...next.pageHeader, enabled: true });

    return (
        <HeaderDialog
            title={adding ? 'New Widget' : 'Widget'}
            preview={valid ? preview : headerFor(pageHeader, pageOwn)}
            pageKey={pageKey}
            onSave={() => valid && onSave(next)}
            onCancel={onCancel}
            saveLabel={adding ? 'Add' : 'Save'}
            saveDisabled={!valid}
        >
            <Group
                title="Widget"
                description={source === 'page' ? 'Shown on this page only.' : 'Shown on every page that has no widgets of its own.'}
            >
                <SegmentedField label="Kind" value={form.type} options={TYPE_OPTIONS} onChange={(type) => set({ type })} hint={TYPE_HINTS[form.type]} />
                <TextField
                    label="Entity"
                    value={form.entity_id}
                    onChange={(v) => set({ entity_id: (v ?? '').trim().toLowerCase() })}
                    placeholder="sensor.outside_temperature"
                    hint={form.entity_id && !ENTITY_ID.test(form.entity_id)
                        ? 'An entity id from Home Assistant, such as sensor.outside_temperature.'
                        : saved && form.entity_id && !saved.has(form.entity_id)
                            ? 'Its value shows once the dashboard is saved with Done.'
                            : undefined}
                />
                {form.type === 'rectangle' && (
                    <>
                        <TextField
                            label="Second entity (optional)"
                            value={form.entity_id2}
                            onChange={(v) => set({ entity_id2: (v ?? '').trim().toLowerCase() })}
                            placeholder="sensor.energy_today"
                            hint="Shown under the first value. Without one, the name is shown there."
                        />
                        {!form.entity_id2 && (
                            <TextField label="Name (optional)" value={form.name} onChange={(v) => set({ name: v ?? '' })} placeholder="The entity's name" />
                        )}
                    </>
                )}
            </Group>

            {(form.type === 'ring' || form.type === 'gauge') && (
                <Group title="Range" description="Entities measured in % always run from 0 to 100.">
                    <div className="editor-row">
                        {form.type === 'gauge' && (
                            <NumberField label="Lowest" value={form.min} onChange={(min) => set({ min: min ?? 0 })} />
                        )}
                        <NumberField label="Highest" value={form.max} onChange={(max) => set({ max: max ?? 100 })} />
                    </div>
                </Group>
            )}

            <Group title="Appearance">
                <ToggleField
                    label="Icon of the entity"
                    checked={!form.icon}
                    onChange={(own) => set({ icon: own ? '' : 'mdi:gauge' })}
                    hint={form.icon ? undefined : 'The icon Home Assistant shows for it.'}
                />
                {form.icon && <IconPicker value={form.icon} onChange={(icon) => set({ icon })} />}
                <ColorField value={form.color} onChange={(color) => set({ color })} />
            </Group>

            <Group title="Condition" description="Shows the widget only while its entity's value matches.">
                <ToggleField label="Only show when…" checked={form.conditional} onChange={(conditional) => set({ conditional })} />
                {form.conditional && (
                    <>
                        <SegmentedField label="The value is" value={form.operator} options={OPERATOR_OPTIONS} onChange={(operator) => set({ operator })} />
                        <TextField
                            label={form.operator === 'above' || form.operator === 'below' ? 'Number' : 'Value'}
                            value={form.value}
                            onChange={(value) => set({ value: value ?? '' })}
                            placeholder={form.operator === 'above' || form.operator === 'below' ? 'e.g. 25' : 'e.g. on'}
                        />
                    </>
                )}
            </Group>

            {!adding && (
                <div className="editor-remove page-dialog-delete">
                    {confirmRemove ? (
                        <>
                            <span>Remove this widget?</span>
                            <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirmRemove(false)}>Keep</button>
                            <button
                                type="button"
                                className="button-reset editor-dialog-action destructive"
                                onClick={() => onSave(withList(list.filter((_, i) => i !== index)))}
                            >
                                Remove
                            </button>
                        </>
                    ) : (
                        <button type="button" className="button-reset editor-dialog-action destructive" onClick={() => setConfirmRemove(true)}>
                            Remove widget
                        </button>
                    )}
                </div>
            )}
        </HeaderDialog>
    );
}
