import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ACCENT_PRESETS, MENU_STYLES, STYLE_NAMES, TRANSPARENT_STYLES } from '../../../shared/appearance.js';
import TwoToneBase from '../Shared/TwoToneBase';
import UsageBar from '../Shared/UsageBar';
import StatusPill from '../Shared/StatusPill';
import Icon from '../Shared/Icon';
import { useSectionCommit } from './settingsSection';
import '../Header/ThemeMenu.css';
import '../../features/HomeAssistant/HAControlCard.css';
import './AppearanceSettings.css';

/** One line about each style, shown under its name. */
const STYLE_HINTS = {
    glass: 'Frosted tiles',
    liquid: 'Clear glass, round',
    material: 'Solid, Material 3',
    neon: 'Dark, glowing color',
    terminal: 'Monospace, square',
};

/**
 * Two Home Assistant tiles, one on and one off, drawn like the real ones.
 * @returns {JSX.Element} The tiles.
 */
const PreviewTiles = () => (
    <div className="ha-control-card appearance-preview-tiles">
        <div className="ha-tile on">
            <div className="ha-icon-circle on"><Icon icon="lu-Lightbulb" size={20} /></div>
            <div className="ha-tile-content">
                <div className="ha-tile-name">Ceiling Light</div>
                <div className="ha-tile-state">On · 80%</div>
            </div>
        </div>
        <div className="ha-tile off">
            <div className="ha-icon-circle off"><Icon icon="lu-Fan" size={20} /></div>
            <div className="ha-tile-content">
                <div className="ha-tile-name">Fan</div>
                <div className="ha-tile-state">Off</div>
            </div>
        </div>
    </div>
);

/**
 * Appearance section of the settings window: the dashboard's style, accent color and (for Glass and
 * Liquid Glass) transparency, for everyone using it. Changes show on the page and in a preview of
 * a few cards right away, and are saved by the window's Save; closing without saving shows the saved
 * appearance again. Light or dark and the effects of this device stay in the Theme menu.
 * @returns {JSX.Element} The section.
 */
const AppearanceSettings = () => {
    const { style, accent, transparency, locked, setAppearance, previewAppearance } = useTheme();
    const [saved] = useState(() => ({ style, accent, transparency }));
    const [draft, setDraft] = useState(saved);
    const transparencyId = useId();
    const custom = draft.accent && !ACCENT_PRESETS.some(p => p.color === draft.accent);
    const committed = useRef(false);

    // Back to the saved appearance when the window closes without saving
    useEffect(() => () => {
        if (!committed.current) previewAppearance(null);
    }, [previewAppearance]);

    /**
     * Changes the draft and shows it on the page.
     * @param {{style?: string, accent?: string|null, transparency?: number}} change - The change.
     */
    const update = (change) => {
        const next = { ...draft, ...change };
        setDraft(next);
        previewAppearance(next);
    };

    useSectionCommit(async () => {
        const change = Object.fromEntries(Object.entries(draft).filter(([key, value]) => saved[key] !== value));
        if (Object.keys(change).length === 0) return;
        await setAppearance(change);
        committed.current = true;
    });

    const styles = MENU_STYLES.includes(draft.style) ? MENU_STYLES : [...MENU_STYLES, draft.style];

    return (
        <div className="settings-columns appearance-settings">
            <aside className="card-editor-preview appearance-preview" aria-label="Preview">
                <p className="card-editor-preview-label">Preview</p>
                <div className="appearance-preview-page">
                    <div className="appearance-preview-bar" aria-hidden="true">
                        <span className="appearance-preview-dot" />
                        Glassboard
                    </div>
                    <PreviewTiles />
                    <TwoToneBase title="Server" subtitle="4 containers" icon="lu-Server">
                        <div className="appearance-preview-usage">
                            <span>CPU</span>
                            <UsageBar percent={34} label="CPU" />
                            <span>Memory</span>
                            <UsageBar percent={72} label="Memory" />
                        </div>
                        <div className="appearance-preview-pills">
                            <StatusPill tone="green">Running</StatusPill>
                            <StatusPill tone="blue">Updated</StatusPill>
                        </div>
                    </TwoToneBase>
                </div>
                <p className="appearance-preview-note">The whole dashboard shows the change too, until you cancel.</p>
            </aside>

            <div className="settings-columns-main">
                <div className="settings-form">
                    {locked && <p className="editor-note">The theme is locked in config.yaml.</p>}

                    <fieldset className="theme-menu-styles appearance-styles" disabled={locked}>
                        <legend className="editor-label">Style</legend>
                        <div className="theme-menu-style-grid">
                            {styles.map(id => (
                                <label key={id} className={`theme-menu-style${draft.style === id ? ' is-selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="glassboard-settings-style"
                                        value={id}
                                        checked={draft.style === id}
                                        onChange={() => update({ style: id })}
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

                    {TRANSPARENT_STYLES.includes(draft.style) && (
                        <div className="editor-field theme-menu-transparency">
                            <label className="editor-label" htmlFor={transparencyId}>Transparency</label>
                            <input
                                id={transparencyId}
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={draft.transparency}
                                disabled={locked}
                                aria-valuetext={`${Math.round(draft.transparency * 100)}%`}
                                onChange={(e) => update({ transparency: Number(e.target.value) })}
                            />
                            <div className="theme-menu-transparency-ends" aria-hidden="true">
                                <span>Solid</span>
                                <span>Clear</span>
                            </div>
                        </div>
                    )}

                    <fieldset className="theme-menu-accents" disabled={locked}>
                        <legend className="editor-label">Accent</legend>
                        <div className="theme-menu-swatches">
                            <label className="theme-menu-swatch is-theme" title="Theme color">
                                <input type="radio" name="glassboard-settings-accent" checked={!draft.accent} onChange={() => update({ accent: null })} aria-label="Theme color" />
                            </label>
                            {ACCENT_PRESETS.map(preset => (
                                <label key={preset.color} className="theme-menu-swatch" style={/** @type {import('react').CSSProperties} */ ({ '--swatch': preset.color })} title={preset.name}>
                                    <input
                                        type="radio"
                                        name="glassboard-settings-accent"
                                        checked={draft.accent === preset.color}
                                        onChange={() => update({ accent: preset.color })}
                                        aria-label={preset.name}
                                    />
                                </label>
                            ))}
                            <label className={`theme-menu-swatch is-custom${custom ? ' is-checked' : ''}`} style={custom ? /** @type {import('react').CSSProperties} */ ({ '--swatch': draft.accent }) : undefined} title="Other color">
                                <input
                                    type="color"
                                    value={draft.accent || '#0a84ff'}
                                    onChange={(e) => update({ accent: e.target.value })}
                                    aria-label="Other color"
                                />
                            </label>
                        </div>
                        <div className="editor-hint">
                            Style, accent{TRANSPARENT_STYLES.includes(draft.style) ? ' and transparency' : ''} are for everyone using this dashboard.
                            Light or dark, and the effects of this device, are in the Theme menu outside edit mode.
                        </div>
                    </fieldset>
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;
