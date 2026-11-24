import { Check, Minus, Plus, Power, Volume2, VolumeX } from 'lucide-react';
import Icon from '../../../components/Shared/Icon';
import DialogShell from './DialogShell';
import HSlider from './HSlider';
import { useMediaControls } from './useMediaControls';

/**
 * Pop-up of an Entity tile that shows a media player, like a TV: its inputs, with the current
 * one ticked, the volume and power. Picking an input switches right away and keeps the pop-up
 * open; when the player is off, it is turned on first.
 * @param {Object} props
 * @param {Object} props.entity - Entity config from the card (`entity_id`, `name`, `sources`).
 * @param {string|Object} props.icon - Icon of the tile.
 * @param {() => void} props.onClose - Closes the dialog.
 * @param {() => void} [props.onChange] - Called after a change was sent, e.g. to update the tile.
 * @returns {JSX.Element} The dialog.
 */
const MediaDialog = ({ entity, icon, onClose, onChange }) => {
    const { player, loading, error, actions } = useMediaControls(entity, onChange);
    const current = player.inputs.find(i => i.source === player.source);
    const subtitle = loading ? 'Loading…' : error || !player.available ? 'Unavailable'
        : player.on ? ['On', current?.name || player.source].filter(Boolean).join(' · ') : 'Off';
    const disabled = !player.available;
    const showVolume = player.can.volumeSet || player.can.volumeStep;

    let body;
    if (loading || error) {
        body = <div className="ctl-message">{loading ? 'Loading…' : `Couldn't load ${player.name}: ${error}`}</div>;
    } else {
        body = (
            <div className="ctl-panes">
                <div className="ctl-detail">
                    {player.can.source && player.inputs.length > 0 ? (
                        <div className="ctl-scroll">
                            <div className="ctl-section-label" id="ctl-inputs-label">Input</div>
                            <div className="ctl-list ctl-inputs" role="radiogroup" aria-labelledby="ctl-inputs-label">
                                {player.inputs.map(input => {
                                    const checked = player.on && input.source === player.source;
                                    return (
                                        <button
                                            key={input.source}
                                            type="button"
                                            role="radio"
                                            aria-checked={checked}
                                            className="button-reset ctl-item ctl-input"
                                            disabled={disabled}
                                            onClick={() => actions.selectSource(input.source)}
                                        >
                                            <span className={`ctl-icon${checked ? ' on' : ''}`} aria-hidden="true">
                                                <Icon icon={input.icon} size={18} />
                                            </span>
                                            <span className="ctl-item-meta">
                                                <span className="ctl-item-name">{input.name}</span>
                                            </span>
                                            {checked && <Check className="ctl-input-check" size={20} aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : <div className="ctl-spacer" />}

                    <div className="ctl-primary">
                        {player.can.volumeSet && (
                            <HSlider
                                label="Volume"
                                min={0}
                                max={100}
                                value={player.volume ?? 0}
                                valueText={player.muted ? 'Muted' : player.volume === null ? '–' : `${player.volume}%`}
                                background="linear-gradient(90deg, var(--ctl-track-low), #fff)"
                                dim={!player.on || player.muted}
                                onChange={actions.setVolume}
                            />
                        )}
                        {!player.can.volumeSet && player.can.volumeStep && (
                            <div className="ctl-volume-steps" role="group" aria-label="Volume">
                                <button type="button" className="button-reset ctl-step" aria-label="Volume down" disabled={disabled || !player.on} onClick={() => actions.stepVolume(false)}>
                                    <Minus size={20} aria-hidden="true" />
                                </button>
                                <span className="ctl-step-value" aria-live="polite">
                                    {player.muted ? 'Muted' : player.volume === null ? 'Volume' : `Volume ${player.volume}%`}
                                </span>
                                <button type="button" className="button-reset ctl-step" aria-label="Volume up" disabled={disabled || !player.on} onClick={() => actions.stepVolume(true)}>
                                    <Plus size={20} aria-hidden="true" />
                                </button>
                            </div>
                        )}
                        <div className={`ctl-media-row${showVolume && player.can.mute ? '' : ' single'}`}>
                            {showVolume && player.can.mute && (
                                <button
                                    type="button"
                                    className="button-reset ctl-power ctl-mute"
                                    aria-pressed={player.muted}
                                    disabled={disabled || !player.on}
                                    onClick={() => actions.setMuted(!player.muted)}
                                >
                                    {player.muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
                                    <span>{player.muted ? 'Muted' : 'Mute'}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                className="button-reset ctl-power ctl-media-on"
                                aria-pressed={player.on}
                                aria-label={`${player.name}: ${player.on ? 'On' : 'Off'}`}
                                disabled={disabled}
                                onClick={() => actions.setOn(!player.on)}
                            >
                                <Power size={20} aria-hidden="true" />
                                <span>{disabled ? 'Unavailable' : player.on ? 'On' : 'Off'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <DialogShell
            title={player.name}
            subtitle={subtitle}
            icon={icon}
            iconOn={player.on}
            iconStyle={player.on ? { background: 'var(--system-blue)' } : undefined}
            onClose={onClose}
        >
            {body}
        </DialogShell>
    );
};

export default MediaDialog;
