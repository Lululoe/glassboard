import React, { useState } from 'react';
import './Header.css';
import { LayoutTemplate, Sun, Moon, LayoutGrid } from 'lucide-react';
import LauncherPopup from './LauncherPopup';
import { useTheme } from '../../context/ThemeContext';

/**
 * Application header component displaying the logo, theme toggle, and launcher grid toggle.
 * @param {Object} props
 * @param {Object} props.config - The global application configuration object.
 * @returns {JSX.Element} The rendered header.
 */
const Header = ({ config }) => {
    const [isLauncherOpen, setIsLauncherOpen] = useState(false);
    const { mode, toggleMode } = useTheme();

    return (
        <header className="app-header">
            <div className="header-left">
                <LayoutTemplate className="header-logo-icon" size={24} />
                <span className="header-title">Glassboard</span>
            </div>

            <div className="header-right">
                {config?.themeToggle && (
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
