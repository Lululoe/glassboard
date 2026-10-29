import { useEffect, useRef, useState } from 'react';
import BaseCard from '../../components/Shared/BaseCard';
import Icon from '../../components/Shared/Icon';
import { useThermostat } from './useThermostat';
import './ThermostatCard.css';

const KEY_COMMIT_DELAY = 600;
const BADGE_ICONS = { heating: 'lu-Flame', cooling: 'lu-Snowflake', idle: 'lu-CirclePause', off: 'lu-Power' };

/**
 * Formats a temperature for the step size: whole degrees for steps of 1 or more.
 * @param {number|null} value - The temperature.
 * @param {number} step - The entity's target step.
 * @returns {string} The formatted value, or `–` when unknown.
 */
const formatTemp = (value, step) => {
    if (value === null || value === undefined) return '–';
    return step >= 1 ? String(Math.round(value)) : value.toFixed(1);
};

/**
 * Vertical slider for the target temperature. It previews while dragging and reports the
 * value once on release; arrow keys report after a short pause.
 * @param {Object} props
 * @param {Object} props.t - Thermostat state from useThermostat.
 * @param {number|null} props.preview - Value being dragged, if any.
 * @param {(value: number|null) => void} props.onPreview - Receives the value while dragging.
 * @returns {JSX.Element} The slider.
 */
const TempSlider = ({ t, preview, onPreview }) => {
    const ref = useRef(null);
    const keyTimer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    const range = t.max - t.min || 1;
    const value = preview ?? t.target ?? t.min;
    const fraction = (v) => Math.min(1, Math.max(0, (v - t.min) / range));
    const snap = (v) => Math.min(t.max, Math.max(t.min, Math.round(v / t.step) * t.step));

    useEffect(() => () => clearTimeout(keyTimer.current), []);

    const fromPointer = (e) => {
        const rect = ref.current.getBoundingClientRect();
        return snap(t.min + (1 - (e.clientY - rect.top) / rect.height) * range);
    };

    // The drag lives in a ref so quick pointer events never see a stale preview
    const drag = useRef(/** @type {{id: number, value: number}|null} */ (null));

    const onPointerDown = (e) => {
        if (!t.available || e.button !== 0) return;
        ref.current.setPointerCapture?.(e.pointerId);
        drag.current = { id: e.pointerId, value: fromPointer(e) };
        onPreview(drag.current.value);
    };
    const onPointerMove = (e) => {
        if (drag.current?.id !== e.pointerId) return;
        drag.current.value = fromPointer(e);
        onPreview(drag.current.value);
    };
    const onPointerUp = (e) => {
        if (drag.current?.id !== e.pointerId) return;
        t.setTarget(drag.current.value);
        drag.current = null;
        onPreview(null);
    };
    const onPointerCancel = () => {
        drag.current = null;
        onPreview(null);
    };

    const onKeyDown = (e) => {
        const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (!delta || !t.available) return;
        e.preventDefault();
        const next = snap(value + delta * t.step);
        onPreview(next);
        clearTimeout(keyTimer.current);
        keyTimer.current = setTimeout(() => {
            t.setTarget(next);
            onPreview(null);
        }, KEY_COMMIT_DELAY);
    };

    return (
        <div
            ref={ref}
            className={`thermo-slider ${t.on ? t.action : 'off'}${preview !== null ? ' dragging' : ''}`}
            role="slider"
            tabIndex={t.available ? 0 : -1}
            aria-label={`${t.name} target temperature`}
            aria-valuemin={t.min}
            aria-valuemax={t.max}
            aria-valuenow={value}
            aria-valuetext={t.on ? `${formatTemp(value, t.step)}°` : 'Off'}
            aria-disabled={!t.available || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onKeyDown={onKeyDown}
        >
            <div className="thermo-slider-fill" style={{ height: `${(t.on || preview !== null ? fraction(value) : 0) * 100}%` }}>
                <span className="thermo-slider-grip" />
            </div>
            {t.current !== null && (
                <span className="thermo-slider-now" style={{ bottom: `${fraction(t.current) * 100}%` }} />
            )}
        </div>
    );
};

/**
 * Heating state as a small badge: icon and word.
 * @param {Object} props
 * @param {Object} props.t - Thermostat state.
 * @returns {JSX.Element} The badge.
 */
const StateBadge = ({ t }) => (
    <span className={`thermo-badge ${t.action}`}>
        <Icon icon={BADGE_ICONS[t.action]} size={13} />
        {t.actionLabel}
    </span>
);

/**
 * Thermostat for one Home Assistant climate entity, in three sizes:
 * - quarter: a slider strip and the target; tapping the tile turns it on or off,
 * - half: slider, target and room temperature, and a row of preset chips,
 * - one wide or more: slider and a list of presets.
 * Presets come from the entity's preset modes unless `presets` is set in the card config.
 * @param {Object} props
 * @param {Object} props.config - Card configuration.
 * @returns {JSX.Element} The rendered card.
 */
const ThermostatCard = ({ config }) => {
    const t = useThermostat(config);
    const [preview, setPreview] = useState(null);
    const size = config.tileSize === 'quarter' || config.tileSize === 'half' ? config.tileSize : 'full';
    const shownTarget = preview ?? t.target;
    const targetText = t.on || preview !== null ? `${formatTemp(shownTarget, t.step)}°` : 'Off';
    const nowText = t.current !== null ? `${formatTemp(t.current, t.step)}°` : '–';

    if (!config.entity_id || (!t.available && !t.loading)) {
        return (
            <BaseCard className={`thermostat-card size-${size}`} hoverable={false}>
                <div className="thermo-message">
                    <Icon icon="lu-Thermometer" size={22} />
                    <span>{!config.entity_id ? 'Set a climate entity_id for this thermostat.' : `${t.name} is unavailable`}</span>
                </div>
            </BaseCard>
        );
    }

    const offButton = (className) => (
        <button
            type="button"
            className={`button-reset ${className}`}
            aria-pressed={!t.on}
            onClick={() => t.setOn(false)}
        >
            <Icon icon="lu-Power" size={className === 'thermo-chip' ? 15 : 18} />
            <span>Off</span>
        </button>
    );

    return (
        <BaseCard className={`thermostat-card size-${size}`} hoverable={false}>
            <div className="thermo">
                <TempSlider t={t} preview={preview} onPreview={setPreview} />

                {size === 'quarter' ? (
                    <button
                        type="button"
                        className="button-reset thermo-toggle"
                        aria-pressed={t.on}
                        aria-label={`${t.name}, ${t.on ? `on, ${targetText}` : 'off'}. Turn ${t.on ? 'off' : 'on'}.`}
                        onClick={() => t.setOn(!t.on)}
                    >
                        <span className="thermo-name-row">
                            <span className="thermo-name">{t.name}</span>
                            <span className={`thermo-dot ${t.action}`} title={t.actionLabel} />
                        </span>
                        <span className="thermo-caption">{t.actionLabel} · {nowText}</span>
                        <span className="thermo-target">{targetText}</span>
                    </button>
                ) : (
                    <div className="thermo-side">
                        <div className="thermo-head">
                            <span className="thermo-name">{t.name}</span>
                            <StateBadge t={t} />
                        </div>
                        <div className="thermo-temps">
                            <span className="thermo-target">{targetText}</span>
                            <span className="thermo-caption">Now {nowText}</span>
                        </div>
                        {size === 'half' ? (
                            <div className="thermo-chips">
                                {/* Presets scroll when they do not fit; Off always stays visible */}
                                <div className="thermo-chips-scroll">
                                    {t.presets.map(p => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            className="button-reset thermo-chip"
                                            aria-pressed={t.activePreset === p.key}
                                            aria-label={p.temperature !== undefined ? `${p.name}, ${p.temperature}°` : p.name}
                                            onClick={() => t.applyPreset(p)}
                                        >
                                            <Icon icon={p.icon} size={15} />
                                            <span>{p.temperature !== undefined ? `${p.temperature}°` : p.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {offButton('thermo-chip')}
                            </div>
                        ) : (
                            <div className="thermo-presets">
                                {t.presets.map(p => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        className="button-reset thermo-preset"
                                        aria-pressed={t.activePreset === p.key}
                                        onClick={() => t.applyPreset(p)}
                                    >
                                        <Icon icon={p.icon} size={18} />
                                        <span>{p.name}</span>
                                        {p.temperature !== undefined && <span className="thermo-preset-temp">{p.temperature}°</span>}
                                    </button>
                                ))}
                                {offButton('thermo-preset')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </BaseCard>
    );
};

export default ThermostatCard;
