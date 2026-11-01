import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import Icon from '../../../components/Shared/Icon';
import HSlider from './HSlider';
import LightDetail from './LightDetail';
import { useEntityControls } from './useEntityControls';
import { iconCss, isDimmable, stateText } from './lightModel';
import './ControlDialog.css';

const PHONE_QUERY = '(max-width: 760px)';

/** Stops events from reaching the dashboard behind the dialog (page swipes, card gestures). */
const stop = (e) => e.stopPropagation();
const STOPPED = {
    onClick: stop,
    onPointerDown: stop,
    onPointerUp: stop,
    onTouchStart: stop,
    onTouchMove: stop,
    onTouchEnd: stop,
    onContextMenu: stop,
};

/**
 * Pop-up with the controls of an hacontrol entity: a light or switch gets its own controls,
 * a group lists its members with controls for all of them, and each member can be opened.
 * Everything updates in place while Home Assistant reports changes.
 * @param {Object} props
 * @param {Object} props.entity - Entity config from the card (`entity_id`, `name`).
 * @param {string} props.icon - Icon of the tile, e.g. `lu-Lightbulb`.
 * @param {() => void} props.onClose - Closes the dialog.
 * @param {() => void} [props.onChange] - Called after a change was sent, e.g. to update tiles.
 * @returns {JSX.Element} The dialog, rendered into `document.body`.
 */
const ControlDialog = ({ entity, icon, onClose, onChange }) => {
    const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
    const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
    const backRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
    const pressedBackdrop = useRef(false);
    const { loading, error, isGroup, main, members, actions } = useEntityControls(entity, true, onChange);
    const [selectedId, setSelectedId] = useState(/** @type {string|null} */ (null));
    const [showDetail, setShowDetail] = useState(false);

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

    useEffect(() => {
        if (showDetail) backRef.current?.focus();
    }, [showDetail, selectedId]);

    // The first light that is on is selected until one is picked
    const selected = members.find(m => m.id === selectedId) || members.find(m => m.on) || members[0];
    const onCount = members.filter(m => m.on).length;
    const dimOn = members.filter(m => m.on && isDimmable(m));
    const groupBri = dimOn.length ? Math.round(dimOn.reduce((sum, m) => sum + m.bri, 0) / dimOn.length) : 0;
    const groupText = onCount ? `${onCount} of ${members.length} on` : 'All off';
    const subtitle = loading ? 'Loading…' : error ? 'Unavailable' : isGroup ? `${members.length} lights · ${groupText}` : stateText(main);
    const headColor = main.on ? (isGroup ? undefined : iconCss(main)) : undefined;

    const select = (id) => {
        setSelectedId(id);
        setShowDetail(window.matchMedia?.(PHONE_QUERY).matches ?? false);
    };

    const back = () => {
        const id = selected?.id;
        setShowDetail(false);
        requestAnimationFrame(() => {
            const item = /** @type {HTMLElement|null|undefined} */ (dialogRef.current?.querySelector(`[data-entity="${CSS.escape(id || '')}"]`));
            item?.focus();
        });
    };

    let body;
    if (loading || error) {
        body = <div className="ctl-message">{loading ? 'Loading…' : `Couldn't load ${main.name}: ${error}`}</div>;
    } else if (isGroup) {
        body = (
            <div className={`ctl-panes${showDetail ? ' show-detail' : ''}`}>
                <div className="ctl-list-pane">
                    <div className="ctl-list" role="list" aria-label="Lights">
                        {members.map(m => (
                            <div role="listitem" key={m.id}>
                                <button
                                    type="button"
                                    className="button-reset ctl-item"
                                    data-entity={m.id}
                                    aria-current={m.id === selected?.id}
                                    onClick={() => select(m.id)}
                                >
                                    <span className={`ctl-icon${m.on ? ' on' : ''}`} style={{ background: iconCss(m) }} aria-hidden="true">
                                        <Icon icon={m.icon || (m.id.startsWith('light.') ? 'lu-Lightbulb' : 'lu-Power')} size={18} />
                                    </span>
                                    <span className="ctl-item-meta">
                                        <span className="ctl-item-name">{m.name}</span>
                                        <span className="ctl-item-state">{stateText(m)}</span>
                                    </span>
                                    <ChevronRight className="ctl-chevron" size={18} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="ctl-primary">
                        <div className="ctl-master">
                            <div>
                                <div className="ctl-master-name">All lights</div>
                                <div className="ctl-sub">{onCount && dimOn.length ? `${groupText} · ${groupBri}%` : groupText}</div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                className="button-reset ctl-switch-hit"
                                aria-checked={onCount > 0}
                                aria-label={`All ${main.name} lights`}
                                onClick={() => actions.setOn(main, onCount === 0)}
                            >
                                <span className="ctl-switch" />
                            </button>
                        </div>
                        {members.some(isDimmable) && (
                            <HSlider
                                label="Brightness"
                                min={1}
                                max={100}
                                value={groupBri || 1}
                                valueText={onCount ? `${groupBri}%` : 'Off'}
                                background="linear-gradient(90deg, var(--ctl-track-low), rgb(255 214 140))"
                                dim={onCount === 0}
                                onChange={actions.setGroupBrightness}
                            />
                        )}
                    </div>
                </div>
                {selected && (
                    <LightDetail
                        key={selected.id}
                        light={selected}
                        actions={actions}
                        inGroup
                        groupName={main.name}
                        onBack={back}
                        backRef={backRef}
                    />
                )}
            </div>
        );
    } else {
        body = (
            <div className="ctl-panes">
                <LightDetail light={main} actions={actions} />
            </div>
        );
    }

    return createPortal(
        <dialog
            ref={dialogRef}
            className="ctl-overlay"
            aria-labelledby="ctl-dialog-title"
            onCancel={(e) => { e.preventDefault(); onClose(); }}
            onKeyDown={stop}
            {...STOPPED}
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
            <div className={`ctl-panel${isGroup ? '' : ' single'}`}>
                <div className="ctl-grabber" aria-hidden="true" />
                <header className="ctl-head">
                    <span className={`ctl-icon${main.on ? ' on' : ''}`} style={headColor ? { background: headColor } : undefined} aria-hidden="true">
                        <Icon icon={icon} size={20} />
                    </span>
                    <div className="ctl-titles">
                        <h2 id="ctl-dialog-title" className="ctl-title">{main.name}</h2>
                        <div className="ctl-sub">{subtitle}</div>
                    </div>
                    <button type="button" ref={closeRef} className="button-reset ctl-close" onClick={onClose} aria-label="Close">
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                {body}
            </div>
        </dialog>,
        document.body,
    );
};

export default ControlDialog;
