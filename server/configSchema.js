import { z } from 'zod';
import {
    ALIGNMENTS, CONDITION_OPERATORS, HEADER_AUTO_HIDE, ENTITY_ID, LAYOUTS, LINE_TYPES, MAX_TEMPLATE_LENGTH, MAX_WIDGETS, STYLES, WIDGET_TYPES,
    isHeaderColor,
} from '../shared/pageHeader.js';

const id = z.union([z.string().min(1), z.number()]);

// `false` hides a line and a string is a text; both become objects so problems point at the option
const headerLine = z.preprocess(
    value => (value === false ? undefined : typeof value === 'string' ? { type: 'text', text: value } : value),
    z.looseObject({
        type: z.enum(LINE_TYPES).optional(),
        format: z.string().optional(),
        text: z.string().optional(),
        template: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
        refresh: z.number().positive().optional(),
        color: z.string().refine(isHeaderColor, 'Use a color name, #hex, rgb(), hsl() or var(--…)').optional(),
    }).refine(line => line.type !== 'template' || !!line.template, 'Template lines require a template').optional(),
);

const headerWidget = z.looseObject({
    id: z.string().optional(),
    type: z.enum(WIDGET_TYPES).optional(),
    entity_id: z.string().regex(ENTITY_ID, 'Use an entity id such as sensor.outside_temperature'),
    entity_id2: z.string().regex(ENTITY_ID, 'Use an entity id such as sensor.outside_temperature').optional(),
    name: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().refine(isHeaderColor, 'Use a color name, #hex, rgb(), hsl() or var(--…)').optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    condition: z.looseObject({
        operator: z.enum(CONDITION_OPERATORS),
        value: z.union([z.string(), z.number()]),
    }).optional(),
});

// `true` and `false` turn the header on with its defaults or off
const pageHeader = z.preprocess(
    value => (typeof value === 'boolean' ? { enabled: value } : value),
    z.looseObject({
        enabled: z.boolean().optional(),
        align: z.enum(ALIGNMENTS).optional(),
        layout: z.enum(LAYOUTS).optional(),
        style: z.enum(STYLES).optional(),
        locale: z.string().optional(),
        title: headerLine,
        subtitle: headerLine,
        widgets: z.array(headerWidget).max(MAX_WIDGETS).optional(),
    }),
);

const card = z.looseObject({
    id,
    type: z.string().min(1),
    colSpan: z.number().int().min(1).max(3).optional(),
    tileSize: z.enum(['half', 'quarter']).optional(),
    hideOn: z.array(z.enum(['phone', 'tablet', 'desktop'])).optional(),
    primaryColor: z.string().optional(),
});

const page = z.looseObject({
    id: id.optional(),
    name: z.string().optional(),
    type: z.enum(['grid', 'iframe']).optional(),
    url: z.string().optional(),
    hidden: z.boolean().optional(),
    cards: z.array(card).optional(),
    pageHeader: pageHeader.optional(),
});

const launcherItem = z.looseObject({
    name: z.string(),
    url: z.string(),
});

export const configSchema = z.looseObject({
    theme: z.string().optional(),
    themeToggle: z.boolean().optional(),
    headerAutoHide: z.enum(HEADER_AUTO_HIDE).optional(),
    demo: z.boolean().optional(),
    editable: z.boolean().optional(),
    pageHeader: pageHeader.optional(),
    themes: z.array(z.looseObject({ id: z.string() })).optional(),
    pages: z.array(page).optional(),
    cards: z.array(card).optional(),
    launcher: z.looseObject({
        apps: z.array(launcherItem).optional(),
        links: z.array(launcherItem).optional(),
        links_title: z.string().optional(),
    }).optional(),
    background: z.looseObject({
        color: z.string().optional(),
        image: z.string().optional(),
        dim: z.number().min(0).max(1).optional(),
    }).optional(),
    services: z.record(z.string(), z.unknown()).optional(),
}).superRefine((config, ctx) => {
    const pages = config.pages || [{ cards: config.cards || [] }];
    const seenCardIds = new Set();
    const seenPageIds = new Set();

    pages.forEach((p, pageIdx) => {
        const pagePath = config.pages ? ['pages', pageIdx] : [];

        if (p.id !== undefined) {
            if (seenPageIds.has(p.id)) {
                ctx.addIssue({ code: 'custom', path: [...pagePath, 'id'], message: `Duplicate page id "${p.id}"` });
            }
            seenPageIds.add(p.id);
        }

        if (p.type === 'iframe' && !p.url) {
            ctx.addIssue({ code: 'custom', path: [...pagePath, 'url'], message: 'Iframe pages require a url' });
        }

        (p.cards || []).forEach((c, cardIdx) => {
            if (c.id === undefined) return;
            if (seenCardIds.has(c.id)) {
                ctx.addIssue({
                    code: 'custom',
                    path: [...pagePath, 'cards', cardIdx, 'id'],
                    message: `Duplicate card id "${c.id}"`,
                });
            }
            seenCardIds.add(c.id);
        });
    });
});

/**
 * Formats a zod issue path as `pages[0].cards[2].colSpan`.
 * @param {PropertyKey[]} path - Issue path segments.
 * @returns {string} Readable path.
 */
function formatPath(path) {
    const formatted = path
        .map(seg => (typeof seg === 'number' ? `[${seg}]` : `.${String(seg)}`))
        .join('')
        .replace(/^\./, '');
    return formatted || '(root)';
}

/**
 * Validates a merged configuration object.
 * @param {Object} config - The merged configuration.
 * @returns {string[]} Human-readable problems; empty when the config is valid.
 */
export function validateConfig(config) {
    const result = configSchema.safeParse(config);
    if (result.success) return [];
    return result.error.issues.map(issue => `${formatPath(issue.path)}: ${issue.message}`);
}
