import { useEffect, useRef, useState } from 'react';
import { getCardInfo } from '../../features/registry';
import { CardIconInspector, CardIconStage } from './icons/CardIconStage';
import './CardEditor.css';

/**
 * Dialog that changes only a card's header icon: which icon, its color and its background.
 * It opens from the edit button on the icon in edit mode and shows the real card's header
 * with the icon as it will look.
 * @param {Object} props
 * @param {Object} props.card - The card whose icon is edited.
 * @param {Object} [props.globalConfig] - The dashboard config, for the card preview.
 * @param {(card: Object) => void} props.onSave - Receives the card with its new icon.
 * @param {() => void} props.onCancel - Closes without changes.
 * @returns {JSX.Element} The dialog.
 */
const CardIconEditor = ({ card, globalConfig, onSave, onCancel }) => {
    const dialogRef = useRef(null);
    const [draft, setDraft] = useState(card);
    const info = getCardInfo(card.type);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog has-stage icon-editor-dialog"
            aria-labelledby="card-icon-editor-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="card-icon-editor-title" className="editor-dialog-title">
                    Card Icon
                    <span className="editor-dialog-subtitle">{info?.name || card.type}</span>
                </h2>
                <button type="button" className="button-reset editor-dialog-action primary" onClick={() => onSave(draft)}>
                    Save
                </button>
            </header>
            <div className="editor-workspace">
                <div className="editor-workspace-stage">
                    <CardIconStage config={draft} savedConfig={card} globalConfig={globalConfig} />
                </div>
                <div className="editor-dialog-body">
                    <CardIconInspector config={draft} onChange={setDraft} />
                </div>
            </div>
        </dialog>
    );
};

export default CardIconEditor;
