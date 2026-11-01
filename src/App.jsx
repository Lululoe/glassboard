import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfig } from './hooks/useConfig';
import { usePageNavigation } from './hooks/usePageNavigation';
import { useSwipe } from './hooks/useSwipe';
import { ThemeProvider } from './context/ThemeContext';
import { IconBackgroundsContext } from './context/iconBackgrounds';
import { PageActiveContext } from './context/pageActive';
import { pageKey, useDashboardEditing } from './hooks/useDashboardEditing';
import BentoGrid from './components/Grid/BentoGrid';
import AddCardDialog from './components/Editor/AddCardDialog';
import CardEditor from './components/Editor/CardEditor';
import ConfirmDialog from './components/Editor/ConfirmDialog';
import HeaderMenuEditor from './components/Editor/HeaderMenuEditor';
import IframeView from './components/Layout/IframeView';
import Header from './components/Header/Header';
import ParticlesBackground from './components/Layout/ParticlesBackground';
import './App.css';

/**
 * Renders the pages of a loaded config with swipe, keyboard and URL navigation.
 * Only the active page polls its services; the others stay mounted but idle.
 * @param {Object} props
 * @param {Object} props.config - The dashboard configuration.
 * @returns {JSX.Element} The dashboard.
 */
function Dashboard({ config }) {
    const pages = useMemo(() => {
        if (Array.isArray(config.pages)) return config.pages;
        if (Array.isArray(config.cards)) return [{ id: 'default', cards: config.cards }];
        return [];
    }, [config]);

    const { pageIndex, goTo, next, prev, hasNext, hasPrev } = usePageNavigation(pages);
    const layout = useDashboardEditing(config, pages);
    const swipeHandlers = useSwipe({ onSwipeLeft: next, onSwipeRight: prev, threshold: 75 });
    const contentRef = useRef(null);

    // The header menu being edited shows wherever the saved one would, also in app grids that follow it
    const liveConfig = useMemo(
        () => (layout.launcher === config.launcher ? config : { ...config, launcher: layout.launcher }),
        [config, layout.launcher],
    );

    const activePage = pages[pageIndex];
    const editable = config.editable !== false && !!activePage && activePage.type !== 'iframe';

    /**
     * Index of the page a card dragged to the screen edge would move to, or -1 if there is none.
     * @param {number} from - Current page index.
     * @param {-1|1} direction - Previous or next.
     * @returns {number} The target page index.
     */
    const pageInDirection = (from, direction) => {
        const target = pages[from + direction];
        return target && target.type !== 'iframe' ? from + direction : -1;
    };

    const onKeyDown = useEffectEvent((e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        if (layout.editing) {
            if (e.key === 'Escape' && !layout.editor && !layout.adding && !layout.editingMenu && !layout.confirmingReset) layout.finish();
            return;
        }
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') prev();
    });

    useEffect(() => {
        const handler = (e) => onKeyDown(e);
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Restart the entrance animation of the cards when switching pages.
    useEffect(() => {
        const items = contentRef.current?.querySelectorAll('.page-active .grid-item') || [];
        items.forEach(el => {
            el.style.animation = 'none';
            void el.offsetHeight;
            el.style.animation = '';
        });
    }, [pageIndex]);

    return (
        <div className={`App${layout.editing ? ' is-editing' : ''}`} {...(layout.editing ? {} : swipeHandlers)}>
            <ParticlesBackground />
            <Header
                config={liveConfig}
                edit={{
                    available: editable,
                    active: layout.editing,
                    saving: layout.saving,
                    status: layout.status,
                    onStart: layout.start,
                    onDone: layout.finish,
                    onReset: layout.requestReset,
                    canUndoReset: layout.canUndoReset,
                    undoFailed: layout.undoFailed,
                    onUndoReset: layout.undoReset,
                    onAdd: layout.openAdd,
                    onEditMenu: layout.openMenuEditor,
                }}
            />

            <div className="app-content" ref={contentRef}>
                {hasPrev && (
                    <button type="button" className="button-reset nav-zone nav-zone-left" onClick={prev} aria-label="Previous page">
                        <ChevronLeft size={48} aria-hidden="true" />
                    </button>
                )}

                {pages.map((page, idx) => (
                    <div
                        key={page.id ?? idx}
                        className={`scroll-content ${idx === pageIndex ? 'page-active' : 'page-hidden'}`}
                    >
                        <PageActiveContext value={idx === pageIndex}>
                            {page.type === 'iframe'
                                ? <IframeView config={page} />
                                : (
                                    <BentoGrid
                                        cards={layout.cardsOf(page, idx)}
                                        globalConfig={liveConfig}
                                        editing={layout.editing && idx === pageIndex}
                                        onLayoutChange={(cards) => layout.change(pageKey(page, idx), cards)}
                                        onRequestEdit={config.editable !== false ? layout.start : undefined}
                                        onExitEdit={layout.finish}
                                        onEditCard={(index) => layout.openEditor(pageKey(page, idx), index)}
                                        canMoveToPage={(dir) => pageInDirection(idx, dir) >= 0}
                                        onMoveToPage={(dir, index, carry) => {
                                            const target = pageInDirection(idx, dir);
                                            layout.moveToPage(pageKey(page, idx), index, pageKey(pages[target], target), carry);
                                            goTo(target);
                                        }}
                                        incomingDrag={idx === pageIndex ? layout.carry : null}
                                        onIncomingDragTaken={layout.clearCarry}
                                    />
                                )}
                        </PageActiveContext>
                    </div>
                ))}

                {hasNext && (
                    <button type="button" className="button-reset nav-zone nav-zone-right" onClick={next} aria-label="Next page">
                        <ChevronRight size={48} aria-hidden="true" />
                    </button>
                )}
            </div>

            {layout.confirmingReset && (
                <ConfirmDialog
                    title="Reset Dashboard?"
                    message="This removes everything changed in the browser, including cards you added, and goes back to config.yaml."
                    confirmLabel="Reset Dashboard"
                    onConfirm={layout.reset}
                    onCancel={layout.cancelReset}
                />
            )}

            {layout.adding && activePage && (
                <AddCardDialog
                    onPick={(type) => layout.addCard(pageKey(activePage, pageIndex), type)}
                    onCancel={layout.closeAdd}
                />
            )}

            <IconBackgroundsContext value={{ presets: layout.iconBackgrounds, onChange: layout.setIconBackgrounds }}>
                {layout.editingCard && (
                    <CardEditor
                        key={`${layout.editor.key}:${layout.editingCard.id}`}
                        card={layout.editingCard}
                        globalConfig={liveConfig}
                        isNew={layout.editor.isNew}
                        onSave={layout.saveCard}
                        onCancel={layout.cancelEditor}
                        onRemove={layout.removeCard}
                    />
                )}

                {layout.editingMenu && (
                    <HeaderMenuEditor
                        launcher={layout.launcher}
                        onSave={layout.saveMenu}
                        onCancel={layout.closeMenuEditor}
                    />
                )}
            </IconBackgroundsContext>

            {pages.length > 1 && (
                <nav className="page-indicators" aria-label="Pages">
                    {pages.map((page, idx) => !page.hidden && (
                        <button
                            type="button"
                            key={page.id ?? idx}
                            className={`button-reset page-dot ${idx === pageIndex ? 'active' : ''}`}
                            onClick={() => goTo(idx)}
                            aria-label={`Page ${idx + 1} of ${pages.length}${page.name ? `: ${page.name}` : ''}`}
                            aria-current={idx === pageIndex ? 'page' : undefined}
                        />
                    ))}
                </nav>
            )}
        </div>
    );
}

/**
 * Root component: loads the configuration and renders the dashboard once it is available.
 * @returns {JSX.Element} The rendered application.
 */
function App() {
    const { config, error } = useConfig();

    if (!config) {
        return (
            <div className="loading-screen">
                {error ? <p className="loading-error">{error}</p> : <div className="loading-spinner" />}
            </div>
        );
    }

    return (
        <ThemeProvider config={config}>
            <Dashboard config={config} />
        </ThemeProvider>
    );
}

export default App;
