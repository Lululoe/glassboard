import { useLayoutEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { formatDate, formatHasSeconds, greetingFor, headerColorCss, widgetVisible } from '../../../shared/pageHeader';
import { callService } from '../../lib/api';
import { useHeaderEntities } from '../../context/headerEntities';
import { useNow } from '../../hooks/useNow';
import { usePolling } from '../../hooks/usePolling';
import HeaderWidgets from './HeaderWidgets';
import './PageHeader.css';

/** Last text of each template, so a header that stays the same between pages doesn't load again. */
const templateTexts = new Map();

/**
 * A line whose text comes from a Home Assistant template, rendered by the server. The browser
 * only names the page and the line; the template itself never leaves the config.
 * @param {string} pageKey - Key of the page the header belongs to.
 * @param {'title'|'subtitle'} name - Which line.
 * @param {number} refresh - Seconds between renders.
 * @param {string} template - The template, as the key of its last text.
 * @returns {string} The rendered text, an ellipsis while loading, or an empty string on errors.
 */
function useTemplateText(pageKey, name, refresh, template) {
    const { data, error } = usePolling(
        () => callService('homeassistant', { endpoint: 'template', page: pageKey, line: name }).then((result) => {
            templateTexts.set(template, result.text);
            return result;
        }),
        { interval: refresh * 1000, key: `${pageKey}:${name}` },
    );
    if (data) return data.text;
    // The text this template had on the page before, until it is rendered again
    if (templateTexts.has(template)) return templateTexts.get(template);
    return error ? '' : '…';
}

/**
 * One line of the header.
 * @param {Object} props
 * @param {Object} props.line - The line, as resolvePageHeader returns it.
 * @param {'title'|'subtitle'} props.name - Which line.
 * @param {Date} props.now - The current time.
 * @param {string} [props.locale] - Locale for month and weekday names.
 * @param {string} props.pageKey - Key of the page.
 * @param {boolean} [props.monochrome] - Whether the header is monochrome.
 */
function HeaderLine({ line, name, now, locale, pageKey, monochrome }) {
    const className = `ph-${name} ph-type-${line.type}`;
    // A monochrome header shows its lines in the text color, whatever color they have
    const style = monochrome ? undefined : { color: headerColorCss(line.color) };
    if (line.type === 'template') return <TemplateLine className={className} style={style} line={line} name={name} pageKey={pageKey} />;

    let text = line.text;
    if (line.type === 'clock' || line.type === 'date') text = formatDate(now, line.format, locale);
    if (line.type === 'greeting') text = greetingFor(now);
    if (line.type === 'clock' || line.type === 'date') {
        return <time className={className} style={style} dateTime={now.toISOString()}>{text}</time>;
    }
    return <span className={className} style={style}>{text}</span>;
}

/** A template line; separate so only template lines poll. */
function TemplateLine({ className, style, line, name, pageKey }) {
    const text = useTemplateText(pageKey, name, line.refresh, line.template);
    return <span className={className} style={style}>{text}</span>;
}

/**
 * Decides whether the widgets go next to the title lines or under them. `auto` puts them next
 * to the lines while every widget fits in one row; `side-by-side` keeps them there, wrapping
 * into more rows, while at least the widest widget fits; `stacked` always puts them under.
 * @param {string} layout - The configured layout.
 * @param {string} shape - Changes when lines come or go, so they are measured again.
 * @returns {{stacked: boolean, sectionRef: Object, leadRef: Object}} Whether to stack, and refs
 *   for the header and its lines.
 */
function useStacked(layout, shape) {
    const sectionRef = useRef(null);
    const leadRef = useRef(null);
    const [measured, setMeasured] = useState(false);

    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (layout === 'stacked' || !section) return undefined;
        const measure = () => {
            const style = getComputedStyle(section);
            const available = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const gap = parseFloat(style.columnGap) || 0;
            const widgets = [...section.querySelectorAll(':scope > .ph-widgets > *')].map(el => el.offsetWidth);
            if (widgets.length === 0) {
                setMeasured(false);
                return;
            }
            const widgetGap = parseFloat(getComputedStyle(section.querySelector('.ph-widgets')).columnGap) || 0;
            const lead = leadRef.current ? leadRef.current.offsetWidth + gap : 0;
            const needed = layout === 'auto'
                ? widgets.reduce((sum, w) => sum + w, 0) + widgetGap * (widgets.length - 1)
                : Math.max(...widgets);
            setMeasured(lead + needed > available);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(section);
        if (leadRef.current) observer.observe(leadRef.current);
        return () => observer.disconnect();
    }, [layout, shape]);

    return { stacked: layout === 'stacked' || measured, sectionRef, leadRef };
}

const LINE_LABELS = { title: 'Title', subtitle: 'Subtitle' };

/** Seconds between updates of the widgets' values; the server answers from its live copy. */
const WIDGET_REFRESH = 10;

/**
 * The states of the widgets' entities, with their icons. Only entities the server allows are
 * asked for, so a widget added while editing doesn't stop the others from loading.
 * @param {Array<Object>} widgets - The widgets.
 * @returns {Object<string, Object|null>} States by entity id.
 */
function useWidgetStates(widgets) {
    const allowed = useHeaderEntities();
    const ids = [...new Set(widgets.flatMap(w => [w.entity_id, w.entity_id2]).filter(Boolean))]
        .filter(id => !allowed || allowed.has(id))
        .sort();
    const { data } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: ids, icons: true }),
        { interval: WIDGET_REFRESH * 1000, enabled: ids.length > 0, key: ids.join(',') },
    );
    return data || {};
}

/**
 * The optional header above a page's cards: a title line (a clock by default) under a smaller
 * subtitle (the date by default), with widgets beside or below them. In edit mode each line
 * opens its own editor, hidden lines can be added back, and a button opens the arrangement.
 * @param {Object} props
 * @param {Object} props.header - The page's header, as resolvePageHeader returns it.
 * @param {string} props.pageKey - Key of the page, for its template lines.
 * @param {(part: 'layout'|'title'|'subtitle'|'widget', index?: number|null) => void} [props.onEdit] - Opens an
 *   editor; for a widget with its position, or null for a new one. Given in edit mode.
 * @param {boolean} [props.entering=true] - Whether it plays its entrance; false keeps it still, e.g.
 *   when the previous page showed the same header.
 * @returns {JSX.Element} The header.
 */
export default function PageHeader({ header, pageKey, onEdit, entering = true }) {
    const { align, layout, locale, title, subtitle } = header;
    const monochrome = header.style === 'monochrome';
    const states = useWidgetStates(header.widgets);
    const editing = !!onEdit;
    // While editing, hidden lines keep a place where they can be added back
    const lines = [['subtitle', subtitle], ['title', title]].filter(([, line]) => line || editing);
    const ticksEverySecond = lines.some(([, line]) => line?.type === 'clock' && formatHasSeconds(line.format));
    const now = useNow(ticksEverySecond ? 'second' : 'minute');
    // Widgets shown change with their conditions, and the layout is measured again when they do
    const shownWidgets = header.widgets.filter(w => editing || widgetVisible(w, states[w.entity_id]));
    const shape = `${lines.map(([n, l]) => `${n}:${!!l}`)}|${shownWidgets.map(w => `${w.id}:${w.type}`)}|${editing}`;
    const { stacked, sectionRef, leadRef } = useStacked(layout, shape);

    return (
        <section
            ref={sectionRef}
            className={`page-header ph-align-${align} ph-style-${header.style || 'colored'} ${stacked ? 'is-stacked' : 'is-side'}${title ? ' has-title' : ''}${editing ? ' is-editing' : ''}${entering ? ' is-entering' : ''}`}
            aria-label="Page header"
        >
            {editing && (
                <button
                    type="button"
                    className="button-reset grid-edit-button ph-edit-button"
                    aria-label="Edit header"
                    title="Header"
                    onClick={() => onEdit('layout')}
                >
                    <Pencil size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
            )}
            {lines.length > 0 && (
                <div className="ph-lead" ref={leadRef}>
                    {lines.map(([name, line]) => {
                        if (!editing) return <HeaderLine key={name} name={name} line={line} now={now} locale={locale} pageKey={pageKey} monochrome={monochrome} />;
                        if (!line) {
                            return (
                                <button key={name} type="button" className={`button-reset ph-add-line ph-add-${name}`} onClick={() => onEdit(name)}>
                                    <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                                    {LINE_LABELS[name]}
                                </button>
                            );
                        }
                        return (
                            <button
                                key={name}
                                type="button"
                                className="button-reset ph-line-button"
                                aria-label={`Edit ${LINE_LABELS[name].toLowerCase()}`}
                                onClick={() => onEdit(name)}
                            >
                                <HeaderLine name={name} line={line} now={now} locale={locale} pageKey={pageKey} monochrome={monochrome} />
                                <span className="grid-icon-badge ph-line-badge" aria-hidden="true">
                                    <Pencil size={10} strokeWidth={3} />
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            {(shownWidgets.length > 0 || editing) && (
                <div className="ph-widgets">
                    <HeaderWidgets
                        widgets={header.widgets}
                        states={states}
                        locale={locale}
                        monochrome={monochrome}
                        onEdit={editing ? (index) => onEdit('widget', index) : undefined}
                    />
                </div>
            )}
        </section>
    );
}

/**
 * In edit mode, where a page without a header can get one.
 * @param {Object} props
 * @param {() => void} props.onAdd - Opens the header editor.
 * @returns {JSX.Element} The button.
 */
export function AddPageHeader({ onAdd }) {
    return (
        <div className="page-header page-header-add">
            <button type="button" className="button-reset background-upload ph-add-header" onClick={onAdd}>
                <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                Add Header
            </button>
        </div>
    );
}
