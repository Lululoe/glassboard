import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfig } from './hooks/useConfig';
import { usePageNavigation } from './hooks/usePageNavigation';
import { useSwipe } from './hooks/useSwipe';
import { ThemeProvider } from './context/ThemeContext';
import { PageActiveContext } from './context/pageActive';
import BentoGrid from './components/Grid/BentoGrid';
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
    const swipeHandlers = useSwipe({ onSwipeLeft: next, onSwipeRight: prev, threshold: 75 });
    const contentRef = useRef(null);

    const onKeyDown = useEffectEvent((e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
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
        <div className="App" {...swipeHandlers}>
            <ParticlesBackground />
            <Header config={config} />

            <div className="app-content" ref={contentRef}>
                {hasPrev && (
                    <div className="nav-zone nav-zone-left" onClick={prev}>
                        <ChevronLeft size={48} />
                    </div>
                )}

                {pages.map((page, idx) => (
                    <div
                        key={page.id ?? idx}
                        className={`scroll-content ${idx === pageIndex ? 'page-active' : 'page-hidden'}`}
                    >
                        <PageActiveContext value={idx === pageIndex}>
                            {page.type === 'iframe'
                                ? <IframeView config={page} />
                                : <BentoGrid cards={page.cards} globalConfig={config} />}
                        </PageActiveContext>
                    </div>
                ))}

                {hasNext && (
                    <div className="nav-zone nav-zone-right" onClick={next}>
                        <ChevronRight size={48} />
                    </div>
                )}
            </div>

            {pages.length > 1 && (
                <div className="page-indicators">
                    {pages.map((page, idx) => !page.hidden && (
                        <div
                            key={page.id ?? idx}
                            className={`page-dot ${idx === pageIndex ? 'active' : ''}`}
                            onClick={() => goTo(idx)}
                        />
                    ))}
                </div>
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
