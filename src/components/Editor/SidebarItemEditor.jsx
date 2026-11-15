import { useEffect, useRef, useState } from 'react';
import { Field, TextField } from './EditorFields';
import BackgroundField from './icons/BackgroundField';
import IconColorField from './icons/IconColorField';
import IconPicker from './icons/IconPicker';
import Stage from './icons/Stage';
import { readIcon, storedColor } from './icons/iconModel';
import { SidebarIcon } from '../Sidebar/Sidebar';
import { NEW_FOLDER_NAME, isFolder } from '../Sidebar/sidebarModel';
import '../Sidebar/Sidebar.css';
import './CardEditor.css';

/**
 * Removes the keys whose value is empty.
 * @param {Object} entry - A sidebar entry.
 * @returns {Object} The entry without empty settings.
 */
const withoutEmpty = (entry) => Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== ''));

/**
 * Dialog that changes a sidebar icon: the icon of a page, or a folder's name and icon. It uses
 * the same icon picker, icon color and background as the icons of cards and apps, and shows the
 * icon as it will look in the sidebar.
 * @param {Object} props
 * @param {import('../Sidebar/sidebarModel').Entry} props.entry - The page or folder.
 * @param {string} [props.pageName] - The page's name; pages are renamed in their own settings.
 * @param {(entry: import('../Sidebar/sidebarModel').Entry) => void} props.onSave - Receives the changed entry.
 * @param {() => void} props.onCancel - Closes without changes.
 * @param {() => void} [props.onUngroup] - Removes the folder and keeps its pages.
 * @returns {JSX.Element} The dialog.
 */
const SidebarItemEditor = ({ entry, pageName, onSave, onCancel, onUngroup }) => {
    const dialogRef = useRef(null);
    const [draft, setDraft] = useState(entry);
    const folder = isFolder(draft);
    const name = folder ? (/** @type {any} */ (draft).name ?? '') : (pageName ?? '');
    const { ref } = readIcon(draft.icon);
    const color = draft.iconColor;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    const change = (patch) => setDraft(prev => withoutEmpty({ ...prev, ...patch }));
    const setIcon = (nextRef, nextColor) => change({ icon: nextRef || undefined, iconColor: storedColor(nextRef, nextColor) });
    const save = () => onSave(/** @type {any} */ (folder ? { ...draft, name: name.trim() || NEW_FOLDER_NAME } : draft));

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog has-stage icon-editor-dialog"
            aria-labelledby="sidebar-item-editor-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="sidebar-item-editor-title" className="editor-dialog-title">
                    {folder ? 'Folder' : 'Sidebar Icon'}
                    <span className="editor-dialog-subtitle">{name || NEW_FOLDER_NAME}</span>
                </h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save}>Save</button>
            </header>
            <div className="editor-workspace">
                <div className="editor-workspace-stage">
                    <Stage width={160} height={120}>
                        {() => (
                            <div className="sidebar-preview">
                                <div className={`sidebar-item is-active${folder ? ' is-folder' : ''}`}>
                                    <span className="button-reset sidebar-button">
                                        <span className="sidebar-tile"><SidebarIcon entry={draft} name={name || NEW_FOLDER_NAME} /></span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </Stage>
                </div>
                <div className="editor-dialog-body">
                    <section className="icon-inspector" aria-label={folder ? 'Folder' : 'Sidebar icon'}>
                        {folder ? (
                            <TextField label="Name" value={name} placeholder={NEW_FOLDER_NAME} onChange={(value = '') => change({ name: value })} />
                        ) : (
                            <Field label="Page" hint="Rename the page in its settings.">
                                <p className="sidebar-editor-page">{pageName}</p>
                            </Field>
                        )}
                        <IconPicker value={ref} onChange={(next) => setIcon(next, color)} />
                        {ref && (
                            <div className="sidebar-editor-icon-row">
                                <code className="icon-code">{ref}</code>
                                <button type="button" className="button-reset editor-dialog-action" onClick={() => setIcon('', undefined)}>
                                    {folder ? 'Use folder icon' : 'Use first letter'}
                                </button>
                            </div>
                        )}
                        <IconColorField iconRef={ref} value={color} onChange={(next) => setIcon(ref, next)} />
                        <BackgroundField value={draft.iconBackground} onChange={(background) => change({ iconBackground: background })} />
                        {folder && onUngroup && (
                            <button type="button" className="button-reset editor-dialog-action destructive sidebar-editor-ungroup" onClick={onUngroup}>
                                Remove Folder
                            </button>
                        )}
                    </section>
                </div>
            </div>
        </dialog>
    );
};

export default SidebarItemEditor;
