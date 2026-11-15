import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 5;

/** Part of an icon, from its middle, where dropping makes a folder instead of moving it next to it. */
const MERGE_ZONE = 0.28;

/**
 * @typedef {import('./sidebarModel').EntryPath} EntryPath
 * @typedef {{type: 'insert', folder: string|null, index: number} | {type: 'merge', index: number}} DropTarget
 * @typedef {{folder: string|null, index: number, side: 'before'|'after'|'merge'}} DropMarker
 */

/**
 * Whether a point is inside a rectangle grown by a margin.
 * @param {DOMRect} rect - The rectangle.
 * @param {number} x - Horizontal position.
 * @param {number} y - Vertical position.
 * @param {number} margin - How far around it still counts.
 * @returns {boolean} Whether the point is inside.
 */
const inside = (rect, x, y, margin) => x >= rect.left - margin && x <= rect.right + margin
    && y >= rect.top - margin && y <= rect.bottom + margin;

/**
 * Works out where a dragged entry would land: next to other entries in the list under the
 * pointer, or, over the middle of an entry at the top, into a folder with it.
 * @param {HTMLElement} root - The sidebar.
 * @param {number} x - Pointer position.
 * @param {number} y - Pointer position.
 * @param {EntryPath} from - Where the dragged entry is.
 * @param {boolean} draggingFolder - Whether it is a folder, which can't go into folders.
 * @returns {{target: DropTarget, marker: DropMarker|null}|null} The drop, or null when it would land nowhere.
 */
export function dropAt(root, x, y, from, draggingFolder) {
    const flyout = /** @type {HTMLElement|null} */ (root.querySelector('[data-sb-folder-list]'));
    const rail = /** @type {HTMLElement|null} */ (root.querySelector('[data-sb-root]'));
    let list = null;
    let folder = null;
    if (flyout && inside(flyout.getBoundingClientRect(), x, y, 12)) {
        if (draggingFolder) return null;
        list = flyout;
        folder = flyout.dataset.sbFolderList;
    } else if (rail && inside(rail.getBoundingClientRect(), x, y, 48)) {
        list = rail;
    }
    if (!list) return null;

    const horizontal = getComputedStyle(list).flexDirection.startsWith('row');
    const along = horizontal ? x : y;
    const across = horizontal ? y : x;
    const sameList = (from.folder ?? null) === folder;
    const items = [...list.querySelectorAll(':scope > [data-sb-index]')]
        .map((/** @type {HTMLElement} */ el) => ({ index: Number(el.dataset.sbIndex), rect: el.getBoundingClientRect() }))
        .filter(item => !(sameList && item.index === from.index));

    if (folder === null && !draggingFolder) {
        for (const item of items) {
            const start = horizontal ? item.rect.left : item.rect.top;
            const size = horizontal ? item.rect.width : item.rect.height;
            const crossStart = horizontal ? item.rect.top : item.rect.left;
            const crossSize = horizontal ? item.rect.height : item.rect.width;
            const middle = start + size / 2;
            if (Math.abs(along - middle) <= size * MERGE_ZONE && across >= crossStart && across <= crossStart + crossSize) {
                return { target: { type: 'merge', index: item.index }, marker: { folder: null, index: item.index, side: 'merge' } };
            }
        }
    }

    const position = items.filter(item => along > (horizontal ? item.rect.left + item.rect.width / 2 : item.rect.top + item.rect.height / 2)).length;
    const target = /** @type {DropTarget} */ ({ type: 'insert', folder, index: position });
    if (sameList && position === from.index) return { target, marker: null };
    const marker = items.length === 0 ? null
        : position < items.length
            ? { folder, index: items[position].index, side: /** @type {'before'} */ ('before') }
            : { folder, index: items[items.length - 1].index, side: /** @type {'after'} */ ('after') };
    return { target, marker };
}

/**
 * Drag and drop of the sidebar's icons while the dashboard is edited. A press that moves a
 * few pixels picks the icon up; a copy follows the pointer and a marker shows where it would
 * land. Dropping on the middle of an icon makes a folder, dropping between icons moves it.
 * Escape cancels.
 * @param {Object} options
 * @param {import('react').RefObject<HTMLElement>} options.rootRef - The sidebar.
 * @param {boolean} options.enabled - Whether icons can be dragged.
 * @param {(from: EntryPath, target: DropTarget) => void} options.onDrop - Applies a drop.
 * @returns {{drag: {from: EntryPath, marker: DropMarker|null}|null, pressProps: (path: EntryPath, isFolder: boolean) => Object, consumeClick: () => boolean}}
 *   The drag in progress, props for each icon, and a check that swallows the click ending a drag.
 */
export function useSidebarDrag({ rootRef, enabled, onDrop }) {
    const [drag, setDrag] = useState(/** @type {{from: EntryPath, marker: DropMarker|null}|null} */ (null));
    const press = useRef(null);
    const dragged = useRef(false);
    const latest = useRef({ onDrop });

    useLayoutEffect(() => {
        latest.current = { onDrop };
    });

    useEffect(() => {
        if (!enabled) return undefined;

        /** Ends a press or drag and removes the copy that followed the pointer. */
        const finish = () => {
            press.current?.ghost?.remove();
            press.current = null;
            setDrag(null);
        };

        /** Picks up the pressed icon, with a copy of it that follows the pointer. */
        const start = () => {
            const current = press.current;
            const rect = current.element.getBoundingClientRect();
            const ghost = current.element.cloneNode(true);
            ghost.classList.add('sidebar-ghost');
            ghost.removeAttribute('id');
            Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px` });
            document.body.append(ghost);
            current.ghost = ghost;
            current.offsetX = current.x - rect.left;
            current.offsetY = current.y - rect.top;
            setDrag({ from: current.from, marker: null });
        };

        const onMove = (e) => {
            const current = press.current;
            if (!current) return;
            if (!current.ghost) {
                if (Math.hypot(e.clientX - current.x, e.clientY - current.y) < DRAG_THRESHOLD) return;
                start();
            }
            current.ghost.style.left = `${e.clientX - current.offsetX}px`;
            current.ghost.style.top = `${e.clientY - current.offsetY}px`;
            const drop = rootRef.current ? dropAt(rootRef.current, e.clientX, e.clientY, current.from, current.isFolder) : null;
            current.target = drop?.target ?? null;
            const marker = drop?.marker ?? null;
            setDrag(prev => (prev && JSON.stringify(prev.marker) === JSON.stringify(marker) ? prev : { from: current.from, marker }));
        };

        const onUp = () => {
            const current = press.current;
            if (!current) return;
            if (current.ghost) {
                dragged.current = true;
                setTimeout(() => { dragged.current = false; }, 0);
                if (current.target) latest.current.onDrop(current.from, current.target);
            }
            finish();
        };

        const onKey = (e) => {
            if (e.key === 'Escape' && press.current?.ghost) {
                e.stopPropagation();
                finish();
            }
        };

        // Stops the page from scrolling under a touch drag
        const onTouchMove = (e) => {
            if (press.current?.ghost) e.preventDefault();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', finish);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', finish);
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('touchmove', onTouchMove);
            finish();
        };
    }, [enabled, rootRef]);

    const pressProps = (path, isFolder) => (enabled ? {
        onPointerDown: (e) => {
            if (e.button) return;
            press.current = { from: path, isFolder, element: e.currentTarget, x: e.clientX, y: e.clientY, ghost: null, target: null };
        },
    } : {});

    /**
     * Tells whether a click is the end of a drag, which should not also select the icon.
     * @returns {boolean} True right after a drag.
     */
    const consumeClick = () => {
        if (!dragged.current) return false;
        dragged.current = false;
        return true;
    };

    return { drag, pressProps, consumeClick };
}
