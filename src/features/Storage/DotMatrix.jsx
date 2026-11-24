import React from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useTheme } from '../../context/ThemeContext';
import { allocateColumns } from './storageModel';
import { PITCH, dotCells, dotPath } from './dots';

/**
 * One area of dots in a color: a tinted panel with a glowing edge, dim dots and lit ones.
 * @param {Object} props
 * @param {number} props.x - Left edge, in pixels.
 * @param {number} props.y - Top edge, in pixels.
 * @param {number} props.cols - Columns.
 * @param {number} props.rows - Rows.
 * @param {string} props.color - CSS color.
 * @param {number} props.seed - Picks which dots are lit.
 * @param {number} [props.density=0.3] - Share of lit dots.
 * @param {boolean} props.square - Square dots and corners.
 * @param {boolean} [props.free] - Free space: dim dots only.
 * @param {(c: number, row: number) => boolean} [props.inside] - Whether a cell has a dot.
 * @param {string} [props.title] - Name shown on hover.
 * @param {'active'|'dim'} [props.state] - Highlighted while its category is pointed at, which lights
 *   most of its dots, or dimmed while another one is.
 * @param {() => void} [props.onPointerEnter] - Called when the pointer moves onto it.
 * @returns {JSX.Element} The SVG group.
 */
export function DotArea({ x, y, cols, rows, color, seed, density = 0.3, square, free, inside, title, state, onPointerEnter }) {
    const w = cols * PITCH;
    const h = rows * PITCH;
    const cells = dotCells(cols, rows, seed, free ? 0 : state === 'active' ? 0.72 : density, inside);
    const radius = square ? 0 : Math.min(4, w / 2);
    return (
        <g className={`dot-area${free ? ' is-free' : ''}${state ? ` is-${state}` : ''}`} style={{ color }} onPointerEnter={onPointerEnter}>
            {title && <title>{title}</title>}
            {!inside && <rect className="dot-area-fill" x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={radius} />}
            <path className="dot-area-base" d={dotPath(cells.base, x, y, square ? 0.9 : 0.95, square)} />
            <path className="dot-area-lit" d={dotPath(cells.lit, x, y, square ? 1.3 : 1.35, square)} />
            <path
                className="dot-area-twinkle"
                d={dotPath(cells.twinkle, x, y, square ? 1.3 : 1.35, square)}
                style={{ animationDelay: `${-((seed * 0.73 + x * 0.011) % 3)}s` }}
            />
            {!inside && <rect className="dot-area-edge" x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={radius} />}
        </g>
    );
}

/**
 * A storage bar drawn as a matrix of dots: each category is a glowing block as wide as its share,
 * followed by the free space. Fills the width it is given.
 * @param {Object} props
 * @param {Array<{name: string, size: number, color: string, group?: string}>} props.segments - Categories, in
 *   order; `group` is the legend entry a category belongs to, its name by default.
 * @param {number} props.total - What the whole bar stands for.
 * @param {number} props.rows - Rows of dots.
 * @param {(size: number) => string} [props.format] - Formats a size for the hover text.
 * @param {string|null} [props.active] - The legend entry pointed at: its blocks light up, the rest dim.
 * @param {(group: string|null) => void} [props.onHover] - Called with the entry under the pointer, null when it leaves.
 * @param {string} [props.className]
 * @returns {JSX.Element} The bar.
 */
const DotMatrix = ({ segments, total, rows, format = String, active = null, onHover, className = '' }) => {
    const [{ width }, ref] = useElementSize();
    const { style } = useTheme();
    const square = style === 'terminal';
    const cols = Math.floor(width / PITCH);
    const counts = allocateColumns(segments.map(s => s.size), total, cols);
    const freeCols = cols - counts.reduce((a, b) => a + b, 0);
    const offset = Math.floor((width - cols * PITCH) / 2);
    const height = rows * PITCH;

    const starts = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0));
    return (
        <div className={`dot-matrix ${className}`} ref={ref} style={{ height }}>
            {cols > 0 && (
                <svg
                    width={width} height={height} role="img"
                    aria-label={segments.map(s => `${s.name} ${format(s.size)}`).join(', ')}
                    onPointerLeave={onHover && (() => onHover(null))}
                >
                    {freeCols > 0 && (
                        <DotArea
                            x={offset + (cols - freeCols) * PITCH} y={0} cols={freeCols} rows={rows}
                            color="var(--text-primary)" seed={0} square={square} free
                            title={onHover ? undefined : `Free ${format(total - segments.reduce((a, s) => a + s.size, 0))}`}
                            state={active ? 'dim' : undefined} onPointerEnter={onHover && (() => onHover(null))}
                        />
                    )}
                    {segments.map((s, i) => {
                        const x = offset + starts[i] * PITCH;
                        const group = s.group || s.name;
                        return counts[i] > 0 && (
                            <DotArea
                                key={s.name} x={x} y={0} cols={counts[i]} rows={rows}
                                color={s.color} seed={i + 1} square={square}
                                title={onHover ? undefined : `${s.name} ${format(s.size)}`}
                                state={active == null ? undefined : active === group ? 'active' : 'dim'}
                                onPointerEnter={onHover && (() => onHover(group))}
                            />
                        );
                    })}
                </svg>
            )}
        </div>
    );
};

export default DotMatrix;
