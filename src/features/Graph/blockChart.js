/*
 * Graphs drawn with block characters, for the Terminal style. The plot is a grid of character
 * cells; each sensor becomes rows of text in its color, with spaces where it draws nothing, so
 * the rows of several sensors can lie over each other.
 */

/** Block characters from empty to full, in eighths of a cell. */
export const BLOCKS = ' ▁▂▃▄▅▆▇█';

/** Height of a character cell in pixels. */
export const CELL_HEIGHT = 12;
/** Width of a character cell in pixels; a little wider than a monospace glyph, so glyphs never crowd. */
export const CELL_WIDTH = 7.6;

/**
 * The block character for a cell filled from the bottom.
 * @param {number} fill - How much of the cell is filled, 0 to 1.
 * @returns {string} The character.
 */
export function blockChar(fill) {
    if (fill >= 1) return BLOCKS[8];
    if (fill <= 0) return ' ';
    return BLOCKS[Math.max(1, Math.round(fill * 8))];
}

/**
 * Rows of block characters for one sensor.
 * @param {Array<{lo: number, hi: number}|null>} columns - Per column, the range it covers in
 *   cells from the bottom edge, or null where it draws nothing.
 * @param {number} rows - Number of rows.
 * @param {boolean} [edge] - Only the top cell of each column, to draw a line instead of an area.
 * @returns {string[]} The rows, top first.
 */
export function blockRows(columns, rows, edge = false) {
    const out = [];
    for (let r = rows - 1; r >= 0; r--) {
        out.push(columns.map(c => {
            if (!c || !(c.hi > c.lo)) return ' ';
            const hi = Math.min(c.hi, rows);
            if (edge) {
                const top = Math.min(rows - 1, Math.max(0, Math.ceil(hi) - 1));
                return r === top ? BLOCKS[Math.max(1, Math.round((hi - top) * 8))] : ' ';
            }
            if (r < Math.round(c.lo)) return ' ';
            return blockChar(hi - r);
        }).join(''));
    }
    return out;
}

/**
 * Lays out the sensors of a chart on a character grid.
 * @param {Object} chart - The chart's geometry, as LineBarChart computes it.
 * @param {Array<Object>} chart.drawn - Sensors drawn, with `i`, `unit`, `color` and `values`.
 * @param {number} chart.n - Number of periods.
 * @param {number} chart.w - Plot width in pixels.
 * @param {number} chart.h - Plot height in pixels.
 * @param {(unit: string, value: number) => number} chart.y - Pixel height of a value, from the top.
 * @param {boolean} chart.bar - Bars rather than lines.
 * @param {boolean} chart.stacked - Whether bars stack.
 * @returns {{cols: number, rows: number, cellWidth: number, cellHeight: number, series: Array<{i: number, color: string, rows: string[]}>}} The grid and each sensor's rows.
 */
export function blockLayout({ drawn, n, w, h, y, bar, stacked }) {
    const cols = Math.max(1, Math.floor(w / CELL_WIDTH));
    const rows = Math.max(2, Math.floor(h / CELL_HEIGHT));
    const cellWidth = w / cols;
    const cellHeight = h / rows;
    const cells = (unit, v) => (h - y(unit, v)) / cellHeight;
    const centers = Array.from({ length: cols }, (_, c) => (c + 0.5) * cellWidth);

    if (!bar) {
        const edge = drawn.length > 1;
        return {
            cols, rows, cellWidth, cellHeight,
            series: drawn.map(s => ({
                i: s.i,
                color: s.color,
                rows: blockRows(centers.map(x => {
                    // The value where the line crosses the column, between the two nearest points
                    const at = n > 1 ? (x / w) * (n - 1) : 0;
                    const a = Math.floor(at);
                    const b = Math.min(n - 1, a + 1);
                    const va = s.values[a];
                    const vb = s.values[b];
                    if (!Number.isFinite(va) || !Number.isFinite(vb)) return null;
                    return { lo: 0, hi: cells(s.unit, va + (vb - va) * (at - a)) };
                }), rows, edge),
            })),
        };
    }

    // Bars: each period gets the columns whose middle falls in its slot, with a gap after it when there is room
    const slot = w / Math.max(1, n);
    const slotCols = slot / cellWidth;
    const columns = drawn.map(() => []);
    centers.forEach(x => {
        const j = Math.min(n - 1, Math.floor(x / slot));
        const offset = x - j * slot;
        const gap = slotCols >= 3 && offset > slot - cellWidth;
        let base = 0;
        drawn.forEach((s, k) => {
            const v = s.values[j];
            const share = slot / drawn.length;
            const mine = stacked || Math.floor(offset / share) === k;
            if (gap || !mine || !Number.isFinite(v) || v <= 0) {
                columns[k].push(null);
                return;
            }
            const lo = stacked ? base : 0;
            columns[k].push({ lo: cells(s.unit, lo), hi: cells(s.unit, lo + v) });
            if (stacked) base += v;
        });
    });
    return {
        cols, rows, cellWidth, cellHeight,
        series: drawn.map((s, k) => ({ i: s.i, color: s.color, rows: blockRows(columns[k], rows) })),
    };
}
