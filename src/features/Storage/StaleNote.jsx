import React from 'react';
import Icon from '../../components/Shared/Icon';
import { formatFullTime, formatRelativeTime } from '../../lib/format';
import './StorageCard.css';

/**
 * Says when a card's data was last updated, for a card whose data is older than it should be.
 * Shown in place of the header's second line.
 * @param {Object} props
 * @param {string} props.updated - When the data was last updated, as an ISO date.
 * @param {Date} props.now - The current time.
 * @returns {JSX.Element} The note.
 */
const StaleNote = ({ updated, now }) => (
    <span className="stale-note" title={`Last updated ${formatFullTime(updated)}`}>
        <Icon icon="lu-Clock3" size={13} />
        Updated {formatRelativeTime(updated, now)}
    </span>
);

export default StaleNote;
