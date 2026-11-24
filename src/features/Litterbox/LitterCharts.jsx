import { dayFraction, formatChange, formatTime, formatWeight, weightChange } from './litterModel';

/**
 * Today's visits per cat, on one lane each, with each visit's time below its mark.
 * @param {Object} props
 * @param {Array<Object>} props.cats - The cats, with colors.
 * @param {Object|null} props.history - The `today` history.
 * @param {number} props.now - The current time in ms.
 * @returns {JSX.Element} The chart.
 */
export const TodayChart = ({ cats, history, now }) => (
    <div className="lb-chart lb-today">
        <div className="lb-today-lanes">
            {cats.map(cat => {
                const visits = history?.cats?.find(c => c.index === cat.index)?.visits || [];
                return (
                    <div className="lb-lane" key={cat.index} style={/** @type {import('react').CSSProperties} */ ({ '--cat': cat.color })}>
                        <span className="lb-lane-name">{cat.name}</span>
                        <div className="lb-lane-track" role="img" aria-label={`${cat.name}: ${visits.length ? visits.map(formatTime).join(', ') : 'no visits yet'}`}>
                            <span className="lb-grid" style={{ left: '25%' }} />
                            <span className="lb-grid" style={{ left: '50%' }} />
                            <span className="lb-grid" style={{ left: '75%' }} />
                            {visits.map((t, i) => (
                                <span key={`${t}-${i}`} className="lb-lane-visit" style={{ left: `${dayFraction(t) * 100}%` }}>
                                    <span className="lb-lane-time">{formatTime(t)}</span>
                                </span>
                            ))}
                            <span className="lb-now" style={{ left: `${dayFraction(now) * 100}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
        <div className="lb-axis lb-chart-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </div>
);

/**
 * Visits on each of the last seven days, stacked by cat, with the total above each bar.
 * @param {Object} props
 * @param {Array<Object>} props.cats - The cats, with colors.
 * @param {Object|null} props.history - The `week` history.
 * @returns {JSX.Element} The chart.
 */
export const WeekChart = ({ cats, history }) => {
    const start = history?.start ?? null;
    const perCat = cats.map(cat => history?.cats?.find(c => c.index === cat.index)?.days || Array(7).fill(0));
    const totals = Array.from({ length: 7 }, (_, d) => perCat.reduce((sum, days) => sum + (days[d] || 0), 0));
    const max = Math.max(4, ...totals);
    const dayName = (d) => {
        if (d === 6) return 'Today';
        if (start === null) return '';
        const date = new Date(start);
        date.setDate(date.getDate() + d);
        return date.toLocaleDateString(undefined, { weekday: 'short' });
    };
    return (
        <div className="lb-chart lb-week" role="img" aria-label={`Visits per day: ${totals.map((t, d) => `${dayName(d)} ${t}`).join(', ')}`}>
            {totals.map((total, d) => (
                <div className="lb-day" key={d}>
                    <div className="lb-day-bar">
                        <b className="lb-day-total">{total}</b>
                        {cats.map((cat, i) => {
                            const v = perCat[i][d] || 0;
                            return v > 0 && <span key={cat.index} className="lb-day-part" style={{ height: `${(v / max) * 100}%`, background: cat.color }} />;
                        })}
                    </div>
                    <span className="lb-day-name">{dayName(d)}</span>
                </div>
            ))}
        </div>
    );
};

/**
 * Each cat's weight over the last 30 days, as its own small line chart.
 * @param {Object} props
 * @param {Array<Object>} props.cats - The cats, with colors.
 * @param {Object|null} props.history - The `weight` history.
 * @returns {JSX.Element} The charts.
 */
export const WeightChart = ({ cats, history }) => (
    <div className="lb-chart lb-weight">
        {cats.map(cat => {
            const points = history?.cats?.find(c => c.index === cat.index)?.points || [];
            const change = weightChange(points);
            const values = points.map(p => p.v);
            const lo = values.length ? Math.min(...values) : 0;
            const hi = values.length ? Math.max(...values) : 1;
            const pad = Math.max((hi - lo) * 0.15, 0.05);
            const t0 = points[0]?.t ?? 0;
            const t1 = points[points.length - 1]?.t ?? 1;
            const x = (t) => (t1 > t0 ? ((t - t0) / (t1 - t0)) * 100 : 50);
            const y = (v) => 100 - ((v - (lo - pad)) / (hi - lo + pad * 2)) * 100;
            return (
                <div className="lb-weight-cat" key={cat.index} style={/** @type {import('react').CSSProperties} */ ({ '--cat': cat.color })}>
                    <div className="lb-weight-head">
                        <b>{cat.name}</b>
                        <span>
                            {formatWeight(cat.weight ?? values[values.length - 1] ?? null, cat.weight_unit)}
                            {change !== null && ` · ${formatChange(change, cat.weight_unit)} in 30 days`}
                        </span>
                    </div>
                    {points.length > 1 ? (
                        <div className="lb-weight-plot">
                            <span className="lb-weight-scale" aria-hidden="true">
                                <span style={{ top: `${y(hi)}%` }}>{formatWeight(hi)}</span>
                                {hi !== lo && <span style={{ top: `${y(lo)}%` }}>{formatWeight(lo)}</span>}
                            </span>
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${cat.name}'s weight over 30 days, from ${formatWeight(points[0].v, cat.weight_unit)} to ${formatWeight(points[points.length - 1].v, cat.weight_unit)}`}>
                                <polyline points={points.map(p => `${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />
                            </svg>
                        </div>
                    ) : <div className="lb-chart-empty">{history ? 'No weights in the last 30 days' : 'Loading…'}</div>}
                </div>
            );
        })}
    </div>
);
