import { act, render, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { normalizeNotice, notifies, summarizeNotices, useCardNotice, useNotices } from './notices';
import { NoticeCard, NoticePage, NoticesProvider } from './NoticeScopes';

/**
 * A card that publishes the notice it is given.
 * @param {Object} props
 * @param {*} props.notice - The notice.
 * @returns {null} Nothing.
 */
const Publisher = ({ notice }) => {
    useCardNotice(notice);
    return null;
};

/**
 * Renders a publishing card inside a page and a dashboard, and follows the notices.
 * @param {Object} options
 * @param {*} options.notice - The notice the card publishes.
 * @param {Object} [options.card] - The card's config.
 * @param {boolean} [options.scoped] - Whether the card is inside a page and card scope.
 * @returns {{notices: () => Array<Object>, rerender: (notice: *) => void, unmount: () => void}} The test harness.
 */
function setup({ notice, card = { id: 'git', type: 'git' }, scoped = true }) {
    const seen = vi.fn();
    const Reader = () => {
        seen(useNotices());
        return null;
    };
    const tree = (n) => (
        <NoticesProvider>
            <Reader />
            {scoped
                ? <NoticePage page="dev"><NoticeCard card={card}><Publisher notice={n} /></NoticeCard></NoticePage>
                : <Publisher notice={n} />}
        </NoticesProvider>
    );
    const view = render(tree(notice));
    return { notices: () => seen.mock.lastCall[0], rerender: (n) => view.rerender(tree(n)), unmount: view.unmount };
}

describe('notices', () => {
    it('publishes a card notice with its page and card', () => {
        const { notices } = setup({ notice: { level: 'todo', count: 3, title: '3 open pull requests' } });
        expect(notices()).toEqual([{ level: 'todo', count: 3, title: '3 open pull requests', page: 'dev', card: 'git' }]);
    });

    it('updates and clears the notice as the card changes, and when it unmounts', () => {
        const harness = setup({ notice: { level: 'alert', title: 'Sonarr is offline' } });
        act(() => harness.rerender({ level: 'alert', count: 2, title: '2 apps offline' }));
        expect(harness.notices()).toEqual([expect.objectContaining({ count: 2, title: '2 apps offline' })]);
        act(() => harness.rerender(false));
        expect(harness.notices()).toEqual([]);
        act(() => harness.rerender({ level: 'activity', title: 'Printing' }));
        expect(harness.notices()).toHaveLength(1);
        harness.unmount();
    });

    it('publishes several notices of one card, skipping empty ones and levels turned off', () => {
        const notices = [
            { level: 'alert', title: 'Print failed' },
            false,
            { level: 'activity', title: 'Cleaning' },
            { level: 'todo', count: 2, title: '2 parts worn' },
        ];
        const harness = setup({ notice: notices, card: { id: 'robot', notify: { activity: false } } });
        expect(harness.notices()).toEqual([
            { level: 'alert', title: 'Print failed', page: 'dev', card: 'robot' },
            { level: 'todo', count: 2, title: '2 parts worn', page: 'dev', card: 'robot' },
        ]);
        act(() => harness.rerender([]));
        expect(harness.notices()).toEqual([]);
    });

    it('publishes nothing outside a page and card, such as in editor previews', () => {
        const { notices } = setup({ notice: { level: 'alert', title: 'Down' }, scoped: false });
        expect(notices()).toEqual([]);
    });

    it('follows the notify setting of the card', () => {
        expect(setup({ notice: { level: 'alert', title: 'Down' }, card: { id: 'a', notify: false } }).notices()).toEqual([]);
        const perLevel = { id: 'a', notify: { activity: false } };
        expect(setup({ notice: { level: 'activity', title: 'Busy' }, card: perLevel }).notices()).toEqual([]);
        expect(setup({ notice: { level: 'alert', title: 'Down' }, card: perLevel }).notices()).toHaveLength(1);
    });

    it('ignores invalid notices', () => {
        expect(normalizeNotice({ level: 'panic', title: 'x' })).toBeNull();
        expect(normalizeNotice({ level: 'todo', title: '  ' })).toBeNull();
        expect(normalizeNotice({ level: 'todo', title: ' Two ', count: 2.4 })).toEqual({ level: 'todo', title: 'Two', count: 2 });
        expect(normalizeNotice({ level: 'todo', title: 'x', count: -1 })).toEqual({ level: 'todo', title: 'x' });
        expect(notifies(undefined, 'alert')).toBe(true);
    });

    it('sums up notices by page, the most urgent level first', () => {
        const all = [
            { level: 'activity', title: 'Printing', page: 'office', card: 'p' },
            { level: 'todo', count: 3, title: 'PRs', page: 'dev', card: 'g' },
            { level: 'alert', count: 2, title: 'Offline', page: 'home', card: 'a' },
            { level: 'todo', title: 'Print done', page: 'office', card: 'p2' },
        ];
        const summary = summarizeNotices(all);
        expect(summary).toMatchObject({ alert: 2, todo: 4, activity: 1, level: 'alert', count: 2 });
        expect(summary.items.map(n => n.level)).toEqual(['alert', 'todo', 'todo', 'activity']);
        expect(summarizeNotices(all, ['office'])).toMatchObject({ level: 'todo', count: 1, activity: 1 });
        expect(summarizeNotices(all, ['media'])).toMatchObject({ level: null, count: 0 });
    });

    it('reads nothing without a provider', () => {
        const { result } = renderHook(() => useNotices());
        expect(result.current).toEqual([]);
    });
});
