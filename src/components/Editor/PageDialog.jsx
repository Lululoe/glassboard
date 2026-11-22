import { useEffect, useRef, useState } from 'react';
import { Group, TextField } from './EditorFields';
import './CardEditor.css';

/**
 * Dialog that adds a page after the others. The settings of an existing page are in the settings
 * window.
 * @param {Object} props
 * @param {(name: string|undefined) => void} props.onSave - Receives the page's name.
 * @param {() => void} props.onCancel - Closes without adding one.
 * @returns {JSX.Element} The dialog.
 */
const PageDialog = ({ onSave, onCancel }) => {
    const dialogRef = useRef(null);
    const [name, setName] = useState(/** @type {string|undefined} */ (undefined));

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
        dialog?.querySelector('input')?.focus();
    }, []);

    const save = () => onSave(name?.trim() || undefined);

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog page-dialog"
            aria-labelledby="page-dialog-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="page-dialog-title" className="editor-dialog-title">New Page</h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save}>Add</button>
            </header>
            <form
                className="card-editor-scroll page-dialog-body"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <Group
                    title="Page"
                    description="The page is added after the others. Add cards to it with +, or drag cards to the edge of the screen to move them there."
                >
                    <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Garden" />
                </Group>
            </form>
        </dialog>
    );
};

export default PageDialog;
