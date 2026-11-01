import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { MAX_ROOMS, formatTemp, useClimateControl } from './useThermostat';
import { PresetMenu, StateBadge } from './ThermostatParts';
import './ThermostatCard.css';
import './MultiThermostatCard.css';

const ICON_BACKGROUND = 'linear-gradient(180deg, #ffb340, #ff8a00)';

/**
 * One room of the multiroom card: a row (one wide) or a column (two and three wide).
 * @param {Object} props
 * @param {Object} props.config - The room's settings, with the card's shared settings merged in.
 * @param {Object|undefined} props.raw - The room's Home Assistant state.
 * @param {number} props.updatedAt - When the states were loaded.
 * @param {() => void} props.refresh - Reloads the states.
 * @param {'rows'|'columns'} props.layout - How the card lays out its rooms.
 * @param {boolean} props.compact - Single-line rows, for five or six rooms.
 * @param {boolean} props.open - Whether this room's preset menu is open.
 * @param {(open: boolean) => void} props.onOpenChange - Opens or closes the preset menu.
 * @returns {JSX.Element} The room.
 */
const Room = ({ config, raw, updatedAt, refresh, layout, compact, open, onOpenChange }) => {
    const t = useClimateControl(config, raw, updatedAt, refresh);
    const triggerRef = useRef(null);
    const targetText = t.on ? `${formatTemp(t.target, t.step)}°` : 'Off';
    const nowText = t.current !== null ? `${formatTemp(t.current, t.step)}°` : '–';
    const preset = t.presets.find(p => p.key === t.activePreset);
    const presetLabel = !t.on ? 'Off' : preset?.name || 'Manual';
    const presetIcon = !t.on ? 'lu-Power' : preset?.icon || 'lu-Thermometer';

    const close = () => {
        onOpenChange(false);
        triggerRef.current?.focus();
    };

    const steppers = (
        <>
            <button
                type="button"
                className="button-reset mt-step"
                aria-label={`Lower ${t.name}`}
                disabled={!t.available}
                onClick={() => t.stepTarget(-1)}
            >
                <Minus size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
            {layout === 'rows' && <span className="mt-value">{targetText}</span>}
            <button
                type="button"
                className="button-reset mt-step"
                aria-label={`Raise ${t.name}`}
                disabled={!t.available}
                onClick={() => t.stepTarget(1)}
            >
                <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
        </>
    );

    const menu = open && t.available && (
        <PresetMenu t={t} onClose={close} title={layout === 'rows' ? t.name : undefined} />
    );

    if (layout === 'rows') {
        return (
            <div className={`mt-row${compact ? ' compact' : ''}${t.available ? '' : ' unavailable'}`}>
                <button
                    ref={triggerRef}
                    type="button"
                    className="button-reset mt-row-meta"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={`${t.name}, ${t.available ? `${t.actionLabel}, now ${nowText}, ${presetLabel}` : 'unavailable'}. Choose a preset.`}
                    disabled={!t.available}
                    onClick={() => onOpenChange(!open)}
                >
                    <span className="mt-name-line">
                        <span className="mt-name">{t.name}</span>
                        {compact && <span className={`thermo-dot ${t.action}`} />}
                        {compact && <span className="mt-now">{nowText}</span>}
                    </span>
                    {!compact && (
                        <span className={`mt-state ${t.action}`}>
                            <span className={`thermo-dot ${t.action}`} />
                            {t.available ? `${t.actionLabel} · ${nowText} · ${presetLabel}` : 'Unavailable'}
                        </span>
                    )}
                </button>
                {steppers}
                {menu}
            </div>
        );
    }

    return (
        <div className={`mt-col${t.available ? '' : ' unavailable'}`}>
            <span className="mt-name">{t.name}</span>
            {t.available ? <StateBadge t={t} /> : <span className="thermo-badge off">Unavailable</span>}
            <span className="mt-target">{targetText}</span>
            <span className="thermo-caption">Now {nowText}</span>
            <button
                ref={triggerRef}
                type="button"
                className="button-reset mt-preset"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${t.name} preset: ${presetLabel}`}
                disabled={!t.available}
                onClick={() => onOpenChange(!open)}
            >
                <Icon icon={presetIcon} size={15} />
                <span className="mt-preset-label">{presetLabel}</span>
                <ChevronDown className="mt-preset-chevron" size={14} aria-hidden="true" />
            </button>
            <div className="mt-steps">{steppers}</div>
            {menu}
        </div>
    );
};

/**
 * Thermostats for up to six rooms. One wide shows a row per room with − target +, and the
 * room name opens its presets; two and three wide show a column per room with a preset
 * menu and ± keys. On phones the grid narrows the card to one wide, so it shows rows.
 * All rooms are loaded in one request.
 * @param {Object} props
 * @param {Object} props.config - Card configuration (`rooms`, and shared `presets`, `hvac_mode`, `min`, `max`).
 * @returns {JSX.Element} The rendered card.
 */
const MultiThermostatCard = ({ config }) => {
    const rooms = (Array.isArray(config.rooms) ? config.rooms : []).filter(r => r?.entity_id).slice(0, MAX_ROOMS);
    const ids = rooms.map(r => r.entity_id);
    const { data, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: ids }),
        { interval: 5000, enabled: ids.length > 0, key: ids.join(',') },
    );
    const [openRoom, setOpenRoom] = useState(/** @type {number|null} */ (null));

    const layout = (config.colSpan || 1) >= 2 ? 'columns' : 'rows';
    const shared = { presets: config.presets, hvac_mode: config.hvac_mode, min: config.min, max: config.max };

    // A tap outside the open menu closes it
    useEffect(() => {
        if (openRoom === null) return undefined;
        const onPointerDown = (e) => {
            if (!e.target.closest?.('.thermo-menu, [aria-haspopup="menu"]')) setOpenRoom(null);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [openRoom]);

    const states = ids.map(id => data?.[id]).filter(Boolean);
    const count = (action) => states.filter(s => s.state !== 'off' && s.attributes?.hvac_action === action).length;
    const heating = count('heating') + count('preheating');
    const cooling = count('cooling');
    const subtitle = [
        `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`,
        heating > 0 && `${heating} heating`,
        cooling > 0 && `${cooling} cooling`,
    ].filter(Boolean).join(' · ');

    return (
        <TwoToneBase
            title={config.title || 'Climate'}
            subtitle={subtitle}
            icon={config.icon || 'lu-Thermometer'}
            iconBackground={config.iconBackground || ICON_BACKGROUND}
            iconColor={config.iconColor}
            className={`multi-thermostat layout-${layout}`}
        >
            {rooms.length === 0 ? (
                <div className="thermo-message">
                    <Icon icon="lu-Thermometer" size={22} />
                    <span>Add up to {MAX_ROOMS} rooms with a climate entity_id.</span>
                </div>
            ) : (
                <div className="mt-rooms" style={/** @type {import('react').CSSProperties} */ ({ '--rooms': rooms.length })}>
                    {rooms.map((room, i) => (
                        <Room
                            key={room.entity_id}
                            config={{ ...shared, ...room }}
                            raw={data?.[room.entity_id]}
                            updatedAt={updatedAt}
                            refresh={refresh}
                            layout={layout}
                            compact={rooms.length > 4}
                            open={openRoom === i}
                            onOpenChange={(open) => setOpenRoom(open ? i : null)}
                        />
                    ))}
                </div>
            )}
        </TwoToneBase>
    );
};

export default MultiThermostatCard;
