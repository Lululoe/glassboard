import { useState, useMemo, useRef, useEffect } from 'react';
import { useConfig } from './hooks/useConfig';
import { ThemeProvider } from './context/ThemeContext';
import { useSwipe } from './hooks/useSwipe';
import { useRouteSync, getInitialPageIndex } from './hooks/useRouteSync';
import BentoGrid from './components/Grid/BentoGrid';
import IframeView from './components/Layout/IframeView';
import Header from './components/Header/Header';
import ParticlesBackground from './components/Layout/ParticlesBackground';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './App.css';

/**
 * Main application component.
 * Manages configuration loading, routing, theme initialization, and page navigation via swipe/keyboard.
 * @returns {JSX.Element} The rendered application.
 */
function App() {
  const { config } = useConfig();

  // Normalize config to Pages
  const pages = useMemo(() => {
    if (!config) return [];
    if (config.pages && Array.isArray(config.pages)) return config.pages;
    if (config.cards && Array.isArray(config.cards)) return [{ id: 'default', cards: config.cards }];
    return [];
  }, [config]);

  // Initialize state based on URL
  const [pageIndex, setPageIndex] = useState(() => getInitialPageIndex(pages));

  // Sync state <-> URL
  useRouteSync(pages, pageIndex, setPageIndex);

  // Navigation Handlers
  const nextPage = () => {
    let nextIndex = pageIndex + 1;
    while (nextIndex < pages.length && pages[nextIndex].hidden) {
      nextIndex++;
    }
    if (nextIndex < pages.length) setPageIndex(nextIndex);
  };

  const prevPage = () => {
    let prevIndex = pageIndex - 1;
    while (prevIndex >= 0 && pages[prevIndex].hidden) {
      prevIndex--;
    }
    if (prevIndex >= 0) setPageIndex(prevIndex);
  };

  // Check for available visible pages
  const hasNextVisible = useMemo(() => {
    let i = pageIndex + 1;
    while (i < pages.length) {
      if (!pages[i].hidden) return true;
      i++;
    }
    return false;
  }, [pageIndex, pages]);

  const hasPrevVisible = useMemo(() => {
    let i = pageIndex - 1;
    while (i >= 0) {
      if (!pages[i].hidden) return true;
      i--;
    }
    return false;
  }, [pageIndex, pages]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextPage,
    onSwipeRight: prevPage,
    threshold: 75
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageIndex, pages]);

  const contentRef = useRef(null);

  // Re-trigger entrance animations when switching pages
  useEffect(() => {
    if (!contentRef.current) return;
    const activeContainer = contentRef.current.querySelector('.page-active');
    if (!activeContainer) return;
    const items = activeContainer.querySelectorAll('.grid-item');
    items.forEach(el => {
      el.style.animation = 'none';
      el.offsetHeight; // force reflow
      el.style.animation = '';
    });
  }, [pageIndex, nextPage, prevPage]);

  if (!config) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <ThemeProvider config={config}>
      <div className="App" {...swipeHandlers}>
        <ParticlesBackground />
        <Header config={config} />

        <div className="app-content" ref={contentRef}>
          {/* Left Navigation Zone */}
          {hasPrevVisible && (
            <div className="nav-zone nav-zone-left" onClick={prevPage}>
              <ChevronLeft size={48} />
            </div>
          )}

          {pages.map((page, idx) => (
            <div
              key={page.id || idx}
              className={`scroll-content ${idx === pageIndex ? 'page-active' : 'page-hidden'}`}
            >
              {page.type === 'iframe' ? (
                <IframeView config={page} />
              ) : (
                <BentoGrid config={{ ...config, cards: page.cards }} />
              )}
            </div>
          ))}

          {/* Right Navigation Zone */}
          {hasNextVisible && (
            <div className="nav-zone nav-zone-right" onClick={nextPage}>
              <ChevronRight size={48} />
            </div>
          )}
        </div>

        {/* Page Indicator */}
        {pages.length > 1 && (
          <div className="page-indicators">
            {pages.map((page, idx) => {
              if (page.hidden) return null;
              return (
                <div
                  key={idx}
                  className={`page-dot ${idx === pageIndex ? 'active' : ''}`}
                  onClick={() => setPageIndex(idx)}
                />
              );
            })}
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}


export default App;
