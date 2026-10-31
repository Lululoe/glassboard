import { useCallback, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';

const CONFIRM_DELAY = 600;

/** Home Assistant media_player feature bits. */
const FEATURES = {
    pause: 1,
    seek: 2,
    volume: 4,
    previous: 16,
    next: 32,
    play: 16384,
    grouping: 524288,
};

/**
 * Normalizes a list of players or speakers from the config to `{ entity_id, name }`.
 * @param {Array<string|Object>|undefined} list - Entity ids or objects with `entity_id`.
 * @returns {Array<{entity_id: string, name?: string}>} The entries.
 */
export function normalizeEntries(list) {
    return (Array.isArray(list) ? list : [])
        .map(entry => (typeof entry === 'string' ? { entity_id: entry } : entry))
        .filter(entry => entry?.entity_id);
}

/**
 * Returns a short hash of a string, used to refresh artwork when the track changes.
 * @param {string} text - Any text.
 * @returns {string} Hash in base 36.
 */
export function hashText(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
    return hash.toString(36);
}

/**
 * Turns a Home Assistant media_player state (plus pending changes) into what the card shows.
 * @param {{entity_id: string, name?: string}} entry - The configured player.
 * @param {Object|undefined} raw - The entity's state.
 * @param {Object|null} pending - Optimistic changes newer than `raw`.
 * @returns {Object} The player view.
 */
function toPlayer(entry, raw, pending) {
    const attributes = raw?.attributes || {};
    const available = Boolean(raw) && raw.state !== 'unavailable' && raw.state !== 'unknown';
    const state = pending?.state ?? raw?.state ?? 'unavailable';
    const features = Number(attributes.supported_features) || 0;
    const has = (bit) => (features & bit) !== 0;
    const picture = typeof attributes.entity_picture === 'string' ? attributes.entity_picture : '';
    const updated = Date.parse(attributes.media_position_updated_at);

    return {
        id: entry.entity_id,
        name: entry.name || attributes.friendly_name || entry.entity_id,
        available,
        state,
        playing: state === 'playing',
        active: state === 'playing' || state === 'paused' || state === 'buffering',
        title: attributes.media_title || '',
        artist: attributes.media_artist || attributes.media_series_title || '',
        album: attributes.media_album_name || '',
        app: attributes.app_name || attributes.source || '',
        art: picture ? `/api/ha/artwork?entity_id=${encodeURIComponent(entry.entity_id)}&v=${hashText(picture)}` : null,
        duration: Number(attributes.media_duration) || 0,
        position: pending?.position ?? (Number(attributes.media_position) || 0),
        positionAt: pending?.positionAt ?? (Number.isFinite(updated) ? updated : 0),
        volume: pending?.volume ?? (Number.isFinite(attributes.volume_level) ? attributes.volume_level : null),
        group: pending?.group ?? (Array.isArray(attributes.group_members) ? attributes.group_members : [entry.entity_id]),
        can: {
            playPause: has(FEATURES.pause) || has(FEATURES.play),
            seek: has(FEATURES.seek),
            volume: has(FEATURES.volume),
            previous: has(FEATURES.previous),
            next: has(FEATURES.next),
            group: has(FEATURES.grouping),
        },
    };
}

/**
 * Where playback is now, counting on from the last reported position while playing.
 * @param {Object} player - A player from useMediaPlayers.
 * @param {number} now - Current time in ms.
 * @returns {number} Position in seconds, within the track.
 */
export function livePosition(player, now) {
    const elapsed = player.playing && player.positionAt && now > player.positionAt ? (now - player.positionAt) / 1000 : 0;
    const position = player.position + elapsed;
    return player.duration ? Math.min(position, player.duration) : position;
}

/**
 * Reads the media players of a media player card, and the speakers listed for its output
 * menu, in one request, and controls them. Changes show right away and are replaced by the
 * next state from the server; a failed action drops them again.
 * @param {Object} config - Card config (`entities` or `entity_id`, and `speakers`).
 * @param {number} [interval=2000] - Polling interval in ms.
 * @returns {Object} Players, speakers, load state and actions.
 */
export function useMediaPlayers(config, interval = 2000) {
    const players = normalizeEntries(Array.isArray(config.entities) ? config.entities : config.entity_id ? [config.entity_id] : []);
    const speakers = config.speakers ? normalizeEntries(config.speakers) : players;
    const ids = [...new Set([...players, ...speakers].map(e => e.entity_id))];

    const { data, loading, error, updatedAt, refresh } = usePolling(
        () => callService('homeassistant', { endpoint: 'states', entity_ids: ids }),
        { interval, enabled: ids.length > 0, key: ids.join(',') },
    );
    const [pending, setPending] = useState(/** @type {Object<string, Object>} */ ({}));

    const fresh = (id) => (pending[id] && pending[id].at > updatedAt ? pending[id] : null);
    const view = (entry) => toPlayer(entry, data?.[entry.entity_id], fresh(entry.entity_id));

    /**
     * Sends an action with optimistic changes per entity, reverting them if it fails.
     * @param {string} id - The media player.
     * @param {string} action - The media player action.
     * @param {Object} [extra] - Its value.
     * @param {Object<string, Object>} [optimistic] - Changes to show per entity id.
     */
    const send = useCallback(async (id, action, extra = {}, optimistic = {}) => {
        const at = Date.now();
        setPending(prev => {
            const next = { ...prev };
            Object.entries(optimistic).forEach(([eid, change]) => { next[eid] = { ...prev[eid], ...change, at }; });
            return next;
        });
        try {
            await callService('homeassistant', { endpoint: 'media', entity_id: id, action, ...extra });
            setTimeout(refresh, CONFIRM_DELAY);
        } catch (err) {
            console.error(`Media player ${id}:`, err);
            setPending(prev => {
                const next = { ...prev };
                Object.keys(optimistic).forEach(eid => { delete next[eid]; });
                return next;
            });
        }
    }, [refresh]);

    const actions = {
        playPause: (player) => {
            const now = Date.now();
            send(player.id, 'media_play_pause', {}, {
                [player.id]: { state: player.playing ? 'paused' : 'playing', position: livePosition(player, now), positionAt: now },
            });
        },
        next: (player) => send(player.id, 'media_next_track'),
        previous: (player) => send(player.id, 'media_previous_track'),
        seek: (player, seconds) => send(player.id, 'media_seek', { seek_position: seconds }, {
            [player.id]: { position: seconds, positionAt: Date.now() },
        }),
        setVolume: (player, level) => send(player.id, 'volume_set', { volume_level: level }, {
            [player.id]: { volume: level },
        }),
        /**
         * Adds a speaker to the player's group, or removes it.
         * @param {Object} player - The player whose group changes.
         * @param {Object} speaker - The speaker to add or remove.
         * @param {boolean} grouped - Whether the speaker should play along.
         */
        setGrouped: (player, speaker, grouped) => {
            const group = grouped
                ? [...new Set([...player.group, speaker.id])]
                : player.group.filter(id => id !== speaker.id);
            const optimistic = { [player.id]: { group }, [speaker.id]: { group: grouped ? group : [speaker.id] } };
            if (grouped) send(player.id, 'join', { group_members: [speaker.id] }, optimistic);
            else send(speaker.id, 'unjoin', {}, optimistic);
        },
    };

    return {
        players: players.map(view),
        speakers: speakers.map(view),
        loading,
        error,
        actions,
    };
}
