import { useEffect, useRef } from 'react';
import Icon from '../../components/Shared/Icon';
import { BADGE_ICONS } from './useThermostat';

/**
 * Heating state as a small badge: icon and word.
 * @param {Object} props
 * @param {Object} props.t - Thermostat state from useClimateControl.
 * @returns {JSX.Element} The badge.
 */
export const StateBadge = ({ t }) => (
    <span className={`thermo-badge ${t.action}`}>
        <Icon icon={BADGE_ICONS[t.action]} size={13} />
        {t.actionLabel}
    </span>
);

/**
 * Menu of a thermostat's presets plus Off, shown over its room. The current choice is
 * checked and focused when the menu opens; Escape closes it.
 * @param {Object} props
 * @param {Object} props.t - Thermostat state from useClimateControl.
 * @param {() => void} props.onClose - Closes the menu.
 * @param {string} [props.title] - Heading, shown when the menu covers more than its own room.
 * @returns {JSX.Element} The menu.
 */
export const PresetMenu = ({ t, onClose, title }) => {
    const ref = useRef(null);

    useEffect(() => {
        const menu = ref.current;
        (menu?.querySelector('[aria-checked="true"]') || menu?.querySelector('button'))?.focus();
    }, []);

    const pick = (action) => {
        action();
        onClose();
    };

    return (
        <div
            ref={ref}
            className="thermo-menu"
            role="menu"
            aria-label={`${t.name} presets`}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            {title && <div className="thermo-menu-title">{title}</div>}
            {t.presets.map(p => (
                <button
                    key={p.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={t.activePreset === p.key}
                    className="button-reset thermo-menu-item"
                    onClick={() => pick(() => t.applyPreset(p))}
                >
                    <Icon icon={p.icon} size={16} />
                    <span>{p.name}</span>
                    {p.temperature !== undefined && <span className="thermo-menu-temp">{p.temperature}°</span>}
                </button>
            ))}
            <button
                type="button"
                role="menuitemradio"
                aria-checked={!t.on}
                className="button-reset thermo-menu-item"
                onClick={() => pick(() => t.setOn(false))}
            >
                <Icon icon="lu-Power" size={16} />
                <span>Off</span>
            </button>
        </div>
    );
};
