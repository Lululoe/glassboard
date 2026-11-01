import { Minus } from 'lucide-react';

/**
 * An item in a preview, with its remove badge. The slot takes the place of the item in the
 * grid or list and adds nothing to its size, so the preview stays true to the real card.
 * @param {Object} props
 * @param {string} props.id - Stable id, for the move animation.
 * @param {string} props.label - Name of the item, for assistive technology.
 * @param {string} props.className - Classes of the item itself.
 * @param {string} [props.slotClassName] - Extra classes of the slot.
 * @param {boolean} props.selected - Whether it is selected.
 * @param {boolean} props.dragging - Whether it is being dragged.
 * @param {Object} props.itemProps - Props from `useArrangeable`.
 * @param {() => void} [props.onRemove] - Removes the item; left out, there is no badge.
 * @param {boolean} [props.removeAtEnd] - Puts the badge at the end of a row instead of on its icon's corner.
 * @param {import('react').ReactNode} props.children - The item's content.
 * @returns {JSX.Element} The slot.
 */
const ArrangeSlot = ({ id, label, className, slotClassName = '', selected, dragging, itemProps, onRemove, removeAtEnd = false, children }) => (
    <div className={`arrange-slot ${slotClassName}`} data-flip-id={id}>
        <div
            {...itemProps}
            className={`${className} arrange-item${selected ? ' selected' : ''}${dragging ? ' is-placeholder' : ''}`}
            aria-label={label}
            aria-keyshortcuts="Enter Delete Shift+ArrowLeft Shift+ArrowRight"
        >
            {children}
        </div>
        {onRemove && (
            <button type="button" className={`button-reset arrange-remove${removeAtEnd ? ' arrange-remove-end' : ''}`} tabIndex={-1} aria-label={`Remove ${label}`} onClick={onRemove}>
                <Minus size={12} strokeWidth={3.5} aria-hidden="true" />
            </button>
        )}
    </div>
);

export default ArrangeSlot;
