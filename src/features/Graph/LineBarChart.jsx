import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { axisLabels, cssVars, formatValue, niceRange, pointLabel } from './graphModel';

const TOP = 8;
const BOTTOM = 22;
const LABEL_WIDTH = 50;
const DUAL_WIDTH = 40;

/**
 * Lines or bars for one or more sensors over a time range. Sensors with the same unit share an
 * axis; with two units, the first gets an axis on the left and the second on the right. Hover (mouse) or press and slide (touch)
 * to read every sensor at that time; arrow keys do the same.
 * @param {Object} props
 * @param {Array<Object>} props.series - Sensors with `name`, `unit`, `color`, `kind` and `values`.
 * @param {number[]} props.times - Start of each period in ms.
 * @param {number} props.minutes - Length of a period.
 * @param {number} props.hours - The time range.
 * @param {'line'|'bar'} props.type - Lines or bars.
 * @param {boolean} props.stack - Whether bars stack.
 * @param {Set<number>} props.hidden - Positions of hidden sensors.
 * @param {number|null} [props.focus] - A sensor to highlight.
 * @returns {JSX.Element} The chart.
 */
const LineBarChart = ({ series, times, minutes, hours, type, stack, hidden, focus = null }) => {
    const [size, measure] = useElementSize();
    const [active, setActive] = useState(/** @type {number|null} */ (null));
    const pressed = useRef(false);
    const tipRef = useRef(/** @type {HTMLDivElement|null} */ (null));
    const gradient = useId();
    const bar = type === 'bar';
    const n = times.length;

    const chart = useMemo(() => {
        const visible = series.map((s, i) => ({ ...s, i })).filter(s => !hidden.has(s.i));
        // Up to two units: one goes on the right; with two, the first goes on the left
        const units = [...new Set(visible.map(s => s.unit))].slice(0, 2);
        const drawn = visible.filter(s => units.includes(s.unit));
        const dual = units.length === 2;
        const left = dual ? DUAL_WIDTH : 0;
        const right = dual ? DUAL_WIDTH : LABEL_WIDTH;
        const w = Math.max(0, size.width - left - right);
        const h = Math.max(0, size.height - TOP - BOTTOM);
        const stacked = bar && stack && !dual;
        const scales = Object.fromEntries(units.map(unit => {
            const own = drawn.filter(s => s.unit === unit);
            const values = own.flatMap(s => s.values).filter(Number.isFinite);
            let max = Math.max(...values);
            if (stacked) max = Math.max(...times.map((_, j) => own.reduce((a, s) => a + Math.max(0, s.values[j] || 0), 0)));
            const fromZero = bar || own.some(s => s.kind === 'change');
            const [lo, hi] = niceRange(Math.min(...values), max, fromZero);
            // Percentages never need room above 100
            return [unit, [lo, unit === '%' && max <= 100 ? Math.max(Math.min(hi, 100), lo + 1) : hi]];
        }));
        const y = (unit, v) => {
            const [lo, hi] = scales[unit];
            return h - ((v - lo) / (hi - lo || 1)) * h;
        };
        const slot = n ? w / n : 0;
        const xs = times.map((_, j) => (bar ? j * slot + slot / 2 : (n > 1 ? (j / (n - 1)) * w : w / 2)));
        return { drawn, units, dual, left, right, w, h, stacked, scales, y, slot, xs };
    }, [series, hidden, size, bar, stack, times, n]);

    const { drawn, units, dual, left, w, h, stacked, scales, y, slot, xs } = chart;

    const pick = (clientX, rect) => {
        const x = clientX - rect.left - left;
        const j = bar ? Math.floor(x / (slot || 1)) : Math.round((x / (w || 1)) * (n - 1));
        setActive(Math.min(n - 1, Math.max(0, j)));
    };
    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse') return;
        pressed.current = true;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Synthetic events have no pointer to capture
        }
        pick(e.clientX, e.currentTarget.getBoundingClientRect());
    };
    const onPointerMove = (e) => {
        if (e.pointerType === 'mouse' || pressed.current) pick(e.clientX, e.currentTarget.getBoundingClientRect());
    };
    const onPointerEnd = (e) => {
        if (e.pointerType === 'mouse' && e.type !== 'pointerleave') return;
        pressed.current = false;
        setActive(null);
    };
    const onKeyDown = (e) => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (step) {
            e.preventDefault();
            setActive(a => Math.min(n - 1, Math.max(0, (a ?? n - 1) + step)));
        } else if (e.key === 'Escape') {
            setActive(null);
        }
    };

    // Keep the tooltip inside the chart
    useLayoutEffect(() => {
        const tip = tipRef.current;
        if (!tip || active === null) return;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.min(size.width - half, Math.max(half, left + xs[active]))}px`;
    }, [active, size, left, xs]);

    let body = null;
    if (w > 0 && h > 0 && drawn.length) {
        if (!bar) {
            const single = drawn.length === 1;
            body = drawn.map(s => {
                // Missing values break the line
                let d = '';
                let open = false;
                s.values.forEach((v, j) => {
                    if (!Number.isFinite(v)) {
                        open = false;
                        return;
                    }
                    d += `${open ? 'L' : 'M'}${xs[j].toFixed(1)},${y(s.unit, v).toFixed(1)}`;
                    open = true;
                });
                const focused = focus === s.i;
                return (
                    <g key={s.i} className={focus !== null && !focused ? 'graph-faded' : undefined}>
                        {single && d && (
                            <>
                                <defs>
                                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" stopColor={s.color} stopOpacity="0.3" />
                                        <stop offset="1" stopColor={s.color} stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d={`${d}L${xs[n - 1]},${h}L${xs[0]},${h}Z`} fill={`url(#${gradient})`} />
                            </>
                        )}
                        <path className="graph-line" d={d} style={{ stroke: s.color, strokeWidth: focused ? 3 : 2 }} />
                    </g>
                );
            });
        } else {
            const groupWidth = Math.max(3, Math.min(stacked ? 22 : 30, slot - 3));
            body = times.map((_, j) => {
                let base = 0;
                const width = stacked ? groupWidth : Math.max(2, groupWidth / drawn.length - 1);
                const parts = drawn.map((s, k) => {
                    const v = s.values[j];
                    if (!Number.isFinite(v) || v <= 0) return null;
                    const x = stacked ? xs[j] - groupWidth / 2 : xs[j] - groupWidth / 2 + k * (width + 1);
                    const y0 = y(s.unit, stacked ? base : 0);
                    const y1 = y(s.unit, (stacked ? base : 0) + v);
                    const top = !stacked || drawn.slice(k + 1).every(o => !(o.values[j] > 0));
                    const r = top ? Math.min(3, width / 2, y0 - y1) : 0;
                    if (stacked) base += v;
                    return (
                        <path
                            key={s.i}
                            className={focus !== null && focus !== s.i ? 'graph-faded' : undefined}
                            style={{ fill: s.color }}
                            d={`M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + width - r}Q${x + width},${y1} ${x + width},${y1 + r}V${y0}Z`}
                        />
                    );
                });
                return <g key={j} className={active !== null && active !== j ? 'graph-dim' : undefined}>{parts}</g>;
            });
        }
    }

    const labels = units.flatMap((unit, k) => {
        const [lo, hi] = scales[unit];
        // Whole numbers unless the axis steps are smaller than one
        const digits = (hi - lo) / 2 >= 1 ? 0 : (hi - lo) / 2 >= 0.1 ? 1 : 2;
        const side = dual && k === 0 ? 'left' : 'right';
        const color = dual ? drawn.find(s => s.unit === unit)?.color : undefined;
        return [hi, (hi + lo) / 2, lo].map((v, i) => (
            <span key={`${unit}-${i}`} className={`graph-ylab ${side}`} style={{ top: TOP + (h * i) / 2, color }}>
                {formatValue(v, unit, digits)}
            </span>
        ));
    });

    const showTip = active !== null && drawn.length > 0;
    const sameUnit = units.length === 1;
    return (
        <div
            ref={measure}
            className={`graph-chart${dual ? ' dual' : ''}`}
            style={cssVars({ '--graph-left': `${left}px`, '--graph-right': `${chart.right}px` })}
            role="group"
            tabIndex={0}
            aria-label={`${bar ? 'Bar' : 'Line'} chart of ${drawn.map(s => s.name).join(', ')}. Use the arrow keys to read values.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onPointerLeave={onPointerEnd}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
        >
            <svg className="graph-plot" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
                {[0, 0.5, 1].map(f => <line key={f} className="graph-grid" x1="0" x2={w} y1={h * f} y2={h * f} />)}
                {body}
            </svg>
            {labels}
            <div className="graph-xlabs" aria-hidden="true">
                {(n ? axisLabels(times, hours, Math.max(2, Math.min(5, Math.floor(w / 60) + 1))) : []).map((label, i) => <span key={i}>{label}</span>)}
            </div>
            {showTip && !bar && (
                <>
                    <div className="graph-cross" style={{ left: left + xs[active] }} />
                    {drawn.map(s => Number.isFinite(s.values[active]) && (
                        <div
                            key={s.i}
                            className="graph-cross-dot"
                            style={{ left: left + xs[active], top: TOP + y(s.unit, s.values[active]), background: s.color }}
                        />
                    ))}
                </>
            )}
            {showTip && (
                <div ref={tipRef} className="graph-tip" role="status">
                    <div className="graph-tip-when">{pointLabel(times[active], minutes, hours, type)}</div>
                    {drawn.map(s => (
                        <div key={s.i} className="graph-tip-row">
                            <span className="graph-dot" style={cssVars({ '--c': s.color })} />
                            {s.name}
                            <b>{formatValue(s.values[active], s.unit)}</b>
                        </div>
                    ))}
                    {stacked && sameUnit && drawn.length > 1 && (
                        <div className="graph-tip-row total">
                            <span className="graph-dot" style={cssVars({ '--c': 'transparent' })} />
                            Total
                            <b>{formatValue(drawn.reduce((a, s) => a + (s.values[active] || 0), 0), drawn[0].unit)}</b>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LineBarChart;
