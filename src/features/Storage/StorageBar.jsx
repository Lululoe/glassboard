import React from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import DotMatrix from './DotMatrix';
import './StorageCard.css';

/** Narrowest segment, in pixels, that has room for its name and size. */
const LABEL_FROM = 64;

/**
 * A bar of solid, rounded blocks, one per category and as wide as its share, followed by the
 * free space. Tall enough bars name the categories that have room for it.
 * @param {Object} props
 * @param {Array<{name: string, size: number, color: string, group?: string}>} props.segments - Categories, in order.
 * @param {number} props.total - What the whole bar stands for.
 * @param {number} props.height - Height in pixels.
 * @param {(size: number) => string} props.format - Formats a size.
 * @param {string|null} [props.active] - The legend entry pointed at: its blocks stay, the rest dim.
 * @param {(group: string|null) => void} [props.onHover] - Called with the entry under the pointer, null when it leaves.
 * @returns {JSX.Element} The bar.
 */
const SolidBar = ({ segments, total, height, format, active = null, onHover }) => {
    const [{ width }, ref] = useElementSize();
    const free = Math.max(0, total - segments.reduce((sum, s) => sum + s.size, 0));
    const labels = height >= 36;
    return (
        <div
            className="solid-bar"
            ref={ref}
            style={{ height }}
            role="img"
            aria-label={segments.map(s => `${s.name} ${format(s.size)}`).join(', ')}
            onPointerLeave={onHover && (() => onHover(null))}
        >
            {segments.map(s => {
                const group = s.group || s.name;
                const state = active == null ? '' : active === group ? ' is-active' : ' is-dim';
                return (
                <span
                    key={s.name}
                    className={`solid-bar-segment${state}`}
                    style={{ '--cat': s.color, flexGrow: s.size }}
                    title={onHover ? undefined : `${s.name} ${format(s.size)}`}
                    onPointerEnter={onHover && (() => onHover(group))}
                >
                    {labels && (width * s.size) / total >= LABEL_FROM && (
                        <>
                            <b>{s.name}</b>
                            <small>{format(s.size)}</small>
                        </>
                    )}
                </span>
                );
            })}
            {free > 0 && (
                <span
                    className={`solid-bar-free${active ? ' is-dim' : ''}`} style={{ flexGrow: free }}
                    title={onHover ? undefined : `Free ${format(free)}`}
                    onPointerEnter={onHover && (() => onHover(null))}
                />
            )}
        </div>
    );
};

/**
 * The storage card's bar, as a matrix of dots or as solid blocks.
 * @param {Object} props
 * @param {'dots'|'solid'} props.variant - How it is drawn.
 * @param {Array<{name: string, size: number, color: string}>} props.segments - Categories, in order.
 * @param {number} props.total - What the whole bar stands for.
 * @param {number} props.rows - Rows of dots, for the dot matrix.
 * @param {number} props.height - Height in pixels, for solid blocks.
 * @param {(size: number) => string} props.format - Formats a size.
 * @param {string|null} [props.active] - The legend entry pointed at.
 * @param {(group: string|null) => void} [props.onHover] - Called with the entry under the pointer.
 * @returns {JSX.Element} The bar.
 */
const StorageBar = ({ variant, segments, total, rows, height, format, active, onHover }) => (
    variant === 'solid'
        ? <SolidBar segments={segments} total={total} height={height} format={format} active={active} onHover={onHover} />
        : <DotMatrix segments={segments} total={total} rows={rows} format={format} active={active} onHover={onHover} />
);

export default StorageBar;
