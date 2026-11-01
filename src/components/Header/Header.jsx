import React, { useState } from 'react';
import './Header.css';
import { LayoutTemplate, Sun, Moon, LayoutGrid, Pencil, SquarePen, Plus } from 'lucide-react';
import LauncherPopup from './LauncherPopup';
import { useTheme } from '../../context/ThemeContext';

/**
 * Application header component displaying the logo, theme toggle, and launcher grid toggle.
 * While the layout is being edited it shows Reset and Done instead.
 * @param {Object} props
 * @param {Object} props.config - The global application configuration object.
 * @param {Object} [props.edit] - Edit mode state and actions.
 * @param {boolean} props.edit.available - Whether the current page can be edited.
 * @param {boolean} props.edit.active - Whether edit mode is on.
 * @param {boolean} [props.edit.saving] - Whether a save is in progress.
 * @param {string|null} [props.edit.status] - Message shown next to the edit controls.
 * @param {() => void} props.edit.onStart - Turns edit mode on.
 * @param {() => void} props.edit.onDone - Saves and leaves edit mode.
 * @param {() => void} props.edit.onReset - Resets the dashboard to config.yaml.
 * @param {() => void} props.edit.onAdd - Opens the list of cards to add.
 * @param {() => void} [props.edit.onEditMenu] - Opens the editor of the header menu.
 * @returns {JSX.Element} The rendered header.
 */
const Header = ({ config, edit }) => {
    const [isLauncherOpen, setIsLauncherOpen] = useState(false);
    const { mode, toggleMode } = useTheme();

    return (
        <header className="app-header">
            <div className="header-left">
                <LayoutTemplate className="header-logo-icon" size={24} />
                <span className="header-title">Glassboard</span>
                {config?.demo && (
                    <span className="header-demo-badge" title="Cards show simulated data">Demo</span>
                )}
            </div>

            {edit?.active ? (
                <div className="header-right">
                    {edit.status && <span className="header-edit-status" role="status">{edit.status}</span>}
                    <button
                        type="button"
                        className="button-reset icon-button"
                        onClick={edit.onAdd}
                        disabled={edit.saving}
                        title="Add card"
                        aria-label="Add card"
                    >
                        <Plus size={22} aria-hidden="true" />
                    </button>
                    {edit.onEditMenu && (
                        <button
                            type="button"
                            className="button-reset icon-button header-menu-edit"
                            onClick={edit.onEditMenu}
                            disabled={edit.saving}
                            title="Edit header menu"
                            aria-label="Edit header menu"
                        >
                            <LayoutGrid size={20} aria-hidden="true" />
                            <span className="header-menu-edit-badge"><Pencil size={10} strokeWidth={3} aria-hidden="true" /></span>
                        </button>
                    )}
                    <button type="button" className="button-reset header-text-button" onClick={edit.onReset} disabled={edit.saving}>
                        Reset
                    </button>
                    <button type="button" className="button-reset header-done-button" onClick={edit.onDone} disabled={edit.saving}>
                        Done
                    </button>
                </div>
            ) : (
            <div className="header-right">
                {edit?.available && (
                    <button
                        type="button"
                        className="button-reset icon-button"
                        onClick={edit.onStart}
                        title="Edit layout"
                        aria-label="Edit layout"
                    >
                        <SquarePen size={20} aria-hidden="true" />
                    </button>
                )}
                {config?.themeToggle !== false && (
                    <button
                        type="button"
                        className="button-reset icon-button"
                        onClick={toggleMode}
                        title={mode === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'}
                        aria-label={mode === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'}
                    >
                        {mode === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                    </button>
                )}
                <button
                    type="button"
                    className={`button-reset icon-button${isLauncherOpen ? ' active' : ''}`}
                    onClick={() => setIsLauncherOpen(!isLauncherOpen)}
                    title="Apps"
                    aria-label="Apps"
                    aria-haspopup="dialog"
                    aria-expanded={isLauncherOpen}
                >
                    <LayoutGrid size={20} aria-hidden="true" />
                </button>
            </div>
            )}

            {isLauncherOpen && (
                <LauncherPopup
                    config={config}
                    onClose={() => setIsLauncherOpen(false)}
                />
            )}
        </header>
    );
};

export default Header;
