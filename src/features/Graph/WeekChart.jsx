import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cssVars, formatValue, percentChange, signedPercent, weekDayName, weekTotals } from './graphModel';

/**
 * This week against last week, a column per day. With several sensors in one unit the columns
 * stack: hover or tap a part to see its sensor and value, and on wide cards a list breaks the
 * selected day down. Last week stays grey; the selected day is highlighted.
 * @param {Object} props
 * @param {Array<Object>} props.parts - Sensors shown (one, or several that stack), with `name`,
 *   `unit`, `color` and 14 `values`.
 * @param {number[]} props.times - Start of each day in ms; the last is today.
 * @param {boolean} props.wide - Whether there's room for the breakdown list.
 * @param {boolean} [props.breakdown=true] - Whether to show the breakdown list on wide cards.
 * @returns {JSX.Element} The chart.
 */
const WeekChart = ({ parts, times, wide, breakdown = true }) => {
    const [selected, setSelected] = useState(13);
    const [part, setPart] = useState(/** @type {{day: number, index: number}|null} */ (null));
    const barsRef = useRef(/** @type {HTMLDivElement|null} */ (null));
    const tipRef = useRef(/** @type {HTMLDivElement|null} */ (null));
    const stacked = parts.length > 1;
    const showBreakdown = wide && stacked && breakdown;
    const unit = parts[0]?.unit || '';
    const { totals, thisWeek } = weekTotals(parts);
    const max = Math.max(...totals, 0) || 1;
    const top = max * 1.05;
    const average = thisWeek / 7;
    const other = selected < 7 ? selected + 7 : selected - 7;
    const dayName = weekDayName(times[selected], selected);
    const change = percentChange(totals[selected], totals[other]);
    const letter = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' });

    // Touch: the tooltip stays until something outside the columns is tapped
    useEffect(() => {
        if (!part) return undefined;
        const onDown = (e) => {
            if (!barsRef.current?.contains(e.target)) setPart(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [part]);

    // Place the part's tooltip above it, inside the chart
    useLayoutEffect(() => {
        const tip = tipRef.current;
        const bars = barsRef.current;
        if (!tip || !bars || !part) return;
        const el = bars.querySelector(`[data-day="${part.day}"] [data-part="${part.index}"]`);
        if (!el) return;
        const box = bars.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.min(box.width - half, Math.max(half, r.left + r.width / 2 - box.left))}px`;
        tip.style.top = `${r.top - box.top}px`;
    }, [part]);

    const pointAt = (e) => {
        const el = /** @type {Element} */ (e.target).closest?.('[data-part]');
        if (!el) return null;
        return { day: Number(/** @type {HTMLElement} */ (el.closest('[data-day]')).dataset.day), index: Number(/** @type {HTMLElement} */ (el).dataset.part) };
    };

    const tipPart = part && parts[part.index];
    const tipTotal = part ? totals[part.day] : 0;

    return (
        <div className={`graph-week${showBreakdown ? ' with-breakdown' : ''}`}>
            <div className="graph-week-main">
                <div className="graph-hero">
                    <span className="graph-hero-value">{formatValue(totals[selected], unit)}</span>
                    <span className="graph-caption">
                        {dayName}
                        {change !== null && (
                            <>
                                {' · '}
                                <span className={change >= 0 ? 'graph-up' : 'graph-down'}>{signedPercent(change)}</span>
                                {` vs ${selected < 7 ? 'this' : 'last'} ${weekDayName(times[selected % 7 + 7], 7)}`}
                            </>
                        )}
                    </span>
                </div>
                <div
                    ref={barsRef}
                    className="graph-week-bars"
                    onPointerOver={(e) => {
                        const p = pointAt(e);
                        if (p) setPart(p);
                    }}
                    onPointerOut={(e) => {
                        if (e.pointerType === 'mouse' && !/** @type {Element|null} */ (e.relatedTarget)?.closest?.('[data-part]')) setPart(null);
                    }}
                >
                    {times.map((t, day) => {
                        const label = `${weekDayName(t, day)}, ${formatValue(totals[day], unit)}${stacked ? `: ${parts.map(s => `${s.name} ${formatValue(s.values[day], unit)}`).join(', ')}` : ''}`;
                        return (
                            <span key={t} className="graph-week-slot">
                                {day === 7 && <span className="graph-week-split" aria-hidden="true" />}
                                <button
                                    type="button"
                                    data-day={day}
                                    className={`button-reset graph-week-col${day < 7 ? ' last-week' : ''}`}
                                    aria-pressed={day === selected}
                                    aria-label={label}
                                    onClick={(e) => {
                                        setSelected(day);
                                        // A tap on a part shows it; elsewhere on the column hides the tooltip
                                        setPart(pointAt(e));
                                    }}
                                >
                                    <span className="graph-week-track">
                                        <span
                                            className={`graph-week-stack${part?.day === day ? ' has-part' : ''}`}
                                            style={{ height: `${(totals[day] / top) * 100}%` }}
                                        >
                                            {parts.map((s, index) => (
                                                <i
                                                    key={index}
                                                    data-part={index}
                                                    className={part?.day === day && part.index === index ? 'active' : undefined}
                                                    style={cssVars({ '--c': s.color, height: `${totals[day] > 0 ? ((s.values[day] || 0) / totals[day]) * 100 : 0}%` })}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span className="graph-week-day" aria-hidden="true">{letter(t)}</span>
                                </button>
                            </span>
                        );
                    })}
                    <div className="graph-week-average" style={{ bottom: `calc(34px + (100% - 34px) * ${average / top})` }} aria-hidden="true" />
                    {tipPart && (
                        <div ref={tipRef} className="graph-part-tip" role="status">
                            <div className="graph-tip-when">{weekDayName(times[part.day], part.day)}</div>
                            <div className="graph-tip-row strong">
                                <span className="graph-dot" style={cssVars({ '--c': tipPart.color })} />
                                {tipPart.name}
                                <b>{formatValue(tipPart.values[part.day], unit)}</b>
                            </div>
                            {stacked && tipTotal > 0 && (
                                <div className="graph-tip-when">
                                    {`${Math.round(((tipPart.values[part.day] || 0) / tipTotal) * 100)}% of ${formatValue(tipTotal, unit)}`}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {showBreakdown && (
                <div className="graph-breakdown">
                    <div className="graph-breakdown-head">{dayName}</div>
                    {parts.map((s, index) => {
                        const v = s.values[selected] || 0;
                        const share = totals[selected] > 0 ? v / totals[selected] : 0;
                        const d = percentChange(v, s.values[other] || 0);
                        return (
                            <div
                                key={index}
                                className={`graph-breakdown-row${part?.day === selected && part.index === index ? ' active' : ''}`}
                                style={cssVars({ '--c': s.color })}
                            >
                                <span className="graph-dot" />
                                <span className="graph-breakdown-name">{s.name}</span>
                                <span className="graph-breakdown-value">{formatValue(v, unit)}</span>
                                <span className="graph-breakdown-sub">
                                    <span>{`${Math.round(share * 100)}% of day`}</span>
                                    {d !== null && <span className={d >= 0 ? 'graph-up' : 'graph-down'}>{signedPercent(d)}</span>}
                                </span>
                                <span className="graph-share"><i style={{ width: `${share * 100}%` }} /></span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WeekChart;
