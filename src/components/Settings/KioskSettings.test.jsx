import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveKiosk } from '../../lib/api';
import { resetEntityCache } from '../Editor/entityModel';
import KioskSettings from './KioskSettings';
import { renderSection } from './sectionTestUtils';

vi.mock('../../lib/api', () => ({
    listEntities: vi.fn(async () => [
        { entity_id: 'weather.home', name: 'Home' },
        { entity_id: 'switch.coffee', name: 'Coffee Machine' },
        { entity_id: 'light.kitchen', name: 'Kitchen Ceiling' },
    ]),
    saveKiosk: vi.fn(async () => ({})),
}));
vi.mock('../../features/MediaPlayer/useMediaPlayers', () => ({ useMediaPlayers: () => ({ players: [], actions: {} }) }));

describe('KioskSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
        resetEntityCache();
    });

    it('draws every clock face to pick from, and the picked one large', async () => {
        renderSection(<KioskSettings kiosk={{ clock: 'analog' }} />);
        const faces = screen.getByRole('radiogroup', { name: 'Face' });
        const options = within(faces).getAllByRole('radio');
        expect(options.map(o => o.getAttribute('aria-label'))).toEqual(['Lock Screen', 'Analog', 'StandBy', 'Stacked']);
        options.forEach(option => expect(option.querySelector('.kiosk-clock-face')).not.toBeNull());
        expect(within(faces).getByRole('radio', { name: 'Analog' })).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(within(faces).getByRole('radio', { name: 'StandBy' }));
        expect(within(faces).getByRole('radio', { name: 'StandBy' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText(/beside this month/)).toBeInTheDocument();
    });

    it('picks entities by searching for them, offering only those of the right kind', async () => {
        const { save } = renderSection(<KioskSettings kiosk={{ clock: 'analog' }} />);
        fireEvent.click(screen.getByLabelText('Weather'));
        expect(await screen.findByRole('option', { name: /Home/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Coffee/ })).toBeNull();
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search Weather' }), { key: 'Enter' });

        fireEvent.click(screen.getByLabelText('Toggles'));
        fireEvent.change(screen.getByRole('combobox', { name: 'Search Toggles' }), { target: { value: 'kitchen' } });
        expect(screen.getByRole('option', { name: /Kitchen Ceiling/ })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search Toggles' }), { key: 'Enter' });

        await save();
        expect(saveKiosk).toHaveBeenCalledWith(expect.objectContaining({ weather_entity: 'weather.home', toggles: ['light.kitchen'] }));
    });

    it('saves only when something changed', async () => {
        const { save } = renderSection(<KioskSettings kiosk={{ clock: 'analog' }} />);
        await save();
        expect(saveKiosk).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('radio', { name: 'Stacked' }));
        await save();
        expect(saveKiosk).toHaveBeenCalledWith(expect.objectContaining({ clock: 'stacked' }));
    });
});
