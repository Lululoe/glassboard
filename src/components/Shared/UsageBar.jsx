import { usageLevel } from './usageLevel';
import './UsageBar.css';

/**
 * A bar showing how much of something is used: the accent color, orange when getting full
 * and red when nearly full.
 * @param {Object} props
 * @param {number} props.percent - The usage from 0 to 100.
 * @param {string} props.label - What is measured, for assistive technology.
 * @returns {JSX.Element} The bar.
 */
const UsageBar = ({ percent, label }) => {
    const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    return (
        <div
            className={`usage-bar ${usageLevel(value)}`}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value)}
        >
            <div style={{ width: `${value}%` }} />
        </div>
    );
};

export default UsageBar;
