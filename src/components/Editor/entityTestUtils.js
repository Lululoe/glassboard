import { fireEvent, screen } from '@testing-library/react';

/**
 * Picks an entity in an entity picker the way a person does: opens it, types the id and presses
 * Enter. Without a Home Assistant to list entities from, the typed id is offered as it is.
 * @param {string} label - The picker's label.
 * @param {string} entityId - The entity to pick.
 */
export function pickEntity(label, entityId) {
    fireEvent.click(screen.getByLabelText(label));
    const search = screen.getByRole('combobox', { name: `Search ${label}` });
    fireEvent.change(search, { target: { value: entityId } });
    fireEvent.keyDown(search, { key: 'Enter' });
}
