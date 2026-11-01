import { useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import './MediaCard.css';
import { useMedia } from './useMedia';
import { useFitCount } from '../../hooks/useFitCount';

// Helpers
/**
 * Formats a given date to a string: "Today", "Tomorrow", or the weekday name.
 * @param {string|Date} date - The date to format.
 * @returns {string} The formatted header string.
 */
const formatHeader = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'long' });
};

/**
 * Formats an ISO date string to a 24-hour time string (HH:MM).
 * @param {string} iso - The ISO date string.
 * @returns {string} The formatted time.
 */
const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Filters an array of events to only include those occurring on a specific date.
 * @param {Array} events - The list of media events.
 * @param {string|Date} date - The target date.
 * @returns {Array} The filtered list of events.
 */
const groupByDay = (events, date) => {
    const startObj = new Date(date);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + 1);

    return events.filter(e => {
        const t = new Date(e.datetime).getTime();
        return t >= startObj.getTime() && t < endObj.getTime();
    });
};

/**
 * Component that displays a calendar of upcoming media releases (from Sonarr/Radarr).
 * @param {Object} props
 * @param {Object} props.config - Configuration object for the media card.
 * @returns {JSX.Element} The rendered media card.
 */
const MediaCard = ({ config = {} }) => {
    const colSpan = config.colSpan || 1;
    // Up to two days per grid column, as many as fit the card's current width
    const [visibleDays, gridRef] = useFitCount(110, colSpan * 2);

    const icon = config.icon || "lu-Tv";
    const iconColor = config.iconColor || "#FDC7FF";
    const iconBackground = config.iconBackground || "linear-gradient(45deg,rgba(54, 111, 255, 1) 0%, rgba(171, 80, 240, 1) 100%)";

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const days = Array.from({ length: visibleDays }).map((_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });

    const endDate = days[days.length - 1];

    // The range end is exclusive, so request through the day after the last visible day.
    const fetchEndDate = new Date(endDate);
    fetchEndDate.setDate(fetchEndDate.getDate() + 1);

    const { events, error } = useMedia(startDate, fetchEndDate);

    const prevDay = () => setStartDate(d => {
        const n = new Date(d); n.setDate(n.getDate() - 1); return n;
    });
    const nextDay = () => setStartDate(d => {
        const n = new Date(d); n.setDate(n.getDate() + 1); return n;
    });

    return (
        <TwoToneBase
            title="Media"
            url={config.services?.[0]?.url || config.url}
            subtitle={<span>{`${events.length} upcoming`}</span>}
            icon={icon}
            iconColor={iconColor}
            iconBackground={iconBackground}

            actions={(
                <>
                    <button type="button" className="button-reset two-tone-header-action" onClick={prevDay} aria-label="Previous day" title="Previous day"><Icon icon="lu-ChevronLeft" size={18} /></button>
                    <button type="button" className="button-reset two-tone-header-action" onClick={nextDay} aria-label="Next day" title="Next day"><Icon icon="lu-ChevronRight" size={18} /></button>
                </>
            )}
        >
            <div className="media-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${visibleDays}, minmax(0, 1fr))` }}>
                {days.map((d, idx) => {
                    const dayEvents = groupByDay(events, d);
                    return (
                        <div className="media-day" key={idx}>
                            <div className="media-day-header">{formatHeader(d)}</div>
                            <div className="media-day-body">
                                {error ? (
                                    <div className="media-empty">Error</div>
                                ) : (
                                    dayEvents.length === 0 ? (
                                        <div className="media-empty">TBA</div>
                                    ) : (
                                        dayEvents.map((ev, i) => (
                                            <MediaEvent key={ev.id ?? i} event={ev} />
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </TwoToneBase>
    );
};

// Each status gets a glyph and a name as well as a color, so it never relies on color alone
const STATUS = {
    downloaded: { icon: 'lu-CircleCheck', label: 'Downloaded' },
    downloading: { icon: 'lu-CircleArrowDown', label: 'Downloading' },
    missing: { icon: 'lu-CircleAlert', label: 'Missing' },
    upcoming: { icon: 'lu-Clock', label: 'Not yet available' },
    not_yet_out: { icon: 'lu-Clock', label: 'Not yet available' },
};

/**
 * Renders an individual media event item (movie or episode).
 * @param {Object} props
 * @param {Object} props.event - The media event object.
 * @returns {JSX.Element} The rendered media event UI.
 */
const MediaEvent = ({ event }) => {
    // Type icon
    const iconName = event.type === 'radarr' ? 'lu-Film' : 'lu-Tv';
    const status = STATUS[event.status];

    const eventContent = (
        <>
            <div className={`media-event-status ${event.status}`} aria-hidden="true" />
            <div className="media-event-icon">
                <Icon icon={iconName} size={12} strokeWidth={2.5} />
            </div>
            <div className="media-event-body">
                <div className="media-event-title">{event.title}</div>
                <div className="media-event-meta">{event.secondary}</div>
                <div className="media-event-time">
                    {status && (
                        <span className={`media-event-status-glyph ${event.status}`} title={status.label}>
                            <Icon icon={status.icon} size={12} strokeWidth={2.5} />
                            <span className="visually-hidden">{status.label}, </span>
                        </span>
                    )}
                    {formatTime(event.datetime)}
                </div>
            </div>
        </>
    );

    return event.url ? (
        <a href={event.url} target="_blank" rel="noopener noreferrer" className="media-event media-event-link">
            {eventContent}
        </a>
    ) : (
        <div className="media-event">
            {eventContent}
        </div>
    );
};

export default MediaCard;
