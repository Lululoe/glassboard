import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EyeOff, Pencil } from 'lucide-react';
import { getCardComponent, getCardInfo, getCardSizes } from '../../features/registry';
import { useGridColumns } from '../../hooks/useGridColumns';
import CardErrorBoundary from './CardErrorBoundary';
import { childCardsOf, isContainer } from '../../../shared/containerCards';
import {
    DEVICES, MAX_ROWS, buildEntries, deviceFor, dropIndex, fitToColumns, isHiddenAt, isSubTile, layoutCards, moveItem, nearestSize,
    rowCount, rowSpanOf, sizeLabel, sizeOf, usableSizes, withRows, withSize,
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
 * Returns where an element is inside a grid item, from layout offsets rather than rects, so move
 * animations don't skew it. Scrolled ancestors inside the item are taken into account.
 * @param {HTMLElement} el - The element.
 * @param {HTMLElement} item - The grid item it is in.
 * @returns {{left: number, top: number, width: number, height: number}} Its box in the item.
 */
function boxInItem(el, item) {
    let left = 0;
    let top = 0;
    for (let node = el; node && node !== item; node = /** @type {HTMLElement} */ (node.offsetParent)) {
        left += node.offsetLeft;
        top += node.offsetTop;
    }
    for (let node = el.parentElement; node && node !== item; node = node.parentElement) {
        left -= node.scrollLeft;
        top -= node.scrollTop;
    }
    return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * The tiles of the grid, drawn behind the cards in edit mode with one free row below them,
 * so it is clear where cards can go. While a card is dragged, the place it will land is marked.
 * @param {Object} props
 * @param {Array<Object>} props.cards - The page's cards.
 * @param {number} props.columns - Columns in the grid.
 * @param {{x: number, y: number, w: number, h: number}|null|undefined} [props.target] - Where the
 *   dragged card lands, in tiles.
 * @returns {JSX.Element} The guide.
 */
const GridGuide = ({ cards, columns, target }) => {
    const rows = rowCount(cards, columns) + 1;
    /** @type {import('react').CSSProperties & Object<string, number>} */
    const style = { '--rows': rows };
    return (
        <div className="grid-guide" style={style} aria-hidden="true">
            {Array.from({ length: rows * columns }, (_, i) => <div key={i} className="grid-guide-tile" />)}
            {target && (
                <div
                    className="grid-guide-target"
                    style={/** @type {import('react').CSSProperties} */ ({ '--x': target.x, '--y': target.y, '--w': target.w, '--h': target.h })}
                />
            )}
        </div>
    );
};

/**
 * Renders a grid of dashboard cards. Full-height cards span one to three columns; half and
 * quarter cards share square slots. On narrow screens the grid drops to two or one columns
 * and wide cards are narrowed to fit.
 *
 * In edit mode a guide shows the grid's tiles behind the cards, and the cards can be dragged
 * to a new position, resized with the corner handle, or moved and resized from the keyboard. Every change is reported through
 * `onLayoutChange`; the caller decides when to save.
 * @param {Object} props
 * @param {Array<Object>} [props.cards] - Card configs for this page.
 * @param {Object} [props.globalConfig] - The full dashboard config, passed to every card.
 * @param {boolean} [props.editing=false] - Whether edit mode is on.
 * @param {(cards: Array<Object>) => void} [props.onLayoutChange] - Receives the cards in their new order and size.
 * @param {() => void} [props.onRequestEdit] - Called on a long press; omit to disable entering edit mode that way.
 * @param {() => void} [props.onExitEdit] - Called when the user taps the background or presses Escape in edit mode.
 * @param {(index: number) => void} [props.onEditCard] - Opens the editor for a card; shows an edit button on each card.
 * @param {(index: number) => void} [props.onEditIcon] - Opens the icon editor of a card; shows an edit button on the
 *   header icon of cards that have one.
 * @param {(direction: -1|1) => boolean} [props.canMoveToPage] - Whether a dragged card can go to the previous/next page.
 * @param {(direction: -1|1, index: number, carry: Object) => void} [props.onMoveToPage] - Moves the dragged card to
 *   the previous/next page when it is held at the screen edge. `carry` lets that page's grid continue the drag.
 * @param {Object|null} [props.incomingDrag] - A drag carried over from another page, to continue here.
 * @param {() => void} [props.onIncomingDragTaken] - Called once this grid has picked up `incomingDrag`.
 * @returns {JSX.Element|null} The rendered grid, or null when there are no cards.
 */
const BentoGrid = ({
    cards, globalConfig, editing = false, onLayoutChange, onRequestEdit, onExitEdit, onEditCard, onEditIcon,
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
    const placeRef = useRef(null);
    const pendingRef = useRef(null);
    const [dragKey, setDragKey] = useState(null);
    const [intoKey, setIntoKey] = useState(/** @type {string|null} */ (null));
    const [pickup, setPickup] = useState(/** @type {{key: string}|null} */ (null));
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
        // Over a container the card shrinks toward the pointer, the way it will look inside
        const scale = d.into ? 0.85 : 1.04;
        el.style.transformOrigin = d.into ? `${d.grabX}px ${d.grabY}px` : '';
        el.style.transform = `translate(${d.x - d.grabX - r.left}px, ${d.y - d.grabY - r.top}px) scale(${scale})`;
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

    // Puts each icon edit button over its card's header icon; cards without a header at their
    // size have none to edit. Offsets are used rather than rects, so move animations don't skew them.
    // The grab areas of cards inside containers go over those cards, clipped to what is in view.
    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid || !editing) return undefined;
        const place = () => {
            grid.querySelectorAll('.grid-child-surface').forEach((surface) => {
                const el = /** @type {HTMLElement} */ (surface);
                const item = /** @type {HTMLElement|null} */ (el.closest('[data-key]'));
                const child = /** @type {HTMLElement|null} */ (item?.querySelector(`[data-child-index="${el.dataset.child}"]`));
                const body = /** @type {HTMLElement|null} */ (item?.querySelector('.container-card-body'));
                if (!child || !body) {
                    el.style.display = 'none';
                    return;
                }
                const box = boxInItem(child, item);
                const view = boxInItem(body, item);
                const left = Math.max(box.left, view.left);
                const top = Math.max(box.top, view.top);
                const right = Math.min(box.left + box.width, view.left + view.width);
                const bottom = Math.min(box.top + box.height, view.top + view.height);
                if (right - left < 12 || bottom - top < 12) {
                    el.style.display = 'none';
                    return;
                }
                Object.assign(el.style, {
                    display: '',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${right - left}px`,
                    height: `${bottom - top}px`,
                });
            });
            grid.querySelectorAll('.grid-icon-button').forEach((button) => {
                const el = /** @type {HTMLElement} */ (button);
                const item = el.closest('[data-key]');
                const icon = /** @type {HTMLElement|null} */ (item?.querySelector('.two-tone-header .app-icon-container'));
                if (!icon) {
                    el.style.display = 'none';
                    return;
                }
                let left = 0;
                let top = 0;
                for (let node = icon; node && node !== item; node = /** @type {HTMLElement} */ (node.offsetParent)) {
                    left += node.offsetLeft;
                    top += node.offsetTop;
                }
                Object.assign(el.style, {
                    display: '',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${icon.offsetWidth}px`,
                    height: `${icon.offsetHeight}px`,
                });
            });
        };
        place();
        placeRef.current = place;
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(place);
        observer.observe(grid);
        return () => observer.disconnect();
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

    /**
     * Finds the container card under the pointer that the dragged card can be dropped into.
     * Containers don't go into containers.
     * @param {{key: string, index: number, x: number, y: number}} d - The drag.
     * @returns {string|null} The container's key, or null.
     */
    const containerUnder = (d) => {
        const list = cardsRef.current;
        const grid = gridRef.current;
        if (!grid || isContainer(list[d.index])) return null;
        for (const el of grid.querySelectorAll('[data-key]')) {
            const item = /** @type {HTMLElement} */ (el);
            if (item.dataset.key === d.key || !isContainer(list[Number(item.dataset.gridIndex)])) continue;
            const box = item.querySelector('.container-card')?.getBoundingClientRect();
            if (box && d.x >= box.left && d.x <= box.right && d.y >= box.top && d.y <= box.bottom) return item.dataset.key;
        }
        return null;
    };

    /**
     * Puts a page card into a container, before the card inside it under the point, or last.
     * @param {number} index - Position of the card on the page.
     * @param {string} key - Key of the container.
     * @param {number} x - Pointer x where the card was dropped.
     * @param {number} y - Pointer y where the card was dropped.
     */
    const dropInto = (index, key, x, y) => {
        const list = cardsRef.current;
        const target = list.findIndex((c, i) => keyOf(c, i) === key);
        const card = list[index];
        if (target < 0 || !card) return;
        const container = list[target];
        const children = childCardsOf(container);
        let at = children.length;
        gridRef.current?.querySelector(byKey(key))?.querySelectorAll('[data-child-index]').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) at = Number(/** @type {HTMLElement} */ (el).dataset.childIndex);
        });
        const filled = { ...container, cards: [...children.slice(0, at), card, ...children.slice(at)] };
        commit(list.map((c, i) => (i === target ? filled : c)).filter((_, i) => i !== index));
        announce(`${nameOf(card)} moved into ${nameOf(container)}`);
    };

    /**
     * Moves the dragged card to the place in the order where it lands closest to where it is
     * held. Every place is tried, so a card also drops into a gap next to a wider card. While
     * the pointer is over a container the order stays put, so the card can be dropped into it.
     */
    const hitTest = () => {
        const d = dragRef.current;
        const grid = gridRef.current;
        if (!d?.started || !grid || d.mode !== 'move') return;
        const into = containerUnder(d);
        if (into !== d.into) {
            d.into = into;
            setIntoKey(into);
            positionDragged();
            if (into) announce(`Release to put ${nameOf(cardsRef.current[d.index])} into this container`);
        }
        if (into || now() - d.lastSwap < SWAP_COOLDOWN_MS) return;
        const list = cardsRef.current;
        const rect = grid.getBoundingClientRect();
        const styles = getComputedStyle(grid);
        const gap = parseFloat(styles.columnGap) || 0;
        const rowHeight = parseFloat(styles.gridAutoRows) || d.anchor.height;
        const colPitch = (rect.width + gap) / columns;
        const rowPitch = rowHeight + gap;
        // The centre of the card as it is drawn under the pointer
        const center = {
            x: (d.x - d.grabX + d.anchor.width / 2 - rect.left) / colPitch,
            y: (d.y - d.grabY + d.anchor.height / 2 - rect.top) / rowPitch,
        };
        const target = dropIndex(list, d.index, center, columns);
        if (target === d.index) return;
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
            into: null,
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
                const card = list[d.index];
                const sizes = usableSizes(getCardSizes(card.type), columns);
                const w = (d.x - d.anchor.left + d.gap) / d.pitch;
                const h = (d.y - d.anchor.top + d.gap) / d.pitch;
                // Cards that can be taller take a row for every two cells dragged below the first row
                const tall = getCardInfo(card.type)?.rows;
                const size = nearestSize(sizes, w, tall ? Math.min(h, 2) : h);
                const rows = tall && !isSubTile(size) ? Math.min(MAX_ROWS, Math.max(1, Math.round(h / 2))) : 1;
                if (size !== sizeOf(fitToColumns(card, columns)) || rows !== rowSpanOf(card)) {
                    commit(list.map((c, i) => (i === d.index ? withRows(withSize(c, size), rows) : c)));
                    announce(`${nameOf(card)} is now ${sizeLabel(size)}${rows > 1 ? `, ${rows} rows tall` : ''}`);
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
            const into = d.started && mode === 'move' && ev.type === 'pointerup' ? d.into : null;
            // A card dropped into a container leaves the page, so it doesn't fly back to its place
            if (into) d.handedOff = true;
            cleanup();
            if (tapped && mode === 'resize') stepSize(d.index, 1);
            if (into) dropInto(d.index, into, ev.clientX, ev.clientY);
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
                    el.style.transformOrigin = '';
                    if (!d.handedOff && from && from !== 'none' && typeof el.animate === 'function' && !prefersReducedMotion()) {
                        el.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.32, 0.08, 0.24, 1)' });
                    }
                }
                setDragKey(null);
                setEdgeHint(0);
                setIntoKey(null);
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

    // Continue dragging a card taken out of a container, once it is on the page
    useLayoutEffect(() => {
        const p = pendingRef.current;
        if (!pickup || !p || p.key !== pickup.key || !editing || dragRef.current) return;
        const index = (cardsRef.current || []).findIndex((c, i) => keyOf(c, i) === pickup.key);
        const el = gridRef.current?.querySelector(byKey(pickup.key));
        if (index < 0 || !el) return;
        p.cleanup();
        const rect = el.getBoundingClientRect();
        beginRef.current?.({
            mode: 'move', index, pointerId: p.pointerId, x: p.x, y: p.y,
            grabX: p.fx * rect.width, grabY: p.fy * rect.height, started: true,
        });
    }, [pickup, cards, editing]);

    /**
     * Takes a card out of a container and puts it on the page right after the container.
     * @param {number} index - Position of the container.
     * @param {number} childIndex - Position of the card in the container.
     * @returns {string|null} The key the card has on the page, or null when there is no such card.
     */
    const takeOut = (index, childIndex) => {
        const list = cardsRef.current;
        const container = list[index];
        const children = childCardsOf(container);
        const child = children[childIndex];
        if (!child) return null;
        const next = [...list];
        next[index] = { ...container, cards: children.filter((_, i) => i !== childIndex) };
        next.splice(index + 1, 0, child);
        commit(next);
        announce(`${nameOf(child)} moved out of ${nameOf(container)}, to position ${index + 2} of ${next.length}`);
        return keyOf(child, index + 1);
    };

    /**
     * Starts tracking a pointer on a card inside a container. Once it moves, the card is taken
     * out onto the page and dragged from there like any card; a tap leaves it where it is.
     * @param {import('react').PointerEvent<HTMLElement>} e - The pointerdown event.
     * @param {number} index - Position of the container.
     * @param {number} childIndex - Position of the card in the container.
     */
    const startChildGesture = (e, index, childIndex) => {
        if (e.button !== 0 || dragRef.current || pendingRef.current) return;
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const p = {
            key: null,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            x: e.clientX,
            y: e.clientY,
            fx: rect.width ? (e.clientX - rect.left) / rect.width : 0.5,
            fy: rect.height ? (e.clientY - rect.top) / rect.height : 0.5,
            liftAt: e.pointerType === 'touch' ? now() + TOUCH_LIFT_MS : 0,
            cleanup: () => {},
        };
        const onMove = (ev) => {
            if (ev.pointerId !== p.pointerId) return;
            p.x = ev.clientX;
            p.y = ev.clientY;
            if (p.key || Math.hypot(p.x - p.startX, p.y - p.startY) <= DRAG_THRESHOLD) return;
            if (p.liftAt && now() < p.liftAt) {
                cleanup();
                return;
            }
            p.key = takeOut(index, childIndex);
            if (!p.key) cleanup();
            else setPickup({ key: p.key });
        };
        const onTouchMove = (ev) => {
            if (p.key || (p.liftAt && now() >= p.liftAt)) ev.preventDefault();
        };
        const onUp = (ev) => {
            if (ev.pointerId === p.pointerId) cleanup();
        };
        function cleanup() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('touchmove', onTouchMove);
            if (pendingRef.current === p) pendingRef.current = null;
        }
        p.cleanup = cleanup;
        pendingRef.current = p;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
    };

    /**
     * Scrolls a container's cards while editing, where the card itself does not take input.
     * @param {import('react').WheelEvent<HTMLElement>} e - The wheel event.
     */
    const scrollContainer = (e) => {
        const body = e.currentTarget.closest('[data-key]')?.querySelector('.container-card-body');
        if (!body || body.scrollHeight <= body.clientHeight) return;
        const before = body.scrollTop;
        body.scrollTop += e.deltaY;
        if (body.scrollTop !== before) placeRef.current?.();
    };

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
        } else if (rowSpanOf(shown) > 1) {
            style.gridRow = `span ${rowSpanOf(shown)}`;
        }

        const hiddenHere = isHiddenAt(card, columns);
        const container = isContainer(card);
        const className = [
            'grid-item',
            `col-span-${isSubTile(size) ? 1 : size}`,
            isSubTile(size) && `tile-${size}`,
            dragKey === key && 'dragging',
            dragKey === key && intoKey && 'over-container',
            intoKey === key && 'drop-target',
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
                            onWheel={container ? scrollContainer : undefined}
                        />
                        {childCardsOf(card).map((child, childIndex) => (
                            <div
                                key={child.id ?? childIndex}
                                className="grid-child-surface"
                                data-child={childIndex}
                                role="button"
                                tabIndex={0}
                                aria-label={`${nameOf(child)}, in ${nameOf(card)}. Drag out of the container, or press Enter to take it out.`}
                                style={{ display: 'none' }}
                                onPointerDown={(e) => startChildGesture(e, index, childIndex)}
                                onWheel={scrollContainer}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const key = takeOut(index, childIndex);
                                    if (key) focusKeyRef.current = key;
                                }}
                            />
                        ))}
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
                        {onEditIcon && getCardInfo(card.type)?.headerIcon && (
                            <button
                                type="button"
                                className="button-reset grid-icon-button"
                                aria-label={`Change the icon of ${nameOf(card)}`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onEditIcon(index)}
                            >
                                <span className="grid-icon-badge" aria-hidden="true">
                                    <Pencil size={10} strokeWidth={3} />
                                </span>
                            </button>
                        )}
                        {hiddenHere && (
                            <span className="grid-hidden-badge">
                                <EyeOff size={13} aria-hidden="true" />
                                Hidden on {DEVICES.find(dv => dv.key === device)?.label.toLowerCase()}
                            </span>
                        )}
                        {(sizes.length > 1 || getCardInfo(card.type)?.rows) && (
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

    const dragIndex = dragKey ? list.findIndex((c, i) => keyOf(c, i) === dragKey) : -1;
    const dragTarget = dragIndex >= 0 && !intoKey ? layoutCards(list, columns).get(dragIndex) : null;

    return (
        <div className={`bento-grid${editing ? ' editing' : ''}${settled && !editing ? ' settled' : ''}${dragKey ? ' is-dragging' : ''}`}>
            <div className="bento-grid-stage">
            {editing && <GridGuide cards={list} columns={columns} target={dragTarget} />}
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
