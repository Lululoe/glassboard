import './StatusPill.css';

/**
 * A short state in a tinted pill, used wherever a card shows the state of an item.
 * @param {Object} props
 * @param {'gray'|'green'|'orange'|'blue'|'purple'|'red'} [props.tone='gray'] - Its color.
 * @param {string} [props.className] - Additional classes.
 * @param {import('react').ReactNode} props.children - The icon, if any, and the word.
 * @returns {JSX.Element} The pill.
 */
const StatusPill = ({ tone = 'gray', className = '', children }) => (
    <span className={`status-pill ${tone} ${className}`.trim()}>{children}</span>
);

export default StatusPill;
