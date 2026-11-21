/**
 * Kiosk mode: a wall tablet shows a clock while nobody uses it, the dashboard when someone
 * looks at it or touches it, turns its screen off when the room is empty, and a full-screen
 * player while music plays. It is turned on per browser with the `kiosk` URL parameter, and
 * set up under `kiosk` in config.yaml or in the kiosk options of edit mode.
 *
 * Used by the server (which entities the browser may read and change) and the browser.
 */

/** The clock faces the screensaver can show. */
export const CLOCK_FACES = ['lockscreen', 'analog', 'standby', 'stacked'];

/** Domains whose entities can be toggles in the control center. */
export const TOGGLE_DOMAINS = ['switch', 'input_boolean', 'light', 'fan'];

/** Most toggles the control center shows. */
export const MAX_TOGGLES = 12;

/** Most media players that can take over the screen. */
export const MAX_PLAYERS = 12;

/** Entity settings of the kiosk, one entity each, with the domains each may be. */
export const KIOSK_ENTITY_FIELDS = {
    volume_entity: ['media_player'],
    brightness_entity: ['number', 'input_number'],
    screen_entity: ['switch', 'input_boolean'],
    presence_entity: ['binary_sensor', 'input_boolean'],
    face_entity: ['binary_sensor', 'input_boolean'],
    illuminance_entity: ['sensor'],
    weather_entity: ['weather'],
};

/** Settings left out of the config. */
export const KIOSK_DEFAULTS = {
    clock: 'lockscreen',
    /** Seconds without a touch or a face before the dashboard gives way to the clock. */
    idle_timeout: 60,
    /** Seconds a paused player keeps the screen before it steps back. */
    pause_timeout: 300,
    /** Below this many lux the clock shows its night colours. */
    night_below: 10,
};

/** Hours (local time) the clock is in night colours when no light sensor is set. */
export const NIGHT_HOURS = { from: 21, to: 7 };

const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;

/**
 * Whether a value is an entity id of one of the domains.
 * @param {*} value - The value.
 * @param {string[]} domains - Allowed domains.
 * @returns {boolean} True for a well-formed id of an allowed domain.
 */
export function isEntityOf(value, domains) {
    return typeof value === 'string' && ENTITY.test(value) && domains.includes(value.split('.')[0]);
}

/**
 * Reads a number setting, falling back to its default when missing or out of range.
 * @param {*} value - The value.
 * @param {number} fallback - The default.
 * @param {number} min - Smallest allowed value.
 * @param {number} max - Largest allowed value.
 * @returns {number} The setting.
 */
const numberSetting = (value, fallback, min, max) => (
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
);

/**
 * The kiosk settings of a config, with defaults filled in and anything malformed left out.
 * @param {*} raw - `config.kiosk`.
 * @returns {{media_players: string[], toggles: string[], clock: string, idle_timeout: number,
 *   pause_timeout: number, night_below: number, volume_entity?: string, brightness_entity?: string,
 *   screen_entity?: string, presence_entity?: string, face_entity?: string,
 *   illuminance_entity?: string, weather_entity?: string}} The settings.
 */
export function normalizeKiosk(raw) {
    const kiosk = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const list = (value, domains, max) => [...new Set((Array.isArray(value) ? value : [])
        .filter(id => isEntityOf(id, domains)))].slice(0, max);
    const result = {
        media_players: list(kiosk.media_players, ['media_player'], MAX_PLAYERS),
        toggles: list(kiosk.toggles, TOGGLE_DOMAINS, MAX_TOGGLES),
        clock: CLOCK_FACES.includes(kiosk.clock) ? kiosk.clock : KIOSK_DEFAULTS.clock,
        idle_timeout: numberSetting(kiosk.idle_timeout, KIOSK_DEFAULTS.idle_timeout, 5, 3600),
        pause_timeout: numberSetting(kiosk.pause_timeout, KIOSK_DEFAULTS.pause_timeout, 0, 86400),
        night_below: numberSetting(kiosk.night_below, KIOSK_DEFAULTS.night_below, 0, 100000),
    };
    Object.entries(KIOSK_ENTITY_FIELDS).forEach(([key, domains]) => {
        if (isEntityOf(kiosk[key], domains)) result[key] = kiosk[key];
    });
    return result;
}

/**
 * The media players of the kiosk: those that take over the screen and the one whose volume the
 * control center sets.
 * @param {*} raw - `config.kiosk`.
 * @returns {string[]} Media player entity ids.
 */
export function kioskMediaIds(raw) {
    const kiosk = normalizeKiosk(raw);
    return [...new Set([...kiosk.media_players, ...(kiosk.volume_entity ? [kiosk.volume_entity] : [])])];
}

/**
 * Every entity the kiosk reads.
 * @param {*} raw - `config.kiosk`.
 * @returns {string[]} Entity ids.
 */
export function kioskEntityIds(raw) {
    const kiosk = normalizeKiosk(raw);
    const single = Object.keys(KIOSK_ENTITY_FIELDS).map(key => kiosk[key]).filter(Boolean);
    return [...new Set([...kiosk.media_players, ...kiosk.toggles, ...single])];
}

/**
 * Whether kiosk mode is turned on in a URL: `?kiosk`, `?kiosk=1` or `?kiosk=true`.
 * `?kiosk=0`, `?kiosk=false` and `?kiosk=off` leave it off.
 * @param {string} search - The query string, like `window.location.search`.
 * @returns {boolean} True when kiosk mode is on.
 */
export function kioskFromUrl(search) {
    const params = new URLSearchParams(search);
    if (!params.has('kiosk')) return false;
    return !['0', 'false', 'off', 'no'].includes(String(params.get('kiosk')).trim().toLowerCase());
}
