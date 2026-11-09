import { useEffect, useId, useRef, useState } from 'react';
import { Check, ImageUp } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
    BACKGROUND_COLORS, backgroundCss, isBackgroundColor, isBackgroundImage,
} from '../../../shared/pageBackground.js';
import { downloadBackground, uploadBackground } from '../../lib/api';
import { Group, SegmentedField, TextField } from './EditorFields';
import './CardEditor.css';

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/**
 * @typedef {Object} BackgroundForm
 * @property {'inherit'|'theme'|'color'|'image'} kind - What the background is; `inherit` only for a page.
 * @property {string} color - The color its gradient is made from.
 * @property {string|undefined} image - The picture's address.
 * @property {number} dim - How much the picture is darkened, from 0 to 0.8.
 */

/**
 * Reads a saved background setting into a form.
 * @param {{color?: string, image?: string, dim?: number, theme?: boolean}|null|undefined} background - The setting.
 * @param {boolean} forPage - Whether it is a single page's, which can follow the dashboard's.
 * @returns {BackgroundForm} The form.
 */
const toForm = (background, forPage) => {
    const base = { color: BACKGROUND_COLORS[0], image: undefined, dim: 0.25 };
    if (isBackgroundImage(background?.image)) return { ...base, kind: 'image', image: background.image, dim: Number(background.dim) || 0 };
    if (isBackgroundColor(background?.color)) return { ...base, kind: 'color', color: background.color.toLowerCase() };
    if (forPage && !background?.theme) return { ...base, kind: 'inherit' };
    return { ...base, kind: 'theme' };
};

/**
 * Turns a form into the setting that is saved.
 * @param {BackgroundForm} form - The form.
 * @param {boolean} forPage - Whether it is a single page's.
 * @returns {Object|undefined} The setting: undefined for the theme's (dashboard) or the dashboard's (page),
 *   `{ theme: true }` for the theme's on a page.
 */
const fromForm = (form, forPage) => {
    if (form.kind === 'color') return { color: form.color };
    if (form.kind === 'image' && isBackgroundImage(form.image)) return form.dim > 0 ? { image: form.image, dim: form.dim } : { image: form.image };
    if (form.kind === 'theme' && forPage) return { theme: true };
    return undefined;
};

/**
 * Downloads a picture from another site to this server, so the page loads it from here.
 * @param {Object|undefined} setting - A background setting.
 * @returns {Promise<Object|undefined>} The setting, with a local picture address.
 */
const withLocalPicture = async (setting) => (/^https?:\/\//.test(setting?.image || '')
    ? { ...setting, image: await downloadBackground(setting.image) }
    : setting);

/**
 * Dialog that sets the page background, for all pages or for the page being shown: the theme's
 * gradient, a gradient made from a color, or a picture, uploaded from this device or downloaded
 * from a web address to the server, optionally darkened so the cards stay readable. A page can
 * also follow the background of all pages. A small dashboard shows the result. Saving keeps it
 * in the dashboard's draft; "Done" stores it in layout.yaml.
 * @param {Object} props
 * @param {{color?: string, image?: string, dim?: number}} [props.background] - The background of all pages.
 * @param {Object|null} [props.pageBackground] - The current page's own background, if it has one.
 * @param {string} [props.pageName] - The current page's name; without one, only all pages can be edited.
 * @param {'all'|'page'} [props.initialScope] - Which background to start on; `page` also when the page has its own.
 * @param {(saved: {background: Object|undefined, pageBackground: Object|undefined}) => void} props.onSave - Receives
 *   both settings; undefined means the theme's (all pages) or the one of all pages (page).
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
const BackgroundEditor = ({ background, pageBackground, pageName, initialScope, onSave, onCancel }) => {
    const dialogRef = useRef(null);
    const fileRef = useRef(null);
    const dimId = useId();
    const { mode } = useTheme();
    const hasPage = pageName !== undefined;
    const [scope, setScope] = useState(hasPage && (pageBackground || initialScope === 'page') ? 'page' : 'all');
    const [forms, setForms] = useState(() => ({ all: toForm(background, false), page: toForm(pageBackground, true) }));
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    const forPage = scope === 'page';
    const form = forms[scope];
    const set = (patch) => setForms(prev => ({ ...prev, [scope]: { ...prev[scope], ...patch } }));
    const shown = forPage && form.kind === 'inherit' ? fromForm(forms.all, false) : fromForm(form, forPage);
    const preview = backgroundCss(shown, mode);
    const missingImage = Object.values(forms).some(f => f.kind === 'image' && !isBackgroundImage(f.image));

    const pickFile = async (file) => {
        if (!file) return;
        setError(null);
        setUploading(true);
        try {
            set({ image: await uploadBackground(file) });
        } catch (err) {
            setError(`Couldn't upload the picture: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    // Pictures from other sites are downloaded to this server first, so the page loads them from here
    const save = async () => {
        setError(null);
        setDownloading(true);
        try {
            const all = await withLocalPicture(fromForm(forms.all, false));
            const page = hasPage ? await withLocalPicture(fromForm(forms.page, true)) : pageBackground ?? undefined;
            onSave({ background: all, pageBackground: page });
        } catch (err) {
            setError(`Couldn't download the picture: ${err.message}`);
            setDownloading(false);
        }
    };

    const kinds = [
        ...(forPage ? [{ value: 'inherit', label: 'All pages' }] : []),
        { value: 'theme', label: 'Theme' },
        { value: 'color', label: 'Color' },
        { value: 'image', label: 'Picture' },
    ];
    const kindHint = {
        inherit: 'This page shows the background of all pages.',
        theme: "The theme's own gradient.",
    }[form.kind];

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog background-editor"
            aria-labelledby="background-editor-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="background-editor-title" className="editor-dialog-title">Background</h2>
                <button
                    type="button"
                    className="button-reset editor-dialog-action primary"
                    onClick={save}
                    disabled={uploading || downloading || missingImage}
                >
                    {downloading ? 'Downloading…' : 'Save'}
                </button>
            </header>

            <div className="card-editor-scroll background-editor-body">
                {hasPage && (
                    <div className="editor-tabs background-scope" role="tablist" aria-label="Background of">
                        <button type="button" role="tab" aria-selected={!forPage} className="button-reset" onClick={() => setScope('all')}>
                            All pages
                        </button>
                        <button type="button" role="tab" aria-selected={forPage} className="button-reset" onClick={() => setScope('page')}>
                            {pageName ? `This page: ${pageName}` : 'This page'}
                        </button>
                    </div>
                )}

                <div
                    className="background-preview"
                    aria-hidden="true"
                    style={preview.image ? { backgroundImage: preview.image } : undefined}
                >
                    <div className="background-preview-dim" style={{ opacity: preview.dim }} />
                    <div className="background-preview-bar" />
                    <div className="background-preview-grid">
                        <span className="wide" />
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                </div>

                {error && <div className="editor-error" role="alert">{error}</div>}

                <Group title={forPage ? 'This page' : 'All pages'}>
                    <SegmentedField
                        label="Show"
                        value={form.kind}
                        options={kinds}
                        onChange={(kind) => set({ kind })}
                        hint={kindHint}
                    />
                </Group>

                {form.kind === 'color' && (
                    <Group title="Color" description="The gradient is made from this color, lighter in light mode and darker in dark mode.">
                        <div className="background-swatches" role="radiogroup" aria-label="Color">
                            {BACKGROUND_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.color === color}
                                    aria-label={color}
                                    className="button-reset background-swatch"
                                    style={{ background: color }}
                                    onClick={() => set({ color })}
                                >
                                    {form.color === color && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                                </button>
                            ))}
                            <label className={`background-swatch background-swatch-custom${BACKGROUND_COLORS.includes(form.color) ? '' : ' selected'}`}>
                                <input
                                    type="color"
                                    value={form.color}
                                    aria-label="Custom color"
                                    onChange={(e) => set({ color: e.target.value.toLowerCase() })}
                                />
                            </label>
                        </div>
                    </Group>
                )}

                {form.kind === 'image' && (
                    <Group title="Picture" description="Up to 20 MB. Uploaded pictures are kept next to layout.yaml.">
                        <input
                            ref={fileRef}
                            type="file"
                            accept={IMAGE_TYPES}
                            className="visually-hidden"
                            tabIndex={-1}
                            aria-label="Picture file"
                            onChange={(e) => pickFile(e.target.files?.[0])}
                        />
                        <button
                            type="button"
                            className="button-reset background-upload"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                        >
                            <ImageUp size={20} aria-hidden="true" />
                            {uploading ? 'Uploading…' : form.image ? 'Choose another picture…' : 'Choose a picture…'}
                        </button>
                        <TextField
                            label="Or a web address"
                            value={form.image}
                            placeholder="https://example.com/photo.jpg"
                            onChange={(image) => set({ image })}
                            hint={form.image && !isBackgroundImage(form.image)
                                ? 'Starts with https://, http:// or /.'
                                : 'Saving downloads it to this server, so it loads quickly and keeps working if the site changes.'}
                        />
                        <div className="editor-field">
                            <label className="editor-label" htmlFor={dimId}>Darken: {Math.round(form.dim * 100)}%</label>
                            <input
                                id={dimId}
                                className="background-dim"
                                type="range"
                                min={0}
                                max={0.8}
                                step={0.05}
                                value={form.dim}
                                onChange={(e) => set({ dim: Number(e.target.value) })}
                            />
                            <div className="editor-hint">Keeps the cards readable on bright pictures.</div>
                        </div>
                    </Group>
                )}
            </div>
        </dialog>
    );
};

export default BackgroundEditor;
