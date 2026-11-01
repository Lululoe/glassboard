import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 5;
const TOUCH_HOLD_MS = 280;

/**
 * Creates ids for items, which have none of their own in the config.
 * @param {number} count - How many.
 * @returns {string[]} New ids.
 */
const newIds = (count) => Array.from({ length: count }, () => crypto.randomUUID());

/**
 * Keeps the operations on one list of apps or links together: moving, removing and inserting
 * also update the ids React and the move animation follow, and keep the selection on its item.
 * @param {Object} options
 * @param {string} options.name - Name of the list in the selection.
 * @param {Array<Object>} options.items - The items.
 * @param {(items: Array<Object>) => void} options.onChange - Receives the changed list.
 * @param {{list: string, index: number}|null} options.selection - The selected item.
 * @param {(selection: {list: string, index: number}|null) => void} options.onSelect - Changes the selection.
 * @returns {{name: string, items: Array<Object>, ids: string[], move: Function, removeAt: Function, insertAt: Function}} The list.
 */
export function useArrangedList({ name, items, onChange, selection, onSelect }) {
    const [ids, setIds] = useState(() => newIds(items.length));
    if (ids.length !== items.length) {
        setIds(ids.length < items.length
            ? [...ids, ...newIds(items.length - ids.length)]
            : ids.slice(0, items.length));
    }

    const selected = selection?.list === name ? selection.index : -1;

    const move = (from, to) => {
        const reorder = (list) => {
            const next = [...list];
            next.splice(to, 0, next.splice(from, 1)[0]);
            return next;
        };
        setIds(reorder(ids));
        onChange(reorder(items));
        if (selected === from) onSelect({ list: name, index: to });
        else if (selected > from && selected <= to) onSelect({ list: name, index: selected - 1 });
        else if (selected < from && selected >= to) onSelect({ list: name, index: selected + 1 });
    };

    const removeAt = (index) => {
        setIds(ids.filter((_, i) => i !== index));
        onChange(items.filter((_, i) => i !== index));
        if (selected === index) onSelect(null);
        else if (selected > index) onSelect({ list: name, index: selected - 1 });
    };

    const insertAt = (index, item, select = true) => {
        const put = (list, value) => [...list.slice(0, index), value, ...list.slice(index)];
        setIds(put(ids, crypto.randomUUID()));
        onChange(put(items, item));
        if (select) onSelect({ list: name, index });
    };

    return { name, items, ids, move, removeAt, insertAt };
}

/**
 * Direct manipulation of the items in a preview. A click selects, a small move starts a drag,
 * and on touch a short hold does, so a swipe still scrolls. While dragging, a copy of the item
 * follows the pointer and the list reorders under it. The keyboard offers the same: Enter
 * selects, the arrow keys move focus, Shift and an arrow key moves the item, Delete removes it.
 * @param {Object} options
 * @param {import('react').RefObject<HTMLElement>} options.rootRef - Element holding the items.
 * @param {Object<string, ReturnType<typeof useArrangedList>>} options.lists - The lists by name.
 * @param {{list: string, index: number}|null} options.selection - The selected item.
 * @param {(selection: {list: string, index: number}|null) => void} options.onSelect - Changes the selection.
 * @param {(list: string, index: number) => void} options.onRemove - Removes an item.
 * @returns {{dragging: {list: string, index: number}|null, itemProps: (list: string, index: number) => Object}} The drag state and props for each item.
 */
export function useArrangeable({ rootRef, lists, selection, onSelect, onRemove }) {
    const [dragging, setDragging] = useState(/** @type {{list: string, index: number}|null} */ (null));
    const press = useRef(null);
    const latest = useRef({ lists, selection, onSelect });

    useLayoutEffect(() => {
        latest.current = { lists, selection, onSelect };
    });

    useEffect(() => {
        /** Ends a press or drag and removes the copy that followed the pointer. */
        const finish = () => {
            clearTimeout(press.current?.hold);
            press.current?.ghost?.remove();
            press.current = null;
            setDragging(null);
        };

        /**
         * Starts dragging the pressed item, with a copy of it on the dialog so the card's
         * rounded clip doesn't cut it off.
         */
        const startDrag = () => {
            const current = press.current;
            const dialog = current.element.closest('dialog') || document.body;
            const rect = current.element.getBoundingClientRect();
            const ghost = current.element.cloneNode(true);
            ghost.querySelector('.app-name, .launcher-app-name')?.remove();
            ghost.removeAttribute('role');
            ghost.removeAttribute('tabindex');
            ghost.classList.add('arrange-ghost');
            Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px` });
            dialog.append(ghost);
            current.ghost = ghost;
            current.offsetX = current.x - rect.left;
            current.offsetY = current.y - rect.top;
            setDragging({ list: current.list, index: current.index });
        };

        /** Places the copy at the pointer and reorders towards the nearest item. */
        const follow = (x, y) => {
            const current = press.current;
            const area = (current.element.closest('dialog') || document.body).getBoundingClientRect();
            current.ghost.style.left = `${x - area.left - current.offsetX}px`;
            current.ghost.style.top = `${y - area.top - current.offsetY}px`;

            let nearest = -1;
            let distance = Infinity;
            rootRef.current?.querySelectorAll(`[data-arrange-list="${current.list}"]`).forEach((/** @type {HTMLElement} */ el) => {
                const r = el.getBoundingClientRect();
                const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
                if (d < distance) {
                    distance = d;
                    nearest = Number(el.dataset.arrangeIndex);
                }
            });
            if (nearest < 0 || nearest === current.index) return;
            latest.current.lists[current.list].move(current.index, nearest);
            current.index = nearest;
            setDragging({ list: current.list, index: nearest });
        };

        const onMove = (e) => {
            const current = press.current;
            if (!current) return;
            if (!current.ghost) {
                const moved = Math.hypot(e.clientX - current.x, e.clientY - current.y) >= DRAG_THRESHOLD;
                if (current.touch && !current.held) {
                    if (moved) finish();
                    return;
                }
                if (!current.touch && !moved) return;
                startDrag();
            }
            follow(e.clientX, e.clientY);
        };

        const onUp = () => {
            const current = press.current;
            if (!current) return;
            const { list, index, ghost } = current;
            const { selection: selected, onSelect: select } = latest.current;
            const same = selected?.list === list && selected.index === index;
            finish();
            if (ghost) select({ list, index });
            else select(same ? null : { list, index });
        };

        /** Stops the page scrolling under a touch drag; the browser only allows this while dragging. */
        const onTouchMove = (e) => {
            if (press.current?.ghost) e.preventDefault();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', finish);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', finish);
            window.removeEventListener('touchmove', onTouchMove);
            finish();
        };
    }, [rootRef]);

    const itemProps = (list, index) => ({
        role: 'button',
        tabIndex: 0,
        'data-arrange-list': list,
        'data-arrange-index': index,
        'aria-pressed': selection?.list === list && selection.index === index,
        onPointerDown: (e) => {
            if (e.button) return;
            const touch = e.pointerType === 'touch';
            const element = e.currentTarget;
            press.current = { list, index, element, x: e.clientX, y: e.clientY, touch, held: false, ghost: null };
            if (touch) {
                press.current.hold = setTimeout(() => {
                    if (press.current) press.current.held = true;
                }, TOUCH_HOLD_MS);
            }
        },
        onKeyDown: (e) => {
            const items = lists[list].items.length;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const same = selection?.list === list && selection.index === index;
                onSelect(same ? null : { list, index });
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onRemove(list, index);
            } else {
                const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
                const target = index + (direction || 0);
                if (!direction || target < 0 || target >= items) return;
                e.preventDefault();
                if (e.shiftKey) lists[list].move(index, target);
                const refocus = () => /** @type {HTMLElement|null|undefined} */ (rootRef.current
                    ?.querySelector(`[data-arrange-list="${list}"][data-arrange-index="${target}"]`))
                    ?.focus();
                if (e.shiftKey) requestAnimationFrame(refocus);
                else refocus();
            }
        },
    });

    return { dragging, itemProps };
}

/**
 * Animates elements carrying `data-flip-id` from where they were to where they are now.
 * @param {import('react').RefObject<HTMLElement>} rootRef - Element holding them.
 * @param {number} zoom - CSS zoom of that element, which transforms are multiplied by.
 */
export function useMoveAnimation(rootRef, zoom = 1) {
    const before = useRef(new Map());

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const now = new Map();
        root.querySelectorAll('[data-flip-id]').forEach((/** @type {HTMLElement} */ el) => {
            const rect = el.getBoundingClientRect();
            now.set(el.dataset.flipId, rect);
            const old = before.current.get(el.dataset.flipId);
            if (reduced || !el.animate) return;
            if (!old) {
                if (before.current.size > 0) {
                    el.animate([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
                }
                return;
            }
            const dx = old.left - rect.left;
            const dy = old.top - rect.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            el.animate([{ transform: `translate(${dx / zoom}px, ${dy / zoom}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        });
        before.current = now;
    });
}
