import { useEffect, useRef, useState } from 'react';
import { Wallpaper } from 'lucide-react';
import { Group, TextField } from './EditorFields';
import './CardEditor.css';

/**
 * Dialog that adds a page, or shows the settings of the page being edited: pages added in the
 * browser can be renamed and deleted here, pages from config.yaml only show where they come from.
 * Every page can open its background from here.
 * @param {Object} props
 * @param {{id: string, name?: string, addedInEditor?: boolean}} [props.page] - The page to change; omitted to add one.
 * @param {number} [props.cardCount=0] - Cards on that page, deleted with it.
 * @param {(name: string|undefined) => void} props.onSave - Receives the page's name.
 * @param {() => void} [props.onDelete] - Deletes the page.
 * @param {() => void} [props.onEditBackground] - Opens the background dialog on this page's background.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
const PageDialog = ({ page, cardCount = 0, onSave, onDelete, onEditBackground, onCancel }) => {
    const dialogRef = useRef(null);
    const [name, setName] = useState(page?.name);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const adding = !page;
    const renamable = adding || page.addedInEditor;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
        dialog?.querySelector('input')?.focus();
    }, []);

    const save = () => (renamable ? onSave(name?.trim() || undefined) : onCancel());

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
                <h2 id="page-dialog-title" className="editor-dialog-title">{adding ? 'New Page' : 'Page'}</h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={save}>
                    {adding ? 'Add' : renamable ? 'Save' : 'Done'}
                </button>
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
                    description={adding
                        ? 'The page is added after the others. Add cards to it with +, or drag cards to the edge of the screen to move them there.'
                        : renamable
                            ? `Its address is /${page.id}.`
                            : `Its address is /${page.id}. This page is set up in config.yaml; change its name or remove it there.`}
                >
                    {renamable
                        ? <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Garden" />
                        : <p className="page-dialog-name">{page.name || page.id}</p>}
                </Group>
                {!adding && onEditBackground && (
                    <button type="button" className="button-reset background-upload page-dialog-background" onClick={onEditBackground}>
                        <Wallpaper size={20} aria-hidden="true" />
                        Page background…
                    </button>
                )}
                {!adding && onDelete && (
                    <div className="editor-remove page-dialog-delete">
                        {confirmDelete ? (
                            <>
                                <span>{cardCount > 0 ? `Delete this page and its ${cardCount === 1 ? 'card' : `${cardCount} cards`}?` : 'Delete this page?'}</span>
                                <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirmDelete(false)}>Keep</button>
                                <button type="button" className="button-reset editor-dialog-action destructive" onClick={onDelete}>Delete</button>
                            </>
                        ) : (
                            <button type="button" className="button-reset editor-dialog-action destructive" onClick={() => setConfirmDelete(true)}>
                                Delete page
                            </button>
                        )}
                    </div>
                )}
            </form>
        </dialog>
    );
};

export default PageDialog;
