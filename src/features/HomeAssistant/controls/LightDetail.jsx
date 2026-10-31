import { ChevronLeft, Power } from 'lucide-react';
import HSlider from './HSlider';
import { isDimmable, isWhite, lightCss, presetActive, presetCss, presetsFor, stateText } from './lightModel';

/**
 * Controls for one light (or switch): presets and colors above, brightness and power at the
 * bottom, closest to the thumb. Entities that only switch get one large power button.
 * @param {Object} props
 * @param {Object} props.light - The light, see `toLight`.
 * @param {Object} props.actions - Actions from `useEntityControls`.
 * @param {boolean} [props.inGroup=false] - Shown as a member of a group (adds a title row).
 * @param {string} [props.groupName] - Name of the group, for the back button.
 * @param {() => void} [props.onBack] - Goes back to the group's list (phones).
 * @param {import('react').Ref<HTMLButtonElement>} [props.backRef] - Ref of the back button.
 * @returns {JSX.Element} The light's controls.
 */
const LightDetail = ({ light, actions, inGroup = false, groupName, onBack, backRef }) => {
    const presets = presetsFor(light);
    const dimmable = isDimmable(light);
    const hasColor = light.caps === 'color';
    const hasWhite = light.caps === 'color' || light.caps === 'ct';
    const white = isWhite(light);
    const disabled = !light.available;

    return (
        <div className={`ctl-detail${inGroup ? ' in-group' : ''}`}>
            {inGroup && (
                <div className="ctl-detail-title">
                    <button type="button" ref={backRef} className="button-reset ctl-back" onClick={onBack} aria-label={`Back to ${groupName}`}>
                        <ChevronLeft size={22} aria-hidden="true" />
                    </button>
                    <div>
                        <h3 className="ctl-title">{light.name}</h3>
                        <div className="ctl-sub">{stateText(light)}</div>
                    </div>
                </div>
            )}

            {presets.length > 0 || hasWhite ? (
                <div className="ctl-scroll">
                    {presets.length > 0 && (
                        <>
                            <div className="ctl-section-label">Presets</div>
                            <div className="ctl-presets">
                                {presets.map(p => (
                                    <div className="ctl-preset" key={p.name}>
                                        <button
                                            type="button"
                                            className="button-reset ctl-swatch"
                                            style={{ background: presetCss(p) }}
                                            aria-pressed={presetActive(light, p)}
                                            aria-label={p.name}
                                            disabled={disabled}
                                            onClick={() => actions.setColor(light, p.ct ? { ct: p.ct } : { h: p.h, s: p.s })}
                                        />
                                        <span className="ctl-preset-name" aria-hidden="true">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    {hasColor && (
                        <>
                            <div className="ctl-section-label">Color</div>
                            <div className="ctl-stack">
                                <HSlider
                                    label="Hue"
                                    variant="hue"
                                    min={0}
                                    max={360}
                                    value={light.h}
                                    valueText={white ? '–' : `${Math.round(light.h)}°`}
                                    onChange={(h, final) => actions.setColor(light, { h }, final)}
                                />
                                <HSlider
                                    label="Saturation"
                                    min={0}
                                    max={100}
                                    value={light.s}
                                    valueText={white ? '–' : `${Math.round(light.s)}%`}
                                    background={`linear-gradient(90deg, #fff, hsl(${Math.round(light.h)} 100% 50%))`}
                                    onChange={(s, final) => actions.setColor(light, { s }, final)}
                                />
                            </div>
                        </>
                    )}
                    {hasWhite && (
                        <>
                            <div className="ctl-section-label">White</div>
                            <HSlider
                                label="Temperature"
                                variant="ct"
                                min={light.ctMin}
                                max={light.ctMax}
                                step={50}
                                value={light.ct}
                                valueText={white ? `${light.ct} K` : '–'}
                                onChange={(ct, final) => actions.setColor(light, { ct }, final)}
                            />
                        </>
                    )}
                </div>
            ) : <div className="ctl-spacer" />}

            <div className="ctl-primary">
                {dimmable && (
                    <HSlider
                        label="Brightness"
                        min={1}
                        max={100}
                        value={light.on ? light.bri : 1}
                        valueText={light.on ? `${light.bri}%` : 'Off'}
                        background={`linear-gradient(90deg, var(--ctl-track-low), ${lightCss(light)})`}
                        dim={!light.on}
                        onChange={(bri, final) => actions.setBrightness(light, bri, final)}
                    />
                )}
                <button
                    type="button"
                    className={`button-reset ctl-power${dimmable ? '' : ' big'}`}
                    aria-pressed={light.on}
                    aria-label={`${light.name}: ${light.on ? 'On' : 'Off'}`}
                    disabled={disabled}
                    onClick={() => actions.setOn(light, !light.on)}
                >
                    <Power size={dimmable ? 20 : 34} aria-hidden="true" />
                    <span>{disabled ? 'Unavailable' : light.on ? 'On' : 'Off'}</span>
                </button>
            </div>
        </div>
    );
};

export default LightDetail;
