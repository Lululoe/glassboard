import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { SegmentedField, ToggleField } from '../Editor/EditorFields';
import { ACCENT_PRESETS, APPEARANCE_STYLES, STYLE_NAMES } from '../../../shared/appearance.js';
import '../Editor/EditorFields.css';
import './ThemeMenu.css';

/** One line about each style, shown under its name. */
const STYLE_HINTS = {
    glass: 'Frosted tiles',
    liquid: 'Clear glass, round',
    material: 'Solid, Material 3',
    terminal: 'Monospace, square',
};

const MODE_OPTIONS = [
    { value: 'system', label: 'Automatic' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];

/**
 * Popover of the header's Theme button: light or dark, liquid glass refraction and terminal
 * screen effects for this browser, and the dashboard's style and accent color for everyone using it.
 * @param {Object} props
 * @param {boolean} props.editable - Whether the dashboard's style can be changed here.
 * @param {() => void} props.onClose - Closes the menu.
 * @returns {JSX.Element} The menu.
 */
const ThemeMenu = ({ editable, onClose }) => {
    const dialogRef = useRef(null);
    const { modeSetting, setMode, style, accent, setAppearance, refraction, screenEffects } = useTheme();
    const custom = accent && !ACCENT_PRESETS.some(p => p.color === accent);
    const [error, setError] = useState(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        dialog.showModal?.();
        dialog.focus();
    }, []);

    /**
     * Saves a change to the dashboard's appearance, showing why when it can't be saved.
     * @param {{style?: string, accent?: string|null}} change - The change.
     */
    const save = (change) => {
        clearTimeout(pickTimer.current);
        setError(null);
        setAppearance(change).catch(err => setError(err.message));
    };

    // The color picker reports every color passed while dragging; only the one it stops at is saved
    const pickTimer = useRef(0);
    const pickColor = (color) => {
        clearTimeout(pickTimer.current);
        pickTimer.current = setTimeout(() => save({ accent: color }), 400);
    };
    useEffect(() => () => clearTimeout(pickTimer.current), []);

    // A click on the backdrop, outside the menu, closes it. Clicks on the menu's own controls
    // target those controls, so only clicks on the dialog element itself are checked.
    const onClick = (e) => {
        const rect = dialogRef.current?.getBoundingClientRect();
        if (!rect || e.target !== dialogRef.current) return;
        const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!inside) onClose();
    };

    return (
        <dialog className="theme-menu" ref={dialogRef} onClick={onClick} onClose={onClose} aria-label="Theme" tabIndex={-1}>
            <SegmentedField label="Appearance" value={modeSetting} options={MODE_OPTIONS} onChange={setMode} />

            <fieldset className="theme-menu-styles" disabled={!editable}>
                <legend className="editor-label">Style</legend>
                <div className="theme-menu-style-grid">
                    {APPEARANCE_STYLES.map(id => (
                        <label key={id} className={`theme-menu-style${style === id ? ' is-selected' : ''}`}>
                            <input
                                type="radio"
                                name="glassboard-style"
                                value={id}
                                checked={style === id}
                                onChange={() => save({ style: id })}
                            />
                            <span className={`theme-menu-preview preview-${id}`} aria-hidden="true">
                                <span className="preview-tile" />
                                <span className="preview-tile" />
                            </span>
                            <span className="theme-menu-style-name">{STYLE_NAMES[id]}</span>
                            <span className="theme-menu-style-hint">{STYLE_HINTS[id]}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <fieldset className="theme-menu-accents" disabled={!editable}>
                <legend className="editor-label">Accent</legend>
                <div className="theme-menu-swatches">
                    <label className="theme-menu-swatch is-theme" title="Theme color">
                        <input type="radio" name="glassboard-accent" checked={!accent} onChange={() => save({ accent: null })} aria-label="Theme color" />
                    </label>
                    {ACCENT_PRESETS.map(preset => (
                        <label key={preset.color} className="theme-menu-swatch" style={{ '--swatch': preset.color }} title={preset.name}>
                            <input
                                type="radio"
                                name="glassboard-accent"
                                checked={accent === preset.color}
                                onChange={() => save({ accent: preset.color })}
                                aria-label={preset.name}
                            />
                        </label>
                    ))}
                    <label className={`theme-menu-swatch is-custom${custom ? ' is-checked' : ''}`} style={custom ? { '--swatch': accent } : undefined} title="Other color">
                        <input
                            type="color"
                            value={accent || '#0a84ff'}
                            onChange={(e) => pickColor(e.target.value)}
                            aria-label="Other color"
                        />
                    </label>
                </div>
                <div className="editor-hint">{editable ? 'Style and accent are for everyone using this dashboard.' : 'Set in config.yaml.'}</div>
            </fieldset>

            {style === 'liquid' && (
                refraction.supported ? (
                    <ToggleField
                        label="Refraction"
                        checked={refraction.enabled}
                        onChange={refraction.setEnabled}
                        hint="Glass edges bend what is behind them. Only on this device; turn off to save power."
                    />
                ) : (
                    <div className="editor-field">
                        <div className="editor-label">Refraction</div>
                        <div className="editor-hint">Not available in this browser. Chrome, Edge and Android show it.</div>
                    </div>
                )
            )}

            {style === 'terminal' && (
                <ToggleField
                    label="Screen effects"
                    checked={screenEffects.enabled}
                    onChange={screenEffects.setEnabled}
                    hint="Scanlines and a phosphor glow, like an old monitor. Only on this device."
                />
            )}

            {error && <div className="theme-menu-error" role="alert">{error}</div>}
        </dialog>
    );
};

export default ThemeMenu;
