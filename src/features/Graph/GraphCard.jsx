import { useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import EmptyState from '../../components/Shared/EmptyState';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { useElementSize } from '../../hooks/useElementSize';
import LineBarChart from './LineBarChart';
import WeekChart from './WeekChart';
import {
    colorOf, cssVars, formatValue, graphRanges, hoursOf, longLabel, rangeLabel, shouldStack, signedPercent, sumOf, weekTotals,
} from './graphModel';
import './GraphCard.css';

const POLL_INTERVAL = 60000;
// Content narrower than this moves the time range out of the header, and narrows its buttons
const NARROW_WIDTH = 290;
const COMPACT_WIDTH = 330;
const ICON_BACKGROUNDS = {
    line: 'linear-gradient(180deg, #4aa8ff, #0a6cff)',
    bar: 'linear-gradient(180deg, #5ee07f, #24b04a)',
    week: 'linear-gradient(180deg, #5ee07f, #24b04a)',
};
const ICONS = { line: 'lu-ChartLine', bar: 'lu-ChartColumn', week: 'lu-ChartColumnStacked' };

/**
 * Graph card: the history of one or more Home Assistant sensors as lines, bars, or this week
 * against last week. The time range is chosen in the header (unless turned off); whether the
 * card draws lines or bars is part of its config.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`entities`, `chart`, `ranges`, `range`, `stack`,
 *   `breakdown`, `title`).
 * @returns {JSX.Element} The rendered card.
 */
const GraphCard = ({ config }) => {
    const chart = ['bar', 'week'].includes(config.chart) ? config.chart : 'line';
    const { ranges, selector } = graphRanges(config);
    const [picked, setPicked] = useState(ranges[0]);
    const range = ranges.includes(picked) ? picked : ranges[0];
    const [hidden, setHidden] = useState(() => new Set());
    const [focus, setFocus] = useState(/** @type {number|null} */ (null));
    const [sensor, setSensor] = useState(0);
    const hasEntities = Array.isArray(config.entities) && config.entities.length > 0;
    const wide = (config.colSpan || 1) >= 2;
    const [bodySize, measureBody] = useElementSize();
    const narrow = bodySize.width > 0 && bodySize.width < NARROW_WIDTH;
    const compact = bodySize.width > 0 && bodySize.width < COMPACT_WIDTH;

    const { data, error, loading } = usePolling(
        () => callService('homeassistant', { endpoint: 'graph', card_id: config.id, ...(chart === 'week' ? {} : { range }) }),
        { interval: POLL_INTERVAL, enabled: hasEntities && config.id !== undefined, key: `${chart}|${range}|${JSON.stringify(config.entities)}` },
    );

    const series = (data?.series || []).map((s, i) => ({ ...s, color: colorOf(s.color, i) }));
    const toggle = (i) => setHidden(prev => {
        const next = new Set(prev);
        // One sensor always stays visible
        if (next.has(i)) next.delete(i);
        else if (next.size < series.length - 1) next.add(i);
        return next;
    });

    // The week comparison stacks sensors with one unit, and shows one at a time otherwise
    const weekStacks = chart === 'week' && shouldStack({ ...config, stack: config.stack ?? true }, series);
    const weekIndex = Math.min(sensor, Math.max(0, series.length - 1));
    const weekParts = weekStacks ? series : series.slice(weekIndex, weekIndex + 1);
    const visible = series.filter((_, i) => !hidden.has(i));

    let subtitle = config.subtitle;
    if (!subtitle && series.length) {
        if (chart === 'week') {
            const { thisWeek, change } = weekTotals(weekParts);
            subtitle = `This week ${formatValue(thisWeek, weekParts[0].unit)}${change !== null ? ` · ${signedPercent(change)} vs last` : ''}`;
        } else if (chart === 'bar') {
            subtitle = visible.slice(0, 3).map(s => `${s.name} ${formatValue(sumOf(s.values), s.unit)}`).join(' · ');
        } else {
            subtitle = visible.slice(0, 3).map(s => `${s.name} ${formatValue(s.current ?? s.values.at(-1), s.unit)}`).join(' · ');
        }
    }

    let actions = null;
    let selectorInBody = null;
    if (chart !== 'week' && selector && ranges.length > 1) {
        actions = (
            <div className="graph-seg" role="group" aria-label="Time range">
                {ranges.map(r => (
                    <button key={r} type="button" className="button-reset" aria-pressed={r === range} aria-label={longLabel(r)} onClick={() => setPicked(r)}>
                        {rangeLabel(r)}
                    </button>
                ))}
            </div>
        );
        // Too narrow for the title and the buttons side by side: the buttons go above the chart
        if (narrow) {
            selectorInBody = actions;
            actions = null;
        }
    } else if (chart !== 'week') {
        actions = <span className="graph-range-label">{longLabel(range)}</span>;
    }

    let body;
    if (!hasEntities) {
        body = <EmptyState message="Add sensors in the card settings." />;
    } else if (!data) {
        body = <EmptyState message={loading ? 'Loading…' : `Couldn't load the history${error ? `: ${error}` : ''}`} />;
    } else if (chart === 'week') {
        body = (
            <>
                {!weekStacks && series.length > 1 && (
                    <div className="graph-seg graph-sensor-switch" role="group" aria-label="Sensor">
                        {series.map((s, i) => (
                            <button key={s.entity_id} type="button" className="button-reset" aria-pressed={i === weekIndex} onClick={() => setSensor(i)}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
                <WeekChart parts={weekParts} times={data.times} wide={wide} breakdown={config.breakdown !== false} />
            </>
        );
    } else {
        const plot = (
            <LineBarChart
                series={series}
                times={data.times}
                minutes={data.minutes}
                hours={hoursOf(data.range) || 24}
                type={chart}
                stack={chart === 'bar' && shouldStack(config, series)}
                hidden={hidden}
                focus={focus}
            />
        );
        body = wide ? (
            <div className="graph-wide">
                <div className="graph-series" role="group" aria-label="Sensors">
                    <div className="graph-series-head"><span>Sensor</span><span>{chart === 'bar' ? rangeLabel(range) : 'Now'}</span></div>
                    {series.map((s, i) => (
                        <button
                            key={s.entity_id}
                            type="button"
                            className="button-reset graph-series-row"
                            style={cssVars({ '--c': s.color })}
                            aria-pressed={!hidden.has(i)}
                            onClick={() => toggle(i)}
                            onPointerEnter={(e) => e.pointerType === 'mouse' && setFocus(i)}
                            onPointerLeave={() => setFocus(null)}
                        >
                            <span className="graph-dot" />
                            <span className="graph-series-meta">
                                <span className="graph-series-name">{s.name}</span>
                                <span className="graph-series-value">{formatValue(chart === 'bar' ? sumOf(s.values) : (s.current ?? s.values.at(-1)), s.unit)}</span>
                            </span>
                        </button>
                    ))}
                </div>
                <div className="graph-area">{plot}</div>
            </div>
        ) : (
            <>
                {series.length > 1 && (
                    <div className="graph-chips" role="group" aria-label="Sensors">
                        {series.map((s, i) => (
                            <button key={s.entity_id} type="button" className="button-reset graph-chip" style={cssVars({ '--c': s.color })} aria-pressed={!hidden.has(i)} onClick={() => toggle(i)}>
                                <span className="graph-dot" />
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
                {plot}
            </>
        );
    }

    return (
        <TwoToneBase
            className={`graph-card graph-type-${chart}${compact ? ' compact' : ''}${narrow ? ' narrow' : ''}`}
            title={config.title || 'Graph'}
            subtitle={subtitle}
            icon={config.icon || ICONS[chart]}
            iconBackground={config.iconBackground || ICON_BACKGROUNDS[chart]}
            iconColor={config.iconColor}
            actions={actions}
        >
            <div className="graph-body" ref={measureBody}>
                {selectorInBody}
                {body}
            </div>
        </TwoToneBase>
    );
};

export default GraphCard;
