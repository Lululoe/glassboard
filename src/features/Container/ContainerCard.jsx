import { getCardComponent } from '../registry';
import CardErrorBoundary from '../../components/Grid/CardErrorBoundary';
import { buildEntries, fitToColumns, isSubTile, rowSpanOf, sizeOf } from '../../components/Grid/gridLayout';
import { childCardsOf } from '../../../shared/containerCards';
import { columnsOf, scaleOf } from './containerModel';
import './ContainerCard.css';

/**
 * Fallback for a card inside the container whose type is not registered.
 * @param {Object} props
 * @param {string} [props.type] - The configured card type.
 * @returns {JSX.Element} The fallback card.
 */
const UnknownCard = ({ type }) => (
    <div className="glass-card">
        <div className="card-content">{type ? `Unknown card type "${type}"` : 'Card is missing a type'}</div>
    </div>
);

/**
 * Returns a stable key for a card inside the container: its id, or its position.
 * @param {Array<Object>} cards - The container's cards.
 * @param {number} index - Position of the card.
 * @returns {string} The key.
 */
const keyOf = (cards, index) => (cards[index].id !== undefined ? `id:${cards[index].id}` : `idx:${index}`);

/**
 * Renders one card inside the container, drawn a little smaller than on the page.
 * @param {Array<Object>} cards - The container's cards, fitted to it.
 * @param {number} index - Position of the card; edit mode finds the card by it (`data-child-index`).
 * @param {Object|undefined} globalConfig - The dashboard config.
 * @param {{col: number, row: number, w: number, h: number}} [place] - Its cell in a shared half/quarter slot.
 * @returns {JSX.Element} The card.
 */
const renderItem = (cards, index, globalConfig, place) => {
    const card = cards[index];
    const Card = getCardComponent(card.type);
    const size = sizeOf(card);
    /** @type {import('react').CSSProperties} */
    const style = {};
    if (place) {
        style.gridColumn = `${place.col + 1} / span ${place.w}`;
        style.gridRow = `${place.row + 1} / span ${place.h}`;
    } else {
        style.gridColumn = `span ${Number(size)}`;
        if (rowSpanOf(card) > 1) style.gridRow = `span ${rowSpanOf(card)}`;
    }
    if (card.primaryColor) style['--card-primary'] = card.primaryColor;

    return (
        <div key={keyOf(cards, index)} data-child-index={index} className={`container-card-item ${isSubTile(size) ? `tile-${size}` : `col-span-${size}`}`} style={style}>
            <div className="container-card-scale">
                <CardErrorBoundary label={card.id ?? card.type} resetKey={card}>
                    {Card ? <Card config={card} globalConfig={globalConfig} /> : <UnknownCard type={card.type} />}
                </CardErrorBoundary>
            </div>
        </div>
    );
};

/**
 * A card that holds other cards. It is as wide and as tall as set in its layout, and its cards
 * fill it in a grid of the same number of columns and rows, drawn a little smaller (`scale`)
 * than on the page. Cards are narrowed to the container's width, half and quarter cards share
 * slots like on the page, and cards that don't fit scroll inside the container.
 * @param {Object} props
 * @param {Object} props.config - The container's config: `cards`, and optionally `title`,
 *   `scale` (0.6 to 1) and `background` (`false` for no panel behind the cards).
 * @param {Object} [props.globalConfig] - The dashboard config, passed to every card inside.
 * @returns {JSX.Element} The container.
 */
const ContainerCard = ({ config, globalConfig }) => {
    const columns = columnsOf(config);
    const rows = rowSpanOf(config);
    const cards = childCardsOf(config).map(card => fitToColumns(card, columns));
    const entries = buildEntries(cards);
    const plain = config.background === false;

    /** @type {import('react').CSSProperties & Object<string, string|number>} */
    const style = { '--container-cols': columns, '--container-rows': rows, '--container-scale': scaleOf(config) };

    return (
        <section
            className={`container-card${plain ? ' plain' : ''}${config.title ? ' has-title' : ''}`}
            style={style}
            aria-label={config.title || undefined}
        >
            {config.title && <h2 className="container-card-title">{config.title}</h2>}
            <div className="container-card-body">
                {cards.length === 0
                    ? <p className="container-card-empty">No cards yet. Add them in the container's settings.</p>
                    : (
                        <div className="container-card-grid">
                            {entries.map(entry => (entry.kind === 'card'
                                ? renderItem(cards, entry.index, globalConfig)
                                : (
                                    <div key={`slot:${keyOf(cards, entry.items[0].index)}`} className="container-card-slot">
                                        {entry.items.map(item => renderItem(cards, item.index, globalConfig, item))}
                                    </div>
                                )))}
                        </div>
                    )}
            </div>
        </section>
    );
};

export default ContainerCard;
