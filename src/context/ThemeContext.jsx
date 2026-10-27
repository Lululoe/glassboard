import { createContext, useContext, useEffect, useRef, useState } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext({ mode: 'dark', toggleMode: () => {}, themeId: 'default', particles: null });

/**
 * Hook to access the current theme context, including mode (light/dark) and toggle functions.
 * @returns {Object} Theme context value containing mode, toggleMode, themeId, and particles config.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

/**
 * Provider component that manages the application theme state, applying CSS variables to the document root.
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to wrap.
 * @param {Object} props.config - Global configuration containing theme definitions.
 * @returns {JSX.Element} The ThemeContext Provider.
 */
export const ThemeProvider = ({ children, config }) => {
    // Light/Dark mode state
    const [mode, setMode] = useState(() => {
        const saved = localStorage.getItem('theme-mode');
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    // Determine active theme from config
    const activeThemeId = config?.theme || 'default';
    const themes = config?.themes || [];
    const activeThemeConfig = themes.find(t => t.id === activeThemeId);

    // Find default theme for fallback
    const defaultThemeConfig = themes.find(t => t.id === 'default');

    // Extract particles config
    const activeParticles = activeThemeConfig?.particles || defaultThemeConfig?.particles || null;

    const appliedVars = useRef([]);

    const toggleMode = () => {
        setMode(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme-mode', next);
            return next;
        });
    };

    // Apply the default theme's colors overlaid with the active theme's, removing
    // variables left over from a previous theme or mode.
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', mode);

        const finalColors = {
            ...defaultThemeConfig?.colors?.[mode],
            ...activeThemeConfig?.colors?.[mode],
        };

        appliedVars.current
            .filter(key => !(key in finalColors))
            .forEach(key => root.style.removeProperty(key));
        Object.entries(finalColors).forEach(([key, value]) => root.style.setProperty(key, value));
        appliedVars.current = Object.keys(finalColors);
    }, [mode, activeThemeConfig, defaultThemeConfig]);

    // Custom CSS Injection
    useEffect(() => {
        const customCssId = 'glassboard-custom-css';
        if (!document.getElementById(customCssId)) {
            const link = document.createElement('link');
            link.id = customCssId;
            link.rel = 'stylesheet';
            link.href = '/custom.css';
            document.head.appendChild(link);
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ mode, toggleMode, themeId: activeThemeId, particles: activeParticles }}>
            {children}
        </ThemeContext.Provider>
    );
};
