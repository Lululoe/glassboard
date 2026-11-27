import { useEffect, useId, useRef, useState } from 'react';
import { Group } from './EditorFields';
import { finishUnlock, unlock, useUnlockPrompt } from '../../lib/editAccess';
import './CardEditor.css';

/**
 * The form inside the unlock dialog: the password, and why it failed.
 * @returns {JSX.Element} The dialog.
 */
const UnlockForm = () => {
    const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
    const inputId = useId();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(/** @type {string|null} */ (null));
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
        dialog?.querySelector('input')?.focus();
    }, []);

    const submit = async () => {
        if (!password || busy) return;
        setBusy(true);
        setError(null);
        try {
            await unlock(password);
            finishUnlock(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
        }
    };

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog unlock-dialog"
            aria-labelledby="unlock-dialog-title"
            onCancel={(e) => {
                e.preventDefault();
                finishUnlock(false);
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={() => finishUnlock(false)}>Cancel</button>
                <h2 id="unlock-dialog-title" className="editor-dialog-title">Unlock Editing</h2>
                <button type="button" className="button-reset editor-dialog-action primary" disabled={!password || busy} onClick={submit}>
                    {busy ? 'Checking…' : 'Unlock'}
                </button>
            </header>
            <form
                className="card-editor-scroll page-dialog-body"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <Group
                    title="Edit Password"
                    description="It's the EDIT_PASSWORD set for Glassboard. This browser keeps you unlocked until you lock it in the settings."
                >
                    <label htmlFor={inputId} className="visually-hidden">Edit password</label>
                    <input
                        id={inputId}
                        className="editor-input"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {error && <p className="unlock-error" role="alert">{error}</p>}
                </Group>
            </form>
        </dialog>
    );
};

/**
 * Asks for the edit password when edit mode starts, or when the server refuses a change because
 * this browser's key is missing or old.
 * @returns {JSX.Element|null} The dialog while asking.
 */
const UnlockDialog = () => (useUnlockPrompt() ? <UnlockForm /> : null);

export default UnlockDialog;
