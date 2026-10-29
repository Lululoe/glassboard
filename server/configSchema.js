import { z } from 'zod';

const id = z.union([z.string().min(1), z.number()]);

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
});

const launcherItem = z.looseObject({
    name: z.string(),
    url: z.string(),
});

export const configSchema = z.looseObject({
    theme: z.string().optional(),
    themeToggle: z.boolean().optional(),
    demo: z.boolean().optional(),
    editable: z.boolean().optional(),
    themes: z.array(z.looseObject({ id: z.string() })).optional(),
    pages: z.array(page).optional(),
    cards: z.array(card).optional(),
    launcher: z.looseObject({
        apps: z.array(launcherItem).optional(),
        links: z.array(launcherItem).optional(),
        links_title: z.string().optional(),
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
