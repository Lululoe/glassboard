import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listKioskEntities, saveKiosk } from '../../lib/api';
import KioskSettings from './KioskSettings';
import { renderSection } from './sectionTestUtils';

vi.mock('../../lib/api', () => ({ listKioskEntities: vi.fn(async () => []), saveKiosk: vi.fn(async () => ({})) }));
vi.mock('../../features/MediaPlayer/useMediaPlayers', () => ({ useMediaPlayers: () => ({ players: [], actions: {} }) }));

describe('KioskSettings', () => {
    afterEach(() => vi.clearAllMocks());

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
        await screen.findByRole('radiogroup', { name: 'Face' });
        expect(listKioskEntities).toHaveBeenCalled();
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
