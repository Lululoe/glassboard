import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EyeOff, Pencil } from 'lucide-react';
import { getCardComponent, getCardSizes } from '../../features/registry';
import { useGridColumns } from '../../hooks/useGridColumns';
import CardErrorBoundary from './CardErrorBoundary';
import {
    DEVICES, buildEntries, deviceFor, fitToColumns, isHiddenAt, isSubTile, moveItem, nearestSize, sizeLabel, sizeOf,
    usableSizes, withSize,
} from './gridLayout';
import './BentoGrid.css';

const LONG_PRESS_MS = 550;
const TOUCH_LIFT_MS = 220;
const DRAG_THRESHOLD = 6;
const SWAP_COOLDOWN_MS = 180;
const EDGE_SCROLL_ZONE = 70;
const EDGE_PAGE_ZONE = 48;
const EDGE_DWELL_MS = 650;
const INTERACTIVE = 'button, a, input, select, textarea, [role="slider"], [role="button"], [contenteditable="true"]';

/**
 * Current time for gesture timing. Only called from event handlers.
 * @returns {number} Milliseconds since page load.
 */
const now = () => performance.now();

/**
 * Fallback rendered when a card's type is not registered.
 * @param {Object} props
 * @param {string} [props.type] - The configured card type.
 * @returns {JSX.Element} The fallback card UI.
 */
const FallbackCard = ({ type }) => (
    <div className="glass-card">
        <div className="card-content">
            {type ? `Unknown card type "${type}"` : 'Card is missing a type'}
        </div>
    </div>
);

/**
 * Returns a stable key for a card: its id, or its position for cards without one.
 * @param {Object} card - The card config.
 * @param {number} index - Position of the card.
 * @returns {string} The key.
 */
const keyOf = (card, index) => (card.id !== undefined ? `id:${card.id}` : `idx:${index}`);

/**
 * Builds an attribute selector for a card key.
 * @param {string} key - The card key.
 * @returns {string} A `[data-key="…"]` selector.
 */
const byKey = (key) => `[data-key="${window.CSS?.escape ? CSS.escape(key) : key.replace(/["\\]/g, '\\$&')}"]`;

/**
 * Whether the user asked for reduced motion.
 * @returns {boolean} True when animations should be skipped.
 */
const prefersReducedMotion = () => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Finds the nearest scrollable ancestor, used to scroll while dragging near an edge.
 * @param {Element|null} el - Start element.
 * @returns {Element|null} The scroll container.
 */
function scrollParent(el) {
    for (let node = el?.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return document.scrollingElement;
}

/**
 * Renders a grid of dashboard cards. Full-height cards span one to three columns; half and
 * quarter cards share square slots. On narrow screens the grid drops to two or one columns
 * and wide cards are narrowed to fit.
 *
 * In edit mode the cards wiggle and can be dragged to a new position, resized with the
 * corner handle, or moved and resized from the keyboard. Every change is reported through
 * `onLayoutChange`; the caller decides when to save.
 * @param {Object} props
 * @param {Array<Object>} [props.cards] - Card configs for this page.
 * @param {Object} [props.globalConfig] - The full dashboard config, passed to every card.
 * @param {boolean} [props.editing=false] - Whether edit mode is on.
 * @param {(cards: Array<Object>) => void} [props.onLayoutChange] - Receives the cards in their new order and size.
 * @param {() => void} [props.onRequestEdit] - Called on a long press; omit to disable entering edit mode that way.
 * @param {() => void} [props.onExitEdit] - Called when the user taps the background or presses Escape in edit mode.
 * @param {(index: number) => void} [props.onEditCard] - Opens the editor for a card; shows an edit button on each card.
 * @param {(direction: -1|1) => boolean} [props.canMoveToPage] - Whether a dragged card can go to the previous/next page.
 * @param {(direction: -1|1, index: number, carry: Object) => void} [props.onMoveToPage] - Moves the dragged card to
 *   the previous/next page when it is held at the screen edge. `carry` lets that page's grid continue the drag.
 * @param {Object|null} [props.incomingDrag] - A drag carried over from another page, to continue here.
 * @param {() => void} [props.onIncomingDragTaken] - Called once this grid has picked up `incomingDrag`.
 * @returns {JSX.Element|null} The rendered grid, or null when there are no cards.
 */
const BentoGrid = ({
    cards, globalConfig, editing = false, onLayoutChange, onRequestEdit, onExitEdit, onEditCard,
    canMoveToPage, onMoveToPage, incomingDrag, onIncomingDragTaken,
}) => {
    const gridRef = useRef(null);
    const columns = useGridColumns(gridRef);
    const cardsRef = useRef(cards);
    const dragRef = useRef(null);
    const flipRef = useRef(null);
    const focusKeyRef = useRef(null);
    const pressRef = useRef(null);
    const dragEndedRef = useRef(0);
    const beginRef = useRef(null);
    const [dragKey, setDragKey] = useState(null);
    const [edgeHint, setEdgeHint] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [settled, setSettled] = useState(false);

    // Once edit mode has been used, leaving it must not replay the entrance animation
    if (editing && !settled) setSettled(true);

    useLayoutEffect(() => {
        cardsRef.current = cards;
    });

    /** Records every card's position so the next layout change can animate from it. */
    const captureFlip = () => {
        if (!gridRef.current || prefersReducedMotion()) return;
        const rects = new Map();
        gridRef.current.querySelectorAll('[data-key]').forEach(el => rects.set(el.dataset.key, el.getBoundingClientRect()));
        flipRef.current = rects;
    };

    /** Moves the dragged card under the pointer, measured from its untransformed position. */
    const positionDragged = () => {
        const d = dragRef.current;
        const el = d?.started && d.mode === 'move' && gridRef.current?.querySelector(byKey(d.key));
        if (!el) return;
        el.style.transform = 'none';
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${d.x - d.grabX - r.left}px, ${d.y - d.grabY - r.top}px) scale(1.04)`;
    };

    // After each render: animate cards to their new places, keep the dragged card under
    // the pointer and restore keyboard focus to a card that was moved.
    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        const before = flipRef.current;
        flipRef.current = null;
        if (before) {
            grid.querySelectorAll('[data-key]').forEach(el => {
                const d = dragRef.current;
                if (d?.started && d.mode === 'move' && el.dataset.key === d.key) return;
                const b = before.get(el.dataset.key);
                if (!b || typeof el.animate !== 'function') return;
                const a = el.getBoundingClientRect();
                const dx = b.left - a.left;
                const dy = b.top - a.top;
                const sx = a.width ? b.width / a.width : 1;
                const sy = a.height ? b.height / a.height : 1;
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
                el.animate(
                    [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'none' }],
                    { duration: 280, easing: 'cubic-bezier(0.32, 0.08, 0.24, 1)' },
                );
            });
        }
        positionDragged();
        if (focusKeyRef.current) {
            grid.querySelector(`${byKey(focusKeyRef.current)} .grid-edit-surface`)?.focus();
            focusKeyRef.current = null;
        }
    });

    // Stop a drag cleanly when edit mode ends underneath it.
    useEffect(() => {
        if (!editing) {
            dragRef.current?.cleanup?.();
            dragRef.current = null;
        }
    }, [editing]);

    useEffect(() => () => {
        dragRef.current?.cleanup?.();
        clearTimeout(pressRef.current?.timer);
    }, []);

    const list = Array.isArray(cards) ? cards : [];

    // Cards hidden at this screen size stay visible (dimmed) while editing, so they can be managed
    const entries = buildEntries(list, editing ? undefined : (card) => !isHiddenAt(card, columns));
    const device = deviceFor(columns);
    const announce = (text) => setAnnouncement(text);
    const nameOf = (card) => String(card.name || card.title || card.id || card.type || 'card');

    /**
     * Reports a new layout and remembers positions for the move animation.
     * @param {Array<Object>} next - The cards in their new order and size.
     */
    const commit = (next) => {
        captureFlip();
        onLayoutChange?.(next);
    };

    const moveBy = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= cards.length) return;
        focusKeyRef.current = keyOf(cards[index], index);
        commit(moveItem(cards, index, target));
        announce(`${nameOf(cards[index])} moved to position ${target + 1} of ${cards.length}`);
    };

    const resizeTo = (index, size) => {
        const card = cards[index];
        if (size === sizeOf(card)) return;
        focusKeyRef.current = keyOf(card, index);
        commit(cards.map((c, i) => (i === index ? withSize(c, size) : c)));
        announce(`${nameOf(card)} is now ${sizeLabel(size)}`);
    };

    const stepSize = (index, delta) => {
        const sizes = usableSizes(getCardSizes(cards[index].type), columns);
        const current = sizes.indexOf(sizeOf(fitToColumns(cards[index], columns)));
        const next = sizes[(current + delta + sizes.length) % sizes.length];
        if (next) resizeTo(index, next);
    };

    /** Swaps the dragged card with the card under the pointer, or moves it to the end. */
    const hitTest = () => {
        const d = dragRef.current;
        const grid = gridRef.current;
        if (!d?.started || !grid || now() - d.lastSwap < SWAP_COOLDOWN_MS) return;
        const list = cardsRef.current;
        const hit = /** @type {HTMLElement|null} */ (document.elementFromPoint(d.x, d.y)?.closest?.('[data-grid-index]'));
        let target = null;

        if (hit && grid.contains(hit)) {
            const r = hit.getBoundingClientRect();
            const inset = Math.min(r.width, r.height) * 0.15;
            const inside = d.x > r.left + inset && d.x < r.right - inset && d.y > r.top + inset && d.y < r.bottom - inset;
            if (inside) target = Number(hit.dataset.gridIndex);
        } else {
            const items = [...grid.querySelectorAll('[data-grid-index]')];
            const last = items.reduce((a, el) => {
                const r = el.getBoundingClientRect();
                return !a || r.bottom > a.bottom || (r.bottom === a.bottom && r.right > a.right) ? r : a;
            }, null);
            const gridRect = grid.getBoundingClientRect();
            if (last && d.x >= gridRect.left && d.x <= gridRect.right
                && (d.y > last.bottom || (d.y > last.top && d.x > last.right))) {
                target = list.length - 1;
            }
        }

        if (target === null || target === d.index) return;
        d.lastSwap = now();
        commit(moveItem(list, d.index, target));
        d.index = target;
        announce(`Moved to position ${target + 1} of ${list.length}`);
    };

    /** Scrolls the page while a dragged card is held near the top or bottom edge. */
    const autoScroll = () => {
        const d = dragRef.current;
        if (!d?.started) return;
        const scroller = d.scroller;
        if (scroller) {
            const bounds = scroller === document.scrollingElement
                ? { top: 0, bottom: window.innerHeight }
                : scroller.getBoundingClientRect();
            let speed = 0;
            if (d.y < bounds.top + EDGE_SCROLL_ZONE) speed = -Math.ceil((bounds.top + EDGE_SCROLL_ZONE - d.y) / 6);
            else if (d.y > bounds.bottom - EDGE_SCROLL_ZONE) speed = Math.ceil((d.y - bounds.bottom + EDGE_SCROLL_ZONE) / 6);
            if (speed) {
                scroller.scrollTop += speed;
                positionDragged();
                hitTest();
            }
        }

        // Holding a card at the left or right edge carries it to the previous or next page
        const edge = d.x < EDGE_PAGE_ZONE ? -1 : d.x > window.innerWidth - EDGE_PAGE_ZONE ? 1 : 0;
        const card = cardsRef.current[d.index];
        if (edge && card?.id !== undefined && canMoveToPage?.(edge)) {
            if (d.edge !== edge) {
                d.edge = edge;
                d.edgeSince = now();
                setEdgeHint(edge);
            } else if (now() - d.edgeSince > EDGE_DWELL_MS) {
                const carry = { key: d.key, pointerId: d.pointerId, x: d.x, y: d.y, grabX: d.grabX, grabY: d.grabY };
                const from = d.index;
                d.handedOff = true;
                d.cleanup();
                setEdgeHint(0);
                onMoveToPage?.(edge, from, carry);
                announce(`Moved to the ${edge < 0 ? 'previous' : 'next'} page`);
                return;
            }
        } else if (d.edge) {
            d.edge = 0;
            setEdgeHint(0);
        }
        d.frame = requestAnimationFrame(autoScroll);
    };

    /**
     * Starts tracking a pointer on a card in edit mode: a drag moves the card, a resize
     * drag on the corner handle changes its size, and a tap on the handle cycles sizes.
     * @param {import('react').PointerEvent<HTMLElement>} e - The pointerdown event.
     * @param {number} index - The card's position.
     * @param {'move'|'resize'} mode - What the gesture does.
     */
    const startGesture = (e, index, mode) => {
        if (e.button !== 0 || dragRef.current) return;
        e.stopPropagation();
        const rect = e.currentTarget.closest('[data-key]').getBoundingClientRect();
        beginGesture({
            mode,
            index,
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            grabX: e.clientX - rect.left,
            grabY: e.clientY - rect.top,
            // A finger has to rest briefly before a card lifts, so a quick swipe still scrolls
            liftAt: e.pointerType === 'touch' && mode === 'move' ? now() + TOUCH_LIFT_MS : 0,
        });
    };

    /**
     * Tracks a move or resize gesture until the pointer is released.
     * @param {Object} opts
     * @param {'move'|'resize'} opts.mode - What the gesture does.
     * @param {number} opts.index - The card's position.
     * @param {number} opts.pointerId - The pointer being followed.
     * @param {number} opts.x - Pointer x.
     * @param {number} opts.y - Pointer y.
     * @param {number} opts.grabX - Pointer offset from the card's left edge.
     * @param {number} opts.grabY - Pointer offset from the card's top edge.
     * @param {number} [opts.liftAt] - Time before which moving cancels the gesture (touch).
     * @param {boolean} [opts.started] - Whether the card is already lifted (a drag carried from another page).
     */
    const beginGesture = ({ mode, index, pointerId, x, y, grabX, grabY, liftAt = 0, started = false }) => {
        const card = cardsRef.current[index];
        const item = gridRef.current.querySelector(byKey(keyOf(card, index)));
        const rect = item.getBoundingClientRect();
        const styles = getComputedStyle(gridRef.current);
        const tile = parseFloat(styles.gridAutoRows) || rect.height;
        const gap = parseFloat(styles.rowGap) || 0;

        const d = {
            mode,
            key: keyOf(card, index),
            index,
            pointerId,
            startX: x,
            startY: y,
            x,
            y,
            grabX,
            grabY,
            anchor: rect,
            pitch: (tile - gap) / 2 + gap,
            gap,
            started: false,
            lastSwap: 0,
            liftAt,
            scroller: scrollParent(gridRef.current),
            frame: 0,
            edge: 0,
            edgeSince: 0,
            handedOff: false,
            cleanup: () => {},
        };

        const begin = () => {
            d.started = true;
            if (mode === 'move') {
                setDragKey(d.key);
                d.frame = requestAnimationFrame(autoScroll);
                navigator.vibrate?.(8);
            }
        };

        const onMove = (ev) => {
            if (ev.pointerId !== d.pointerId) return;
            d.x = ev.clientX;
            d.y = ev.clientY;
            if (!d.started) {
                const far = Math.hypot(d.x - d.startX, d.y - d.startY) > DRAG_THRESHOLD;
                if (!far) return;
                if (d.liftAt && now() < d.liftAt) {
                    // Moved before the card lifted: let the page scroll instead
                    cleanup();
                    return;
                }
                begin();
            }
            if (mode === 'move') {
                positionDragged();
                hitTest();
            } else {
                const list = cardsRef.current;
                const sizes = usableSizes(getCardSizes(list[d.index].type), columns);
                const w = (d.x - d.anchor.left + d.gap) / d.pitch;
                const h = (d.y - d.anchor.top + d.gap) / d.pitch;
                const size = nearestSize(sizes, w, h);
                if (size !== sizeOf(fitToColumns(list[d.index], columns))) {
                    commit(list.map((c, i) => (i === d.index ? withSize(c, size) : c)));
                    announce(`${nameOf(list[d.index])} is now ${sizeLabel(size)}`);
                }
            }
        };

        // Once a card has lifted, keep the browser from scrolling under the finger
        const onTouchMove = (ev) => {
            if (d.started || (d.liftAt && now() >= d.liftAt)) ev.preventDefault();
        };

        const onUp = (ev) => {
            if (ev.pointerId !== d.pointerId) return;
            const tapped = !d.started && ev.type === 'pointerup';
            cleanup();
            if (tapped && mode === 'resize') stepSize(d.index, 1);
        };

        function cleanup() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('touchmove', onTouchMove);
            cancelAnimationFrame(d.frame);
            if (d.started && mode === 'move') {
                const el = gridRef.current?.querySelector(byKey(d.key));
                if (el) {
                    const from = el.style.transform;
                    el.style.transform = '';
                    if (!d.handedOff && from && from !== 'none' && typeof el.animate === 'function' && !prefersReducedMotion()) {
                        el.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.32, 0.08, 0.24, 1)' });
                    }
                }
                setDragKey(null);
                setEdgeHint(0);
            }
            if (d.started) dragEndedRef.current = now();
            if (dragRef.current === d) dragRef.current = null;
        }

        d.cleanup = cleanup;
        dragRef.current = d;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        if (started) {
            begin();
            positionDragged();
        }
    };

    useLayoutEffect(() => {
        beginRef.current = beginGesture;
    });

    // Continue a drag that started on another page and was carried here at the screen edge
    useLayoutEffect(() => {
        if (!incomingDrag || !editing || dragRef.current) return;
        const index = (cardsRef.current || []).findIndex((c, i) => keyOf(c, i) === incomingDrag.key);
        if (index < 0) return;
        onIncomingDragTaken?.();
        beginRef.current?.({ ...incomingDrag, index, mode: 'move', started: true });
    }, [incomingDrag, editing, onIncomingDragTaken]);

    const onSurfaceKeyDown = (e, index) => {
        const keys = {
            ArrowLeft: () => moveBy(index, -1),
            ArrowUp: () => moveBy(index, -1),
            ArrowRight: () => moveBy(index, 1),
            ArrowDown: () => moveBy(index, 1),
            '+': () => stepSize(index, 1),
            '=': () => stepSize(index, 1),
            '-': () => stepSize(index, -1),
            Escape: () => onExitEdit?.(),
        };
        if (!keys[e.key]) return;
        e.preventDefault();
        e.stopPropagation();
        keys[e.key]();
    };

    /** Long press on a card (outside its controls) turns on edit mode. */
    const onItemPointerDown = (e) => {
        if (editing || !onRequestEdit || e.button !== 0 || /** @type {Element} */ (e.target).closest(INTERACTIVE)) return;
        const press = { x: e.clientX, y: e.clientY, id: e.pointerId };
        const cancel = () => {
            clearTimeout(press.timer);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', cancel);
            window.removeEventListener('pointercancel', cancel);
        };
        const onMove = (ev) => {
            if (ev.pointerId === press.id && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 10) cancel();
        };
        press.timer = setTimeout(() => {
            cancel();
            navigator.vibrate?.(10);
            onRequestEdit();
        }, LONG_PRESS_MS);
        clearTimeout(pressRef.current?.timer);
        pressRef.current = press;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', cancel);
        window.addEventListener('pointercancel', cancel);
    };

    const renderItem = (index, place) => {
        const card = cards[index];
        const shown = fitToColumns(card, columns);
        const size = sizeOf(shown);
        const key = keyOf(card, index);
        const CardComponent = getCardComponent(card.type);
        const sizes = usableSizes(getCardSizes(card.type), columns);

        /** @type {import('react').CSSProperties & Object<string, string|number>} */
        const style = { '--i': index };
        if (card.primaryColor) style['--card-primary'] = card.primaryColor;
        if (place) {
            style.gridColumn = `${place.col + 1} / span ${place.w}`;
            style.gridRow = `${place.row + 1} / span ${place.h}`;
        }

        const hiddenHere = isHiddenAt(card, columns);
        const className = [
            'grid-item',
            `col-span-${isSubTile(size) ? 1 : size}`,
            isSubTile(size) && `tile-${size}`,
            dragKey === key && 'dragging',
            hiddenHere && 'hidden-here',
        ].filter(Boolean).join(' ');

        return (
            <div
                key={key}
                data-key={key}
                data-grid-index={index}
                className={className}
                style={style}
                onPointerDown={onItemPointerDown}
                onContextMenu={editing ? (e) => e.preventDefault() : undefined}
            >
                <div className="grid-item-body" inert={editing || undefined}>
                    <CardErrorBoundary label={card.id ?? card.type} resetKey={shown}>
                        {CardComponent
                            ? <CardComponent config={shown} globalConfig={globalConfig} />
                            : <FallbackCard type={card.type} />}
                    </CardErrorBoundary>
                </div>
                {editing && (
                    <>
                        <div
                            className="grid-edit-surface"
                            role="button"
                            tabIndex={0}
                            aria-roledescription="movable card"
                            aria-label={`${nameOf(card)}, ${sizeLabel(size)}${hiddenHere ? `, hidden on ${device}` : ''}, position ${index + 1} of ${cards.length}. Arrow keys move, plus and minus resize.`}
                            onPointerDown={(e) => startGesture(e, index, 'move')}
                            onKeyDown={(e) => onSurfaceKeyDown(e, index)}
                        />
                        {onEditCard && (
                            <button
                                type="button"
                                className="button-reset grid-edit-button"
                                aria-label={`Edit ${nameOf(card)}`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onEditCard(index)}
                            >
                                <Pencil size={14} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                        )}
                        {hiddenHere && (
                            <span className="grid-hidden-badge">
                                <EyeOff size={13} aria-hidden="true" />
                                Hidden on {DEVICES.find(dv => dv.key === device)?.label.toLowerCase()}
                            </span>
                        )}
                        {sizes.length > 1 && (
                            <button
                                type="button"
                                className="button-reset grid-resize-handle"
                                aria-label={`Resize ${nameOf(card)}, now ${sizeLabel(size)}`}
                                onPointerDown={(e) => startGesture(e, index, 'resize')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        stepSize(index, 1);
                                    }
                                }}
                            />
                        )}
                    </>
                )}
            </div>
        );
    };

    if (!Array.isArray(cards)) return null;

    return (
        <div className={`bento-grid${editing ? ' editing' : ''}${settled && !editing ? ' settled' : ''}${dragKey ? ' is-dragging' : ''}`}>
            <div
                ref={gridRef}
                className="bento-grid-container"
                onClick={editing ? (e) => {
                    // The click that ends a drag lands on the grid itself; it is not a background tap
                    if (e.target === e.currentTarget && now() - dragEndedRef.current > 300) onExitEdit?.();
                } : undefined}
            >
                {entries.map(entry => (entry.kind === 'card'
                    ? renderItem(entry.index)
                    : (
                        <div key={`slot:${keyOf(cards[entry.items[0].index], entry.items[0].index)}`} className="grid-slot">
                            {entry.items.map(item => renderItem(item.index, item))}
                        </div>
                    )))}
            </div>
            {dragKey && /** @type {Array<-1|1>} */ ([-1, 1]).filter(dir => canMoveToPage?.(dir)).map(dir => (
                <div
                    key={dir}
                    className={`grid-page-edge ${dir < 0 ? 'left' : 'right'}${edgeHint === dir ? ' active' : ''}`}
                    aria-hidden="true"
                />
            ))}
            <div className="visually-hidden" aria-live="polite">{announcement}</div>
        </div>
    );
};

export default BentoGrid;
