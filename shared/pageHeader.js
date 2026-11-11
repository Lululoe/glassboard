/*
 * Page header settings, shared by the browser (which shows the header) and the server (which
 * renders its Home Assistant templates and validates the config).
 *
 * The header is off unless `pageHeader` is set at the top level of config.yaml or on a page.
 * A page's `pageHeader` is merged over the top-level one, and `pageHeader: false` on a page
 * turns it off there.
 */

export const ALIGNMENTS = ['left', 'center', 'right'];
export const LAYOUTS = ['auto', 'side-by-side', 'stacked'];
/** `colored` widgets use their own colors; `monochrome` draws the whole header in the text color. */
export const STYLES = ['colored', 'monochrome'];
export const LINE_TYPES = ['clock', 'date', 'text', 'greeting', 'template'];
export const LINE_NAMES = ['title', 'subtitle'];

/** Formats used when a clock or date line has none. */
export const DEFAULT_FORMATS = { clock: 'HH:mm', date: 'dddd, D MMMM' };

/** Longest template and longest rendered text, in characters. */
export const MAX_TEMPLATE_LENGTH = 2000;
export const MAX_TEXT_LENGTH = 200;
/** Fewest and default seconds between template renders. */
export const MIN_TEMPLATE_REFRESH = 10;
export const DEFAULT_TEMPLATE_REFRESH = 60;

/** Short color names, for the system colors that follow light and dark mode. */
export const NAMED_COLORS = {
    primary: 'var(--color-primary)',
    text: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    red: 'var(--system-red)',
    orange: 'var(--system-orange)',
    yellow: 'var(--system-yellow)',
    green: 'var(--system-green)',
    teal: 'var(--system-teal)',
    cyan: 'var(--system-cyan)',
    blue: 'var(--system-blue)',
    indigo: 'var(--system-indigo)',
    purple: 'var(--system-purple)',
    pink: 'var(--system-pink)',
    gray: 'var(--system-gray)',
    white: '#fff',
    black: '#000',
};

const DEFAULT_LINES = {
    title: { type: 'clock', color: 'text' },
    subtitle: { type: 'date', color: 'red' },
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Whether a value is a color the header text can use: a name from NAMED_COLORS, a hex color,
 * `rgb()`/`rgba()`/`hsl()`/`hsla()` or a `var(--…)`. Nothing else reaches the style.
 * @param {*} value - The value.
 * @returns {boolean} Whether it can be used.
 */
export function isHeaderColor(value) {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    return Object.hasOwn(NAMED_COLORS, v)
        || /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)
        || /^(?:rgba?|hsla?)\(\s*[\d.%\s,/+-]+\)$/i.test(v)
        || /^var\(--[\w-]+\)$/.test(v);
}

/**
 * The CSS value of a header color.
 * @param {string|undefined} value - A color that passed isHeaderColor, or nothing.
 * @returns {string|undefined} The CSS color, or undefined to keep the default.
 */
export function headerColorCss(value) {
    if (!isHeaderColor(value)) return undefined;
    const v = value.trim();
    return NAMED_COLORS[v] ?? v;
}

/**
 * Turns one line's setting into its full form. A string is a text, `false` hides the line.
 * @param {*} value - The line as configured.
 * @param {'title'|'subtitle'} name - Which line.
 * @returns {Object|null} `{type, format?, text?, template?, refresh?, color}`, or null when hidden.
 */
export function normalizeLine(value, name) {
    if (value === false || value === null) return null;
    const line = typeof value === 'string'
        ? { type: 'text', text: value }
        : isPlainObject(value) ? value : {};
    const type = LINE_TYPES.includes(line.type) ? line.type : DEFAULT_LINES[name].type;
    const result = { type, color: isHeaderColor(line.color) ? line.color.trim() : DEFAULT_LINES[name].color };
    if (type === 'clock' || type === 'date') {
        result.format = typeof line.format === 'string' && line.format ? line.format : DEFAULT_FORMATS[type];
    }
    if (type === 'text') result.text = typeof line.text === 'string' ? line.text.slice(0, MAX_TEXT_LENGTH) : '';
    if (type === 'template') {
        result.template = typeof line.template === 'string' ? line.template.slice(0, MAX_TEMPLATE_LENGTH) : '';
        const refresh = Number(line.refresh);
        result.refresh = Number.isFinite(refresh) && refresh > 0
            ? Math.max(MIN_TEMPLATE_REFRESH, refresh)
            : DEFAULT_TEMPLATE_REFRESH;
    }
    return result;
}

/**
 * Merges a page's header setting over the top-level one. `true` stands for the defaults.
 * @param {*} global - Top-level `pageHeader`.
 * @param {*} page - The page's `pageHeader`.
 * @returns {Object|null} The merged setting, or null when the header is off.
 */
function mergeSettings(global, page) {
    if (page === false || page === null) return null;
    const base = global === true ? {} : isPlainObject(global) ? global : null;
    const own = page === true ? {} : isPlainObject(page) ? page : null;
    if (!base && !own) return null;
    if (!own) return base;
    if (!base) return own;
    // A page with its own setting shows the header even where all pages have it turned off
    const merged = { ...base, ...own, enabled: own.enabled ?? true };
    // Lines merge one level deep, so a page can recolor the title without restating its type
    LINE_NAMES.forEach((name) => {
        if (isPlainObject(base[name]) && isPlainObject(own[name])) merged[name] = { ...base[name], ...own[name] };
    });
    return merged;
}

/**
 * The header a page shows, with every option filled in.
 * @param {Object} config - The dashboard configuration.
 * @param {Object} [page] - The page; iframe pages have no header.
 * @returns {{align: string, layout: string, style: string, locale?: string, title: Object|null, subtitle: Object|null, widgets: Array<Object>}|null}
 *   The header, or null when it is off.
 */
export function resolvePageHeader(config, page) {
    if (page?.type === 'iframe') return null;
    const settings = mergeSettings(config?.pageHeader, page?.pageHeader);
    if (!settings || settings.enabled === false) return null;
    const header = {
        align: ALIGNMENTS.includes(settings.align) ? settings.align : 'left',
        layout: LAYOUTS.includes(settings.layout) ? settings.layout : 'auto',
        style: STYLES.includes(settings.style) ? settings.style : 'colored',
        title: normalizeLine(settings.title, 'title'),
        subtitle: normalizeLine(settings.subtitle, 'subtitle'),
        widgets: normalizeWidgets(settings.widgets),
    };
    if (typeof settings.locale === 'string' && settings.locale) header.locale = settings.locale;
    return header;
}

/**
 * Finds the template of a line in the header of a page. The server only ever renders templates
 * it finds this way, in its own config, never ones sent by the browser.
 * @param {Object} config - The dashboard configuration.
 * @param {string} key - The page key: its id, or its position for pages without one.
 * @param {string} line - `title` or `subtitle`.
 * @returns {{template: string, refresh: number}|null} The template, or null when there is none.
 */
export function findHeaderTemplate(config, key, line) {
    if (!LINE_NAMES.includes(line)) return null;
    const pages = Array.isArray(config?.pages) ? config.pages : [{ id: 'default' }];
    const page = pages.find((p, index) => String(p?.id ?? index) === String(key));
    if (!page) return null;
    const found = resolvePageHeader(config, page)?.[line];
    return found?.type === 'template' && found.template ? { template: found.template, refresh: found.refresh } : null;
}

/**
 * Makes rendered template output safe to show: plain text on one line, at most MAX_TEXT_LENGTH
 * characters. It is always shown as text, never as HTML.
 * @param {*} value - What Home Assistant returned.
 * @returns {string} The text.
 */
export function cleanTemplateOutput(value) {
    return String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_TEXT_LENGTH);
}

/**
 * Greeting for the time of day: morning from 5:00, afternoon from 12:00, evening from 18:00
 * and night from 22:00.
 * @param {Date} date - The time.
 * @returns {string} The greeting.
 */
export function greetingFor(date) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    if (hour >= 18 && hour < 22) return 'Good evening';
    return 'Good night';
}

const TOKEN = /\[([^\]]*)]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g;

/**
 * Formats a date with tokens: `YYYY` `YY` year, `MMMM` `MMM` `MM` `M` month, `dddd` `ddd`
 * weekday, `DD` `D` day, `HH` `H` 24-hour, `hh` `h` 12-hour, `mm` `m` minutes, `ss` `s`
 * seconds, `A` `a` AM/PM. Text in square brackets is kept as it is. Names follow the locale.
 * @param {Date} date - The date.
 * @param {string} format - The format, e.g. `dddd, D MMMM` or `HH:mm`.
 * @param {string} [locale] - Locale for names; the browser's language by default.
 * @returns {string} The formatted date.
 */
export function formatDate(date, format, locale) {
    const pad = (n) => String(n).padStart(2, '0');
    const name = (options) => {
        try {
            return new Intl.DateTimeFormat(locale, options).format(date);
        } catch {
            return new Intl.DateTimeFormat(undefined, options).format(date);
        }
    };
    const hours12 = date.getHours() % 12 || 12;
    const values = {
        YYYY: () => String(date.getFullYear()),
        YY: () => String(date.getFullYear()).slice(-2),
        MMMM: () => name({ month: 'long' }),
        MMM: () => name({ month: 'short' }),
        MM: () => pad(date.getMonth() + 1),
        M: () => String(date.getMonth() + 1),
        dddd: () => name({ weekday: 'long' }),
        ddd: () => name({ weekday: 'short' }),
        DD: () => pad(date.getDate()),
        D: () => String(date.getDate()),
        HH: () => pad(date.getHours()),
        H: () => String(date.getHours()),
        hh: () => pad(hours12),
        h: () => String(hours12),
        mm: () => pad(date.getMinutes()),
        m: () => String(date.getMinutes()),
        ss: () => pad(date.getSeconds()),
        s: () => String(date.getSeconds()),
        A: () => (date.getHours() < 12 ? 'AM' : 'PM'),
        a: () => (date.getHours() < 12 ? 'am' : 'pm'),
    };
    return format.replace(TOKEN, (match, literal) => (literal !== undefined ? literal : values[match]()));
}

/**
 * Whether a format shows seconds, so the clock has to tick every second.
 * @param {string} format - The format.
 * @returns {boolean} Whether it contains `s` or `ss` outside brackets.
 */
export function formatHasSeconds(format) {
    return /s/.test(format.replace(/\[[^\]]*]/g, ''));
}

/* ---------- Widgets ---------- */

/**
 * Widget types: `ring` (a closed ring filled to the value), `gauge` (an open ring with a dot at
 * the value), `number` (icon and value, no ring) and `rectangle` (one or two values, three
 * circles wide).
 */
export const WIDGET_TYPES = ['ring', 'gauge', 'number', 'rectangle'];
/** Conditions a widget can be shown under, compared with its entity's state. */
export const CONDITION_OPERATORS = ['above', 'below', 'equals', 'not_equals'];
/** Most widgets a header can have. */
export const MAX_WIDGETS = 24;
/** What an entity id looks like: `domain.object_id`. */
export const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/**
 * A widget with every option checked and filled in.
 * @param {*} value - The widget as configured.
 * @param {number} index - Its position, for an id when it has none.
 * @returns {Object|null} `{id, type, entity_id, entity_id2?, name?, icon?, color, min, max, condition?}`,
 *   or null when it has no valid entity.
 */
export function normalizeWidget(value, index) {
    if (!isPlainObject(value) || typeof value.entity_id !== 'string' || !ENTITY_ID.test(value.entity_id)) return null;
    const number = (v, fallback) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fallback);
    const widget = {
        id: typeof value.id === 'string' && value.id ? value.id : `widget-${index}`,
        type: WIDGET_TYPES.includes(value.type) ? value.type : 'ring',
        entity_id: value.entity_id,
        color: isHeaderColor(value.color) ? value.color.trim() : 'text',
        min: number(value.min, 0),
        max: number(value.max, 100),
    };
    if (typeof value.entity_id2 === 'string' && ENTITY_ID.test(value.entity_id2)) widget.entity_id2 = value.entity_id2;
    if (typeof value.name === 'string' && value.name.trim()) widget.name = value.name.trim().slice(0, 60);
    if (typeof value.icon === 'string' && value.icon) widget.icon = value.icon.slice(0, 500);
    const condition = value.condition;
    if (isPlainObject(condition) && CONDITION_OPERATORS.includes(condition.operator)
        && (typeof condition.value === 'string' || typeof condition.value === 'number')) {
        widget.condition = { operator: condition.operator, value: condition.value };
    }
    return widget;
}

/**
 * The widgets of a header setting.
 * @param {*} value - The `widgets` setting.
 * @returns {Array<Object>} The valid widgets, at most MAX_WIDGETS.
 */
export const normalizeWidgets = (value) => (Array.isArray(value) ? value : [])
    .slice(0, MAX_WIDGETS)
    .map(normalizeWidget)
    .filter(Boolean);

/**
 * Every entity the page header widgets of a config show, for all pages and single pages. The
 * server lets the browser read exactly these (and those of the cards).
 * @param {Object} config - The dashboard configuration.
 * @returns {Set<string>} The entity ids.
 */
export function headerWidgetEntityIds(config) {
    const ids = new Set();
    const add = (setting) => {
        if (!isPlainObject(setting)) return;
        normalizeWidgets(setting.widgets).forEach((w) => {
            ids.add(w.entity_id);
            if (w.entity_id2) ids.add(w.entity_id2);
        });
    };
    add(config?.pageHeader);
    (Array.isArray(config?.pages) ? config.pages : []).forEach(page => add(page?.pageHeader));
    return ids;
}

/**
 * The number in an entity's state, if it has one.
 * @param {Object|null|undefined} state - The state.
 * @returns {number|null} The number.
 */
export function stateNumber(state) {
    const n = Number.parseFloat(state?.state);
    return Number.isFinite(n) ? n : null;
}

/**
 * Whether an entity's state is a percentage, which always runs from 0 to 100.
 * @param {Object|null|undefined} state - The state.
 * @returns {boolean} Whether its unit is %.
 */
export const isPercent = (state) => state?.attributes?.unit_of_measurement === '%';

/**
 * How far a widget's value is between its minimum and maximum (0 to 100 for percentages).
 * @param {Object} widget - The widget.
 * @param {Object|null|undefined} state - Its entity's state.
 * @returns {number} From 0 to 1; 0 without a number.
 */
export function widgetFraction(widget, state) {
    const n = stateNumber(state);
    if (n === null) return 0;
    const [min, max] = isPercent(state) ? [0, 100] : [widget.min, widget.max];
    if (max === min) return n >= max ? 1 : 0;
    return Math.min(1, Math.max(0, (n - min) / (max - min)));
}

/**
 * An entity's state for showing: numbers rounded (one decimal below 100), other states as they
 * are, and a dash while it is unknown.
 * @param {Object|null|undefined} state - The state.
 * @param {string} [locale] - Locale for the number.
 * @param {{whole?: boolean}} [options] - `whole` rounds values of 10 and more to whole numbers, for small widgets.
 * @returns {string} The value.
 */
export function formatStateValue(state, locale, { whole = false } = {}) {
    if (!state || ['unavailable', 'unknown'].includes(state.state)) return '–';
    const text = String(state.state).trim();
    if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
    const n = Number(text);
    const digits = Math.abs(n) >= (whole ? 10 : 100) || Number.isInteger(n) ? 0 : 1;
    try {
        return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
    } catch {
        return n.toFixed(digits);
    }
}

/** Icons for widgets whose entity has none, by unit. */
const UNIT_ICONS = {
    '°C': 'mdi:thermometer', '°F': 'mdi:thermometer', '%': 'mdi:percent-circle', W: 'mdi:flash', kW: 'mdi:flash',
    Wh: 'mdi:lightning-bolt', kWh: 'mdi:lightning-bolt', ppm: 'mdi:molecule-co2', lx: 'mdi:brightness-5',
    hPa: 'mdi:gauge', 'km/h': 'mdi:weather-windy', 'm/s': 'mdi:weather-windy', mm: 'mdi:water', V: 'mdi:sine-wave', A: 'mdi:current-ac',
};

/** Icons for widgets whose entity has none, by device class; ahead of the unit, which several classes share. */
const CLASS_ICONS = {
    humidity: 'mdi:water-percent', battery: 'mdi:battery', temperature: 'mdi:thermometer', power: 'mdi:flash',
    energy: 'mdi:lightning-bolt', carbon_dioxide: 'mdi:molecule-co2', illuminance: 'mdi:brightness-5',
};

/**
 * The icon a widget shows: its own, the one Home Assistant has for the entity, or one that fits
 * the entity's device class or unit.
 * @param {Object} widget - The widget.
 * @param {Object|null|undefined} state - Its entity's state, with `icon` when the server added it.
 * @returns {string|undefined} The icon.
 */
export function widgetIcon(widget, state) {
    return widget.icon
        || state?.icon
        || CLASS_ICONS[state?.attributes?.device_class]
        || UNIT_ICONS[state?.attributes?.unit_of_measurement]
        || (stateNumber(state) !== null ? 'mdi:gauge' : undefined);
}

/**
 * Whether a widget is shown: always without a condition, otherwise when its entity's state
 * matches it. `above` and `below` compare numbers; `equals` and `not_equals` compare the state
 * as text (ignoring case), or as numbers when both are numbers.
 * @param {Object} widget - The widget.
 * @param {Object|null|undefined} state - Its entity's state; without one, a widget with a condition is hidden.
 * @returns {boolean} Whether it is shown.
 */
export function widgetVisible(widget, state) {
    const { condition } = widget;
    if (!condition) return true;
    if (!state) return false;
    const n = stateNumber(state);
    const target = Number(condition.value);
    if (condition.operator === 'above') return n !== null && Number.isFinite(target) && n > target;
    if (condition.operator === 'below') return n !== null && Number.isFinite(target) && n < target;
    const same = n !== null && Number.isFinite(target) && String(condition.value).trim() !== ''
        ? n === target
        : String(state.state).toLowerCase() === String(condition.value).trim().toLowerCase();
    return condition.operator === 'equals' ? same : !same;
}

/* ---------- Header bar ---------- */

/**
 * When the header bar (the bar with the title, menu and edit buttons) hides itself: `never`,
 * `with-page-header` (on pages that show a page header, which has the time already) or `always`.
 */
export const HEADER_AUTO_HIDE = ['never', 'with-page-header', 'always'];

/**
 * Whether the header bar hides itself on a page. It never hides while the dashboard is edited.
 * @param {*} mode - `headerAutoHide` from the config.
 * @param {boolean} hasPageHeader - Whether the page shows a page header.
 * @returns {boolean} Whether it hides until it is revealed.
 */
export function headerBarHides(mode, hasPageHeader) {
    if (mode === 'always') return true;
    return mode === 'with-page-header' && hasPageHeader;
}
