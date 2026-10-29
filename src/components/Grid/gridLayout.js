/**
 * Layout rules for the bento grid. A tile is one grid column wide and one row tall; half
 * and quarter cards share a tile ("slot") that is split into a 2×2 cell grid.
 */

/** Card sizes from smallest to largest. Numbers are full-height cards of that many columns. */
export const SIZES = ['quarter', 'half', '1', '2', '3'];

/** Sizes a card supports unless its type declares its own. */
export const DEFAULT_SIZES = ['1', '2', '3'];

/** Footprint of each size in slot cells (a full tile is 2×2 cells). */
const FOOTPRINT = {
    quarter: { w: 1, h: 1 },
    half: { w: 2, h: 1 },
    1: { w: 2, h: 2 },
    2: { w: 4, h: 2 },
    3: { w: 6, h: 2 },
};

const LABELS = {
    quarter: 'quarter tile',
    half: 'half height',
    1: 'one wide',
    2: 'two wide',
    3: 'three wide',
};

/**
 * Returns the size key of a card: `quarter`, `half`, or its column span as a string.
 * @param {Object} card - The card config.
 * @returns {string} The size key.
 */
export function sizeOf(card) {
    if (card?.tileSize === 'quarter' || card?.tileSize === 'half') return card.tileSize;
    const span = Math.round(Number(card?.colSpan) || 1);
    return String(Math.min(3, Math.max(1, span)));
}

/**
 * Returns a copy of the card with the given size applied.
 * @param {Object} card - The card config.
 * @param {string} size - The size key.
 * @returns {Object} The resized card.
 */
export function withSize(card, size) {
    const { tileSize: _tileSize, ...rest } = card;
    if (size === 'quarter' || size === 'half') return { ...rest, tileSize: size };
    return { ...rest, colSpan: Number(size) };
}

/**
 * Returns a readable name for a size, used in labels and announcements.
 * @param {string} size - The size key.
 * @returns {string} The size name.
 */
export function sizeLabel(size) {
    return LABELS[size] || size;
}

/**
 * Whether a size is smaller than a full tile and shares a slot with other cards.
 * @param {string} size - The size key.
 * @returns {boolean} True for `half` and `quarter`.
 */
export function isSubTile(size) {
    return size === 'half' || size === 'quarter';
}

/**
 * Returns the sizes a card can take in a grid with the given number of columns.
 * @param {string[]|undefined} supported - Sizes the card type supports.
 * @param {number} columns - Columns in the grid.
 * @returns {string[]} Usable sizes, smallest first.
 */
export function usableSizes(supported, columns) {
    const list = Array.isArray(supported) && supported.length > 0 ? supported : DEFAULT_SIZES;
    return SIZES.filter(s => list.includes(s) && (isSubTile(s) || Number(s) <= columns));
}

/**
 * Returns the card as it renders in a grid with `columns` columns: wider cards are narrowed
 * to fit, so on a phone a two-wide card renders its one-wide layout. Returns the same
 * object when nothing changes.
 * @param {Object} card - The card config.
 * @param {number} columns - Columns in the grid.
 * @returns {Object} The card config to render.
 */
export function fitToColumns(card, columns) {
    const size = sizeOf(card);
    if (isSubTile(size) || Number(size) <= columns) return card;
    return { ...card, colSpan: columns };
}

/**
 * Groups cards into grid entries. Full-height cards are their own entry; consecutive half
 * and quarter cards fill shared 2×2 slots in order, each taking the first free spot. A card
 * that no longer fits starts a new slot.
 * @param {Array<Object>} cards - The page's cards, in order.
 * @param {(card: Object) => boolean} [include] - Cards for which this returns false are left out.
 * @returns {Array<{kind: 'card', index: number} | {kind: 'slot', items: Array<{index: number, col: number, row: number, w: number, h: number}>}>} Grid entries.
 */
export function buildEntries(cards, include = () => true) {
    const entries = [];
    let slot = null;

    const place = (cells, w, h) => {
        for (let row = 0; row + h <= 2; row++) {
            for (let col = 0; col + w <= 2; col++) {
                let free = true;
                for (let y = row; y < row + h && free; y++) {
                    for (let x = col; x < col + w; x++) {
                        if (cells[y][x]) { free = false; break; }
                    }
                }
                if (free) return { col, row };
            }
        }
        return null;
    };

    cards.forEach((card, index) => {
        if (!include(card)) return;
        const size = sizeOf(card);
        if (!isSubTile(size)) {
            slot = null;
            entries.push({ kind: 'card', index });
            return;
        }
        const { w, h } = FOOTPRINT[size];
        let spot = slot && place(slot.cells, w, h);
        if (!spot) {
            slot = { kind: 'slot', items: [], cells: [[false, false], [false, false]] };
            entries.push(slot);
            spot = { col: 0, row: 0 };
        }
        for (let y = spot.row; y < spot.row + h; y++) {
            for (let x = spot.col; x < spot.col + w; x++) slot.cells[y][x] = true;
        }
        slot.items.push({ index, ...spot, w, h });
    });

    return entries.map(e => (e.kind === 'slot' ? { kind: 'slot', items: e.items } : e));
}

/**
 * Picks the usable size whose footprint is closest to a dragged-out width and height.
 * @param {string[]} sizes - Usable sizes.
 * @param {number} w - Desired width in slot cells.
 * @param {number} h - Desired height in slot cells.
 * @returns {string} The closest size.
 */
export function nearestSize(sizes, w, h) {
    let best = sizes[0];
    let bestDistance = Infinity;
    sizes.forEach(size => {
        const f = FOOTPRINT[size];
        const distance = (f.w - w) ** 2 + (f.h - h) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = size;
        }
    });
    return best;
}

/**
 * Moves an item to a new position in a list, returning a new list.
 * @template T
 * @param {T[]} list - The list.
 * @param {number} from - Current index.
 * @param {number} to - Target index.
 * @returns {T[]} The reordered list.
 */
export function moveItem(list, from, to) {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    return next;
}

/** Screen sizes a card can be hidden on, by number of grid columns. */
export const DEVICES = [
    { key: 'phone', label: 'Phone', columns: 1 },
    { key: 'tablet', label: 'Tablet', columns: 2 },
    { key: 'desktop', label: 'Desktop', columns: 3 },
];

/**
 * Returns the screen size name for a column count.
 * @param {number} columns - Columns in the grid.
 * @returns {'phone'|'tablet'|'desktop'} The screen size.
 */
export function deviceFor(columns) {
    if (columns <= 1) return 'phone';
    if (columns === 2) return 'tablet';
    return 'desktop';
}

/**
 * Whether a card is hidden at the current screen size (`hideOn` in its config).
 * @param {Object} card - The card config.
 * @param {number} columns - Columns in the grid.
 * @returns {boolean} True when the card should not be shown.
 */
export function isHiddenAt(card, columns) {
    return Array.isArray(card?.hideOn) && card.hideOn.includes(deviceFor(columns));
}
