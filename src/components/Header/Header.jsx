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
                <div className="icon-button" onClick={toggleMode} style={{ display: 'none' }}>
                    {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </div>
                <div className="icon-button" onClick={() => setIsLauncherOpen(!isLauncherOpen)}>
                    <LayoutGrid size={20} />
                </div>
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
