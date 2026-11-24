/** Home Assistant's media_player feature bits that the input pop-up uses. */
export const MEDIA_FEATURES = {
    volumeSet: 4,
    volumeMute: 8,
    turnOn: 128,
    turnOff: 256,
    volumeStep: 1024,
    selectSource: 2048,
};

/** States in which a media player counts as off on its tile. */
const OFF_STATES = ['off', 'standby', 'unavailable', 'unknown'];

/**
 * Whether an entity id is a media player.
 * @param {*} entityId - The entity id.
 * @returns {boolean} True for `media_player.*`.
 */
export const isMediaPlayer = (entityId) => String(entityId || '').startsWith('media_player.');

/**
 * Whether a media player is on: anything but off, standby, unavailable or unknown.
 * @param {string|undefined} state - Its state.
 * @returns {boolean} True when on.
 */
export const mediaIsOn = (state) => Boolean(state) && !OFF_STATES.includes(String(state));

/**
 * Icon for an input, guessed from its name: consoles, computers, Apple TV, HDMI and TV inputs.
 * @param {string} name - The input's name, e.g. `Nintendo Switch`.
 * @returns {string} An icon name for the Icon component.
 */
export function sourceIcon(name) {
    const n = String(name || '').toLowerCase();
    if (/apple/.test(n)) return 'mdi:apple';
    if (/switch|nintendo|playstation|ps\d|xbox|console|game/.test(n)) return 'mdi:gamepad-variant';
    if (/\bpc\b|computer|mac|laptop|desktop|steam/.test(n)) return 'mdi:monitor';
    if (/chromecast|cast|fire|roku|shield|google tv/.test(n)) return 'mdi:cast';
    if (/hdmi/.test(n)) return 'mdi:video-input-hdmi';
    if (/tv|antenna|live|cable|satellite|dvb/.test(n)) return 'mdi:television-classic';
    if (/blu|dvd/.test(n)) return 'mdi:disc-player';
    if (/bluetooth|aux|optical|spotify|music|radio/.test(n)) return 'mdi:music';
    return 'mdi:video-input-component';
}

/**
 * The inputs a tile offers: the player's `source_list`, or the ones the card lists in
 * `sources` (each `{ source, name?, icon? }` or a plain source name), in that order. Listed
 * sources the player doesn't have are left out.
 * @param {string[]} sourceList - The player's sources.
 * @param {Array<Object|string>|undefined} configured - The card's `sources`.
 * @returns {Array<{source: string, name: string, icon: string}>} The inputs.
 */
export function inputsOf(sourceList, configured) {
    const list = Array.isArray(sourceList) ? sourceList.map(String) : [];
    const picked = Array.isArray(configured) && configured.length > 0
        ? configured.map(c => (typeof c === 'string' ? { source: c } : c)).filter(c => c && list.includes(String(c.source)))
        : list.map(source => ({ source }));
    return picked.map(c => ({
        source: String(c.source),
        name: typeof c.name === 'string' && c.name ? c.name : String(c.source),
        icon: typeof c.icon === 'string' && c.icon ? c.icon : sourceIcon(c.name || c.source),
    }));
}

/**
 * What the tile shows as a media player's state: the current input's name while on (or what's
 * playing when it has no input), else Off.
 * @param {Object|undefined} state - The player's state.
 * @param {Array<Object|string>} [configured] - The card's `sources`, for the input's name.
 * @returns {string} The state text.
 */
export function mediaTileText(state, configured) {
    const s = state?.state;
    if (!s || s === 'unknown') return 'Unknown';
    if (s === 'unavailable') return 'Unavailable';
    if (!mediaIsOn(s)) return 'Off';
    const a = state.attributes || {};
    if (a.source) {
        const named = inputsOf([a.source], configured).find(i => i.source === String(a.source));
        return named?.name || String(a.source);
    }
    if (a.app_name) return String(a.app_name);
    if (a.media_title) return String(a.media_title);
    return s === 'on' ? 'On' : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Turns a media player's state (plus pending changes) into what its pop-up shows.
 * @param {Object} entity - The entity config from the card (`entity_id`, `name`, `sources`).
 * @param {Object|undefined} state - The player's state.
 * @param {Object} [pending] - Optimistic `on`, `source`, `volume` and `muted`.
 * @returns {Object} `id`, `name`, `available`, `on`, `source`, `inputs`, `volume` (0-100 or null),
 *   `muted` and `can` (`power`, `source`, `volumeSet`, `volumeStep`, `mute`).
 */
export function toMediaPlayer(entity, state, pending = {}) {
    const a = state?.attributes || {};
    const features = Number(a.supported_features) || 0;
    const has = (bit) => (features & bit) !== 0;
    const available = Boolean(state) && state.state !== 'unavailable' && state.state !== 'unknown';
    const level = Number(a.volume_level);
    return {
        id: entity.entity_id,
        name: entity.name || a.friendly_name || entity.entity_id,
        available,
        on: pending.on ?? mediaIsOn(state?.state),
        source: pending.source ?? (a.source != null ? String(a.source) : null),
        inputs: inputsOf(a.source_list, entity.sources),
        volume: pending.volume ?? (a.volume_level != null && Number.isFinite(level) ? Math.round(level * 100) : null),
        muted: pending.muted ?? Boolean(a.is_volume_muted),
        can: {
            power: has(MEDIA_FEATURES.turnOn) || has(MEDIA_FEATURES.turnOff),
            source: has(MEDIA_FEATURES.selectSource),
            volumeSet: has(MEDIA_FEATURES.volumeSet),
            volumeStep: has(MEDIA_FEATURES.volumeStep),
            mute: has(MEDIA_FEATURES.volumeMute),
        },
    };
}
