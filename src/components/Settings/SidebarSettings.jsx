import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus } from 'lucide-react';
import { Field, Group, ToggleField } from '../Editor/EditorFields';
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
/**
 * Drags rows of the list by their handle. The dragged row follows the pointer and a line shows
 * where it will go; it moves once released. On the handle, the up and down arrow keys move it.
 * @param {(from: EntryPath, gap: number) => void} onDrop - Moves the entry at `from` before the row at `gap`.
 * @returns {{dragging: number|null, gap: number|null, handleProps: (flat: number, path: EntryPath, name: string) => Object}}
 *   The row dragged, the row it goes before, and the props of each handle.
 */
function useRowDrag(onDrop) {
    const [dragging, setDragging] = useState(/** @type {number|null} */ (null));
    const [gap, setGap] = useState(/** @type {number|null} */ (null));
    const drag = useRef(null);
    const latest = useRef(onDrop);

    useEffect(() => {
        latest.current = onDrop;
    });

    useEffect(() => {
        const onMove = (e) => {
            const d = drag.current;
            if (!d || e.pointerId !== d.pointerId) return;
            const dy = e.clientY - d.startY;
            if (!d.started) {
                if (Math.abs(dy) < 4) return;
                d.started = true;
                setDragging(d.flat);
            }
            d.row.style.transform = `translateY(${dy}px)`;
            // The rows stay where they were while dragging; only the line moves
            let next = d.mids.length;
            for (let i = 0; i < d.mids.length; i++) {
                if (e.clientY < d.mids[i]) {
                    next = i;
                    break;
                }
            }
            d.gap = next;
            setGap(next);
        };
        const onUp = (e) => {
            const d = drag.current;
            if (!d || e.pointerId !== d.pointerId) return;
            drag.current = null;
            d.row.style.transform = '';
            setDragging(null);
            setGap(null);
            if (d.started && d.gap !== null && d.gap !== d.flat && d.gap !== d.flat + 1) latest.current(d.path, d.gap);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, []);

    const handleProps = (flat, path, name) => ({
        role: 'button',
        tabIndex: 0,
        'aria-label': `Reorder ${name}`,
        'aria-keyshortcuts': 'ArrowUp ArrowDown',
        onPointerDown: (e) => {
            if (e.button) return;
            e.preventDefault();
            const row = /** @type {HTMLElement} */ (e.currentTarget).closest('li');
            const list = row?.parentElement;
            if (!row || !list) return;
            const mids = [...list.children].map(li => {
                const r = li.getBoundingClientRect();
                return r.top + r.height / 2;
            });
            drag.current = { flat, path, row, mids, pointerId: e.pointerId, startY: e.clientY, started: false, gap: null };
        },
        onKeyDown: (e) => {
            const step = { ArrowUp: -1, ArrowDown: 2 }[e.key];
            if (!step) return;
            e.preventDefault();
            const target = flat + step;
            const count = /** @type {HTMLElement} */ (e.currentTarget).closest('ol')?.children.length ?? 0;
            if (target < 0 || target > count) return;
            const list = /** @type {HTMLElement} */ (e.currentTarget).closest('ol');
            latest.current(path, target);
            requestAnimationFrame(() => /** @type {HTMLElement|null|undefined} */ (list?.querySelector(`[aria-label="Reorder ${CSS.escape(name)}"]`))?.focus());
        },
    });

    return { dragging, gap, handleProps };
}

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

    /** Every row of the list, top to bottom: entries at the top, each folder followed by its pages. */
    const rows = items.flatMap((entry, index) => (isFolder(entry)
        ? [{ entry, path: { folder: null, index } }, ...entry.pages.map((p, i) => ({ entry: p, path: { folder: entry.folder, index: i } }))]
        : [{ entry, path: { folder: null, index } }]));

    /**
     * Moves an entry to where it was dropped in the list: before the row at `gap`, or at the end.
     * Dropped between the pages of a folder it joins that folder; a folder only moves at the top.
     * @param {EntryPath} from - Where it is.
     * @param {number} gap - The row it goes before.
     */
    const drop = (from, gap) => {
        const entry = entryAt(items, from);
        if (!entry) return;
        const before = rows[gap];
        let to = !before ? { folder: null, index: items.length } : before.path;
        if (to.folder !== null && (isFolder(entry) || to.index === 0)) {
            // Before a folder's first page, or a folder over a page in a folder: in front of that folder
            to = { folder: null, index: items.findIndex(e => isFolder(e) && e.folder === to.folder) };
        }
        // The new place counts without the entry itself
        const index = from.folder === to.folder && from.index < to.index ? to.index - 1 : to.index;
        if (from.folder === to.folder && index === from.index) return;
        arrange(moveEntry(items, from, { folder: to.folder, index }), entry);
    };

    const { dragging, gap, handleProps } = useRowDrag(drop);

    const row = ({ entry, path }, flat) => {
        const folder = isFolder(entry);
        const page = folder ? null : byKey.get(entry.page);
        const name = nameOf(entry);
        const isSelected = samePath(selected, path);
        const isDragged = dragging === flat;
        return (
            <li
                key={folder ? `f:${entry.folder}` : `p:${entry.page}`}
                data-row={flat}
                className={`sidebar-editor-row${path.folder ? ' is-nested' : ''}${folder ? ' is-folder' : ''}${isSelected ? ' is-selected' : ''}${isDragged ? ' is-dragging' : ''}${gap === flat && dragging !== null ? ' drop-before' : ''}${gap === rows.length && flat === rows.length - 1 && dragging !== null ? ' drop-after' : ''}`}
            >
                <span className="button-reset sidebar-editor-grip" {...handleProps(flat, path, name)}>
                    <GripVertical size={16} aria-hidden="true" />
                </span>
                <button
                    type="button"
                    className="button-reset sidebar-editor-row-main"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(isSelected ? null : path)}
                >
                    <span className="sidebar-editor-row-icon"><SidebarIcon entry={entry} name={name} /></span>
                    <span className="sidebar-editor-row-text">
                        <span className="sidebar-editor-row-name">{name}</span>
                        {folder && <span className="sidebar-editor-row-detail">{entry.pages.length} pages</span>}
                    </span>
                    {page?.hidden && <span className="sidebar-editor-row-tag" aria-label="Hidden page">Hidden</span>}
                    <ChevronRight className="sidebar-editor-row-chevron" size={16} aria-hidden="true" />
                </button>
            </li>
        );
    };

    /** Where the selected entry can go: up, down, into a folder or out of it. */
    const placement = () => {
        if (!selected || !selectedEntry) return null;
        const list = selected.folder === null ? items : folders.find(f => f.folder === selected.folder)?.pages ?? [];
        const name = nameOf(selectedEntry);
        const canStartFolder = selected.folder === null && items.some((e, i) => i > selected.index && !isFolder(e));
        return (
            <div className="sidebar-editor-placement">
                {!isFolder(selectedEntry) && (
                    <Field label="Folder">
                        <select
                            className="editor-input"
                            aria-label={`Folder of ${name}`}
                            value={selected.folder ?? NO_FOLDER}
                            onChange={(e) => setFolder(selected, e.target.value)}
                        >
                            <option value={NO_FOLDER}>None</option>
                            {folders.map(f => <option key={f.folder} value={f.folder}>{f.name || NEW_FOLDER_NAME}</option>)}
                            {canStartFolder && <option value={NEW_FOLDER}>New folder with the next page</option>}
                        </select>
                    </Field>
                )}
                <Field label="Order">
                    <span className="sidebar-editor-moves">
                        <button type="button" className="button-reset sidebar-editor-move" aria-label={`Move ${name} up`} disabled={selected.index === 0} onClick={() => move(selected, -1)}>
                            <ChevronUp size={18} aria-hidden="true" />Up
                        </button>
                        <button type="button" className="button-reset sidebar-editor-move" aria-label={`Move ${name} down`} disabled={selected.index === list.length - 1} onClick={() => move(selected, 1)}>
                            <ChevronDown size={18} aria-hidden="true" />Down
                        </button>
                    </span>
                </Field>
            </div>
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

                    <Group title="Pages and Folders" description="Drag the handles to reorder. Select a page or folder to change its icon, or to put a page in a folder.">
                        <ol className="sidebar-editor-list" aria-label="Pages and folders">
                            {rows.map((r, flat) => row(r, flat))}
                        </ol>
                        {onAddPage && (
                            <button type="button" className="button-reset icon-stage-add sidebar-editor-add" onClick={onAddPage}>
                                <Plus size={18} aria-hidden="true" />Add page
                            </button>
                        )}
                    </Group>

                    {selected && selectedEntry && (
                        <Group title={nameOf(selectedEntry)} description={isFolder(selectedEntry) ? 'A folder opens beside the sidebar with its pages.' : undefined}>
                            {placement()}
                        </Group>
                    )}
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
