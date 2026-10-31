import { useRef } from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Horizontal slider used for every value in the control dialogs: a caption with the value
 * above a gradient track with a white handle. Drag anywhere on the track, or use the arrow keys.
 * @param {Object} props
 * @param {string} props.label - Caption and accessible name.
 * @param {number} props.value - Current value.
 * @param {number} props.min - Value at the left end.
 * @param {number} props.max - Value at the right end.
 * @param {number} [props.step=1] - Rounding while dragging and the arrow key step.
 * @param {string} props.valueText - Value shown in the caption, e.g. `80%`.
 * @param {string} [props.background] - Track background (CSS), e.g. a gradient.
 * @param {string} [props.variant] - Track style with a fixed gradient: `hue` or `ct`.
 * @param {boolean} [props.dim=false] - Fades the slider, e.g. while the light is off.
 * @param {(value: number, final: boolean) => void} props.onChange - Called while dragging
 *   (`final` false) and with the last value on release or for a key press (`final` true).
 * @returns {JSX.Element} The slider.
 */
const HSlider = ({ label, value, min, max, step = 1, valueText, background, variant, dim = false, onChange }) => {
    const drag = useRef(/** @type {{rect: DOMRect, pointerId: number, value: number}|null} */ (null));
    const fraction = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;

    const valueAt = (clientX) => {
        const { rect } = drag.current;
        const f = clamp((clientX - rect.left) / rect.width, 0, 1);
        return clamp(Math.round((min + f * (max - min)) / step) * step, min, max);
    };

    const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Synthetic events have no active pointer to capture
        }
        drag.current = { rect: e.currentTarget.getBoundingClientRect(), pointerId: e.pointerId, value };
        drag.current.value = valueAt(e.clientX);
        onChange(drag.current.value, false);
    };

    const onPointerMove = (e) => {
        if (!drag.current || e.pointerId !== drag.current.pointerId) return;
        const next = valueAt(e.clientX);
        if (next === drag.current.value) return;
        drag.current.value = next;
        onChange(next, false);
    };

    const onPointerEnd = (e) => {
        if (!drag.current || e.pointerId !== drag.current.pointerId) return;
        const last = drag.current.value;
        drag.current = null;
        onChange(last, true);
    };

    const onKeyDown = (e) => {
        const keys = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, Home: min - value, End: max - value };
        if (!(e.key in keys)) return;
        e.preventDefault();
        const next = clamp(value + keys[e.key], min, max);
        if (next !== value) onChange(next, true);
    };

    return (
        <div className={`ctl-slider${dim ? ' dim' : ''}`}>
            <div className="ctl-slider-cap" aria-hidden="true">
                <span>{label}</span>
                <span className="ctl-slider-value">{valueText}</span>
            </div>
            <div
                className={`ctl-track${variant ? ` ${variant}` : ''}`}
                style={background ? { background } : undefined}
                role="slider"
                tabIndex={0}
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={Math.round(value)}
                aria-valuetext={valueText}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onKeyDown={onKeyDown}
            >
                {/* The handle stays inside the track at both ends */}
                <span className="ctl-thumb" style={{ left: `calc(8px + ${fraction} * (100% - 16px))` }} />
            </div>
        </div>
    );
};

export default HSlider;
