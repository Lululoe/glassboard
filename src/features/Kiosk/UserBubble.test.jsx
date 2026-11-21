import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { callService } from '../../lib/api';
import UserBubble from './UserBubble';
import { useKioskUser } from './useKioskUser';

vi.mock('../../lib/api', () => ({ callService: vi.fn() }));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

afterEach(() => vi.clearAllMocks());

/**
 * Shows the bubble for the logged-in person, like the header does.
 * @param {Object} props
 * @param {Object} props.config - The dashboard config.
 * @param {boolean} props.kiosk - Whether the screen is in kiosk mode.
 * @returns {JSX.Element|null} The bubble, or nothing when nobody is logged in.
 */
const Harness = ({ config, kiosk }) => {
    const user = useKioskUser(config, kiosk);
    return user ? <UserBubble user={user} /> : null;
};

const config = { kiosk: { user_entity: 'sensor.face_person', logout_entity: 'button.face_logout' } };

/**
 * Answers state readings with the given person and records logouts.
 * @param {string} person - The state of the user entity.
 */
const answer = (person) => {
    callService.mockImplementation(async (_service, params) => {
        if (params.endpoint === 'kiosk') return [];
        return {
            'sensor.face_person': {
                state: person,
                attributes: { since: '2026-11-21T13:05:00Z', expires: '2026-11-21T13:35:00Z' },
            },
        };
    });
};

describe('UserBubble', () => {
    it('shows who is logged in, and logs them out from its popover', async () => {
        answer('Lukas');
        render(<Harness config={config} kiosk />);
        const bubble = await screen.findByRole('button', { name: 'Lukas is logged in' });
        expect(bubble).toHaveTextContent('L');
        expect(callService).toHaveBeenCalledWith('homeassistant', { endpoint: 'states', entity_ids: ['sensor.face_person'] });

        // The profile picture covers the initial, and goes when it can't be loaded
        const picture = bubble.querySelector('img');
        expect(picture).toHaveAttribute('src', '/api/ha/kiosk-avatar?name=Lukas');
        fireEvent.error(picture);
        expect(bubble.querySelector('img')).toBeNull();

        fireEvent.click(bubble);
        expect(bubble).toHaveAttribute('aria-expanded', 'true');
        const popover = screen.getByRole('dialog', { name: 'Logged in' });
        expect(popover).toHaveTextContent('Lukas');
        expect(popover).toHaveTextContent(/Logged in since .+, until /);

        answer('none');
        fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Lukas is logged in' })).toBeNull());
        expect(callService).toHaveBeenCalledWith('homeassistant', { endpoint: 'kiosk', action: 'logout' });
    });

    it('shows nobody when nobody is logged in, and nothing outside kiosk mode', async () => {
        answer('none');
        const { rerender } = render(<Harness config={config} kiosk />);
        await waitFor(() => expect(callService).toHaveBeenCalled());
        expect(screen.queryByRole('button')).toBeNull();

        vi.clearAllMocks();
        answer('Lukas');
        rerender(<Harness config={config} kiosk={false} />);
        expect(callService).not.toHaveBeenCalled();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('leaves out the Log Out button without a logout entity, and says when logging out fails', async () => {
        answer('Anna');
        const { unmount } = render(<Harness config={{ kiosk: { user_entity: 'sensor.face_person' } }} kiosk />);
        fireEvent.click(await screen.findByRole('button', { name: 'Anna is logged in' }));
        expect(screen.queryByRole('button', { name: 'Log Out' })).toBeNull();
        unmount();

        callService.mockImplementation(async (_service, params) => {
            if (params.endpoint === 'kiosk') throw new Error('Home Assistant is down');
            return { 'sensor.face_person': { state: 'Anna', attributes: {} } };
        });
        render(<Harness config={config} kiosk />);
        fireEvent.click(await screen.findByRole('button', { name: 'Anna is logged in' }));
        expect(screen.getByRole('dialog')).toHaveTextContent(/^AAnnaLogged in/);
        expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', '/api/ha/kiosk-avatar?name=Anna');
        fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t log out.');
    });
});
