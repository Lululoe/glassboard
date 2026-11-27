import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Icon from '../../../components/Shared/Icon';

/** Stops events from reaching the dashboard behind the dialog (page swipes, card gestures). */
const stop = (e) => e.stopPropagation();
const STOPPED = {
    onPointerUp: stop,
    onTouchStart: stop,
    onTouchMove: stop,
    onTouchEnd: stop,
    onContextMenu: stop,
};

/**
 * The frame of the control dialogs: a modal panel over a dimmed page with the entity's icon,
 * name, state and a close button. Clicking beside the panel or pressing Escape closes it; on
 * phones it's a bottom sheet. Focus moves to the close button and back to the opener after.
 * @param {Object} props
 * @param {string} props.title - The entity's name.
 * @param {string} props.subtitle - Its state, e.g. `On · 80%`.
 * @param {string|Object} props.icon - Icon of the entity (see Icon).
 * @param {boolean} [props.iconOn=false] - Draws the icon as on.
 * @param {import('react').CSSProperties} [props.iconStyle] - E.g. the light's color.
 * @param {boolean} [props.wide=false] - Two panes (groups) instead of one.
 * @param {() => void} props.onClose - Closes the dialog.
 * @param {import('react').ReactNode} props.children - The panel's body.
 * @returns {JSX.Element} The dialog, rendered into `document.body`.
 */
const DialogShell = ({ title, subtitle, icon, iconOn = false, iconStyle, wide = false, onClose, children }) => {
    const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
    const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
    const pressedBackdrop = useRef(false);

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
            <div className={`ctl-panel${wide ? '' : ' single'}`}>
                <div className="ctl-grabber" aria-hidden="true" />
                <header className="ctl-head">
                    <span className={`ctl-icon${iconOn ? ' on' : ''}`} style={iconStyle} aria-hidden="true">
                        <Icon icon={icon} size={20} />
                    </span>
                    <div className="ctl-titles">
                        <h2 id="ctl-dialog-title" className="ctl-title">{title}</h2>
                        <div className="ctl-sub">{subtitle}</div>
                    </div>
                    <button type="button" ref={closeRef} className="button-reset ctl-close" onClick={onClose} aria-label="Close">
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                {children}
            </div>
        </dialog>,
        document.body,
    );
};

export default DialogShell;
