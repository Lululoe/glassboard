import { describe, expect, it } from 'vitest';
import {
    formatStateValue, headerWidgetEntityIds, normalizeWidgets, widgetFraction, widgetVisible,
    cleanTemplateOutput, findHeaderTemplate, formatDate, formatHasSeconds, greetingFor, headerColorCss,
    isHeaderColor, resolvePageHeader,
} from './pageHeader';

describe('resolvePageHeader', () => {
    it('is off unless a header is configured', () => {
        expect(resolvePageHeader({}, { id: 'home' })).toBeNull();
        expect(resolvePageHeader({ pageHeader: false }, { id: 'home' })).toBeNull();
        expect(resolvePageHeader({ pageHeader: { enabled: false } }, { id: 'home' })).toBeNull();
    });

    it('fills in a clock under the date, left aligned and placed automatically', () => {
        expect(resolvePageHeader({ pageHeader: true }, { id: 'home' })).toEqual({
            align: 'left',
            layout: 'auto',
            style: 'colored',
            title: { type: 'clock', format: 'HH:mm', color: 'text' },
            subtitle: { type: 'date', format: 'dddd, D MMMM', color: 'red' },
            widgets: [],
        });
    });

    it('lets a page turn the header on, off or change parts of it', () => {
        const config = { pageHeader: { align: 'center', title: { type: 'clock', format: 'h:mm A', color: 'blue' } } };
        expect(resolvePageHeader(config, { id: 'a', pageHeader: false })).toBeNull();
        expect(resolvePageHeader({}, { id: 'b', pageHeader: { layout: 'stacked' } })?.layout).toBe('stacked');
        const page = resolvePageHeader(config, { id: 'c', pageHeader: { title: { color: 'green' }, subtitle: false } });
        expect(page).toMatchObject({ align: 'center', title: { type: 'clock', format: 'h:mm A', color: 'green' }, subtitle: null });
    });

    it('never shows a header on iframe pages', () => {
        expect(resolvePageHeader({ pageHeader: true }, { type: 'iframe', url: 'https://x.test' })).toBeNull();
    });

    it('treats a string as text and replaces invalid options with defaults', () => {
        const header = resolvePageHeader({
            pageHeader: { align: 'middle', layout: 'grid', title: 'Hello', subtitle: { type: 'nope', color: 'red; x: y' } },
        }, {});
        expect(header).toMatchObject({
            align: 'left',
            layout: 'auto',
            title: { type: 'text', text: 'Hello' },
            subtitle: { type: 'date', color: 'red' },
        });
    });

    it('keeps template refreshes at 10 seconds or more', () => {
        const line = (refresh) => resolvePageHeader({ pageHeader: { title: { type: 'template', template: '{{ 1 }}', refresh } } }, {}).title;
        expect(line(undefined).refresh).toBe(60);
        expect(line(2).refresh).toBe(10);
        expect(line(300).refresh).toBe(300);
    });
});

describe('findHeaderTemplate', () => {
    const config = {
        pageHeader: { subtitle: { type: 'template', template: "{{ states('sensor.global') }}" } },
        pages: [
            { id: 'home' },
            { id: 'own', pageHeader: { title: { type: 'template', template: '{{ now() }}', refresh: 30 } } },
            { id: 'off', pageHeader: false },
            {},
        ],
    };

    it("finds a line's template by page key, including pages without an id", () => {
        expect(findHeaderTemplate(config, 'home', 'subtitle')).toEqual({ template: "{{ states('sensor.global') }}", refresh: 60 });
        expect(findHeaderTemplate(config, 'own', 'title')).toEqual({ template: '{{ now() }}', refresh: 30 });
        expect(findHeaderTemplate(config, '3', 'subtitle')?.template).toBe("{{ states('sensor.global') }}");
    });

    it('finds nothing for lines without a template, unknown pages or pages without a header', () => {
        expect(findHeaderTemplate(config, 'home', 'title')).toBeNull();
        expect(findHeaderTemplate(config, 'off', 'subtitle')).toBeNull();
        expect(findHeaderTemplate(config, 'missing', 'subtitle')).toBeNull();
        expect(findHeaderTemplate(config, 'home', 'template')).toBeNull();
    });

    it('works with top-level cards instead of pages', () => {
        expect(findHeaderTemplate({ pageHeader: { title: { type: 'template', template: 'x' } } }, 'default', 'title')?.template).toBe('x');
    });
});

describe('colors', () => {
    it('accepts names, hex, rgb, hsl and CSS variables only', () => {
        ['red', 'primary', '#fff', '#ff375f', 'rgb(255, 0, 0)', 'rgba(0 0 0 / 50%)', 'hsl(210 100% 50%)', 'var(--system-teal)']
            .forEach(c => expect(isHeaderColor(c), c).toBe(true));
        ['tomato', 'red;color:blue', 'url(x)', 'expression(alert(1))', 'var(--x); top: 0', '', 3]
            .forEach(c => expect(isHeaderColor(c), String(c)).toBe(false));
    });

    it('turns names into system colors', () => {
        expect(headerColorCss('red')).toBe('var(--system-red)');
        expect(headerColorCss('#123456')).toBe('#123456');
        expect(headerColorCss('bad;')).toBeUndefined();
    });
});

describe('formatDate', () => {
    const date = new Date(2026, 10, 10, 9, 5, 7);

    it('formats times and dates with tokens', () => {
        expect(formatDate(date, 'HH:mm', 'en-GB')).toBe('09:05');
        expect(formatDate(date, 'H:mm:ss', 'en-GB')).toBe('9:05:07');
        expect(formatDate(new Date(2026, 0, 1, 15, 30), 'h:mm A', 'en-GB')).toBe('3:30 PM');
        expect(formatDate(date, 'dddd, D MMMM', 'en-GB')).toBe('Tuesday, 10 November');
        expect(formatDate(date, 'DD.MM.YYYY', 'en-GB')).toBe('10.11.2026');
        // Short names differ slightly between ICU versions ("Di" or "Di.")
        expect(formatDate(date, 'ddd D MMM YY', 'de-DE')).toMatch(/^Di\.? 10 Nov\.? 26$/);
    });

    it('keeps text in brackets as it is', () => {
        expect(formatDate(date, 'H [Uhr] mm', 'de-DE')).toBe('9 Uhr 05');
    });

    it('falls back to the browser language for an unknown locale', () => {
        expect(() => formatDate(date, 'MMMM', 'not a locale!')).not.toThrow();
    });

    it('knows when a format shows seconds', () => {
        expect(formatHasSeconds('HH:mm:ss')).toBe(true);
        expect(formatHasSeconds('HH:mm')).toBe(false);
        expect(formatHasSeconds('HH:mm [s]')).toBe(false);
    });
});

describe('greetingFor', () => {
    it('greets by the time of day', () => {
        const at = (h) => greetingFor(new Date(2026, 0, 1, h));
        expect([at(4), at(5), at(11), at(12), at(17), at(18), at(22)])
            .toEqual(['Good night', 'Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good night']);
    });
});

describe('cleanTemplateOutput', () => {
    it('makes one line of plain text of at most 200 characters', () => {
        expect(cleanTemplateOutput('  21.5 °C\n\tinside  ')).toBe('21.5 °C inside');
        expect(cleanTemplateOutput('x'.repeat(500))).toHaveLength(200);
        expect(cleanTemplateOutput(null)).toBe('');
    });
});

describe('page settings over a header turned off for all pages', () => {
    it('shows the header on pages with their own setting, built on that of all pages', () => {
        const config = { pageHeader: { enabled: false, align: 'right' } };
        expect(resolvePageHeader(config, { id: 'a' })).toBeNull();
        expect(resolvePageHeader(config, { id: 'b', pageHeader: {} })?.align).toBe('right');
        expect(resolvePageHeader(config, { id: 'c', pageHeader: { enabled: false } })).toBeNull();
    });
});

describe('widgets', () => {
    const state = (value, unit) => ({ state: String(value), attributes: unit ? { unit_of_measurement: unit } : {} });

    it('keeps valid widgets with their defaults and drops those without an entity', () => {
        expect(normalizeWidgets([
            { type: 'gauge', entity_id: 'sensor.temp', min: -10, max: 30, color: 'teal' },
            { type: 'ring' },
            { entity_id: 'not an id' },
            { type: 'rocket', entity_id: 'sensor.cpu', color: 'red; x', condition: { operator: 'above', value: 50 } },
        ])).toEqual([
            { id: 'widget-0', type: 'gauge', entity_id: 'sensor.temp', color: 'teal', min: -10, max: 30 },
            { id: 'widget-3', type: 'ring', entity_id: 'sensor.cpu', color: 'text', min: 0, max: 100, condition: { operator: 'above', value: 50 } },
        ]);
    });

    it('lists the entities of all widgets in a config', () => {
        const ids = headerWidgetEntityIds({
            pageHeader: { widgets: [{ entity_id: 'sensor.a' }, { type: 'rectangle', entity_id: 'sensor.b', entity_id2: 'sensor.c' }] },
            pages: [{ pageHeader: { widgets: [{ entity_id: 'sensor.d' }] } }, { pageHeader: false }],
        });
        expect([...ids].sort()).toEqual(['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d']);
    });

    it('fills rings between their lowest and highest value, and percentages from 0 to 100', () => {
        const widget = { min: 10, max: 30 };
        expect(widgetFraction(widget, state(20, '°C'))).toBe(0.5);
        expect(widgetFraction(widget, state(50, '°C'))).toBe(1);
        expect(widgetFraction(widget, state(25, '%'))).toBe(0.25);
        expect(widgetFraction(widget, state('on'))).toBe(0);
    });

    it('rounds values and shows other states as they are', () => {
        expect(formatStateValue(state('21.456'), 'en-US')).toBe('21.5');
        expect(formatStateValue(state('1234.5'), 'en-US')).toBe('1,235');
        expect(formatStateValue(state('on'))).toBe('on');
        expect(formatStateValue(state('unavailable'))).toBe('–');
        expect(formatStateValue(undefined)).toBe('–');
    });

    it('shows widgets only while their condition matches', () => {
        const when = (operator, value) => ({ condition: { operator, value } });
        expect(widgetVisible({}, undefined)).toBe(true);
        expect(widgetVisible(when('above', 25), state(26))).toBe(true);
        expect(widgetVisible(when('above', 25), state(25))).toBe(false);
        expect(widgetVisible(when('below', 25), state('unknown'))).toBe(false);
        expect(widgetVisible(when('equals', 'On'), state('on'))).toBe(true);
        expect(widgetVisible(when('equals', '1'), state('1.0'))).toBe(true);
        expect(widgetVisible(when('not_equals', 'off'), state('off'))).toBe(false);
        expect(widgetVisible(when('above', 1), undefined)).toBe(false);
    });
});
