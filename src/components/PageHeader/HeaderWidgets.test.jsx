import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeWidgets } from '../../../shared/pageHeader';
import HeaderWidgets from './HeaderWidgets';

const states = {
    'sensor.temp': { state: '21.46', attributes: { unit_of_measurement: '°C', friendly_name: 'Inside' } },
    'sensor.humidity': { state: '48', attributes: { unit_of_measurement: '%' } },
    'sensor.power': { state: '2.4', attributes: { unit_of_measurement: 'kW', friendly_name: 'Power' } },
    'sensor.energy': { state: '12.8', attributes: { unit_of_measurement: 'kWh' } },
};

const widgets = normalizeWidgets([
    { id: 'a', type: 'ring', entity_id: 'sensor.humidity', color: 'blue' },
    { id: 'b', type: 'gauge', entity_id: 'sensor.temp', min: 10, max: 30 },
    { id: 'c', type: 'number', entity_id: 'sensor.temp' },
    { id: 'd', type: 'rectangle', entity_id: 'sensor.power', entity_id2: 'sensor.energy' },
    { id: 'e', type: 'ring', entity_id: 'sensor.humidity', condition: { operator: 'above', value: 60 } },
]);

describe('HeaderWidgets', () => {
    it('shows each kind of widget with its value', () => {
        const { container } = render(<HeaderWidgets widgets={widgets} states={states} locale="en-US" />);
        expect(screen.getByRole('img', { name: 'sensor.humidity: 48 %' })).toHaveClass('ph-type-ring');
        expect(screen.getAllByText('21°')).toHaveLength(2);
        expect(screen.getByRole('img', { name: 'Power: 2.4 kW, 12.8 kWh' })).toHaveClass('ph-r');
        // The second humidity ring is hidden: 48 is not above 60
        expect(container.querySelectorAll('.ph-type-ring')).toHaveLength(1);
    });

    it('draws monochrome widgets in the text color', () => {
        const { container } = render(<HeaderWidgets widgets={widgets.slice(0, 1)} states={states} monochrome />);
        expect([...container.querySelectorAll('circle')].every(c => c.getAttribute('stroke') === 'currentColor')).toBe(true);
    });

    it('opens widgets and adds new ones in edit mode, showing hidden ones dimmed', () => {
        const onEdit = vi.fn();
        render(<HeaderWidgets widgets={widgets} states={states} onEdit={onEdit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit widget 2' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
        expect(onEdit.mock.calls).toEqual([[1], [null]]);
        expect(screen.getByRole('button', { name: 'Edit widget 5, hidden by its condition' })).toHaveClass('is-hidden');
    });
});
