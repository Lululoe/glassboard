import { usePluginsPending } from '../../plugins/registry';

/**
 * Stands in for a card whose type no plugin adds: while plugins from the plugins folder are
 * still loading it waits, as its plugin may be among them; after that it says the type isn't
 * installed.
 * @param {Object} props
 * @param {string} [props.type] - The configured card type.
 * @returns {JSX.Element} The card.
 */
const MissingCard = ({ type }) => {
    const pending = usePluginsPending();
    let text = 'Card is missing a type';
    if (type) text = pending ? 'Loading plugin…' : `Unknown card type "${type}". Is its plugin installed?`;
    return (
        <div className="glass-card" aria-busy={pending && Boolean(type)}>
            <div className="card-content">{text}</div>
        </div>
    );
};

export default MissingCard;
