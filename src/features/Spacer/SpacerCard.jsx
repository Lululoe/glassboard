import './SpacerCard.css';

/**
 * Empty card that only takes up space, to shape the layout. It is invisible on the
 * dashboard and shown as a dashed outline in edit mode.
 * @returns {JSX.Element} The spacer.
 */
const SpacerCard = () => <div className="spacer-card" aria-hidden="true" />;

export default SpacerCard;
