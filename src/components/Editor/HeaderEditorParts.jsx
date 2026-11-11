import { useEffect, useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { NAMED_COLORS, formatDate } from '../../../shared/pageHeader';
import { useElementSize } from '../../hooks/useElementSize';
import { useNow } from '../../hooks/useNow';
import PageHeader from '../PageHeader/PageHeader';
import { Field, TextField } from './EditorFields';
import './CardEditor.css';

/** Width the preview lays the header out at before scaling it down, as on a wide screen. */
const PREVIEW_WIDTH = 1100;

/**
 * Dialog frame shared by the page header editors: Cancel, title and Save, tabs for all pages and
 * the page being shown, and a preview of the header.
 * @param {Object} props
 * @param {string} props.title - Dialog title.
 * @param {'all'|'page'} [props.scope] - The tab shown.
 * @param {(scope: 'all'|'page') => void} [props.onScope] - Switches tabs.
 * @param {string} [props.pageName] - The page's name; without one, only all pages can be edited.
 * @param {Object|null} props.preview - The header to preview; null shows that it is off.
 * @param {string} props.pageKey - Key of the page, for template lines in the preview.
 * @param {() => void} props.onSave - Saves.
 * @param {string} [props.saveLabel='Save'] - Label of the save button.
 * @param {boolean} [props.saveDisabled] - Whether saving isn't possible yet.
 * @param {() => void} props.onCancel - Closes without changes.
 * @param {import('react').ReactNode} props.children - The fields.
 * @returns {JSX.Element} The dialog.
 */
export function HeaderDialog({
    title, scope, onScope, pageName, preview, pageKey, onSave, onCancel, saveLabel = 'Save', saveDisabled = false, children,
}) {
    const dialogRef = useRef(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog background-editor header-editor"
            aria-labelledby={titleId}
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id={titleId} className="editor-dialog-title">{title}</h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={onSave} disabled={saveDisabled}>
                    {saveLabel}
                </button>
            </header>
            <div className="card-editor-scroll background-editor-body">
                {pageName !== undefined && onScope && (
                    <div className="editor-tabs background-scope" role="tablist" aria-label={`${title} of`}>
                        <button type="button" role="tab" aria-selected={scope === 'all'} className="button-reset" onClick={() => onScope('all')}>
                            All pages
                        </button>
                        <button type="button" role="tab" aria-selected={scope === 'page'} className="button-reset" onClick={() => onScope('page')}>
                            {pageName ? `This page: ${pageName}` : 'This page'}
                        </button>
                    </div>
                )}
                <HeaderPreview header={preview} pageKey={pageKey} />
                {children}
            </div>
        </dialog>
    );
}

/**
 * The page header on a small page, laid out as on a wide screen and scaled to fit.
 * @param {Object} props
 * @param {Object|null} props.header - The header; null shows a note that it is off.
 * @param {string} props.pageKey - Key of the page, for template lines.
 * @returns {JSX.Element} The preview.
 */
export function HeaderPreview({ header, pageKey }) {
    const [size, measure] = useElementSize();
    const scale = size.width ? size.width / PREVIEW_WIDTH : 0.5;
    return (
        <div className="background-preview header-preview" ref={measure} aria-hidden="true">
            {header ? (
                <div className="header-preview-stage" style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}>
                    <PageHeader header={header} pageKey={pageKey} />
                    <div className="header-preview-cards"><span className="wide" /><span /><span /></div>
                </div>
            ) : (
                <div className="header-preview-off">No header</div>
            )}
        </div>
    );
}

/** Colors offered for header text, in the order shown. */
const SWATCHES = ['text', 'secondary', 'primary', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'];

const SWATCH_LABELS = { text: 'Text color', secondary: 'Secondary text color', primary: 'Theme color' };

/**
 * Picks a header text color: a system color that follows light and dark mode, or any color.
 * @param {Object} props
 * @param {string} props.value - The color: a name or a CSS color.
 * @param {(value: string) => void} props.onChange - Receives the new color.
 * @returns {JSX.Element} The field.
 */
export function ColorField({ value, onChange }) {
    const custom = !SWATCHES.includes(value);
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
    return (
        <Field label="Color" hint="Named colors follow light and dark mode.">
            <div className="background-swatches header-swatches" role="radiogroup" aria-label="Color">
                {SWATCHES.map(name => (
                    <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={value === name}
                        aria-label={SWATCH_LABELS[name] ?? name[0].toUpperCase() + name.slice(1)}
                        title={SWATCH_LABELS[name] ?? name[0].toUpperCase() + name.slice(1)}
                        className="button-reset background-swatch"
                        style={{ background: NAMED_COLORS[name] }}
                        onClick={() => onChange(name)}
                    >
                        {value === name && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                    </button>
                ))}
                <label className={`background-swatch background-swatch-custom${custom ? ' selected' : ''}`}>
                    <input type="color" value={hex} aria-label="Custom color" onChange={(e) => onChange(e.target.value.toLowerCase())} />
                </label>
            </div>
        </Field>
    );
}

const FORMAT_PRESETS = {
    clock: ['HH:mm', 'h:mm A', 'HH:mm:ss'],
    date: ['dddd, D MMMM', 'ddd, D MMM', 'D MMMM YYYY', 'DD.MM.YYYY'],
};

/**
 * Picks how a clock or date is written: a few common formats, shown as they look now, or a
 * custom one with tokens.
 * @param {Object} props
 * @param {'clock'|'date'} props.kind - Clock or date.
 * @param {string} props.value - The format.
 * @param {string} [props.locale] - Locale for month and weekday names.
 * @param {(value: string) => void} props.onChange - Receives the new format.
 * @returns {JSX.Element} The field.
 */
export function FormatField({ kind, value, locale, onChange }) {
    const now = useNow(kind === 'clock' ? 'second' : 'minute');
    const presets = FORMAT_PRESETS[kind];
    const custom = !presets.includes(value);
    return (
        <>
            <Field label="Format">
                <div className="editor-segmented header-formats" role="radiogroup" aria-label="Format">
                    {presets.map(format => (
                        <button
                            key={format}
                            type="button"
                            role="radio"
                            aria-checked={value === format}
                            className="button-reset"
                            title={format}
                            onClick={() => onChange(format)}
                        >
                            {formatDate(now, format, locale)}
                        </button>
                    ))}
                    <button
                        type="button"
                        role="radio"
                        aria-checked={custom}
                        className="button-reset"
                        onClick={() => !custom && onChange(kind === 'clock' ? 'H [h] mm' : 'D MMM YYYY')}
                    >
                        Custom
                    </button>
                </div>
            </Field>
            {custom && (
                <TextField
                    label="Custom format"
                    value={value}
                    onChange={(v) => onChange(v ?? '')}
                    placeholder={kind === 'clock' ? 'HH:mm' : 'dddd, D MMMM'}
                    hint={`Shows “${formatDate(now, value || (kind === 'clock' ? 'HH:mm' : 'dddd, D MMMM'), locale)}”. `
                        + 'YYYY year, MMMM/MMM/MM month, dddd/ddd weekday, DD/D day, HH/H or hh/h hour, mm minutes, ss seconds, A AM/PM, [text] as written.'}
                />
            )}
        </>
    );
}
