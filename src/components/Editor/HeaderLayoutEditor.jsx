import { useState } from 'react';
import { Group, SegmentedField, TextField, ToggleField } from './EditorFields';
import { HeaderDialog } from './HeaderEditorParts';
import {
    ARRANGEMENT_KEYS, arrangementForm, hasOwn, headerFor, headerOfAll, isOn, widgetsOf, widgetsSource, withArrangement,
    withPageArrangement, withPageWidgets,
} from './headerSettings';

const ALIGN_OPTIONS = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
];

const LAYOUT_OPTIONS = [
    { value: 'auto', label: 'Automatic' },
    { value: 'side-by-side', label: 'Side by Side' },
    { value: 'stacked', label: 'Stacked' },
];

const STYLE_OPTIONS = [
    { value: 'colored', label: 'Colored' },
    { value: 'monochrome', label: 'Monochrome' },
];

const LAYOUT_HINTS = {
    auto: 'Next to the text while they fit in one row, otherwise below it.',
    'side-by-side': 'Always next to the text, in more rows if needed.',
    stacked: 'Always below the text.',
};

/**
 * The arrangement fields: style, alignment, where the widgets go and the language of names.
 * @param {Object} props
 * @param {{align: string, layout: string, style: string, locale: string}} props.form - The arrangement.
 * @param {(patch: Object) => void} props.onChange - Receives changed fields.
 * @returns {JSX.Element} The fields.
 */
function ArrangementFields({ form, onChange }) {
    return (
        <>
            <SegmentedField
                label="Style"
                value={form.style}
                options={STYLE_OPTIONS}
                onChange={(style) => onChange({ style })}
                hint={form.style === 'monochrome' ? 'Text and widgets in one color, like the lock screen.' : 'Widgets and lines in their own colors.'}
            />
            <SegmentedField label="Alignment" value={form.align} options={ALIGN_OPTIONS} onChange={(align) => onChange({ align })} />
            <SegmentedField
                label="Widgets"
                value={form.layout}
                options={LAYOUT_OPTIONS}
                onChange={(layout) => onChange({ layout })}
                hint={LAYOUT_HINTS[form.layout]}
            />
            <TextField
                label="Language"
                value={form.locale}
                onChange={(locale) => onChange({ locale: locale ?? '' })}
                placeholder="Browser language"
                hint="For month and weekday names, e.g. de-DE or en-US."
            />
        </>
    );
}

/**
 * Dialog that turns the page header on or off and arranges it, for all pages or for the page
 * being shown, which can also follow all pages. The header's lines have their own editors.
 * Saving keeps it in the dashboard's draft; "Done" stores it in layout.yaml.
 * @param {Object} props
 * @param {*} props.pageHeader - The setting of all pages.
 * @param {*} [props.pageOwn] - The current page's own setting.
 * @param {string} [props.pageName] - The current page's name; without one, only all pages can be edited.
 * @param {string} props.pageKey - The current page's key, for template lines in the preview.
 * @param {'all'|'page'} [props.initialScope] - The tab to start on; the page's when it has its own arrangement.
 * @param {(saved: {pageHeader: *, pageOwn: *}) => void} props.onSave - Receives both settings.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
export default function HeaderLayoutEditor({ pageHeader, pageOwn, pageName, pageKey, initialScope, onSave, onCancel }) {
    const hasPage = pageName !== undefined;
    const ownArrangement = ARRANGEMENT_KEYS.some(key => hasOwn(pageOwn, key));
    const [scope, setScope] = useState(/** @type {'all'|'page'} */ (hasPage && (ownArrangement || pageOwn === false || initialScope === 'page') ? 'page' : 'all'));
    const [all, setAll] = useState(() => ({ on: isOn(pageHeader), changed: false, ...arrangementForm(headerOfAll(pageHeader)) }));
    const [page, setPage] = useState(() => ({
        visible: headerFor(pageHeader, pageOwn) !== null,
        own: ownArrangement,
        ownWidgets: widgetsSource(pageOwn) === 'page',
        changed: false,
        ...arrangementForm(headerFor(pageHeader, pageOwn) ?? headerOfAll(pageHeader)),
    }));

    // Only what was changed is written, so opening a tab doesn't fill in defaults
    const nextGlobal = !all.changed ? pageHeader : withArrangement(pageHeader, all, all.on);
    const arranged = hasPage && page.changed
        ? withPageArrangement(pageOwn, page.own ? page : all, { visible: page.visible, ownArrangement: page.own, globalOn: isOn(nextGlobal) })
        : pageOwn;
    let nextOwn = arranged;
    if (hasPage && page.changed && page.visible) {
        // Own widgets start as a copy of those of all pages
        const ownWidgets = widgetsSource(pageOwn) === 'page' ? widgetsOf(pageOwn) : structuredClone(widgetsOf(nextGlobal));
        nextOwn = withPageWidgets(arranged, page.ownWidgets ? ownWidgets : undefined, isOn(nextGlobal));
    }
    const preview = scope === 'page' ? headerFor(nextGlobal, nextOwn) : (all.on ? headerFor(nextGlobal) : null);

    return (
        <HeaderDialog
            title="Header"
            scope={scope}
            onScope={setScope}
            pageName={pageName}
            preview={preview}
            pageKey={pageKey}
            onSave={() => onSave({ pageHeader: nextGlobal, pageOwn: nextOwn })}
            onCancel={onCancel}
        >
            {scope === 'all' ? (
                <>
                    <Group title="All pages" description="Pages can show the header differently, or not at all.">
                        <ToggleField
                            label="Show header"
                            checked={all.on}
                            onChange={(on) => setAll(prev => ({ ...prev, on, changed: true }))}
                            hint={all.on ? undefined : 'Pages can still turn it on for themselves.'}
                        />
                    </Group>
                    <Group title="Arrangement">
                        <ArrangementFields form={all} onChange={(patch) => setAll(prev => ({ ...prev, ...patch, changed: true }))} />
                    </Group>
                </>
            ) : (
                <>
                    <Group title="This page">
                        <ToggleField label="Show header" checked={page.visible} onChange={(visible) => setPage(prev => ({ ...prev, visible, changed: true }))} />
                    </Group>
                    {page.visible && (
                        <Group title="Widgets">
                            <SegmentedField
                                label="Show"
                                value={page.ownWidgets ? 'own' : 'all'}
                                options={[{ value: 'all', label: 'All pages' }, { value: 'own', label: 'Own' }]}
                                onChange={(use) => setPage(prev => ({ ...prev, ownWidgets: use === 'own', changed: true }))}
                                hint={page.ownWidgets
                                    ? 'This page has its own widgets; they start as a copy of those of all pages.'
                                    : 'This page shows the widgets of all pages.'}
                            />
                        </Group>
                    )}
                    {page.visible && (
                        <Group title="Arrangement">
                            <SegmentedField
                                label="Use"
                                value={page.own ? 'own' : 'all'}
                                options={[{ value: 'all', label: 'All pages' }, { value: 'own', label: 'Own' }]}
                                onChange={(use) => setPage(prev => (use === 'own'
                                    ? { ...prev, own: true, align: all.align, layout: all.layout, style: all.style, locale: all.locale, changed: true }
                                    : { ...prev, own: false, changed: true }))}
                                hint={page.own ? undefined : 'This page is arranged like all pages.'}
                            />
                            {page.own && <ArrangementFields form={page} onChange={(patch) => setPage(prev => ({ ...prev, ...patch, changed: true }))} />}
                        </Group>
                    )}
                </>
            )}
        </HeaderDialog>
    );
}
