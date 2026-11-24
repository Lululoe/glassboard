import React, { useState } from 'react';
import EmptyState from '../../components/Shared/EmptyState';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import { useElementSize } from '../../hooks/useElementSize';
import { useNow } from '../../hooks/useNow';
import StaleNote from './StaleNote';
import StorageBar from './StorageBar';
import { STORAGE_BARS, columnsFor, formatShare, formatSize, isStale, largestCategory, legendItems, storageModel, storageSize } from './storageModel';
import { STORAGE_SOURCES, useStorage } from './useStorage';
import './StorageCard.css';

const ICON_BACKGROUND = 'linear-gradient(180deg, #8e9bff, #5a5ce6)';

/** Rows of dots and heights of solid bars at each size. */
const ROWS = { half: 6, 1: 10, 2: 14, 3: 16 };
const HEIGHTS = { half: 14, 1: 24, 2: 44, 3: 44 };

/** Minutes after which the data counts as stale: a missed nightly scan, with two hours to spare. */
const STALE_AFTER = 26 * 60;

/** Rows and columns of the list at each width. */
const LIST = { 1: [4, 1], 2: [4, 2], 3: [3, 3] };

/**
 * The header's second line while a category is pointed at: its color, name and size, and its
 * description or share of the disk.
 * @param {Object} props
 * @param {Object} props.item - The legend entry.
 * @returns {JSX.Element} The line.
 */
const HoverSubtitle = ({ item }) => (
    <span className="storage-hover-sub" style={{ '--cat': item.color }}>
        <i aria-hidden="true" />
        <b>{item.name}</b>
        <span>{formatSize(item.size)}</span>
        <span className="storage-hover-note">{item.description || `${formatShare(item.share)} of the disk`}</span>
    </span>
);

/**
 * Storage card on the two-tone base: the volume and how full it is in the header, a bar of what
 * takes the space and a list of the categories with their share. `bar` draws the bar as a matrix
 * of dots (default) or as solid blocks. Half height keeps the bar and a line about the free space.
 * Pointing at a block or a list row highlights both and names the category in the header. Data older
 * than `staleAfter` minutes says when it was last updated in the header.
 * @param {Object} props
 * @param {Object} props.config - Card configuration, see the docs.
 * @returns {JSX.Element} The rendered card.
 */
const StorageCard = ({ config }) => {
    const [active, setActive] = useState(/** @type {string|null} */ (null));
    const [{ width: listWidth }, listRef] = useElementSize();
    const sourced = STORAGE_SOURCES.includes(config.source);
    const { volume: live, loading, error } = useStorage(config.id, config.source);
    // Until it has a source, the card shows sample data as a preview
    const volume = storageModel(sourced ? live : undefined);
    const size = storageSize(config);
    const variant = STORAGE_BARS.includes(config.bar) ? config.bar : 'dots';
    const half = size === 'half';
    const [rows, sizeColumns] = LIST[size] || LIST[1];
    // A narrow viewport shrinks the list: fewer columns, and the categories that no longer fit join Other
    const columns = columnsFor(listWidth, sizeColumns);
    const count = rows * columns;
    const now = useNow();
    const stale = isStale(volume.updated, config.staleAfter ?? STALE_AFTER, now);
    const usage = `${formatSize(volume.used)} of ${formatSize(volume.total)} used`;

    // At half height there is no list, so every category is its own entry
    const items = half ? volume.categories : legendItems(volume.categories, count);
    const groupOf = Object.fromEntries(items.flatMap(item => (item.members || [item.name]).map(name => [name, item.name])));
    const segments = volume.categories.map(c => ({ ...c, group: groupOf[c.name] }));
    const activeItem = items.find(item => item.name === active);

    // A card with a source shows nothing made up while its data is missing
    const missing = sourced && !live;
    const subtitle = missing ? (loading ? 'Loading…' : 'No data')
        : activeItem ? <HoverSubtitle item={activeItem} />
            : stale ? <StaleNote updated={volume.updated} now={now} /> : usage;

    return (
        <TwoToneBase
            className={`storage-card storage-twotone storage-${variant} size-${size}${active ? ' has-active' : ''}`}
            title={config.title || 'Storage'}
            subtitle={subtitle}
            icon={config.icon || 'lu-HardDrive'}
            iconBackground={config.iconBackground || ICON_BACKGROUND}
            iconColor={config.iconColor || '#fff'}
            actions={missing ? null : <span className="storage-percent">{volume.percent}<small>%</small></span>}
        >
            {missing ? (
                <EmptyState message={loading ? 'Loading…' : `Couldn't load the storage${error ? `: ${error}` : ''}`} />
            ) : (
                <>
                    <StorageBar
                        variant={variant} segments={segments} total={volume.total}
                        rows={ROWS[size]} height={HEIGHTS[size]} format={formatSize}
                        active={active} onHover={setActive}
                    />
                    {half ? (
                        <p className="storage-caption">
                            <span>{formatSize(volume.free)} free</span>
                            <span>{largestCategory(volume.categories)?.name} is largest</span>
                        </p>
                    ) : (
                        <ul ref={listRef} className="storage-list" style={{ '--list-cols': columns }} onPointerLeave={() => setActive(null)}>
                            {items.map(c => (
                                <li
                                    key={c.name}
                                    style={{ '--cat': c.color }}
                                    className={active === c.name ? 'is-active' : undefined}
                                    tabIndex={0}
                                    onPointerEnter={() => setActive(c.name)}
                                    onFocus={() => setActive(c.name)}
                                    onBlur={() => setActive(null)}
                                >
                                    <span className="storage-list-dot" />
                                    <span className="storage-list-name">{c.name}</span>
                                    <span className="storage-list-share">{formatShare(c.share)}</span>
                                    <span className="storage-list-size">{formatSize(c.size)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </TwoToneBase>
    );
};

export default StorageCard;
