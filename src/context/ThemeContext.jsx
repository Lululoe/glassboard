import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext({ mode: 'dark', toggleMode: () => {}, themeId: 'default', particles: null });

/**
 * Hook to access the current theme context, including mode (light/dark) and toggle functions.
 * @returns {Object} Theme context value containing mode, toggleMode, themeId, and particles config.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

const darkQuery = '(prefers-color-scheme: dark)';

/**
 * Subscribes to changes of the system appearance.
 * @param {() => void} onChange - Called when the system switches between light and dark.
 * @returns {() => void} Unsubscribe function.
 */
const subscribeToSystemMode = (onChange) => {
    const query = window.matchMedia(darkQuery);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
};

const getSystemMode = () => (window.matchMedia(darkQuery).matches ? 'dark' : 'light');

/**
 * Reads the saved appearance override, if any.
 * @returns {string|null} 'light', 'dark', or null to follow the system.
 */
const readSavedMode = () => {
    try {
        const saved = localStorage.getItem('theme-mode');
        return saved === 'light' || saved === 'dark' ? saved : null;
    } catch {
        return null;
    }
};

/**
 * Provider component that manages the application theme state, applying CSS variables to the document root.
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to wrap.
 * @param {Object} props.config - Global configuration containing theme definitions.
 * @returns {JSX.Element} The ThemeContext Provider.
 */
export const ThemeProvider = ({ children, config }) => {
    // Follow the system appearance, live, unless the person has overridden it with the toggle
    const systemMode = useSyncExternalStore(subscribeToSystemMode, getSystemMode);
    const [savedMode, setSavedMode] = useState(readSavedMode);
    const mode = savedMode || systemMode;

    // Determine active theme from config
    const activeThemeId = config?.theme || 'default';
    const themes = config?.themes || [];
    const activeThemeConfig = themes.find(t => t.id === activeThemeId);

    // Find default theme for fallback
    const defaultThemeConfig = themes.find(t => t.id === 'default');

    // Extract particles config
    const activeParticles = activeThemeConfig?.particles || defaultThemeConfig?.particles || null;

    const appliedVars = useRef([]);

    // Toggling back to the system appearance clears the override, so the app follows the
    // system again instead of staying pinned.
    const toggleMode = () => {
        const next = mode === 'dark' ? 'light' : 'dark';
        const override = next === systemMode ? null : next;
        try {
            if (override) localStorage.setItem('theme-mode', override);
            else localStorage.removeItem('theme-mode');
        } catch {
            // Storage unavailable: the override lasts for this session only
        }
        setSavedMode(override);
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
