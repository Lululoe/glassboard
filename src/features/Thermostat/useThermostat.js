import { useCallback, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const CONFIRM_DELAY = 500;

/** Rooms the multiroom card shows; keep in sync with MAX_ROOMS in server/services/homeassistant.js. */
export const MAX_ROOMS = 6;

/** Icons for the heating state badge, by look. */
export const BADGE_ICONS = { heating: 'lu-Flame', cooling: 'lu-Snowflake', idle: 'lu-CirclePause', off: 'lu-Power' };

/**
 * Formats a temperature for the step size: whole degrees for steps of 1 or more.
 * @param {number|null} value - The temperature.
 * @param {number} step - The entity's target step.
 * @returns {string} The formatted value, or `–` when unknown.
 */
export const formatTemp = (value, step) => {
    if (value === null || value === undefined) return '–';
    return step >= 1 ? String(Math.round(value)) : value.toFixed(1);
};

/** Icons for common Home Assistant preset modes (Lucide names). */
const PRESET_ICONS = {
    comfort: 'Sun',
    home: 'House',
    eco: 'Leaf',
    sleep: 'Moon',
    night: 'Moon',
    away: 'Plane',
    vacation: 'Plane',
    boost: 'Flame',
    activity: 'Activity',
};

/** hvac_action values, grouped into how the card shows them. */
const ACTIONS = {
    heating: { look: 'heating', label: 'Heating' },
    preheating: { look: 'heating', label: 'Preheating' },
    cooling: { look: 'cooling', label: 'Cooling' },
    drying: { look: 'idle', label: 'Drying' },
    fan: { look: 'idle', label: 'Fan' },
    idle: { look: 'idle', label: 'Idle' },
    off: { look: 'off', label: 'Off' },
};

/**
 * Turns a preset mode such as `comfort` or `away_long` into a label.
 * @param {string} mode - The preset mode.
 * @returns {string} The label, e.g. `Away long`.
 */
const presetLabel = (mode) => {
    const text = String(mode).replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Normalizes an icon name from the config to the `lu-` form the Icon component expects.
 * @param {string|undefined} icon - Icon name, e.g. `sun`, `Sun` or `lu-Sun`.
 * @param {string} fallback - Lucide name used when no icon is set.
 * @returns {string} The icon id.
 */
export const presetIcon = (icon, fallback = 'Thermometer') => {
    if (!icon) return `lu-${fallback}`;
    if (/^(lu|sh|local)-|^https?:\/\//.test(icon)) return icon;
    return `lu-${icon.charAt(0).toUpperCase()}${icon.slice(1)}`;
};

/**
 * Returns the presets to show: the card's `presets` if configured, otherwise the entity's
 * Home Assistant preset modes (without `none`).
 * @param {Object} config - The card config.
 * @param {Object} attributes - The climate entity's attributes.
 * @returns {Array<{key: string, name: string, icon: string, temperature?: number, preset?: string}>} The presets.
 */
export function resolvePresets(config, attributes) {
    if (Array.isArray(config.presets)) {
        return config.presets
            .filter(p => p && (Number.isFinite(Number(p.temperature)) || p.preset))
            .map((p, i) => ({
                key: `cfg-${i}`,
                name: p.name || (p.preset ? presetLabel(p.preset) : `${p.temperature}°`),
                icon: presetIcon(p.icon, PRESET_ICONS[String(p.preset || p.name || '').toLowerCase()]),
                ...(p.preset ? { preset: p.preset } : { temperature: Number(p.temperature) }),
            }));
    }
    return (attributes.preset_modes || [])
        .filter(mode => mode && mode !== 'none')
        .map(mode => ({ key: `ha-${mode}`, name: presetLabel(mode), icon: presetIcon(undefined, PRESET_ICONS[mode]), preset: mode }));
}

/**
 * Controls one Home Assistant climate entity whose state is loaded elsewhere. Changes show
 * right away (optimistically) and are replaced by the next state from the server; a failed
 * action drops the optimistic value again.
 * @param {Object} config - Settings for this entity (`entity_id`, `name`, `presets`, `min`, `max`, `hvac_mode`).
 * @param {Object|undefined|null} raw - The entity's current Home Assistant state.
 * @param {number} updatedAt - When `raw` was loaded (ms), to tell which optimistic values are newer.
 * @param {() => void} refresh - Reloads the state after an action.
 * @returns {Object} The thermostat state and actions.
 */
export function useClimateControl(config, raw, updatedAt, refresh) {
    const id = config.entity_id;
    const [pending, setPending] = useState(/** @type {{on?: boolean, target?: number, preset?: string|null, at: number}|null} */ (null));

    const attributes = raw?.attributes || {};
    const available = Boolean(raw) && raw.state !== 'unavailable' && raw.state !== 'unknown';
    const fresh = pending && pending.at > updatedAt ? pending : null;

    const on = fresh?.on ?? (available && raw.state !== 'off');
    const current = Number.isFinite(attributes.current_temperature) ? attributes.current_temperature : null;
    const target = fresh?.target ?? (Number.isFinite(attributes.temperature) ? attributes.temperature : null);
    const presetMode = fresh && 'preset' in fresh ? fresh.preset : attributes.preset_mode;
    const step = attributes.target_temp_step > 0 ? attributes.target_temp_step : 0.5;
    const min = Number.isFinite(config.min) ? config.min : Number.isFinite(attributes.min_temp) ? attributes.min_temp : 7;
    const max = Number.isFinite(config.max) ? config.max : Number.isFinite(attributes.max_temp) ? attributes.max_temp : 30;

    // While a change is pending, judge the action from the temperatures instead of the old state
    let actionKey = attributes.hvac_action;
    if (!on) actionKey = 'off';
    else if (fresh || !ACTIONS[actionKey]) {
        actionKey = current !== null && target !== null && current < target - 0.2 ? 'heating' : 'idle';
    }
    const action = ACTIONS[actionKey] || ACTIONS.idle;

    const presets = resolvePresets(config, attributes);
    // A temperature preset is active when the target matches, unless Home Assistant is in one
    // of the shown preset modes (then that preset is the active one)
    const shownModes = new Set(presets.filter(p => p.preset).map(p => p.preset));
    const activePreset = !on ? null : presets.find(p => (p.preset
        ? p.preset === presetMode
        : p.temperature === target && !shownModes.has(presetMode)))?.key ?? null;

    const send = useCallback(
        (action, extra) => callService('homeassistant', { endpoint: 'climate', entity_id: id, action, ...extra }),
        [id],
    );

    /**
     * Runs actions with an optimistic state, reverting it if one fails.
     * @param {Object} optimistic - The state to show until the server confirms.
     * @param {Array<[string, Object]>} calls - Climate actions to send in order.
     */
    const run = useCallback(async (optimistic, calls) => {
        setPending({ ...optimistic, at: Date.now() });
        try {
            for (const [action, extra] of calls) await send(action, extra);
            setTimeout(refresh, CONFIRM_DELAY);
        } catch (err) {
            console.error(`Thermostat ${id}:`, err);
            setPending(null);
        }
    }, [send, refresh, id]);

    const onMode = config.hvac_mode || 'heat';
    const turnOnFirst = on ? [] : [['set_hvac_mode', { hvac_mode: onMode }]];

    const setTarget = (temperature) => run(
        { on: true, target: temperature, preset: null },
        [...turnOnFirst, ['set_temperature', { temperature }]],
    );

    const applyPreset = (preset) => (preset.preset
        ? run({ on: true, preset: preset.preset }, [...turnOnFirst, ['set_preset_mode', { preset_mode: preset.preset }]])
        : setTarget(preset.temperature));

    const setOn = (value) => run({ on: value }, [['set_hvac_mode', { hvac_mode: value ? onMode : 'off' }]]);

    /**
     * Changes the target by a number of steps from the shown value, turning the thermostat
     * back on (at its last target) if it is off.
     * @param {number} delta - Steps, e.g. 1 or -1.
     */
    const stepTarget = (delta) => {
        if (!on) {
            setOn(true);
            return;
        }
        const base = target ?? current ?? min;
        setTarget(Math.min(max, Math.max(min, Math.round((base + delta * step) / step) * step)));
    };

    return {
        name: config.name || attributes.friendly_name || id,
        available,
        on,
        current,
        target,
        min,
        max,
        step,
        action: action.look,
        actionLabel: action.label,
        presets,
        activePreset,
        setTarget,
        stepTarget,
        applyPreset,
        setOn,
    };
}

/**
 * Reads a Home Assistant climate entity for the single thermostat card and controls it.
 * @param {Object} config - The card config (`entity_id`, `name`, `presets`, `min`, `max`, `hvac_mode`).
 * @param {number} [interval=5000] - Polling interval in ms.
 * @returns {Object} The thermostat state and actions, plus `loading` and `error`.
 */
export function useThermostat(config, interval = 5000) {
    const id = config.entity_id;
    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: [id] }),
        { interval, enabled: Boolean(id), key: id || '' },
    );
    return { ...useClimateControl(config, data?.[id], updatedAt, refresh), loading, error };
}
