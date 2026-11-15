import {
    DEFAULT_FORMATS, DEFAULT_TEMPLATE_REFRESH, normalizeLine, resolvePageHeader,
} from '../../../shared/pageHeader';

/*
 * Turns page header settings into editor forms and back. A setting is what config.yaml or
 * layout.yaml holds: `true`, `false`, nothing, or an object of options. The header of all pages
 * and a page's own setting are edited together, the way the page shows them merged.
 */

/** Options of the arrangement editor, which a page can take over from all pages or set itself. */
export const ARRANGEMENT_KEYS = ['align', 'layout', 'style', 'locale'];

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A setting as an object to change, without changing the setting.
 * @param {*} setting - The setting.
 * @returns {Object} A copy of its options, or an empty object.
 */
const asObject = (setting) => (isPlainObject(setting) ? { ...setting } : {});

/**
 * Whether the header of all pages is on.
 * @param {*} setting - The setting of all pages.
 * @returns {boolean} True for `true` and objects without `enabled: false`.
 */
export const isOn = (setting) => setting === true || (isPlainObject(setting) && setting.enabled !== false);

/**
 * The header a page shows with the given settings.
 * @param {*} global - The setting of all pages.
 * @param {*} [own] - The page's own setting.
 * @returns {Object|null} The header, as resolvePageHeader returns it.
 */
export const headerFor = (global, own) => resolvePageHeader({ pageHeader: global }, { pageHeader: own });

/**
 * The header all pages show, as if it were on, for showing its options while it is off.
 * @param {*} global - The setting of all pages.
 * @returns {Object} The header.
 */
export const headerOfAll = (global) => headerFor(isPlainObject(global) ? { ...global, enabled: true } : true);

/**
 * Whether a page has its own value for an option.
 * @param {*} own - The page's own setting.
 * @param {string} key - The option.
 * @returns {boolean} Whether it sets it.
 */
export const hasOwn = (own, key) => isPlainObject(own) && Object.hasOwn(own, key);

/**
 * The form of the arrangement editor.
 * @param {Object} header - A header, as resolvePageHeader returns it.
 * @returns {{align: string, layout: string, style: string, locale: string}} The form.
 */
export const arrangementForm = (header) => ({
    align: header.align, layout: header.layout, style: header.style, locale: header.locale || '',
});

/**
 * The setting of all pages with a new arrangement. Defaults are left out, so a header that only
 * uses defaults stays `true`.
 * @param {*} setting - The setting of all pages.
 * @param {{align: string, layout: string, style?: string, locale: string}} form - The arrangement.
 * @param {boolean} on - Whether the header is shown on all pages.
 * @returns {*} The new setting.
 */
export function withArrangement(setting, form, on) {
    const result = asObject(setting);
    delete result.enabled;
    ARRANGEMENT_KEYS.forEach(key => delete result[key]);
    if (form.align !== 'left') result.align = form.align;
    if (form.layout !== 'auto') result.layout = form.layout;
    if (form.style && form.style !== 'colored') result.style = form.style;
    if (form.locale.trim()) result.locale = form.locale.trim();
    if (!on) return setting === undefined && Object.keys(result).length === 0 ? undefined : { ...result, enabled: false };
    return Object.keys(result).length > 0 ? result : true;
}

/**
 * A page's own setting after the arrangement editor.
 * @param {*} own - The page's own setting.
 * @param {{align: string, layout: string, style?: string, locale: string}} form - The arrangement.
 * @param {{visible: boolean, ownArrangement: boolean, globalOn: boolean}} options - Whether the page
 *   shows a header, whether it sets its own arrangement, and whether all pages show one.
 * @returns {*} The new setting: `false` to hide it, undefined to follow all pages.
 */
export function withPageArrangement(own, form, { visible, ownArrangement, globalOn }) {
    if (!visible) return false;
    const result = asObject(own);
    delete result.enabled;
    ARRANGEMENT_KEYS.forEach(key => delete result[key]);
    if (ownArrangement) {
        result.align = form.align;
        result.layout = form.layout;
        result.style = form.style || 'colored';
        if (form.locale.trim()) result.locale = form.locale.trim();
    }
    if (Object.keys(result).length > 0) return result;
    // A page shows a header of its own where all pages have none
    return globalOn ? undefined : {};
}

/**
 * @typedef {Object} LineForm
 * @property {boolean} show - Whether the line is shown.
 * @property {string} type - clock, date, text, greeting or template.
 * @property {string} clockFormat - The format while it is a clock.
 * @property {string} dateFormat - The format while it is a date.
 * @property {string} text - The text while it is a text.
 * @property {string} color - Its color.
 * @property {number} refresh - Seconds between template renders.
 * @property {string|undefined} template - The template from config.yaml, if the line has one.
 */

/**
 * The form of a line editor.
 * @param {*} value - The line's setting.
 * @param {'title'|'subtitle'} name - Which line.
 * @param {string} [template] - The template config.yaml has for this line.
 * @returns {LineForm} The form.
 */
export function lineForm(value, name, template) {
    const line = normalizeLine(value, name);
    const shown = line ?? normalizeLine(undefined, name);
    return {
        show: line !== null,
        type: shown.type === 'template' && !template ? normalizeLine(undefined, name).type : shown.type,
        clockFormat: shown.type === 'clock' ? shown.format : DEFAULT_FORMATS.clock,
        dateFormat: shown.type === 'date' ? shown.format : DEFAULT_FORMATS.date,
        text: shown.text ?? '',
        color: shown.color,
        refresh: shown.refresh ?? DEFAULT_TEMPLATE_REFRESH,
        template,
    };
}

/**
 * Turns a line form into the line's setting.
 * @param {LineForm} form - The form.
 * @returns {Object|false} The setting; `false` hides the line.
 */
export function lineFromForm(form) {
    if (!form.show) return false;
    const line = { type: form.type, color: form.color };
    if (form.type === 'clock') line.format = form.clockFormat || DEFAULT_FORMATS.clock;
    if (form.type === 'date') line.format = form.dateFormat || DEFAULT_FORMATS.date;
    if (form.type === 'text') line.text = form.text;
    // The template stays in the draft for the preview; the server keeps the one of config.yaml
    if (form.type === 'template') Object.assign(line, { template: form.template, refresh: form.refresh });
    return line;
}

/**
 * The template config.yaml has for a line: the page's own, or that of all pages.
 * @param {'title'|'subtitle'} name - Which line.
 * @param {...*} settings - Header settings, most specific first.
 * @returns {string|undefined} The template.
 */
export const templateOf = (name, ...settings) => settings
    .map(s => (isPlainObject(s) && isPlainObject(s[name]) ? s[name].template : undefined))
    .find(t => typeof t === 'string' && t);

/**
 * The setting of all pages with a line changed. A header turned off for all pages stays off.
 * @param {*} setting - The setting of all pages.
 * @param {'title'|'subtitle'} name - Which line.
 * @param {Object|false} line - The line's new setting.
 * @returns {Object} The new setting.
 */
export function withLine(setting, name, line) {
    const result = asObject(setting);
    if (setting === false) result.enabled = false;
    result[name] = line;
    return result;
}

/**
 * A page's own setting with a line changed, or following all pages again.
 * @param {*} own - The page's own setting.
 * @param {'title'|'subtitle'} name - Which line.
 * @param {Object|false|undefined} line - The line's setting; undefined to follow all pages.
 * @param {boolean} globalOn - Whether all pages show a header.
 * @returns {*} The new setting, undefined when it follows all pages in everything.
 */
export function withPageLine(own, name, line, globalOn) {
    const result = asObject(own);
    if (line === undefined) delete result[name];
    else result[name] = line;
    if (Object.keys(result).length > 0) return result;
    return globalOn ? undefined : {};
}

/**
 * Where a page's widgets come from: its own list, or that of all pages.
 * @param {*} own - The page's own setting.
 * @returns {'page'|'all'} The list it shows.
 */
export const widgetsSource = (own) => (isPlainObject(own) && Array.isArray(own.widgets) ? 'page' : 'all');

/**
 * The widgets a setting lists, as configured.
 * @param {*} setting - A header setting.
 * @returns {Array<Object>} Its widgets.
 */
export const widgetsOf = (setting) => (isPlainObject(setting) && Array.isArray(setting.widgets) ? setting.widgets : []);

/**
 * The setting of all pages with new widgets. A header turned off for all pages stays off.
 * @param {*} setting - The setting of all pages.
 * @param {Array<Object>} widgets - The widgets.
 * @returns {Object} The new setting.
 */
export function withWidgets(setting, widgets) {
    const result = asObject(setting);
    if (setting === false) result.enabled = false;
    result.widgets = widgets;
    return result;
}

/**
 * A page's own setting with its own widgets, or following all pages' again.
 * @param {*} own - The page's own setting.
 * @param {Array<Object>|undefined} widgets - Its widgets; undefined to show those of all pages.
 * @param {boolean} globalOn - Whether all pages show a header.
 * @returns {*} The new setting, undefined when it follows all pages in everything.
 */
export function withPageWidgets(own, widgets, globalOn) {
    if (own === false) return false;
    const result = asObject(own);
    if (widgets === undefined) delete result.widgets;
    else result.widgets = widgets;
    if (Object.keys(result).length > 0) return result;
    return globalOn ? undefined : {};
}

/**
 * An id for a new widget that no other widget in the list uses.
 * @param {Array<Object>} widgets - The list.
 * @returns {string} The id, such as `w-k3f9`.
 */
export function newWidgetId(widgets) {
    const taken = new Set(widgets.map(w => w?.id));
    for (;;) {
        const id = `w-${Math.random().toString(36).slice(2, 6)}`;
        if (!taken.has(id)) return id;
    }
}

/**
 * @typedef {Object} WidgetForm
 * @property {string} id - The widget's id.
 * @property {string} type - ring, gauge, number or rectangle.
 * @property {string} entity_id - Its entity.
 * @property {string} entity_id2 - A second entity, for rectangles.
 * @property {string} name - A name, for rectangles with one value.
 * @property {string} icon - Its icon; empty for the entity's own.
 * @property {string} color - Its color.
 * @property {number} min - Lowest value, for open rings.
 * @property {number} max - Highest value, for rings.
 * @property {boolean} conditional - Whether it has a condition.
 * @property {string} operator - above, below, equals or not_equals.
 * @property {string} value - What the state is compared with.
 */

/**
 * The form of the widget editor.
 * @param {Object|undefined} widget - The widget as configured; undefined for a new one.
 * @param {string} id - The id for a new widget.
 * @returns {WidgetForm} The form.
 */
export function widgetForm(widget, id) {
    const w = isPlainObject(widget) ? widget : {};
    const condition = isPlainObject(w.condition) ? w.condition : null;
    return {
        id: typeof w.id === 'string' && w.id ? w.id : id,
        type: typeof w.type === 'string' ? w.type : 'ring',
        entity_id: w.entity_id ?? '',
        entity_id2: w.entity_id2 ?? '',
        name: w.name ?? '',
        icon: w.icon ?? '',
        color: typeof w.color === 'string' ? w.color : 'text',
        min: Number.isFinite(w.min) ? w.min : 0,
        max: Number.isFinite(w.max) ? w.max : 100,
        conditional: !!condition,
        operator: condition?.operator ?? 'above',
        value: condition ? String(condition.value) : '',
    };
}

/**
 * Turns a widget form into the widget that is saved, with only the options its type uses.
 * @param {WidgetForm} form - The form.
 * @returns {Object} The widget.
 */
export function widgetFromForm(form) {
    const widget = { id: form.id, type: form.type, entity_id: form.entity_id.trim() };
    if (form.type === 'rectangle' && form.entity_id2.trim()) widget.entity_id2 = form.entity_id2.trim();
    if (form.type === 'rectangle' && form.name.trim()) widget.name = form.name.trim();
    if (form.icon) widget.icon = form.icon;
    widget.color = form.color;
    if (form.type === 'gauge') widget.min = form.min;
    if (form.type === 'ring' || form.type === 'gauge') widget.max = form.max;
    if (form.conditional) {
        const number = Number(form.value);
        const numeric = (form.operator === 'above' || form.operator === 'below') && form.value.trim() !== '' && Number.isFinite(number);
        widget.condition = { operator: form.operator, value: numeric ? number : form.value.trim() };
    }
    return widget;
}
