import { useState } from 'react';
import { ChevronDown, ChevronUp, EyeOff, Plus } from 'lucide-react';
import { Group, ToggleField } from '../Editor/EditorFields';
import { SidebarEntryFields } from '../Editor/SidebarItemEditor';
import { SidebarIcon } from '../Sidebar/Sidebar';
import {
    NEW_FOLDER_NAME, entryAt, isFolder, mergeEntries, moveEntry, normalizeItems, replaceEntry, ungroup,
} from '../Sidebar/sidebarModel';
import { useSectionCommit } from './settingsSection';
import '../Sidebar/Sidebar.css';
import '../Editor/icons/IconEditor.css';
import './SidebarSettings.css';

/**
 * @typedef {import('../Sidebar/sidebarModel').Entry} Entry
 * @typedef {import('../Sidebar/sidebarModel').EntryPath} EntryPath
 * @typedef {{key: string, name: string, hidden?: boolean}} SidebarSettingsPage
 */

/** Value of the folder choice that puts a page and the next one in a new folder. */
const NEW_FOLDER = '\u0000new';
/** Value of the folder choice that takes a page out of its folder. */
const NO_FOLDER = '\u0000none';

/**
 * Whether two paths point to the same entry.
 * @param {EntryPath|null} a - A path.
 * @param {EntryPath|null} b - Another.
 * @returns {boolean} True when they do.
 */
const samePath = (a, b) => !!a && !!b && a.folder === b.folder && a.index === b.index;

/**
 * Sidebar section of the settings window: whether the sidebar shows, and its pages and folders
 * in order with their icons. The rail is drawn as it will look; selecting an icon there or in the
 * list shows its settings. Pages move up and down, into a folder or out of it, and a page can start
 * a new folder with the page after it. The window's Save keeps it all in the dashboard's draft.
 * @param {Object} props
 * @param {boolean} props.enabled - Whether the sidebar shows now.
 * @param {Array<Object>} [props.items] - The arrangement now (`sidebar.items`).
 * @param {SidebarSettingsPage[]} props.pages - The pages, in dashboard order.
 * @param {(sidebar: {enabled: boolean, items?: Entry[]}) => void} props.onSave - Receives whether it
 *   shows and, when it changed, the arrangement.
 * @param {() => void} [props.onAddPage] - Adds a page.
 * @returns {JSX.Element} The section.
 */
const SidebarSettings = ({ enabled, items: stored, pages, onSave, onAddPage }) => {
    const keys = pages.map(p => p.key);
    const [on, setOn] = useState(enabled);
    const [initial] = useState(() => normalizeItems(keys, stored));
    const [draft, setDraft] = useState(/** @type {Entry[]|null} */ (null));
    // Pages added meanwhile join at the end
    const items = normalizeItems(keys, draft ?? initial);
    const [selected, setSelected] = useState(/** @type {EntryPath|null} */ (null));

    const byKey = new Map(pages.map(p => [p.key, p]));
    const nameOf = (entry) => (isFolder(entry) ? entry.name || NEW_FOLDER_NAME : byKey.get(entry.page)?.name ?? entry.page);
    const selectedEntry = selected ? entryAt(items, selected) : undefined;

    useSectionCommit(() => {
        const changed = draft !== null && JSON.stringify(items) !== JSON.stringify(initial);
        if (on !== enabled || changed) onSave({ enabled: on, ...(changed ? { items } : {}) });
    });

    /**
     * Changes the arrangement and keeps the same entry selected, wherever it went.
     * @param {Entry[]} next - The new arrangement.
     * @param {Entry} [follow] - The entry to keep selected.
     */
    const arrange = (next, follow) => {
        setDraft(next);
        if (!follow) return;
        const key = isFolder(follow) ? follow.folder : follow.page;
        for (let i = 0; i < next.length; i++) {
            const entry = next[i];
            if (isFolder(entry)) {
                if (isFolder(follow) && entry.folder === key) return setSelected({ folder: null, index: i });
                const at = entry.pages.findIndex(p => p.page === key);
                if (!isFolder(follow) && at >= 0) return setSelected({ folder: entry.folder, index: at });
            } else if (!isFolder(follow) && entry.page === key) {
                return setSelected({ folder: null, index: i });
            }
        }
        setSelected(null);
    };

    const move = (path, by) => {
        const entry = entryAt(items, path);
        arrange(moveEntry(items, path, { folder: path.folder, index: path.index + by }), entry);
    };

    const folders = /** @type {import('../Sidebar/sidebarModel').FolderEntry[]} */ (items.filter(isFolder));

    /**
     * Moves a page into a folder, out of its folder, or into a new folder with the page after it.
     * @param {EntryPath} path - Where the page is.
     * @param {string} choice - A folder's id, NO_FOLDER or NEW_FOLDER.
     */
    const setFolder = (path, choice) => {
        const entry = entryAt(items, path);
        if (choice === NEW_FOLDER) {
            const nextIndex = items.findIndex((e, i) => i > path.index && !isFolder(e));
            if (nextIndex >= 0) arrange(mergeEntries(items, { folder: null, index: nextIndex }, path.index), entry);
        } else if (choice === NO_FOLDER) {
            const at = items.findIndex(e => isFolder(e) && e.folder === path.folder);
            arrange(moveEntry(items, path, { folder: null, index: at + 1 }), entry);
        } else {
            const target = folders.find(f => f.folder === choice);
            if (target) arrange(moveEntry(items, path, { folder: choice, index: target.pages.length }), entry);
        }
    };

    const row = (entry, path, list) => {
        const folder = isFolder(entry);
        const page = folder ? null : byKey.get(entry.page);
        const name = nameOf(entry);
        const canStartFolder = path.folder === null && items.some((e, i) => i > path.index && !isFolder(e));
        return (
            <li key={folder ? `f:${entry.folder}` : `p:${entry.page}`} className={`sidebar-editor-row${path.folder ? ' is-nested' : ''}${samePath(selected, path) ? ' is-selected' : ''}`}>
                <button
                    type="button"
                    className="button-reset sidebar-editor-row-main"
                    aria-pressed={samePath(selected, path)}
                    onClick={() => setSelected(samePath(selected, path) ? null : path)}
                >
                    <span className="sidebar-editor-row-icon"><SidebarIcon entry={entry} name={name} /></span>
                    <span className="sidebar-editor-row-name">{name}</span>
                    {page?.hidden && <EyeOff className="sidebar-editor-row-hidden" size={14} aria-label="Hidden page" />}
                </button>
                {!folder && (
                    <select
                        className="editor-input sidebar-editor-row-folder"
                        aria-label={`Folder of ${name}`}
                        value={path.folder ?? NO_FOLDER}
                        onChange={(e) => setFolder(path, e.target.value)}
                    >
                        <option value={NO_FOLDER}>No folder</option>
                        {folders.map(f => <option key={f.folder} value={f.folder}>{f.name || NEW_FOLDER_NAME}</option>)}
                        {canStartFolder && <option value={NEW_FOLDER}>New folder with next page</option>}
                    </select>
                )}
                <span className="sidebar-editor-row-moves">
                    <button type="button" className="button-reset sidebar-editor-move" aria-label={`Move ${name} up`} disabled={path.index === 0} onClick={() => move(path, -1)}>
                        <ChevronUp size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="button-reset sidebar-editor-move" aria-label={`Move ${name} down`} disabled={path.index === list.length - 1} onClick={() => move(path, 1)}>
                        <ChevronDown size={18} aria-hidden="true" />
                    </button>
                </span>
            </li>
        );
    };

    const openFolder = selected && (selected.folder ?? (isFolder(items[selected.index]) ? /** @type {any} */ (items[selected.index]).folder : null));
    const openFolderEntry = folders.find(f => f.folder === openFolder);

    const tile = (entry, path) => (
        <div
            key={isFolder(entry) ? `f:${entry.folder}` : `p:${entry.page}`}
            className={`sidebar-item${isFolder(entry) ? ' is-folder' : ''}${samePath(selected, path) ? ' is-active' : ''}${!isFolder(entry) && byKey.get(entry.page)?.hidden ? ' is-hidden-page' : ''}`}
        >
            <button type="button" className="button-reset sidebar-button" aria-label={nameOf(entry)} onClick={() => setSelected(path)}>
                <span className="sidebar-tile"><SidebarIcon entry={entry} name={nameOf(entry)} /></span>
            </button>
        </div>
    );

    return (
        <div className="settings-columns sidebar-settings">
            <aside className="card-editor-preview sidebar-settings-preview" aria-label="Preview">
                <p className="card-editor-preview-label">Preview</p>
                <div className={`sidebar-settings-stage${on ? '' : ' is-off'}`}>
                    <div className="sidebar-rail">
                        {items.map((entry, index) => tile(entry, { folder: null, index }))}
                    </div>
                    {openFolderEntry && (
                        <div className="sidebar-rail sidebar-settings-folder" aria-label={openFolderEntry.name || NEW_FOLDER_NAME}>
                            {openFolderEntry.pages.map((entry, index) => tile(entry, { folder: openFolderEntry.folder, index }))}
                        </div>
                    )}
                </div>
                {!on && <p className="appearance-preview-note">The sidebar is off. Turn on Show sidebar to use it.</p>}
            </aside>

            <div className="settings-columns-main">
                <div className="settings-form">
                    <Group title="Sidebar" description="Lists the pages down the left side, instead of the arrows and dots.">
                        <ToggleField label="Show sidebar" checked={on} onChange={setOn} />
                    </Group>

                    <Group title="Pages and Folders" description="Select one to change its icon. Pages can also be dragged in the sidebar itself while editing.">
                        <ol className="sidebar-editor-list" aria-label="Pages and folders">
                            {items.map((entry, index) => (isFolder(entry) ? [
                                row(entry, { folder: null, index }, items),
                                ...entry.pages.map((p, i) => row(p, { folder: entry.folder, index: i }, entry.pages)),
                            ] : row(entry, { folder: null, index }, items)))}
                        </ol>
                        {onAddPage && (
                            <button type="button" className="button-reset icon-stage-add sidebar-editor-add" onClick={onAddPage}>
                                <Plus size={18} aria-hidden="true" />Add page
                            </button>
                        )}
                    </Group>

                    {selected && selectedEntry && (
                        <SidebarEntryFields
                            key={isFolder(selectedEntry) ? `f:${selectedEntry.folder}` : `p:${selectedEntry.page}`}
                            entry={selectedEntry}
                            pageName={isFolder(selectedEntry) ? undefined : nameOf(selectedEntry)}
                            onChange={(entry) => setDraft(replaceEntry(items, selected, entry))}
                            onUngroup={isFolder(selectedEntry) ? () => {
                                setSelected(null);
                                setDraft(ungroup(items, selectedEntry.folder));
                            } : undefined}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default SidebarSettings;
