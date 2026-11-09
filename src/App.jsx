import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useConfig } from './hooks/useConfig';
import { usePageNavigation } from './hooks/usePageNavigation';
import { useSwipe } from './hooks/useSwipe';
import { ThemeProvider } from './context/ThemeContext';
import { IconBackgroundsContext } from './context/iconBackgrounds';
import { PageActiveContext } from './context/pageActive';
import { pageKey, useDashboardEditing } from './hooks/useDashboardEditing';
import { splitControlCards } from './features/HomeAssistant/haControlModel';
import BentoGrid from './components/Grid/BentoGrid';
import AddCardDialog from './components/Editor/AddCardDialog';
import BackgroundEditor from './components/Editor/BackgroundEditor';
import PageDialog from './components/Editor/PageDialog';
import CardEditor from './components/Editor/CardEditor';
import CardIconEditor from './components/Editor/CardIconEditor';
import ConfirmDialog from './components/Editor/ConfirmDialog';
import HeaderMenuEditor from './components/Editor/HeaderMenuEditor';
import IframeView from './components/Layout/IframeView';
import Header from './components/Header/Header';
import PageBackground from './components/Layout/PageBackground';
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
    // Home Assistant control cards are single quarter tiles; older ones with several entities are split
    const configPages = useMemo(() => {
        const withTiles = (page) => {
            const cards = splitControlCards(page.cards);
            return cards === page.cards ? page : { ...page, cards };
        };
        if (Array.isArray(config.pages)) return config.pages.map(withTiles);
        if (Array.isArray(config.cards)) return [withTiles({ id: 'default', cards: config.cards })];
        return [];
    }, [config]);

    const layout = useDashboardEditing(config, configPages);
    // Pages added, renamed or deleted in edit mode show right away
    const pages = layout.withDraftPages(configPages);
    const { pageIndex, goTo, goToKey, next, prev, hasNext, hasPrev } = usePageNavigation(pages);
    const swipeHandlers = useSwipe({ onSwipeLeft: next, onSwipeRight: prev, threshold: 75 });
    const contentRef = useRef(null);

    // The header menu being edited shows wherever the saved one would, also in app grids that follow it
    const liveConfig = useMemo(
        () => (layout.launcher === config.launcher ? config : { ...config, launcher: layout.launcher }),
        [config, layout.launcher],
    );

    const activePage = pages[pageIndex];
    const activeKey = activePage ? pageKey(activePage, pageIndex) : undefined;
    const activeBackground = activePage ? layout.pageBackgroundOf(activePage, pageIndex) : undefined;
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
            if (e.key === 'Escape' && !layout.editor && !layout.adding && !layout.editingMenu && !layout.editingBackground
                && !layout.pageDialog && !layout.confirmingReset) layout.finish();
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
            <PageBackground background={activeBackground ?? layout.background} />
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
                    onEditBackground: () => layout.openBackgroundEditor(),
                    onEditPage: () => layout.openPageSettings(activeKey),
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
                                        onEditIcon={(index) => layout.openIconEditor(pageKey(page, idx), index)}
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

            {layout.pageDialog && (() => {
                const page = layout.pageDialog.id ? pages.find(p => String(p.id) === layout.pageDialog.id) : null;
                return (
                    <PageDialog
                        page={page ? { id: String(page.id), name: page.name, addedInEditor: !!page.addedInEditor } : undefined}
                        cardCount={page ? layout.cardsOf(page, pages.indexOf(page))?.length : 0}
                        onSave={(name) => (page ? layout.renamePage(String(page.id), name) : goToKey(layout.addPage(name)))}
                        onDelete={page?.addedInEditor ? () => layout.deletePage(String(page.id)) : undefined}
                        onEditBackground={page ? () => layout.openBackgroundEditor('page') : undefined}
                        onCancel={layout.closePageDialog}
                    />
                );
            })()}

            {layout.editingBackground && (
                <BackgroundEditor
                    background={layout.background}
                    pageBackground={activeBackground}
                    pageName={activePage && activePage.type !== 'iframe' ? activePage.name || String(activePage.id) : undefined}
                    initialScope={layout.editingBackground}
                    onSave={(saved) => layout.saveBackground(saved, activeKey)}
                    onCancel={layout.closeBackgroundEditor}
                />
            )}

            {layout.adding && activePage && (
                <AddCardDialog
                    onPick={(type) => layout.addCard(pageKey(activePage, pageIndex), type)}
                    onCancel={layout.closeAdd}
                />
            )}

            <IconBackgroundsContext value={{ presets: layout.iconBackgrounds, onChange: layout.setIconBackgrounds }}>
                {layout.editingCard && layout.editor.mode === 'icon' && (
                    <CardIconEditor
                        key={`${layout.editor.key}:${layout.editingCard.id}:icon`}
                        card={layout.editingCard}
                        globalConfig={liveConfig}
                        onSave={layout.saveCard}
                        onCancel={layout.cancelEditor}
                    />
                )}

                {layout.editingCard && layout.editor.mode !== 'icon' && (
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

            {(pages.length > 1 || layout.editing) && (
                <nav className={`page-indicators${layout.editing ? ' is-editing' : ''}`} aria-label="Pages">
                    {pages.map((page, idx) => (!page.hidden || layout.editing) && (
                        <button
                            type="button"
                            key={page.id ?? idx}
                            className={`button-reset page-dot ${idx === pageIndex ? 'active' : ''}`}
                            onClick={() => goTo(idx)}
                            title={page.name || undefined}
                            aria-label={`Page ${idx + 1} of ${pages.length}${page.name ? `: ${page.name}` : ''}`}
                            aria-current={idx === pageIndex ? 'page' : undefined}
                        />
                    ))}
                    {layout.editing && (
                        <button
                            type="button"
                            className="button-reset page-indicator-action"
                            onClick={layout.openAddPage}
                            aria-label="Add page"
                            title="Add page"
                        >
                            <Plus size={16} aria-hidden="true" />
                        </button>
                    )}
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
