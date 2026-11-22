import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Group, TextField } from '../Editor/EditorFields';
import { useSectionCommit } from './settingsSection';

/**
 * Page section of the settings window, for the page being shown. Pages added in the browser can be
 * renamed (kept by the window's Save) and deleted (right away, after asking); pages from config.yaml
 * only show where they come from.
 * @param {Object} props
 * @param {{id: string, name?: string, addedInEditor?: boolean}} props.page - The page.
 * @param {number} [props.cardCount=0] - Cards on the page, deleted with it.
 * @param {(name: string|undefined) => void} props.onRename - Receives the page's new name.
 * @param {() => void} [props.onDelete] - Deletes the page.
 * @param {() => void} [props.onAddPage] - Adds a new page.
 * @returns {JSX.Element} The section.
 */
const PageSettings = ({ page, cardCount = 0, onRename, onDelete, onAddPage }) => {
    const [name, setName] = useState(page.name);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const renamable = !!page.addedInEditor;

    useSectionCommit(() => {
        const next = name?.trim() || undefined;
        if (renamable && next !== page.name) onRename(next);
    });

    return (
        <div className="settings-form">
            <Group
                title="Page"
                description={renamable
                    ? `Its address is /${page.id}.`
                    : `Its address is /${page.id}. This page is set up in config.yaml; change its name or remove it there.`}
            >
                {renamable
                    ? <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Garden" />
                    : <p className="page-dialog-name">{page.name || page.id}</p>}
            </Group>
            {onDelete && (
                confirmDelete ? (
                    <div className="settings-confirm">
                        <span>{cardCount > 0 ? `Delete this page and its ${cardCount === 1 ? 'card' : `${cardCount} cards`}?` : 'Delete this page?'}</span>
                        <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirmDelete(false)}>Keep</button>
                        <button type="button" className="button-reset editor-dialog-action destructive" onClick={onDelete}>Delete</button>
                    </div>
                ) : (
                    <button type="button" className="button-reset settings-danger-button" onClick={() => setConfirmDelete(true)}>
                        Delete page
                    </button>
                )
            )}
            {onAddPage && (
                <Group title="New Page" description="Adds an empty page after the last one. It is kept with Done.">
                    <button type="button" className="button-reset icon-stage-add settings-add-page" onClick={onAddPage}>
                        <Plus size={18} aria-hidden="true" />Add page
                    </button>
                </Group>
            )}
        </div>
    );
};

export default PageSettings;
