import { useState } from 'react';
import { Field, Group, NumberField, SegmentedField, TextField, ToggleField } from './EditorFields';
import { ColorField, FormatField, HeaderDialog } from './HeaderEditorParts';
import {
    hasOwn, headerFor, headerOfAll, isOn, lineForm, lineFromForm, templateOf, withLine, withPageLine,
} from './headerSettings';

const NAMES = { title: 'Title', subtitle: 'Subtitle' };

const TYPE_HINTS = {
    greeting: 'Good morning, afternoon, evening or night, by the time of day.',
    template: 'Rendered by Home Assistant. Templates are written in config.yaml and can’t be changed here.',
};

/**
 * The fields of one line: whether it shows, what it shows, and in which color.
 * @param {Object} props
 * @param {import('./headerSettings').LineForm} props.form - The line.
 * @param {(patch: Object) => void} props.onChange - Receives changed fields.
 * @param {string} [props.locale] - Locale for the format examples.
 * @param {string} props.name - The line's name, for labels.
 * @param {boolean} [props.monochrome] - Whether the header is monochrome, which ignores line colors.
 * @returns {JSX.Element} The fields.
 */
function LineFields({ form, onChange, locale, name, monochrome }) {
    const types = [
        { value: 'clock', label: 'Clock' },
        { value: 'date', label: 'Date' },
        { value: 'text', label: 'Text' },
        { value: 'greeting', label: 'Greeting' },
        // Only lines config.yaml gives a template can show one
        ...(form.template ? [{ value: 'template', label: 'Template' }] : []),
    ];
    return (
        <>
            <Group title={name}>
                <ToggleField label={`Show ${name.toLowerCase()}`} checked={form.show} onChange={(show) => onChange({ show })} />
                {form.show && (
                    <SegmentedField
                        label="Shows"
                        value={form.type}
                        options={types}
                        onChange={(type) => onChange({ type })}
                        hint={TYPE_HINTS[form.type]}
                    />
                )}
            </Group>
            {form.show && (
                <Group title="Appearance">
                    {form.type === 'clock' && (
                        <FormatField kind="clock" value={form.clockFormat} locale={locale} onChange={(clockFormat) => onChange({ clockFormat })} />
                    )}
                    {form.type === 'date' && (
                        <FormatField kind="date" value={form.dateFormat} locale={locale} onChange={(dateFormat) => onChange({ dateFormat })} />
                    )}
                    {form.type === 'text' && (
                        <TextField label="Text" value={form.text} onChange={(text) => onChange({ text: text ?? '' })} placeholder="e.g. Welcome home" />
                    )}
                    {form.type === 'template' && (
                        <>
                            <Field label="Template">
                                <code className="header-template">{form.template}</code>
                            </Field>
                            <NumberField
                                label="Update every (seconds)"
                                value={form.refresh}
                                min={10}
                                step={10}
                                onChange={(refresh) => onChange({ refresh: Math.max(10, refresh || 60) })}
                            />
                        </>
                    )}
                    {monochrome
                        ? <p className="editor-hint">The header is monochrome, so this line is shown in the text color. Change the style in Header.</p>
                        : <ColorField value={form.color} onChange={(color) => onChange({ color })} />}
                </Group>
            )}
        </>
    );
}

/**
 * Dialog that changes one line of the page header, the title or the subtitle above it, for all
 * pages or for the page being shown, which can also follow all pages. Saving keeps it in the
 * dashboard's draft; "Done" stores it in layout.yaml.
 * @param {Object} props
 * @param {'title'|'subtitle'} props.line - Which line.
 * @param {*} props.pageHeader - The setting of all pages.
 * @param {*} [props.pageOwn] - The current page's own setting.
 * @param {string} [props.pageName] - The current page's name; without one, only all pages can be edited.
 * @param {string} props.pageKey - The current page's key, for template lines in the preview.
 * @param {(saved: {pageHeader: *, pageOwn: *}) => void} props.onSave - Receives both settings.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
export default function HeaderLineEditor({ line, pageHeader, pageOwn, pageName, pageKey, onSave, onCancel }) {
    const name = NAMES[line];
    const hasPage = pageName !== undefined;
    const ownLine = hasOwn(pageOwn, line);
    const globalTemplate = templateOf(line, pageHeader);
    const pageTemplate = templateOf(line, pageOwn, pageHeader);
    const globalSetting = headerOfAll(pageHeader);
    const pageShown = headerFor(pageHeader, pageOwn) ?? globalSetting;

    const [scope, setScope] = useState(/** @type {'all'|'page'} */ (hasPage && ownLine ? 'page' : 'all'));
    const [all, setAll] = useState(() => ({ ...lineForm(pageHeader === true ? undefined : pageHeader?.[line], line, globalTemplate), changed: false }));
    const [page, setPage] = useState(() => ({
        own: ownLine,
        changed: false,
        ...lineForm(ownLine ? pageOwn[line] : pageHeader === true ? undefined : pageHeader?.[line], line, pageTemplate),
    }));

    // Only what was changed is written, so opening a tab doesn't fill in defaults
    const nextGlobal = !all.changed ? pageHeader : withLine(pageHeader, line, lineFromForm(all));
    const nextOwn = hasPage && page.changed
        ? withPageLine(pageOwn, line, page.own ? lineFromForm(page) : undefined, isOn(nextGlobal))
        : pageOwn;
    const preview = scope === 'page' ? headerFor(nextGlobal, nextOwn) : headerOfAll(nextGlobal);
    const locale = (scope === 'page' ? pageShown : globalSetting).locale;
    const monochrome = (scope === 'page' ? pageShown : globalSetting).style === 'monochrome';

    return (
        <HeaderDialog
            title={name}
            scope={scope}
            onScope={setScope}
            pageName={pageName}
            preview={preview}
            pageKey={pageKey}
            onSave={() => onSave({ pageHeader: nextGlobal, pageOwn: nextOwn })}
            onCancel={onCancel}
        >
            {scope === 'all' ? (
                <LineFields form={all} name={name} locale={locale} monochrome={monochrome} onChange={(patch) => setAll(prev => ({ ...prev, ...patch, changed: true }))} />
            ) : (
                <>
                    <Group title="This page">
                        <SegmentedField
                            label="Use"
                            value={page.own ? 'own' : 'all'}
                            options={[{ value: 'all', label: 'All pages' }, { value: 'own', label: 'Own' }]}
                            onChange={(use) => setPage(prev => (use === 'own' ? { ...all, template: pageTemplate, own: true, changed: true } : { ...prev, own: false, changed: true }))}
                            hint={page.own ? undefined : `This page shows the ${name.toLowerCase()} of all pages.`}
                        />
                    </Group>
                    {page.own && (
                        <LineFields form={page} name={name} locale={locale} monochrome={monochrome} onChange={(patch) => setPage(prev => ({ ...prev, ...patch, changed: true }))} />
                    )}
                </>
            )}
        </HeaderDialog>
    );
}
