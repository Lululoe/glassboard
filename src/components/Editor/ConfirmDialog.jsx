import { useEffect, useRef } from 'react';
import './CardEditor.css';

/**
 * Asks before something consequential, like an iOS alert. Cancel is focused, so pressing
 * Return or Escape by accident never confirms.
 * @param {Object} props
 * @param {string} props.title - The question.
 * @param {string} props.message - What will happen.
 * @param {string} props.confirmLabel - Names the action, such as `Reset Dashboard`.
 * @param {() => void} props.onConfirm - Does it.
 * @param {() => void} props.onCancel - Closes without doing it.
 * @returns {JSX.Element} The dialog.
 */
const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel }) => {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
        cancelRef.current?.focus();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            onCancel={(e) => { e.preventDefault(); onCancel(); }}
        >
            <h2 id="confirm-dialog-title">{title}</h2>
            <p id="confirm-dialog-message">{message}</p>
            <div className="confirm-dialog-actions">
                <button type="button" ref={cancelRef} className="button-reset" onClick={onCancel}>Cancel</button>
                <button type="button" className="button-reset destructive" onClick={onConfirm}>{confirmLabel}</button>
            </div>
        </dialog>
    );
};

export default ConfirmDialog;
