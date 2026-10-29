import { useEffect, useRef } from 'react';
import { cardInfo } from '../../features/registry';
import Icon from '../Shared/Icon';
import './CardEditor.css';

/**
 * Modal list of card types to add to the current page.
 * @param {Object} props
 * @param {(type: string) => void} props.onPick - Receives the chosen card type.
 * @param {() => void} props.onCancel - Closes without adding.
 * @returns {JSX.Element} The dialog.
 */
const AddCardDialog = ({ onPick, onCancel }) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog"
            aria-labelledby="add-card-title"
            onCancel={(e) => { e.preventDefault(); onCancel(); }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="add-card-title" className="editor-dialog-title">Add Card</h2>
                <span className="editor-dialog-action" aria-hidden="true" />
            </header>
            <div className="editor-dialog-body">
                <ul className="add-card-list">
                    {Object.entries(cardInfo).map(([type, info]) => (
                        <li key={type}>
                            <button type="button" className="button-reset add-card-option" onClick={() => onPick(type)}>
                                <span className="add-card-icon" aria-hidden="true">
                                    <Icon icon={info.icon} size={22} />
                                </span>
                                <span className="add-card-text">
                                    <span className="add-card-name">{info.name}</span>
                                    <span className="add-card-description">{info.description}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </dialog>
    );
};

export default AddCardDialog;
