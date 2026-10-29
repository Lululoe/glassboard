import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import MediaPlayerCard from './MediaPlayerCard';

const ALL_FEATURES = 1 | 2 | 4 | 16 | 32 | 16384 | 524288;

const PLAYERS = {
    'media_player.living': {
        state: 'playing',
        attributes: {
            friendly_name: 'Living Room', media_title: 'Midnight Tides', media_artist: 'Lumen Harbor', media_duration: 200,
            media_position: 50, media_position_updated_at: new Date().toISOString(), volume_level: 0.45,
            group_members: ['media_player.living', 'media_player.kitchen'], supported_features: ALL_FEATURES,
            entity_picture: '/api/media_player_proxy/media_player.living?token=x',
        },
    },
    'media_player.kitchen': {
        state: 'paused',
        attributes: {
            friendly_name: 'Kitchen', media_title: 'Paper Lanterns', media_artist: 'Saltwater Choir', media_duration: 180,
            media_position: 20, volume_level: 0.3, group_members: ['media_player.living', 'media_player.kitchen'], supported_features: ALL_FEATURES,
        },
    },
    'media_player.bedroom': {
        state: 'idle',
        attributes: { friendly_name: 'Bedroom', volume_level: 0.2, group_members: ['media_player.bedroom'], supported_features: ALL_FEATURES },
    },
};

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

/**
 * Returns the media actions sent so far.
 * @returns {Array<Object>} Request bodies of media calls.
 */
const mediaCalls = () => fetch.mock.calls
    .map(([, init]) => JSON.parse(init.body))
    .filter(body => body.endpoint === 'media');

describe('Media player card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
            const body = JSON.parse(init.body);
            return jsonResponse(body.endpoint === 'states'
                ? Object.fromEntries(body.entity_ids.map(id => [id, { entity_id: id, ...PLAYERS[id] }]))
                : []);
        }));
    });

    afterEach(() => vi.unstubAllGlobals());

    it('shows the player with its artwork, controls and group size', async () => {
        const { container } = render(<MediaPlayerCard config={{ id: 'm', entity_id: 'media_player.living' }} />);

        expect(await screen.findByText('Midnight Tides')).toBeInTheDocument();
        expect(screen.getByText('Lumen Harbor')).toBeInTheDocument();
        expect(container.querySelector('img').getAttribute('src')).toMatch(/^\/api\/ha\/artwork\?entity_id=media_player.living&v=/);
        expect(screen.getByRole('button', { name: 'Pause Living Room' })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: /Position/ })).toHaveAttribute('aria-valuetext', expect.stringMatching(/^0:5\d of 3:20$/));
        expect(container.querySelector('.mp-badge')).toHaveTextContent('2');
    });

    it('plays, pauses and skips', async () => {
        render(<MediaPlayerCard config={{ id: 'm', entity_id: 'media_player.living' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Pause Living Room' }));
        expect(screen.getByRole('button', { name: 'Play Living Room' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Next on Living Room' }));

        await waitFor(() => expect(mediaCalls().map(c => c.action)).toEqual(['media_play_pause', 'media_next_track']));
    });

    it('seeks once when the progress bar is released', async () => {
        render(<MediaPlayerCard config={{ id: 'm', entity_id: 'media_player.living' }} />);
        const scrub = await screen.findByRole('slider', { name: /Position/ });
        scrub.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200, top: 0, bottom: 24, height: 24 });

        fireEvent.pointerDown(scrub, { pointerId: 1, button: 0, clientX: 100 });
        fireEvent.pointerMove(scrub, { pointerId: 1, clientX: 150 });
        expect(scrub).toHaveAttribute('aria-valuetext', '2:30 of 3:20');
        fireEvent.pointerUp(scrub, { pointerId: 1, clientX: 150 });

        await waitFor(() => expect(mediaCalls()).toEqual([expect.objectContaining({ action: 'media_seek', seek_position: 150 })]));
    });

    it('sets volumes and groups speakers in the speaker sheet', async () => {
        render(<MediaPlayerCard config={{ id: 'm', entities: ['media_player.living'], speakers: ['media_player.kitchen', 'media_player.bedroom'] }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Speakers for Living Room' }));
        const sheet = screen.getByRole('dialog', { name: 'Speakers for Living Room' });

        // The playing speaker comes first and cannot leave its own group
        expect(within(sheet).getAllByRole('slider').map(s => s.getAttribute('aria-label'))).toEqual(['Living Room volume', 'Kitchen volume', 'Bedroom volume']);
        expect(within(sheet).getByRole('button', { name: 'Living Room is playing' })).toBeDisabled();

        const bedroom = within(sheet).getByRole('slider', { name: 'Bedroom volume' });
        bedroom.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200, top: 0, bottom: 44, height: 44 });
        fireEvent.pointerDown(bedroom, { pointerId: 2, button: 0, clientX: 120 });
        fireEvent.pointerUp(bedroom, { pointerId: 2, clientX: 120 });

        fireEvent.click(within(sheet).getByRole('button', { name: 'Play on Bedroom' }));
        fireEvent.click(within(sheet).getByRole('button', { name: 'Play on Kitchen' }));

        await waitFor(() => expect(mediaCalls()).toHaveLength(3));
        expect(mediaCalls().map(c => [c.entity_id, c.action, c.volume_level ?? c.group_members])).toEqual([
            ['media_player.bedroom', 'volume_set', 0.6],
            ['media_player.living', 'join', ['media_player.bedroom']],
            ['media_player.kitchen', 'unjoin', undefined],
        ]);

        fireEvent.keyDown(sheet, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('swipes between several players with dots', async () => {
        render(<MediaPlayerCard config={{ id: 'm', entities: ['media_player.living', 'media_player.kitchen'] }} />);
        await screen.findByText('Midnight Tides');

        expect(screen.getByText('Paper Lanterns')).toBeInTheDocument();
        expect(screen.getAllByRole('tab').map(t => [t.getAttribute('aria-label'), t.getAttribute('aria-selected')]))
            .toEqual([['Living Room', 'true'], ['Kitchen', 'false']]);
    });

    it('shows the first player as a quarter tile with only play/pause', async () => {
        render(<MediaPlayerCard config={{ id: 'm', tileSize: 'quarter', entities: ['media_player.kitchen', 'media_player.living'] }} />);

        expect(await screen.findByText('Paper Lanterns')).toBeInTheDocument();
        expect(screen.queryByText('Midnight Tides')).toBeNull();
        expect(screen.getByRole('button', { name: 'Play Kitchen' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Speakers/ })).toBeNull();
    });

    it('shows an idle player and explains a missing entity', async () => {
        const { unmount } = render(<MediaPlayerCard config={{ id: 'm', tileSize: 'half', entity_id: 'media_player.bedroom' }} />);
        expect(await screen.findByText('Nothing playing')).toBeInTheDocument();
        expect(screen.queryByRole('slider')).toBeNull();
        unmount();

        render(<MediaPlayerCard config={{ id: 'm' }} />);
        expect(screen.getByText(/Add a media_player entity/)).toBeInTheDocument();
    });
});
