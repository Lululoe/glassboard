import { NIGHT_HOURS } from '../../../shared/kiosk.js';

/** The clock faces offered in the kiosk options, with a line about each. */
export const CLOCK_FACE_INFO = [
    { value: 'lockscreen', label: 'Lock Screen', description: 'Bold time over the blurred dashboard, with the date and the weather.' },
    { value: 'analog', label: 'Analog', description: 'A watch face on black with a sweeping second hand.' },
    { value: 'standby', label: 'StandBy', description: 'A large clock beside this month’s calendar.' },
    { value: 'stacked', label: 'Stacked', description: 'Hours over minutes, filling the height of the screen.' },
];

/**
 * What the kiosk shows: the dashboard while someone touches the screen or looks at it (and for
 * the idle timeout after that), nothing with the screen off when the room is empty, and the
 * clock otherwise. A touch counts more than the presence sensor, which can lag behind.
 * @param {Object} input
 * @param {number} input.now - Current time in ms.
 * @param {number} input.lastInteraction - When the screen was last touched, in ms.
 * @param {number} input.lastLooking - When a face was last seen looking at the screen, in ms.
 * @param {boolean|undefined} input.presence - Whether someone is in the room; undefined when unknown.
 * @param {number} input.idleMs - How long the dashboard stays after the last touch or look.
 * @returns {'dashboard'|'clock'|'off'} The mode.
 */
export function screenMode({ now, lastInteraction, lastLooking, presence, idleMs }) {
    if (now - lastInteraction < idleMs || now - lastLooking < idleMs) return 'dashboard';
    if (presence === false) return 'off';
    return 'clock';
}

/**
 * Whether the clock shows its night colours. With a light sensor it is night below the
 * threshold, and stays night until the light is clearly brighter, so a reading around the
 * threshold doesn't make the clock flicker. Without one it is night between NIGHT_HOURS.
 * @param {Object} input
 * @param {number|null} input.lux - The light level, or null without a sensor or reading.
 * @param {number} input.threshold - Lux below which it is night.
 * @param {boolean} input.wasNight - Whether it was night before.
 * @param {Date} input.now - The current time.
 * @returns {boolean} True at night.
 */
export function isNight({ lux, threshold, wasNight, now }) {
    if (lux === null || !Number.isFinite(lux)) {
        const hour = now.getHours();
        return hour >= NIGHT_HOURS.from || hour < NIGHT_HOURS.to;
    }
    if (wasNight) return lux < Math.max(threshold * 1.5, threshold + 2);
    return lux < threshold;
}

/**
 * @typedef {Object} TakeoverState
 * @property {string|null} shown - The player on screen.
 * @property {Object<string, true>} dismissed - Players swiped away; they come back when they start playing again.
 * @property {Object<string, number>} pausedAt - When each paused player was paused, in ms.
 * @property {Object<string, string>} last - Each player's state at the previous update.
 */

/** @type {TakeoverState} */
export const INITIAL_TAKEOVER = { shown: null, dismissed: {}, pausedAt: {}, last: {} };

const PLAYING = new Set(['playing', 'buffering']);

/**
 * Works out which player takes over the screen. A player takes over when it starts playing and
 * stays while it plays; once paused it steps back after the pause timeout, and at once when it
 * stops. A player swiped away stays away until it starts playing again. The one on screen keeps
 * it while it may; otherwise a playing player wins over a paused one.
 * @param {TakeoverState} prev - The previous state.
 * @param {Array<{id: string, state: string}>} players - The players, in order of preference.
 * @param {number} now - Current time in ms.
 * @param {number} pauseMs - How long a paused player keeps the screen.
 * @returns {TakeoverState} The new state.
 */
export function nextTakeover(prev, players, now, pauseMs) {
    const dismissed = { ...prev.dismissed };
    const pausedAt = {};
    const last = {};
    players.forEach(({ id, state }) => {
        const was = prev.last[id];
        if (PLAYING.has(state) && !PLAYING.has(was)) delete dismissed[id];
        if (state === 'paused') pausedAt[id] = was === 'paused' && prev.pausedAt[id] !== undefined ? prev.pausedAt[id] : now;
        last[id] = state;
    });

    const eligible = (p) => !dismissed[p.id]
        && (PLAYING.has(p.state) || (p.state === 'paused' && now - pausedAt[p.id] < pauseMs));
    const current = players.find(p => p.id === prev.shown);
    const shown = current && eligible(current)
        ? current.id
        : (players.find(p => eligible(p) && PLAYING.has(p.state)) ?? players.find(eligible))?.id ?? null;
    return { shown, dismissed, pausedAt, last };
}

/**
 * Swipes the player on screen away, and with it every other player that is playing or paused
 * (such as speakers grouped with it), so none of them takes over right after. Each comes back
 * when it starts playing again.
 * @param {TakeoverState} state - The current state.
 * @returns {TakeoverState} The state without a player on screen.
 */
export function dismissTakeover(state) {
    const dismissed = { ...state.dismissed };
    if (state.shown) dismissed[state.shown] = true;
    Object.entries(state.last).forEach(([id, value]) => {
        if (PLAYING.has(value) || value === 'paused') dismissed[id] = true;
    });
    return { ...state, shown: null, dismissed };
}

/**
 * Brings a player back on screen, e.g. from the control center, even when it was swiped away.
 * @param {TakeoverState} state - The current state.
 * @param {string} id - The player.
 * @returns {TakeoverState} The state with the player on screen.
 */
export function showTakeover(state, id) {
    const dismissed = { ...state.dismissed };
    delete dismissed[id];
    return { ...state, shown: id, dismissed };
}

/** Home Assistant weather conditions, by the words the clock shows for them. */
const CONDITIONS = {
    'clear-night': 'Clear',
    cloudy: 'Cloudy',
    exceptional: 'Unusual weather',
    fog: 'Fog',
    hail: 'Hail',
    lightning: 'Thunderstorms',
    'lightning-rainy': 'Thunderstorms',
    partlycloudy: 'Partly cloudy',
    pouring: 'Heavy rain',
    rainy: 'Rain',
    snowy: 'Snow',
    'snowy-rainy': 'Sleet',
    sunny: 'Sunny',
    windy: 'Windy',
    'windy-variant': 'Windy',
};

/**
 * What the clock says about the weather, from a Home Assistant weather entity.
 * @param {Object|null|undefined} state - The weather entity's state.
 * @returns {{condition: string, kind: string, temperature: string|null}|null} The weather, or null without one.
 */
export function weatherOf(state) {
    if (!state || state.state === 'unavailable' || state.state === 'unknown') return null;
    const temperature = Number(state.attributes?.temperature);
    return {
        condition: CONDITIONS[state.state] ?? state.state,
        kind: state.state,
        temperature: Number.isFinite(temperature) ? `${Math.round(temperature)}°` : null,
    };
}

/**
 * The weeks of a month for a calendar that starts on Monday, with the days of the months
 * before and after filling the first and last week.
 * @param {Date} date - A day of the month.
 * @returns {Array<Array<{day: number, current: boolean}>>} The weeks.
 */
export function monthWeeks(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const before = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = lead; i > 0; i--) cells.push({ day: before - i + 1, current: false });
    for (let d = 1; d <= days; d++) cells.push({ day: d, current: true });
    for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ day: d, current: false });
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}
