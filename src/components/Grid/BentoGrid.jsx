import { getCardComponent } from '../../features/registry';
import CardErrorBoundary from './CardErrorBoundary';
import './BentoGrid.css';

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
 * Renders a grid of dashboard cards.
 * @param {Object} props
 * @param {Array<Object>} [props.cards] - Card configs for this page.
 * @param {Object} [props.globalConfig] - The full dashboard config, passed to every card.
 * @returns {JSX.Element|null} The rendered grid, or null when there are no cards.
 */
const BentoGrid = ({ cards, globalConfig }) => {
    if (!Array.isArray(cards)) return null;

    return (
        <div className="bento-grid-container">
            {cards.map((card, idx) => {
                const CardComponent = getCardComponent(card.type);
                /** @type {import('react').CSSProperties & Object<string, string|number>} */
                const style = card.primaryColor
                    ? { '--card-primary': card.primaryColor, '--i': idx }
                    : { '--i': idx };

                return (
                    <div key={card.id ?? idx} className={`grid-item col-span-${card.colSpan || 1}`} style={style}>
                        <CardErrorBoundary label={card.id ?? card.type} resetKey={card}>
                            {CardComponent
                                ? <CardComponent config={card} globalConfig={globalConfig} />
                                : <FallbackCard type={card.type} />}
                        </CardErrorBoundary>
                    </div>
                );
            })}
        </div>
    );
};

export default BentoGrid;
