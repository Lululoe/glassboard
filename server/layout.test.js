// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { applyLayout, buildLayout, gridPages, readLayout, resetLayout, writeLayout } from './layout.js';

const base = () => ({
    pages: [
        { id: 'home', cards: [{ id: 'a', type: 'x', colSpan: 2 }, { id: 'b', type: 'x', tileSize: 'half' }, { id: 'c', type: 'x' }] },
        { id: 'web', type: 'iframe', url: 'http://example.com' },
        { cards: [{ id: 'd', type: 'x' }, { id: 'e', type: 'x', hideOn: ['phone'] }] },
    ],
});
const ids = (config, page) => config.pages[page].cards.map(c => c.id);

describe('applyLayout', () => {
    it('orders and sizes saved cards, then appends cards added to config.yaml since', () => {
        const result = applyLayout(base(), { pages: { home: [{ id: 'b', colSpan: 1 }, { id: 'gone' }, { id: 'a', tileSize: 'quarter' }] } });
        expect(result.pages[0].cards).toEqual([
            { id: 'b', type: 'x', colSpan: 1 },
            { id: 'a', type: 'x', colSpan: 2, tileSize: 'quarter' },
            { id: 'c', type: 'x' },
        ]);
    });

    it('moves cards between pages, by page id or index', () => {
        const result = applyLayout(base(), { pages: { 2: [{ id: 'a' }, { id: 'd' }] } });
        expect(ids(result, 0)).toEqual(['b', 'c']);
        expect(ids(result, 2)).toEqual(['a', 'd', 'e']);
        expect(result.pages[1]).toEqual(base().pages[1]);
    });

    it('uses browser-defined cards, applies visibility and drops removed cards', () => {
        const result = applyLayout(base(), {
            pages: {
                home: [{ id: 'new', colSpan: 1, config: { type: 'spacer' } }, { id: 'a', colSpan: 2, config: { type: 'x', title: 'Edited' } }],
                2: [{ id: 'e', colSpan: 1, hideOn: [] }, { id: 'd', colSpan: 1, hideOn: ['desktop'] }],
            },
            removed: ['c'],
        });
        expect(result.pages[0].cards).toEqual([
            { id: 'new', type: 'spacer', colSpan: 1 },
            { id: 'a', type: 'x', title: 'Edited', colSpan: 2 },
            { id: 'b', type: 'x', tileSize: 'half' },
        ]);
        expect(result.pages[2].cards).toEqual([{ id: 'e', type: 'x', colSpan: 1 }, { id: 'd', type: 'x', colSpan: 1, hideOn: ['desktop'] }]);
    });

    it('supports top-level cards under the key "default"', () => {
        const flat = applyLayout({ cards: [{ id: 'x' }, { id: 'y' }] }, { pages: { default: [{ id: 'y' }] } });
        expect(flat.cards.map(c => c.id)).toEqual(['y', 'x']);
    });
});

describe('buildLayout', () => {
    it('stores unchanged cards by id and changed or new cards with their config', () => {
        const pages = gridPages(base());
        const layout = buildLayout(pages, {
            home: [
                { id: 'b', type: 'x', tileSize: 'half' },
                { id: 'a', type: 'x', colSpan: 1, title: 'Edited' },
                { id: 'n', type: 'spacer', tileSize: 'quarter', hideOn: ['phone'] },
            ],
            2: [{ id: 'e', type: 'x' }, { id: 'd', type: 'x', colSpan: 3 }],
        });

        expect(layout.pages.home).toEqual([
            { id: 'b', tileSize: 'half' },
            { id: 'a', colSpan: 1, config: { type: 'x', title: 'Edited' } },
            { id: 'n', tileSize: 'quarter', hideOn: ['phone'], config: { type: 'spacer' } },
        ]);
        // Clearing hideOn of a config.yaml card is stored explicitly
        expect(layout.pages[2]).toEqual([{ id: 'e', colSpan: 1, hideOn: [] }, { id: 'd', colSpan: 3 }]);
        expect(layout.removed).toEqual(['c']);
    });

    it('round-trips through applyLayout', () => {
        const edited = {
            home: [{ id: 'n', type: 'spacer', colSpan: 1 }, { id: 'a', type: 'x', colSpan: 2 }],
            2: [{ id: 'd', type: 'x', colSpan: 1 }, { id: 'b', type: 'x', tileSize: 'half' }, { id: 'e', type: 'x', colSpan: 1, hideOn: ['phone'] }],
        };
        const result = applyLayout(base(), buildLayout(gridPages(base()), edited));
        expect(result.pages[0].cards).toEqual(edited.home);
        expect(result.pages[2].cards).toEqual(edited[2]);
    });
});

describe('layout file', () => {
    let dir;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glassboard-layout-'));
        process.env.LAYOUT_FILE = path.join(dir, 'layout.yaml');
    });

    afterEach(() => {
        delete process.env.LAYOUT_FILE;
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('treats a missing or empty file as no overrides', () => {
        expect(readLayout()).toEqual({ pages: {}, removed: [] });
        fs.writeFileSync(process.env.LAYOUT_FILE, '');
        expect(readLayout()).toEqual({ pages: {}, removed: [] });
    });

    it('writes, reads and resets the overlay', () => {
        writeLayout({ pages: { home: [{ id: 'a', colSpan: 1 }] }, removed: ['c'] });
        expect(fs.readFileSync(process.env.LAYOUT_FILE, 'utf8')).toMatch(/^# Written by Glassboard/);
        expect(readLayout()).toEqual({ pages: { home: [{ id: 'a', colSpan: 1 }] }, removed: ['c'] });

        expect(resetLayout()).toBe(true);
        expect(readLayout()).toEqual({ pages: {}, removed: [] });
    });
});
