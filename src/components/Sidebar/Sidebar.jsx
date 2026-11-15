import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import AppIcon from '../Shared/AppIcon';
import { summarizeNotices, useNotices } from '../../context/notices';
import { FOLDER_ICON, isFolder, mergeEntries, moveEntry, normalizeItems } from './sidebarModel';
import { useSidebarDrag } from './useSidebarDrag';
import './Sidebar.css';

const LEVEL_NAMES = { alert: 'alert', todo: 'to do', activity: 'running' };

/** How long a folder takes to close, in ms; the same as its closing animation in Sidebar.css. */
const CLOSE_MS = 160;

/**
 * @typedef {import('./sidebarModel').Entry} Entry
 * @typedef {import('./sidebarModel').EntryPath} EntryPath
 * @typedef {{key: string, index: number, name: string, hidden?: boolean}} SidebarPage
 */

/**
 * The icon of a page or folder: the one it was given, or else the page's first letter, or a
 * folder icon. An icon without a background of its own stands on the button's fill.
 * @param {Object} props
 * @param {Entry} props.entry - The page or folder.
 * @param {string} props.name - Its name.
 * @returns {JSX.Element} The icon.
 */
export const SidebarIcon = ({ entry, name }) => {
    const icon = entry.icon || (isFolder(entry) ? FOLDER_ICON : '');
    if (!icon) {
        return (
            <span className="sidebar-letter" style={entry.iconBackground ? { background: entry.iconBackground } : undefined} aria-hidden="true">
                {(name.trim()[0] || '?').toUpperCase()}
            </span>
        );
    }
    return <AppIcon icon={icon} background={entry.iconBackground || 'transparent'} color={entry.iconColor} className="sidebar-icon" size="100%" />;
};

/**
 * The colored bubble with the number of things that need attention: red for alerts, blue for
 * things to do, green for things that are running. The most urgent level wins.
 * @param {Object} props
 * @param {import('../../context/notices').NoticeSummary} props.summary - The notices.
 * @returns {JSX.Element|null} The bubble.
 */
export const NoticeBubble = ({ summary }) => (summary.level ? (
    <span className={`sidebar-badge is-${summary.level}`} aria-hidden="true">
        {summary.count > 99 ? '99+' : summary.count}
    </span>
) : null);

/**
 * Describes notices for assistive technology.
 * @param {import('../../context/notices').NoticeSummary} summary - The notices.
 * @returns {string} Such as ", 2 alert, 3 to do".
 */
const describe = (summary) => ['alert', 'todo', 'activity']
    .filter(level => summary[level] > 0)
    .map(level => `, ${summary[level]} ${LEVEL_NAMES[level]}`)
    .join('');

/**
 * The name of a page or folder and its notices, shown next to its icon on hover.
 * @param {Object} props
 * @param {string} props.name - The name.
 * @param {import('../../context/notices').NoticeSummary} props.summary - The notices.
 * @param {(key: string) => string} [props.pageName] - Names pages, for notices in a folder.
 * @returns {JSX.Element} The tooltip.
 */
const Tip = ({ name, summary, pageName }) => (
    <div className="sidebar-tip" role="tooltip">
        <div className="sidebar-tip-name">{name}</div>
        {summary.items.length > 0 && (
            <ul>
                {summary.items.map((n, i) => (
                    <li key={i}>
                        <span className={`sidebar-tip-dot is-${n.level}`} />
                        {pageName ? `${pageName(n.page)} · ` : ''}{n.title}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

/**
 * The sidebar: a floating rail of the dashboard's pages, with folders that open beside it.
 * Each icon shows a bubble when cards on its page publish notices (see `useCardNotice`); a
 * folder adds up its pages. While the dashboard is edited, icons can be dragged to reorder
 * them, dropped on each other to make a folder, and selected to change their icon.
 * @param {Object} props
 * @param {SidebarPage[]} props.pages - All pages, in dashboard order.
 * @param {number} props.activeIndex - Index of the page shown.
 * @param {(index: number) => void} props.onNavigate - Shows a page.
 * @param {Array<Object>} [props.items] - The stored arrangement (`sidebar.items`).
 * @param {boolean} [props.editing] - Whether the dashboard is edited.
 * @param {(items: Entry[]) => void} [props.onChange] - Receives the arrangement after a move.
 * @param {(path: EntryPath) => void} [props.onEditEntry] - Opens the editor of a page or folder.
 * @returns {JSX.Element} The sidebar.
 */
const Sidebar = ({ pages, activeIndex, onNavigate, items: stored, editing = false, onChange, onEditEntry }) => {
    const rootRef = useRef(null);
    const [openFolder, setOpenFolder] = useState(/** @type {string|null} */ (null));
    // A folder that was just closed stays a moment longer, for its closing animation
    const [closingFolder, setClosingFolder] = useState(/** @type {string|null} */ (null));
    const closeTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const [anchor, setAnchor] = useState(0);
    const notices = useNotices();

    const byKey = useMemo(() => new Map(pages.map(p => [p.key, p])), [pages]);
    const items = useMemo(() => normalizeItems(pages.map(p => p.key), stored), [pages, stored]);
    const activeKey = pages.find(p => p.index === activeIndex)?.key;
    const shown = (entry) => editing || !byKey.get(/** @type {any} */ (entry).page)?.hidden;
    const folderById = (id) => {
        const found = id ? items.find(e => isFolder(e) && e.folder === id) : undefined;
        return found && isFolder(found) ? found : null;
    };
    const folderOpen = folderById(openFolder);
    const folderClosing = folderOpen ? null : folderById(closingFolder);
    const flyout = folderOpen || folderClosing;
    const folderIndex = folderOpen ? items.indexOf(folderOpen) : -1;

    /**
     * Opens a folder, or closes the open one with its closing animation.
     * @param {string|null} id - The folder to open, or null to close.
     */
    const showFolder = (id) => {
        clearTimeout(closeTimer.current);
        if (id === null && openFolder) {
            setClosingFolder(openFolder);
            closeTimer.current = setTimeout(() => setClosingFolder(null), CLOSE_MS);
        } else {
            setClosingFolder(null);
        }
        setOpenFolder(id);
    };
    const closeFolder = useEffectEvent(() => showFolder(null));

    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const { drag, pressProps, consumeClick } = useSidebarDrag({
        rootRef,
        enabled: editing,
        onDrop: (from, target) => {
            const next = target.type === 'merge'
                ? mergeEntries(items, from, target.index)
                : moveEntry(items, from, { folder: target.folder, index: target.index });
            if (next !== items) onChange?.(next);
        },
    });

    // Closes the folder on a press outside the sidebar
    useEffect(() => {
        if (!openFolder) return undefined;
        const onDown = (e) => {
            if (!rootRef.current?.contains(e.target)) closeFolder();
        };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            const id = openFolder;
            closeFolder();
            /** @type {HTMLElement|null|undefined} */ (rootRef.current?.querySelector(`[data-sb-folder-button="${CSS.escape(id)}"]`))?.focus();
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [openFolder]);

    // The folder opens level with its icon
    useLayoutEffect(() => {
        if (!folderOpen) return undefined;
        const measure = () => {
            const button = rootRef.current?.querySelector(`[data-sb-folder-button="${CSS.escape(folderOpen.folder)}"]`);
            const root = rootRef.current?.getBoundingClientRect();
            const rect = button?.getBoundingClientRect();
            if (root && rect) setAnchor(rect.top + rect.height / 2 - root.top);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [folderOpen, items]);

    const nameOf = (key) => byKey.get(key)?.name ?? key;
    const summaryOf = (keys) => summarizeNotices(notices, keys);

    /**
     * Moves an entry one place with Shift and an arrow key while editing.
     * @param {import('react').KeyboardEvent} e - The key press.
     * @param {EntryPath} path - The entry.
     * @param {number} count - How many entries its list has.
     */
    const onMoveKey = (e, path, count) => {
        if (!editing || !e.shiftKey) return;
        const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
        const index = path.index + (step || 0);
        if (!step || index < 0 || index >= count) return;
        e.preventDefault();
        onChange?.(moveEntry(items, path, { folder: path.folder, index }));
        requestAnimationFrame(() => {
            const selector = `[data-sb-index="${index}"][data-sb-in="${path.folder ?? ''}"] button`;
            /** @type {HTMLElement|null|undefined} */ (rootRef.current?.querySelector(selector))?.focus();
        });
    };

    const markerClass = (folder, index) => {
        const marker = drag?.marker;
        return marker && marker.folder === folder && marker.index === index ? ` is-drop-${marker.side}` : '';
    };
    const placeholder = (folder, index) => (drag && (drag.from.folder ?? null) === folder && drag.from.index === index ? ' is-placeholder' : '');

    const pageButton = (entry, path, count, inFolder) => {
        const page = byKey.get(entry.page);
        const summary = summaryOf([entry.page]);
        const active = entry.page === activeKey;
        return (
            <div
                key={entry.page}
                className={`${inFolder ? 'sidebar-fly-item' : 'sidebar-item'}${active ? ' is-active' : ''}${page.hidden ? ' is-hidden-page' : ''}${markerClass(path.folder, path.index)}${placeholder(path.folder, path.index)}`}
                data-sb-index={path.index}
                data-sb-in={path.folder ?? ''}
            >
                <button
                    type="button"
                    className="button-reset sidebar-button"
                    aria-label={`${page.name}${describe(summary)}${editing ? ', edit icon' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    {...pressProps(path, false)}
                    onClick={() => {
                        if (consumeClick()) return;
                        if (editing) {
                            onEditEntry?.(path);
                            return;
                        }
                        showFolder(null);
                        onNavigate(page.index);
                    }}
                    onKeyDown={(e) => onMoveKey(e, path, count)}
                >
                    <span className="sidebar-tile"><SidebarIcon entry={entry} name={page.name} /></span>
                    <NoticeBubble summary={summary} />
                </button>
                {!editing && <Tip name={page.name} summary={summary} />}
            </div>
        );
    };

    const folderButton = (entry, index) => {
        const keys = entry.pages.filter(shown).map(p => p.page);
        const summary = summaryOf(keys);
        const open = openFolder === entry.folder;
        const holdsActive = keys.includes(activeKey);
        const name = entry.name || 'Folder';
        const path = { folder: null, index };
        return (
            <div
                key={entry.folder}
                className={`sidebar-item is-folder${open ? ' is-open' : ''}${holdsActive ? ' is-active' : ''}${markerClass(null, index)}${placeholder(null, index)}`}
                data-sb-index={index}
                data-sb-in=""
            >
                <button
                    type="button"
                    className="button-reset sidebar-button"
                    data-sb-folder-button={entry.folder}
                    aria-label={`${name}, folder with ${keys.length} pages${describe(summary)}`}
                    aria-expanded={open}
                    {...pressProps(path, true)}
                    onClick={() => {
                        if (consumeClick()) return;
                        showFolder(open ? null : entry.folder);
                    }}
                    onKeyDown={(e) => onMoveKey(e, path, items.length)}
                >
                    <span className="sidebar-tile"><SidebarIcon entry={entry} name={name} /></span>
                    <NoticeBubble summary={summary} />
                </button>
                {!open && !editing && <Tip name={name} summary={summary} pageName={nameOf} />}
            </div>
        );
    };

    return (
        <nav
            ref={rootRef}
            className={`sidebar${editing ? ' is-editing' : ''}${drag ? ' is-dragging' : ''}`}
            aria-label="Dashboards"
        >
            <div className="sidebar-rail" data-sb-root="">
                {items.map((entry, index) => {
                    if (isFolder(entry)) return entry.pages.some(shown) ? folderButton(entry, index) : null;
                    return shown(entry) ? pageButton(entry, { folder: null, index }, items.length, false) : null;
                })}
            </div>
            {flyout && (
                <div
                    key={flyout.folder}
                    className={`sidebar-flyout${folderClosing ? ' is-closing' : ''}`}
                    style={/** @type {import('react').CSSProperties} */ ({ '--sb-anchor': `${anchor}px` })}
                    role="group"
                    aria-label={flyout.name || 'Folder'}
                    aria-hidden={folderClosing ? true : undefined}
                    inert={folderClosing ? true : undefined}
                >
                    <div className="sidebar-flyout-row" data-sb-folder-list={folderOpen ? flyout.folder : undefined}>
                        {flyout.pages.map((entry, index) => (shown(entry)
                            ? pageButton(entry, { folder: flyout.folder, index }, flyout.pages.length, true)
                            : null))}
                        {editing && (
                            <div className="sidebar-fly-item sidebar-fly-edit">
                                <button
                                    type="button"
                                    className="button-reset sidebar-button"
                                    aria-label="Edit folder"
                                    title="Edit folder"
                                    onClick={() => onEditEntry?.({ folder: null, index: folderIndex })}
                                >
                                    <span className="sidebar-tile"><Pencil size={18} aria-hidden="true" /></span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Sidebar;
