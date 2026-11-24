/** Drawing helpers of the storage card's dot matrices. */
import { dotNoise } from './storageModel';

/** Distance between dot centers, in pixels. */
export const PITCH = 5;

/**
 * Builds one SVG path of many dots, so a whole area of dots is a single element.
 * @param {Array<[number, number]>} cells - Column and row of each dot.
 * @param {number} x0 - Left edge of column 0, in pixels.
 * @param {number} y0 - Top edge of row 0, in pixels.
 * @param {number} r - Radius, or half the side of a square dot.
 * @param {boolean} square - Square dots (the Terminal style) instead of round ones.
 * @returns {string} The path data.
 */
export function dotPath(cells, x0, y0, r, square) {
    return cells.map(([c, row]) => {
        const cx = x0 + (c + 0.5) * PITCH;
        const cy = y0 + (row + 0.5) * PITCH;
        if (square) return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`;
        return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }).join('');
}

/**
 * Dots of an area of columns and rows, split into the dim base, the lit dots and the lit dots
 * that twinkle.
 * @param {number} cols - Columns.
 * @param {number} rows - Rows.
 * @param {number} seed - Picks which dots are lit.
 * @param {number} density - Share of lit dots, 0 to 1.
 * @param {(c: number, row: number) => boolean} [inside] - Whether a cell has a dot; all by default.
 * @returns {{base: Array<[number, number]>, lit: Array<[number, number]>, twinkle: Array<[number, number]>}} The cells.
 */
export function dotCells(cols, rows, seed, density, inside = () => true) {
    const base = [];
    const lit = [];
    const twinkle = [];
    for (let c = 0; c < cols; c += 1) {
        for (let row = 0; row < rows; row += 1) {
            if (!inside(c, row)) continue;
            const n = dotNoise(seed, c, row);
            if (n < density * 0.25) twinkle.push([c, row]);
            else if (n < density) lit.push([c, row]);
            else base.push([c, row]);
        }
    }
    return { base, lit, twinkle };
}
