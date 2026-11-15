import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NoticeCard, NoticePage, NoticesProvider } from '../../context/NoticeScopes';
import { useCardNotice } from '../../context/notices';
import Sidebar from './Sidebar';
import { dropAt } from './useSidebarDrag';

const PAGES = [
    { key: 'home', index: 0, name: 'Home' },
    { key: 'dev', index: 1, name: 'Development' },
    { key: 'living', index: 2, name: 'Living Room' },
    { key: 'kitchen', index: 3, name: 'Kitchen' },
    { key: 'secret', index: 4, name: 'Secret', hidden: true },
];

const ROOMS = [{ folder: 'rooms', name: 'Rooms', pages: [{ page: 'living' }, { page: 'kitchen' }] }];

/**
 * A card publishing a notice on a page.
 * @param {Object} props
 * @param {string} props.page - The page's key.
 * @param {Object} props.notice - The notice.
 * @returns {JSX.Element} The card.
 */
const Card = ({ page, notice }) => {
    const Inner = () => {
        useCardNotice(notice);
        return null;
    };
    return <NoticePage page={page}><NoticeCard card={{ id: `${page}-card` }}><Inner /></NoticeCard></NoticePage>;
};

/**
 * Renders the sidebar inside a dashboard's notices.
 * @param {Object} props - Sidebar props to override.
 * @param {import('react').ReactNode} [children] - Cards publishing notices.
 * @returns {Object} The rendered sidebar and its callbacks.
 */
function renderSidebar(props = {}, children = null) {
    const callbacks = { onNavigate: vi.fn(), onChange: vi.fn(), onEditEntry: vi.fn() };
    render(
        <NoticesProvider>
            {children}
            <Sidebar pages={PAGES} activeIndex={0} items={ROOMS} {...callbacks} {...props} />
        </NoticesProvider>,
    );
    return callbacks;
}

describe('Sidebar', () => {
    it('shows the pages and folders and marks the page shown', () => {
        renderSidebar();
        expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: 'Rooms, folder with 2 pages' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('button', { name: 'Development' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument();
    });

    it('goes to a page, also from inside a folder, which then closes', () => {
        const { onNavigate } = renderSidebar();
        fireEvent.click(screen.getByRole('button', { name: 'Development' }));
        expect(onNavigate).toHaveBeenLastCalledWith(1);

        fireEvent.click(screen.getByRole('button', { name: /^Rooms/ }));
        expect(screen.getByRole('group', { name: 'Rooms' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
        expect(onNavigate).toHaveBeenLastCalledWith(3);
        expect(screen.queryByRole('group', { name: 'Rooms' })).not.toBeInTheDocument();
    });

    it('opens a folder without a title or names, and animates it closed before removing it', () => {
        vi.useFakeTimers();
        renderSidebar();
        fireEvent.click(screen.getByRole('button', { name: /^Rooms/ }));
        const flyout = screen.getByRole('group', { name: 'Rooms' });
        expect(flyout.querySelector('.sidebar-flyout-title, .sidebar-fly-name')).toBeNull();
        expect(flyout.querySelectorAll('.sidebar-tip')).toHaveLength(2);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(flyout).toHaveClass('is-closing');
        expect(flyout).toHaveAttribute('aria-hidden', 'true');
        act(() => { vi.advanceTimersByTime(200); });
        expect(document.querySelector('.sidebar-flyout')).toBeNull();
        vi.useRealTimers();
    });

    it('closes a folder with Escape and a press outside', () => {
        renderSidebar();
        fireEvent.click(screen.getByRole('button', { name: /^Rooms/ }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Rooms/ }));
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('shows bubbles for notices of cards, adding up the pages of a folder', () => {
        renderSidebar({}, (
            <>
                <Card page="dev" notice={{ level: 'todo', count: 3, title: '3 open pull requests' }} />
                <Card page="living" notice={{ level: 'alert', title: 'Robo is stuck' }} />
                <Card page="kitchen" notice={{ level: 'activity', title: 'Dishwasher running' }} />
            </>
        ));
        const dev = screen.getByRole('button', { name: 'Development, 3 to do' });
        expect(dev.querySelector('.sidebar-badge.is-todo')).toHaveTextContent('3');
        const rooms = screen.getByRole('button', { name: 'Rooms, folder with 2 pages, 1 alert, 1 running' });
        expect(rooms.querySelector('.sidebar-badge.is-alert')).toHaveTextContent('1');
        expect(screen.getAllByRole('tooltip').map(t => t.textContent)).toContain('RoomsLiving Room · Robo is stuckKitchen · Dishwasher running');

        fireEvent.click(rooms);
        expect(screen.getByRole('button', { name: 'Kitchen, 1 running' }).querySelector('.sidebar-badge.is-activity')).toBeInTheDocument();
    });

    it('opens the icon editor while editing, and shows hidden pages', () => {
        const { onEditEntry, onNavigate } = renderSidebar({ editing: true });
        fireEvent.click(screen.getByRole('button', { name: 'Secret, edit icon' }));
        expect(onEditEntry).toHaveBeenCalledWith({ folder: null, index: 3 });
        expect(onNavigate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /^Rooms/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Edit folder' }));
        expect(onEditEntry).toHaveBeenLastCalledWith({ folder: null, index: 0 });
    });

    it('moves an icon with Shift and an arrow key while editing', () => {
        const { onChange } = renderSidebar({ editing: true });
        fireEvent.keyDown(screen.getByRole('button', { name: 'Home, edit icon' }), { key: 'ArrowUp', shiftKey: true });
        expect(onChange).toHaveBeenCalledWith([{ page: 'home' }, ...ROOMS, { page: 'dev' }, { page: 'secret' }]);
    });

    it('drops a dragged icon where the pointer is, or onto another one to make a folder', () => {
        const { onChange } = renderSidebar({ editing: true });
        const rail = document.querySelector('[data-sb-root]');
        const items = [...rail.querySelectorAll(':scope > [data-sb-index]')];
        // A column of 46px icons, 8px apart
        rail.getBoundingClientRect = () => /** @type {DOMRect} */ ({ left: 0, right: 68, top: 0, bottom: 230, width: 68, height: 230 });
        items.forEach((el, i) => {
            el.getBoundingClientRect = () => /** @type {DOMRect} */ ({ left: 11, right: 57, top: i * 54, bottom: i * 54 + 46, width: 46, height: 46 });
        });

        const home = screen.getByRole('button', { name: 'Home, edit icon' });
        fireEvent.pointerDown(home, { clientX: 34, clientY: 77, button: 0 });
        act(() => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 34, clientY: 90 }));
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 34, clientY: 185 }));
        });
        expect(items[3]).toHaveClass('is-drop-merge');
        act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 34, clientY: 185 })); });
        expect(onChange).toHaveBeenCalledWith([
            ...ROOMS,
            { page: 'dev' },
            expect.objectContaining({ name: 'Folder', pages: [{ page: 'secret' }, { page: 'home' }] }),
        ]);
        expect(document.querySelector('.sidebar-ghost')).toBeNull();
    });
});

describe('dropAt', () => {
    it('finds the place between icons, and nowhere far from the sidebar', () => {
        document.body.innerHTML = `
            <nav><div data-sb-root style="display:flex;flex-direction:column">
                <div data-sb-index="0"></div><div data-sb-index="1"></div><div data-sb-index="2"></div>
            </div></nav>`;
        const root = /** @type {HTMLElement} */ (document.querySelector('nav'));
        /** @type {HTMLElement} */ (root.firstElementChild).getBoundingClientRect = () => /** @type {DOMRect} */ ({ left: 0, right: 68, top: 0, bottom: 160 });
        root.querySelectorAll('[data-sb-index]').forEach((el, i) => {
            el.getBoundingClientRect = () => /** @type {DOMRect} */ ({ left: 11, right: 57, top: i * 54, bottom: i * 54 + 46, width: 46, height: 46 });
        });

        expect(dropAt(root, 34, 50, { folder: null, index: 2 }, false)).toEqual({
            target: { type: 'insert', folder: null, index: 1 },
            marker: { folder: null, index: 1, side: 'before' },
        });
        expect(dropAt(root, 34, 23, { folder: null, index: 2 }, false).target).toEqual({ type: 'merge', index: 0 });
        expect(dropAt(root, 34, 23, { folder: null, index: 2 }, true).target).toEqual({ type: 'insert', folder: null, index: 0 });
        expect(dropAt(root, 400, 50, { folder: null, index: 2 }, false)).toBeNull();
    });
});
