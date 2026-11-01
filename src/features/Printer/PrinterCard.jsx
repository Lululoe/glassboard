import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Pause, Play, Square } from 'lucide-react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import EmptyState from '../../components/Shared/EmptyState';
import { joinParts, progressOf, readout, spoolLabel, statusInfo } from './printerModel';
import { usePrinter } from './usePrinter';
import './PrinterCard.css';

const ICON_BACKGROUND = 'linear-gradient(180deg, #5ee07f, #24b04a)';
const CONFIRM_TIME = 3000;

const COLORS = {
    running: 'var(--system-green)',
    paused: 'var(--system-orange)',
    failed: 'var(--system-red)',
    finished: 'var(--system-green)',
};

const temperature = (value) => (value === null ? '–' : `${Math.round(value)}°`);

/**
 * Pause or resume, stop and the chamber light. Stopping asks once more, and buttons the
 * printer doesn't have stay hidden.
 * @param {Object} props
 * @param {Object} props.printer - The printer.
 * @param {Object} props.run - Actions from `usePrinter`.
 * @returns {JSX.Element} The buttons.
 */
const PrinterButtons = ({ printer, run }) => {
    const [confirming, setConfirming] = useState(false);
    const timer = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
    useEffect(() => () => clearTimeout(timer.current), []);

    const { kind } = statusInfo(printer.status);
    const stop = () => {
        clearTimeout(timer.current);
        setConfirming(!confirming);
        if (confirming) run.stop();
        else timer.current = setTimeout(() => setConfirming(false), CONFIRM_TIME);
    };
    const inProgress = kind === 'running' || kind === 'paused';

    return (
        <div className="printer-buttons">
            {kind === 'running' && printer.controls.pause && (
                <button type="button" className="button-reset two-tone-header-action" aria-label="Pause print" title="Pause print" onClick={run.pause}>
                    <Pause size={20} fill="currentColor" stroke="none" />
                </button>
            )}
            {kind === 'paused' && printer.controls.resume && (
                <button type="button" className="button-reset two-tone-header-action" aria-label="Resume print" title="Resume print" onClick={run.resume}>
                    <Play size={20} fill="currentColor" stroke="none" />
                </button>
            )}
            {inProgress && printer.controls.stop && (
                <button
                    type="button"
                    className={`button-reset two-tone-header-action${confirming ? ' printer-confirm' : ''}`}
                    aria-label={confirming ? 'Confirm stopping the print' : 'Stop print'}
                    title={confirming ? 'Confirm stopping the print' : 'Stop print'}
                    onClick={stop}
                >
                    {confirming ? 'Stop?' : <Square size={18} fill="currentColor" stroke="none" />}
                </button>
            )}
            {printer.light !== null && (
                <button
                    type="button"
                    className={`button-reset two-tone-header-action${printer.light === 'on' ? ' printer-light-on' : ''}`}
                    aria-label={printer.light === 'on' ? 'Turn chamber light off' : 'Turn chamber light on'}
                    aria-pressed={printer.light === 'on'}
                    title={printer.light === 'on' ? 'Turn chamber light off' : 'Turn chamber light on'}
                    onClick={run.toggleLight}
                >
                    <Lightbulb size={20} />
                </button>
            )}
        </div>
    );
};

/**
 * The progress bar; stays in place, empty and grey, while nothing is printing.
 * @param {Object} props
 * @param {Object} props.printer - The printer.
 * @returns {JSX.Element} The bar.
 */
const ProgressBar = ({ printer }) => {
    const percent = progressOf(printer);
    return (
        <div className="printer-bar" role="progressbar" aria-label="Print progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%`, background: COLORS[statusInfo(printer.status).kind] }} />
        </div>
    );
};

/**
 * The loaded spools by colour, with the one in use ringed.
 * @param {Object} props
 * @param {Object} props.printer - The printer.
 * @returns {JSX.Element|null} The spools.
 */
const Spools = ({ printer }) => {
    if (printer.spools.length === 0) return null;
    return (
        <div className="printer-spools">
            {printer.spools.map(spool => (
                <div
                    key={spool.entity_id}
                    className={`printer-spool${spool.active ? ' active' : ''}${spool.empty ? ' empty' : ''}`}
                    style={spool.empty || !spool.color ? undefined : /** @type {Object} */ ({ '--spool': spool.color })}
                    role="img"
                    aria-label={spoolLabel(spool)}
                    title={spoolLabel(spool)}
                />
            ))}
        </div>
    );
};

/**
 * One temperature on the full size card.
 * @param {Object} props
 * @param {string} props.name - What it measures.
 * @param {number|null} props.value - The temperature.
 * @param {number|null} [props.target] - The target, when heating.
 * @returns {JSX.Element} The tile.
 */
const TemperatureTile = ({ name, value, target = null }) => (
    <div className="printer-tile">
        <b>{temperature(value)}</b>
        <span>{target ? `${name} / ${temperature(target)}` : name}</span>
    </div>
);

/**
 * The full size content: job, progress, temperatures and spools.
 * @param {Object} props
 * @param {Object} props.printer - The printer.
 * @returns {JSX.Element} The content.
 */
const FullContent = ({ printer }) => {
    const { kind } = statusInfo(printer.status);
    const { big, time, detail } = readout(printer);
    const printing = kind !== 'idle' && kind !== 'offline';
    const layers = printing && printer.layer && printer.totalLayers ? `Layer ${printer.layer} of ${printer.totalLayers}` : '';
    const humidity = printer.humidity !== null ? `AMS ${printer.humidity}%` : '';
    const job = printing ? printer.job : printer.job && `Last print: ${printer.job}`;
    return (
        <div className="printer-body">
            <div className="printer-job">{job}</div>
            <div className="printer-main">
                <div className="printer-big">{big}</div>
                <div className="printer-time">{time}<small>{detail}</small></div>
            </div>
            <ProgressBar printer={printer} />
            <div className="printer-temps">
                <TemperatureTile name="Nozzle" value={printer.nozzle.value} target={printer.nozzle.target} />
                <TemperatureTile name="Bed" value={printer.bed.value} target={printer.bed.target} />
                <TemperatureTile name="Chamber" value={printer.chamber} />
            </div>
            <div className="printer-foot">
                <Spools printer={printer} />
                <span>{layers || humidity}</span>
            </div>
        </div>
    );
};

/**
 * The half height content: the same progress and spools, on fewer lines.
 * @param {Object} props
 * @param {Object} props.printer - The printer.
 * @returns {JSX.Element} The content.
 */
const HalfContent = ({ printer }) => {
    const { big, time, detail } = readout(printer);
    return (
        <div className="printer-body">
            <div className="printer-half-main">
                <b>{big}</b>
                <span>{joinParts(time, detail)}</span>
            </div>
            <ProgressBar printer={printer} />
            <div className="printer-half-foot">
                <span>
                    {joinParts(
                        `Nozzle ${temperature(printer.nozzle.value)}`,
                        `Bed ${temperature(printer.bed.value)}`,
                        `Chamber ${temperature(printer.chamber)}`,
                    )}
                </span>
                <Spools printer={printer} />
            </div>
        </div>
    );
};

/**
 * 3D printer card for the Bambu Lab integration: progress, time, temperatures and spools, with
 * pause, stop and the chamber light in the header. Half height keeps the same parts on fewer lines.
 * @param {Object} props
 * @param {Object} props.config - Card configuration, see the docs.
 * @returns {JSX.Element} The rendered card.
 */
const PrinterCard = ({ config }) => {
    const half = config.tileSize === 'half';
    const { printer, loading, error, run } = usePrinter(config.id, Boolean(config.printer));

    let body;
    if (!config.printer) body = <EmptyState message="Choose a printer in the card settings." />;
    else if (!printer) body = <EmptyState message={loading ? 'Loading…' : `Couldn't load the printer${error ? `: ${error}` : ''}`} />;
    else body = half ? <HalfContent printer={printer} /> : <FullContent printer={printer} />;

    const info = printer ? statusInfo(printer.status) : null;
    const printing = info && info.kind !== 'idle' && info.kind !== 'offline';
    const subtitle = info && (
        <>
            <i className="printer-dot" style={{ background: COLORS[info.kind] }} />
            <span className="printer-status">{joinParts(info.label, half && printing && printer.job)}</span>
        </>
    );

    return (
        <TwoToneBase
            className={`printer-card${half ? ' half' : ''}`}
            title={config.title || printer?.name || '3D Printer'}
            subtitle={subtitle || undefined}
            icon={config.icon || 'mdi:printer-3d-nozzle'}
            iconBackground={config.iconBackground || ICON_BACKGROUND}
            iconColor={config.iconColor || '#fff'}
            actions={printer && <PrinterButtons printer={printer} run={run} />}
        >
            {body}
        </TwoToneBase>
    );
};

export default PrinterCard;
