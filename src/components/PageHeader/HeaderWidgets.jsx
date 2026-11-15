import { Plus, Pencil, EyeOff } from 'lucide-react';
import {
    formatStateValue, headerColorCss, widgetFraction, widgetIcon, widgetVisible,
} from '../../../shared/pageHeader';
import Icon from '../Shared/Icon';

/*
 * The page header's widgets, in the style of lock screen widgets: a closed ring, an open ring
 * with a dot, a number, and a rectangle with one or two values. They sit straight on the page;
 * monochrome headers draw them in the text color.
 */

/** Height of every widget in px: circles are this wide, rectangles this tall. */
const SIZE = 46;
/** Width of the rings and gauge arcs: thick, as on the lock screen. */
const STROKE = 6;

/** Units shown as a small degree sign in the circles, as on the lock screen. */
const DEGREES = new Set(['°C', '°F', '°']);

/**
 * The value for the circles: the number, with a degree sign for temperatures.
 * @param {Object|null|undefined} state - The entity's state.
 * @param {string} [locale] - Locale for the number.
 * @returns {string} The value.
 */
function shortValue(state, locale) {
    const value = formatStateValue(state, locale, { whole: true });
    return value !== '–' && DEGREES.has(state?.attributes?.unit_of_measurement) ? `${value}°` : value;
}

/**
 * A closed ring filled to the value.
 * @param {Object} props
 * @param {number} props.fraction - Fill from 0 to 1.
 * @param {string} props.color - CSS color.
 */
function Ring({ fraction, color }) {
    const c = SIZE / 2;
    const r = (SIZE - STROKE) / 2;
    return (
        <svg className="ph-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth={STROKE} />
            {fraction > 0 && (
                <circle
                    cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={STROKE}
                    strokeLinecap="round" pathLength="100" strokeDasharray={`${fraction * 100} 100`}
                    transform={`rotate(-90 ${c} ${c})`}
                />
            )}
        </svg>
    );
}

/**
 * An open ring with a gap at the bottom, filled up to a dot at the value.
 * @param {Object} props
 * @param {number} props.fraction - Position from 0 to 1.
 * @param {string} props.color - CSS color.
 */
function Gauge({ fraction, color }) {
    const c = SIZE / 2;
    const r = (SIZE - STROKE) / 2;
    const start = 135; // degrees, clockwise from +x
    const sweep = 270;
    const point = (deg) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)];
    const [x1, y1] = point(start);
    const [x2, y2] = point(start + sweep);
    const [mx, my] = point(start + sweep * fraction);
    const arc = (to, [x, y]) => `M ${x1} ${y1} A ${r} ${r} 0 ${to - start > 180 ? 1 : 0} 1 ${x} ${y}`;
    return (
        <svg className="ph-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <path d={arc(start + sweep, [x2, y2])} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth={STROKE} strokeLinecap="round" />
            {fraction > 0 && (
                <path d={arc(start + sweep * fraction, [mx, my])} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
            )}
            <circle cx={mx} cy={my} r={STROKE / 2 + 0.5} fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
        </svg>
    );
}

/**
 * One widget, drawn from its entity's state.
 * @param {Object} props
 * @param {Object} props.widget - The widget, as normalizeWidget returns it.
 * @param {Object<string, Object|null>} props.states - States by entity id.
 * @param {string} [props.locale] - Locale for numbers.
 * @param {boolean} props.monochrome - Draws it in the text color.
 * @returns {JSX.Element} The widget.
 */
function Widget({ widget, states, locale, monochrome }) {
    const state = states[widget.entity_id];
    const color = monochrome ? 'currentColor' : headerColorCss(widget.color);
    const icon = widgetIcon(widget, state);
    const name = widget.name || state?.attributes?.friendly_name || widget.entity_id;
    const unit = state?.attributes?.unit_of_measurement;
    const value = formatStateValue(state, locale);
    const label = `${name}: ${value}${unit && value !== '–' ? ` ${unit}` : ''}`;

    if (widget.type === 'rectangle') {
        const second = widget.entity_id2 ? states[widget.entity_id2] : undefined;
        const secondValue = second !== undefined ? formatStateValue(second, locale) : null;
        const secondUnit = second?.attributes?.unit_of_measurement;
        return (
            <div className="ph-r" role="img" aria-label={secondValue ? `${label}, ${secondValue} ${secondUnit ?? ''}`.trim() : label} title={name}>
                {icon && <Icon className="ph-r-icon" icon={icon} size={22} color={color} strokeWidth={2.25} />}
                <div className="ph-r-text">
                    <span className="ph-r-primary">{value}{unit && value !== '–' && <small> {unit}</small>}</span>
                    <span className="ph-r-secondary">
                        {secondValue !== null ? `${secondValue}${secondUnit && secondValue !== '–' ? ` ${secondUnit}` : ''}` : name}
                    </span>
                </div>
            </div>
        );
    }

    const fraction = widgetFraction(widget, state);
    const short = shortValue(state, locale);
    const small = short.length > 4 ? ' is-long' : '';
    return (
        <div className={`ph-s ph-type-${widget.type}`} role="img" aria-label={label} title={name}>
            {widget.type === 'ring' && <Ring fraction={fraction} color={color} />}
            {widget.type === 'gauge' && <Gauge fraction={fraction} color={color} />}
            {widget.type === 'gauge' ? (
                <>
                    <span className={`ph-s-gauge-value${small}`}>{short}</span>
                    {icon && <Icon className="ph-s-gauge-icon" icon={icon} size={10} color={color} strokeWidth={2.75} />}
                </>
            ) : (
                <div className="ph-s-inner">
                    {icon && <Icon icon={icon} size={widget.type === 'number' ? 16 : 11} color={color} strokeWidth={2.75} />}
                    <span className={`ph-s-value${small}`}>{short}</span>
                </div>
            )}
        </div>
    );
}

/**
 * The header's widgets. They are the header's flex items directly, so it can wrap them together.
 * Widgets whose condition isn't met are left out, except in edit mode, where they are dimmed.
 * @param {Object} props
 * @param {Array<Object>} props.widgets - The widgets, as resolvePageHeader returns them.
 * @param {Object<string, Object|null>} props.states - States by entity id.
 * @param {string} [props.locale] - Locale for numbers.
 * @param {boolean} [props.monochrome] - Draws them in the text color.
 * @param {(index: number|null) => void} [props.onEdit] - Opens a widget's editor, or a new one's
 *   with null; given in edit mode.
 * @returns {JSX.Element} The widgets.
 */
export default function HeaderWidgets({ widgets, states, locale, monochrome = false, onEdit }) {
    return (
        <>
            {widgets.map((widget, index) => {
                const visible = widgetVisible(widget, states[widget.entity_id]);
                if (!onEdit) return visible ? <Widget key={widget.id} widget={widget} states={states} locale={locale} monochrome={monochrome} /> : null;
                return (
                    <button
                        key={widget.id}
                        type="button"
                        className={`button-reset ph-widget-button${visible ? '' : ' is-hidden'}${widget.type === 'rectangle' ? ' is-wide' : ''}`}
                        aria-label={`Edit widget ${index + 1}${visible ? '' : ', hidden by its condition'}`}
                        onClick={() => onEdit(index)}
                    >
                        <Widget widget={widget} states={states} locale={locale} monochrome={monochrome} />
                        <span className="grid-icon-badge ph-widget-badge" aria-hidden="true">
                            {visible ? <Pencil size={10} strokeWidth={3} /> : <EyeOff size={10} strokeWidth={3} />}
                        </span>
                    </button>
                );
            })}
            {onEdit && (
                <button type="button" className="button-reset ph-add-widget" aria-label="Add widget" title="Add widget" onClick={() => onEdit(null)}>
                    <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
                </button>
            )}
        </>
    );
}
