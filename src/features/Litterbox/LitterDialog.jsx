import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Cpu, Lightbulb, Lock, Moon, Power, RotateCw, Sparkles, X } from 'lucide-react';
import Icon from '../../components/Shared/Icon';
import { TodayChart, WeekChart, WeightChart } from './LitterCharts';
import { useLitterHistory } from './useLitterbox';
import { formatChange, formatTime, formatWeight, isBusy, litterLevel, statusOf, wasteLevel, weightChange } from './litterModel';

const CONFIRM_MS = 4000;
const TABS = [['today', 'Today'], ['week', '7 days'], ['weight', 'Weight']];
const NOTES = {
    today: "From each cat's visits-today sensor.",
    week: 'Visits per day, stacked by cat.',
    weight: 'Weight per cat as the robot measured it.',
};

/** Stops events from reaching the dashboard behind the dialog (page swipes, card gestures). */
const stop = (e) => e.stopPropagation();

/**
 * A setting row: icon, name and its control or value.
 * @param {Object} props
 * @param {import('react').ReactNode} props.icon - Lucide icon element.
 * @param {string} props.name - The setting.
 * @param {import('react').ReactNode} props.children - Its control or value.
 * @returns {JSX.Element} The row.
 */
const SetRow = ({ icon, name, children }) => (
    <div className="lb-set-row">
        {icon}
        <span className="lb-set-name">{name}</span>
        {children}
    </div>
);

/**
 * Options of a select entity as a segmented control.
 * @param {Object} props
 * @param {string} props.label - Accessible name.
 * @param {{value: string|null, options: string[]}} props.select - The select.
 * @param {(value: string) => void} props.onChange - Picks an option.
 * @param {(option: string) => string} [props.format] - Text of an option.
 * @returns {JSX.Element} The control.
 */
const Segments = ({ label, select, onChange, format = (o) => o }) => (
    <div className="lb-seg" role="group" aria-label={label}>
        {select.options.map(o => (
            <button key={o} type="button" className="button-reset" aria-pressed={select.value === o} onClick={() => onChange(o)}>{format(o)}</button>
        ))}
    </div>
);

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);
const minutes = (o) => (/^\d+$/.test(o) ? `${o} min` : o);

/**
 * Details of a litter box: a chart of today's visits, the last seven days or each cat's weight
 * on one side; levels, cats, settings and the device on the other, with Clean now and Reset at
 * the bottom. On phones it's a bottom sheet with the chart on top.
 * @param {Object} props
 * @param {Object} props.box - The litter box.
 * @param {Array<Object>} props.cats - Its cats, with colors.
 * @param {*} props.cardId - The card.
 * @param {Object} props.run - Actions from `useLitterbox`.
 * @param {() => void} props.onClose - Closes the dialog.
 * @returns {JSX.Element} The dialog, rendered into `document.body`.
 */
const LitterDialog = ({ box, cats, cardId, run, onClose }) => {
    const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
    const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
    const pressedBackdrop = useRef(false);
    const [tab, setTab] = useState(cats.length ? 'today' : null);
    const [confirmReset, setConfirmReset] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const { history: loaded } = useLitterHistory(cardId, tab || 'today', Boolean(tab));
    const history = loaded?.range === tab ? loaded : null;
    const weights = useLitterHistory(cardId, 'weight', cats.length > 0).history;
    const status = statusOf(box);
    const busy = isBusy(box);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!confirmReset) return undefined;
        const id = setTimeout(() => setConfirmReset(false), CONFIRM_MS);
        return () => clearTimeout(id);
    }, [confirmReset]);

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        const opener = /** @type {HTMLElement|null} */ (document.activeElement);
        if (!dialog.open) {
            if (dialog.showModal) dialog.showModal();
            else dialog.setAttribute('open', '');
        }
        closeRef.current?.focus();
        return () => {
            // The page stays inert until the modal closes, so close it before moving focus back
            if (dialog.open) dialog.close?.();
            opener?.focus?.();
        };
    }, []);

    const reset = () => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }
        setConfirmReset(false);
        run.reset();
    };

    const subtitle = [status.text, box.last_seen ? `last seen ${formatTime(box.last_seen)}` : null].filter(Boolean).join(' · ');
    const hasSettings = box.clean_delay || box.globe_light || box.panel_lock !== null || box.sleep;
    const hasDevice = box.hopper || box.firmware || box.last_seen;

    return createPortal(
        <dialog
            ref={dialogRef}
            className="lb-overlay"
            aria-labelledby="lb-dialog-title"
            onCancel={(e) => { e.preventDefault(); onClose(); }}
            onKeyDown={stop}
            onPointerUp={stop}
            onTouchStart={stop}
            onTouchMove={stop}
            onTouchEnd={stop}
            onContextMenu={stop}
            onPointerDown={(e) => {
                e.stopPropagation();
                pressedBackdrop.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
                pressedBackdrop.current = false;
            }}
        >
            <div className={`lb-panel${tab ? '' : ' single'}`}>
                <div className="lb-grabber" aria-hidden="true" />
                <header className="lb-head">
                    <span className="lb-head-icon" aria-hidden="true"><Icon icon="mdi:cat" size={22} /></span>
                    <div className="lb-head-titles">
                        <h2 id="lb-dialog-title" className="lb-head-title">{box.name}</h2>
                        <div className="lb-head-sub">{subtitle}</div>
                    </div>
                    <button type="button" ref={closeRef} className="button-reset lb-round" aria-label="Close" onClick={onClose}>
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                <div className="lb-panes">
                    {tab && (
                        <div className="lb-view-pane">
                            <div className="lb-seg lb-tabs" role="tablist" aria-label="History">
                                {TABS.map(([key, label]) => (
                                    <button key={key} type="button" role="tab" className="button-reset" aria-selected={tab === key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>
                                ))}
                            </div>
                            <div className="lb-viewer" role="tabpanel">
                                {cats.length > 1 && (
                                    <div className="lb-legend">
                                        {cats.map(c => <span key={c.index} style={/** @type {import('react').CSSProperties} */ ({ '--cat': c.color })}>{c.name}</span>)}
                                    </div>
                                )}
                                {!history ? <div className="lb-chart-empty">Loading…</div>
                                    : tab === 'today' ? <TodayChart cats={cats} history={history} now={now} />
                                        : tab === 'week' ? <WeekChart cats={cats} history={history} />
                                            : <WeightChart cats={cats} history={history} />}
                                <div className="lb-viewer-note">{NOTES[tab]}</div>
                            </div>
                        </div>
                    )}
                    <div className="lb-side">
                        <div className="lb-side-scroll">
                            {(box.waste !== null || box.litter !== null) && (
                                <>
                                    <div className="lb-section">Levels</div>
                                    {box.waste !== null && (
                                        <div className={`lb-part ${wasteLevel(box.waste)}`}>
                                            <span className="lb-part-name">Waste drawer</span>
                                            <span className="lb-part-value">{Math.round(box.waste)}%{box.waste >= 70 ? ' · empty soon' : ''}</span>
                                            <div className="lb-bar"><div style={{ width: `${box.waste}%` }} /></div>
                                        </div>
                                    )}
                                    {box.litter !== null && (
                                        <div className={`lb-part ${litterLevel(box.litter)}`}>
                                            <span className="lb-part-name">Litter</span>
                                            <span className="lb-part-value">{Math.round(box.litter)}%{box.litter <= 40 ? ' · top up' : ''}</span>
                                            <div className="lb-bar"><div style={{ width: `${box.litter}%` }} /></div>
                                        </div>
                                    )}
                                </>
                            )}
                            {cats.length > 0 && (
                                <>
                                    <div className="lb-section">Cats</div>
                                    {cats.map(cat => {
                                        const change = weightChange(weights?.cats?.find(c => c.index === cat.index)?.points);
                                        return (
                                            <div className="lb-cat-line" key={cat.index} style={/** @type {import('react').CSSProperties} */ ({ '--cat': cat.color })}>
                                                <i aria-hidden="true" />
                                                <b>{cat.name}</b>
                                                <span className="lb-cat-weight">{formatWeight(cat.weight, cat.weight_unit)}</span>
                                                <span className="lb-cat-sub">{cat.visits !== null ? `${cat.visits} ${cat.visits === 1 ? 'visit' : 'visits'} today` : ''}</span>
                                                <span className="lb-cat-change">{change !== null ? `${formatChange(change, cat.weight_unit)} / 30 d` : ''}</span>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                            {hasSettings && (
                                <>
                                    <div className="lb-section">Settings</div>
                                    {box.clean_delay && box.clean_delay.options.length > 0 && (
                                        <SetRow icon={<Clock size={18} aria-hidden="true" />} name="Clean after">
                                            <Segments label="Clean after" select={box.clean_delay} onChange={run.setCleanDelay} format={minutes} />
                                        </SetRow>
                                    )}
                                    {box.globe_light && box.globe_light.options.length > 0 && (
                                        <SetRow icon={<Lightbulb size={18} aria-hidden="true" />} name="Globe light">
                                            <Segments label="Globe light" select={box.globe_light} onChange={run.setGlobeLight} format={capitalize} />
                                        </SetRow>
                                    )}
                                    {box.panel_lock !== null && (
                                        <SetRow icon={<Lock size={18} aria-hidden="true" />} name="Panel lock">
                                            <button
                                                type="button"
                                                role="switch"
                                                className="button-reset lb-switch-hit"
                                                aria-checked={box.panel_lock}
                                                aria-label="Panel lock"
                                                onClick={() => run.setPanelLock(!box.panel_lock)}
                                            >
                                                <span className="lb-switch" />
                                            </button>
                                        </SetRow>
                                    )}
                                    {box.sleep && (
                                        <SetRow icon={<Moon size={18} aria-hidden="true" />} name="Sleep mode">
                                            <span className="lb-set-value">{formatTime(box.sleep.start)} – {formatTime(box.sleep.end)}</span>
                                        </SetRow>
                                    )}
                                </>
                            )}
                            {hasDevice && (
                                <>
                                    <div className="lb-section">Device</div>
                                    {box.hopper && <SetRow icon={<Sparkles size={18} aria-hidden="true" />} name="Hopper"><span className="lb-set-value">{capitalize(box.hopper)}</span></SetRow>}
                                    {box.firmware && (
                                        <SetRow icon={<Cpu size={18} aria-hidden="true" />} name="Firmware">
                                            <span className={`lb-set-value${box.firmware.update ? ' lb-update' : ''}`}>
                                                {box.firmware.update ? `Update to ${box.firmware.latest || 'new version'}` : box.firmware.installed ? `${box.firmware.installed} · up to date` : 'Up to date'}
                                            </span>
                                        </SetRow>
                                    )}
                                    {box.last_seen && <SetRow icon={<Clock size={18} aria-hidden="true" />} name="Last seen"><span className="lb-set-value">{formatTime(box.last_seen)}</span></SetRow>}
                                </>
                            )}
                        </div>
                        <div className="lb-primary">
                            <div className={`lb-actions${box.resettable ? '' : ' single'}`}>
                                <button type="button" className="button-reset lb-action accent" disabled={busy || box.state === 'unavailable'} onClick={run.clean}>
                                    <RotateCw size={18} aria-hidden="true" />
                                    {busy ? `${status.text}…` : 'Clean now'}
                                </button>
                                {box.resettable && (
                                    <button type="button" className={`button-reset lb-action${confirmReset ? ' confirm' : ''}`} onClick={reset}>
                                        <Power size={18} aria-hidden="true" />
                                        {confirmReset ? 'Tap to reset' : 'Reset'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </dialog>,
        document.body,
    );
};

export default LitterDialog;
