import React, { useEffect, useState } from 'react';
import { useAutoHide } from '../../hooks/useAutoHide';
import './Header.css';
import { LayoutTemplate, Palette, LayoutGrid, Pencil, SquarePen, Plus, Wallpaper, FilePen, RotateCcw, PanelLeft, TabletSmartphone } from 'lucide-react';
import LauncherPopup from './LauncherPopup';
import ThemeMenu from './ThemeMenu';
import UserBubble from '../../features/Kiosk/UserBubble';

/** The top-left corner that reveals an auto-hiding header when the mouse is in it, in pixels. */
// eslint-disable-next-line react-refresh/only-export-components
export const REVEAL_CORNER = { width: 240, height: 72 };

/**
 * Whether a point is in the top-left corner that reveals the header.
 * @param {number} x - Distance from the left edge.
 * @param {number} y - Distance from the top edge.
 * @returns {boolean} True inside the corner.
 */
const inRevealCorner = (x, y) => x <= REVEAL_CORNER.width && y <= REVEAL_CORNER.height;

/**
 * Application header component displaying the logo, the Theme menu, and launcher grid toggle.
 * While the layout is being edited it shows Reset and Done instead.
 * @param {Object} props
 * @param {Object} props.config - The global application configuration object.
 * @param {Object} [props.edit] - Edit mode state and actions.
 * @param {boolean} props.edit.available - Whether the current page can be edited.
 * @param {boolean} props.edit.active - Whether edit mode is on.
 * @param {boolean} [props.edit.saving] - Whether a save is in progress.
 * @param {string|null} [props.edit.status] - Message shown next to the edit controls.
 * @param {() => void} props.edit.onStart - Turns edit mode on.
 * @param {() => void} props.edit.onDone - Saves and leaves edit mode.
 * @param {() => void} props.edit.onReset - Asks whether to reset the dashboard to config.yaml.
 * @param {boolean} [props.edit.canUndoReset] - Whether a reset was just done.
 * @param {boolean} [props.edit.undoFailed] - Whether undoing it just failed.
 * @param {() => void} [props.edit.onUndoReset] - Undoes it.
 * @param {() => void} props.edit.onAdd - Opens the list of cards to add.
 * @param {() => void} [props.edit.onEditMenu] - Opens the editor of the header menu.
 * @param {() => void} [props.edit.onEditBackground] - Opens the editor of the page background.
 * @param {() => void} [props.edit.onEditPage] - Opens the settings of the page being shown.
 * @param {boolean} [props.edit.sidebar] - Whether the sidebar shows.
 * @param {() => void} [props.edit.onToggleSidebar] - Shows or hides the sidebar.
 * @param {() => void} [props.edit.onEditKiosk] - Opens the kiosk mode options.
 * @param {boolean} [props.autoHide] - Hides the bar until it is pointed at, tapped at the top of the
 *   screen or reached with the keyboard. It stays while it is used and while its menu is open.
 * @param {import('../../features/Kiosk/useKioskUser').KioskUser|null} [props.user] - Who is logged in on
 *   the kiosk tablet; a bubble next to the app menu shows them.
 * @param {number} [props.page] - The page shown; when it changes, whether it is scrolled is read again.
 * @returns {JSX.Element} The rendered header.
 */
const Header = ({ config, edit, autoHide = false, page, user = null }) => {
    const [isLauncherOpen, setIsLauncherOpen] = useState(false);
    const [isThemeOpen, setIsThemeOpen] = useState(false);
    const { hidden, reveal, hideSoon } = useAutoHide(autoHide, isLauncherOpen || isThemeOpen);
    // On touch screens there is no pointer leaving the bar, so it hides a few seconds after the last tap
    const TOUCH_DELAY = 4000;

    // Besides the strip along the top edge, the mouse in the top-left corner reveals the bar. It is
    // watched rather than covered, so the cards under the corner can still be clicked.
    useEffect(() => {
        if (!autoHide) return undefined;
        let inside = false;
        const onMove = (e) => {
            if (e.pointerType !== 'mouse') return;
            const now = inRevealCorner(e.clientX, e.clientY);
            if (now && !inside) reveal();
            // Leaving the corner onto the bar itself keeps it; the bar hides when the mouse leaves it
            else if (!now && inside && !e.target?.closest?.('.app-header')) hideSoon();
            inside = now;
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
    }, [autoHide, reveal, hideSoon]);

    // Whether the page is scrolled down, so a style can fade the name out over the cards
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const update = () => setScrolled((document.querySelector('.scroll-content.page-active')?.scrollTop ?? 0) > 4);
        update();
        document.addEventListener('scroll', update, { capture: true, passive: true });
        return () => document.removeEventListener('scroll', update, { capture: true });
    }, [page]);

    const autoHideHandlers = autoHide ? {
        onPointerEnter: (e) => { if (e.pointerType === 'mouse') reveal(); },
        onPointerLeave: (e) => { if (e.pointerType === 'mouse') hideSoon(); },
        onPointerDown: (e) => {
            if (e.pointerType === 'mouse') return;
            reveal();
            hideSoon(TOUCH_DELAY);
        },
        onFocus: reveal,
        onBlur: (e) => { if (!e.currentTarget.contains(/** @type {Node|null} */ (e.relatedTarget))) hideSoon(); },
    } : {};

    return (
        <>
            {autoHide && (
                <div
                    className="header-reveal"
                    aria-hidden="true"
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') reveal(); }}
                    onClick={() => {
                        reveal();
                        hideSoon(TOUCH_DELAY);
                    }}
                >
                    <span className="header-reveal-handle" />
                </div>
            )}
            <header
                className={`app-header${edit?.active ? ' is-editing' : ''}${autoHide ? ' is-auto-hide' : ''}${hidden ? ' is-hidden' : ''}${scrolled ? ' is-scrolled' : ''}`}
                {...autoHideHandlers}
            >
                <div className="header-left">
                    <LayoutTemplate className="header-logo-icon" size={24} />
                    <span className="header-title">Glassboard</span>
                    {config?.demo && (
                        <span className="header-demo-badge" title="Cards show simulated data">Demo</span>
                    )}
                </div>

                {edit?.active ? (
                    <div className="header-right" key="edit">
                        {edit.status && <span className="header-edit-status" role="status">{edit.status}</span>}
                        <button
                            type="button"
                            className="button-reset icon-button"
                            onClick={edit.onAdd}
                            disabled={edit.saving}
                            title="Add card"
                            aria-label="Add card"
                        >
                            <Plus size={22} aria-hidden="true" />
                        </button>
                        {edit.onEditPage && (
                            <button
                                type="button"
                                className="button-reset icon-button"
                                onClick={edit.onEditPage}
                                disabled={edit.saving}
                                title="Edit page"
                                aria-label="Edit page"
                            >
                                <FilePen size={20} aria-hidden="true" />
                            </button>
                        )}
                        {edit.onEditBackground && (
                            <button
                                type="button"
                                className="button-reset icon-button"
                                onClick={edit.onEditBackground}
                                disabled={edit.saving}
                                title="Edit background"
                                aria-label="Edit background"
                            >
                                <Wallpaper size={20} aria-hidden="true" />
                            </button>
                        )}
                        {edit.onEditMenu && (
                            <button
                                type="button"
                                className="button-reset icon-button header-menu-edit"
                                onClick={edit.onEditMenu}
                                disabled={edit.saving}
                                title="Edit header menu"
                                aria-label="Edit header menu"
                            >
                                <LayoutGrid size={20} aria-hidden="true" />
                                <span className="header-menu-edit-badge"><Pencil size={10} strokeWidth={3} aria-hidden="true" /></span>
                            </button>
                        )}
                        {edit.onToggleSidebar && (
                            <button
                                type="button"
                                className={`button-reset icon-button header-sidebar-toggle${edit.sidebar ? ' is-on' : ''}`}
                                onClick={edit.onToggleSidebar}
                                disabled={edit.saving}
                                title={edit.sidebar ? 'Hide sidebar' : 'Show sidebar'}
                                aria-label="Sidebar"
                                aria-pressed={!!edit.sidebar}
                            >
                                <PanelLeft size={20} aria-hidden="true" />
                            </button>
                        )}
                        {edit.onEditKiosk && (
                            <button
                                type="button"
                                className="button-reset icon-button"
                                onClick={edit.onEditKiosk}
                                disabled={edit.saving}
                                title="Kiosk mode"
                                aria-label="Kiosk mode"
                            >
                                <TabletSmartphone size={20} aria-hidden="true" />
                            </button>
                        )}
                        <button
                            type="button"
                            className="button-reset header-text-button header-reset-button"
                            onClick={edit.onReset}
                            disabled={edit.saving}
                            aria-label="Reset…"
                            title="Reset…"
                        >
                            {/* On narrow screens only the icon shows, so Done always fits */}
                            <RotateCcw className="header-reset-icon" size={18} aria-hidden="true" />
                            <span className="header-reset-label">Reset…</span>
                        </button>
                        <button type="button" className="button-reset header-done-button" onClick={edit.onDone} disabled={edit.saving}>
                            Done
                        </button>
                    </div>
                ) : (
                <div className="header-right" key="view">
                    {edit?.canUndoReset && (
                        <span className="header-edit-status" role="status">
                            {edit.undoFailed ? "Couldn't undo the reset." : 'Dashboard reset.'}{' '}
                            <button type="button" className="button-reset header-undo" onClick={edit.onUndoReset}>
                                {edit.undoFailed ? 'Try Again' : 'Undo'}
                            </button>
                        </span>
                    )}
                    {edit?.available && (
                        <button
                            type="button"
                            className="button-reset icon-button"
                            onClick={edit.onStart}
                            title="Edit layout"
                            aria-label="Edit layout"
                        >
                            <SquarePen size={20} aria-hidden="true" />
                        </button>
                    )}
                    {config?.themeToggle !== false && (
                        <button
                            type="button"
                            className={`button-reset icon-button${isThemeOpen ? ' active' : ''}`}
                            onClick={() => setIsThemeOpen(!isThemeOpen)}
                            title="Theme"
                            aria-label="Theme"
                            aria-haspopup="dialog"
                            aria-expanded={isThemeOpen}
                        >
                            <Palette size={20} aria-hidden="true" />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`button-reset icon-button${isLauncherOpen ? ' active' : ''}`}
                        onClick={() => setIsLauncherOpen(!isLauncherOpen)}
                        title="Apps"
                        aria-label="Apps"
                        aria-haspopup="dialog"
                        aria-expanded={isLauncherOpen}
                    >
                        <LayoutGrid size={20} aria-hidden="true" />
                    </button>
                    {user && <UserBubble user={user} />}
                </div>
                )}

                {isThemeOpen && (
                    <ThemeMenu
                        editable={config?.editable === true}
                        onClose={() => {
                            setIsThemeOpen(false);
                            if (autoHide) hideSoon();
                        }}
                    />
                )}

                {isLauncherOpen && (
                    <LauncherPopup
                        config={config}
                        onClose={() => {
                            setIsLauncherOpen(false);
                            if (autoHide) hideSoon();
                        }}
                    />
                )}
            </header>
        </>
    );
};

export default Header;
