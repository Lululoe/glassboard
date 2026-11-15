import { useEffect, useRef } from 'react';
import Icon from '../Shared/Icon';
import './CardEditor.css';

/** The kinds of page header widgets, as the picker lists them. */
const WIDGET_KINDS = [
    { type: 'ring', name: 'Circle', icon: 'lu-CircleGauge', description: 'A ring filled up to the value, like a battery or humidity.' },
    { type: 'gauge', name: 'Open Circle', icon: 'lu-Gauge', description: 'An open ring with a dot at the value, between a lowest and a highest value.' },
    { type: 'number', name: 'Number', icon: 'lu-Hash', description: 'The icon and the value, without a ring.' },
    { type: 'rectangle', name: 'Rectangle', icon: 'lu-RectangleHorizontal', description: 'One or two values with their units, one under the other, three circles wide.' },
];

/**
 * Modal list of page header widget kinds to add, like the list of cards to add.
 * @param {Object} props
 * @param {(type: string) => void} props.onPick - Receives the chosen kind.
 * @param {() => void} props.onCancel - Closes without adding.
 * @returns {JSX.Element} The dialog.
 */
const AddWidgetDialog = ({ onPick, onCancel }) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal?.();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="editor-dialog"
            aria-labelledby="add-widget-title"
            onCancel={(e) => { e.preventDefault(); onCancel(); }}
        >
            <header className="editor-dialog-header">
                <button type="button" className="button-reset editor-dialog-action" onClick={onCancel}>Cancel</button>
                <h2 id="add-widget-title" className="editor-dialog-title">Add Widget</h2>
                <span className="editor-dialog-action" aria-hidden="true" />
            </header>
            <div className="editor-dialog-body">
                <ul className="add-card-list">
                    {WIDGET_KINDS.map(kind => (
                        <li key={kind.type}>
                            <button type="button" className="button-reset add-card-option" onClick={() => onPick(kind.type)}>
                                <span className="add-card-icon" aria-hidden="true">
                                    <Icon icon={kind.icon} size={22} />
                                </span>
                                <span className="add-card-text">
                                    <span className="add-card-name">{kind.name}</span>
                                    <span className="add-card-description">{kind.description}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </dialog>
    );
};

export default AddWidgetDialog;
