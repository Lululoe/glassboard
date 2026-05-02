import React, { createContext, useContext, useState, useEffect } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext();

/**
 * Hook to access the current theme context, including mode (light/dark) and toggle functions.
 * @returns {Object} Theme context value containing mode, toggleMode, themeId, and particles config.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

// No hardcoded defaults anymore, we rely on 'default' theme from config

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

    // Toggle function
    const toggleMode = () => {
        setMode(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme-mode', next);
            return next;
        });
    };

    // Apply variables
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', mode);

        // 1. Get Base Defaults from 'default' theme in config
        const baseColors = defaultThemeConfig?.colors?.[mode] || {};

        // 2. Get Config Overrides
        const configColors = activeThemeConfig?.colors?.[mode] || {};

        // 3. Merge
        const finalColors = { ...baseColors, ...configColors };

        // 4. Apply to root
        Object.entries(finalColors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });

    }, [mode, activeThemeId, activeThemeConfig, defaultThemeConfig]);

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
