import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SURFACE_TOKENS, accentVariables, fadeSurface, normalizeAppearance, transparencyVariables } from '../../shared/appearance.js';
import { refractionSupported } from '../styles/refraction.js';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext(/** @type {any} */ ({
    mode: 'dark',
    modeSetting: 'system',
    setMode: () => {},
    toggleMode: () => {},
    themeId: 'default',
    particles: null,
    style: 'glass',
    accent: null,
    transparency: 0.5,
    locked: false,
    setAppearance: async () => {},
    refraction: { supported: false, enabled: false, active: false, setEnabled: () => {} },
    screenEffects: { enabled: true, active: false, setEnabled: () => {} },
}));

/**
 * Hook to access the current theme: light or dark, the dashboard's style and accent, and
 * liquid glass refraction, with functions to change them.
 * @returns {Object} Theme context value.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

const darkQuery = '(prefers-color-scheme: dark)';
const reducedTransparencyQuery = '(prefers-reduced-transparency: reduce)';

/**
 * Subscribes to changes of a media query.
 * @param {string} media - The query.
 * @returns {(onChange: () => void) => () => void} Subscribe function for useSyncExternalStore.
 */
const subscribeTo = (media) => (onChange) => {
    const query = window.matchMedia?.(media);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
};
const subscribeToSystemMode = subscribeTo(darkQuery);
const subscribeToTransparency = subscribeTo(reducedTransparencyQuery);
const getSystemMode = () => (window.matchMedia?.(darkQuery).matches ? 'dark' : 'light');
const getReducedTransparency = () => !!window.matchMedia?.(reducedTransparencyQuery).matches;

/**
 * Reads a setting this browser keeps.
 * @param {string} key - Storage key.
 * @returns {string|null} The value, or null when there is none or storage is unavailable.
 */
const readStored = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

/**
 * Keeps a setting in this browser, or removes it.
 * @param {string} key - Storage key.
 * @param {string|null} value - The value, or null to remove it.
 */
const writeStored = (key, value) => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Storage unavailable: the setting lasts for this visit only
    }
};

/** Storage key of the appearance override; absent means follow the system. */
const MODE_KEY = 'theme-mode';
/** Storage key of the refraction setting; `off` turns it off, anything else leaves it on where supported. */
export const REFRACTION_KEY = 'glassboard-refraction';
/** Storage key of the Terminal style's screen effects; `off` turns them off, anything else leaves them on. */
export const SCREEN_EFFECTS_KEY = 'glassboard-screen-effects';

/**
 * Provider component that manages the application theme, applying CSS variables and the
 * `data-theme` (light or dark) and `data-style` attributes to the document root.
 *
 * Light or dark, refraction and screen effects are kept per browser. The style and accent belong to the
 * dashboard: they come from the config, and changing them saves them for every browser.
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to wrap.
 * @param {Object} props.config - Global configuration containing theme definitions and `appearance`.
 * @returns {JSX.Element} The ThemeContext Provider.
 */
export const ThemeProvider = ({ children, config }) => {
    // Follow the system appearance, live, unless the person has overridden it
    const systemMode = useSyncExternalStore(subscribeToSystemMode, getSystemMode);
    const [savedMode, setSavedMode] = useState(() => {
        const saved = readStored(MODE_KEY);
        return saved === 'light' || saved === 'dark' ? saved : null;
    });
    const mode = savedMode || systemMode;

    // Determine active theme from config
    const activeThemeId = config?.theme || 'default';
    const themes = config?.themes || [];
    const activeThemeConfig = themes.find(t => t.id === activeThemeId);
    const defaultThemeConfig = themes.find(t => t.id === 'default');
    const activeParticles = activeThemeConfig?.particles || defaultThemeConfig?.particles || null;

    // The dashboard's appearance, with a change that is still being saved shown right away
    const saved = normalizeAppearance(config?.appearance);
    const [pending, setPending] = useState(null);
    const [pendingFor, setPendingFor] = useState(config?.appearance);
    if (pendingFor !== config?.appearance) {
        // The config was reloaded, so it has the saved appearance now
        setPendingFor(config?.appearance);
        setPending(null);
    }
    const { style, accent, transparency } = normalizeAppearance({ ...saved, ...pending });

    // Refraction: on where the browser can draw it, unless turned off in this browser or the
    // person asked for less transparency
    const reducedTransparency = useSyncExternalStore(subscribeToTransparency, getReducedTransparency);
    const [refractionOn, setRefractionOn] = useState(() => readStored(REFRACTION_KEY) !== 'off');
    const supported = refractionSupported();
    const refractionActive = style === 'liquid' && supported && refractionOn && !reducedTransparency;

    // The Terminal style's scanlines and glow, on unless turned off in this browser
    const [effectsOn, setEffectsOn] = useState(() => readStored(SCREEN_EFFECTS_KEY) !== 'off');
    const effectsActive = style === 'terminal' && effectsOn;

    const appliedVars = useRef([]);

    /**
     * Chooses light, dark, or following the system, for this browser.
     * @param {'light'|'dark'|'system'} next - The appearance.
     */
    const setMode = (next) => {
        const override = next === 'light' || next === 'dark' ? next : null;
        writeStored(MODE_KEY, override);
        setSavedMode(override);
    };

    // Toggling back to the system appearance clears the override, so the app follows the
    // system again instead of staying pinned.
    const toggleMode = () => {
        const next = mode === 'dark' ? 'light' : 'dark';
        setMode(next === systemMode ? 'system' : next);
    };

    /**
     * Changes the dashboard's style, accent or transparency and saves it for every browser.
     * @param {{style?: string|null, accent?: string|null, transparency?: number|null}} change - What to change; null goes back to config.yaml.
     * @returns {Promise<void>} Resolves once saved; rejects, showing the saved appearance again, when saving fails.
     */
    const setAppearance = async (change) => {
        setPending(prev => ({ ...prev, ...change }));
        try {
            const res = await fetch('/api/config/appearance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(change),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Saving failed (${res.status})`);
            }
        } catch (err) {
            setPending(null);
            throw err;
        }
    };

    /**
     * Turns liquid glass refraction on or off in this browser.
     * @param {boolean} enabled - Whether to refract.
     */
    const setRefractionEnabled = (enabled) => {
        writeStored(REFRACTION_KEY, enabled ? null : 'off');
        setRefractionOn(enabled);
    };

    /**
     * Turns the Terminal style's screen effects on or off in this browser.
     * @param {boolean} enabled - Whether to show them.
     */
    const setEffectsEnabled = (enabled) => {
        writeStored(SCREEN_EFFECTS_KEY, enabled ? null : 'off');
        setEffectsOn(enabled);
    };

    // Apply the default theme's colors overlaid with the active theme's and the accent,
    // removing variables left over from a previous theme or mode.
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', mode);

        const finalColors = {
            ...defaultThemeConfig?.colors?.[mode],
            ...activeThemeConfig?.colors?.[mode],
            ...accentVariables(accent),
        };
        // The theme's card surfaces follow the transparency of Glass and Liquid Glass
        SURFACE_TOKENS.forEach(key => { if (key in finalColors) finalColors[key] = fadeSurface(finalColors[key]); });

        appliedVars.current
            .filter(key => !(key in finalColors))
            .forEach(key => root.style.removeProperty(key));
        Object.entries(finalColors).forEach(([key, value]) => root.style.setProperty(key, value));
        appliedVars.current = Object.keys(finalColors);
    }, [mode, activeThemeConfig, defaultThemeConfig, accent]);

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-style', style);
        if (refractionActive) root.setAttribute('data-refraction', 'on');
        else root.removeAttribute('data-refraction');
        if (effectsActive) root.setAttribute('data-effects', 'crt');
        else root.removeAttribute('data-effects');
    }, [style, refractionActive, effectsActive]);

    // How see-through the cards of Glass and Liquid Glass are
    useEffect(() => {
        const root = document.documentElement;
        const vars = transparencyVariables(style, transparency);
        ['--surface-solid', '--surface-clear'].forEach(key => {
            if (key in vars) root.style.setProperty(key, vars[key]);
            else root.style.removeProperty(key);
        });
    }, [style, transparency]);

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
        <ThemeContext.Provider value={{
            mode,
            modeSetting: savedMode || 'system',
            setMode,
            toggleMode,
            themeId: activeThemeId,
            particles: activeParticles,
            style,
            accent,
            transparency,
            // config.yaml keeps the style, accent and transparency; the Theme menu can't change them
            locked: config?.appearance?.locked === true,
            setAppearance,
            refraction: { supported, enabled: refractionOn, active: refractionActive, setEnabled: setRefractionEnabled },
            screenEffects: { enabled: effectsOn, active: effectsActive, setEnabled: setEffectsEnabled },
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
