import { conditionKind } from '../../features/Weather/weatherConditions';

/**
 * @typedef {Object} WeatherScene
 * @property {'rain'|'snow'|'cover'|'sun'} effect - What the background shows.
 * @property {number} intensity - How much rain or snow, from 0 to 1.
 * @property {number} clouds - How much of the sky clouds cover, from 0 to 1.
 * @property {boolean} night - Whether it is dark outside: the sun gives way to stars and the moon.
 * @property {boolean} fog - Whether clouds hang low, as mist.
 */

/**
 * How heavy rain or snow is, from the words of its condition.
 * @param {string} condition - For example `Light rain` or `Heavy snow showers`.
 * @returns {number} From 0 to 1.
 */
const heaviness = (condition) => {
    const c = condition.toLowerCase();
    if (c.includes('heavy') || c.includes('thunder')) return 1;
    if (c.includes('light') || c.includes('drizzle') || c.includes('grains')) return 0.4;
    return 0.7;
};

/**
 * Picks the weather background for the weather now.
 * @param {{condition?: string, isDay?: boolean, cloudCover?: number}|null|undefined} current - The current weather.
 * @param {string|null} [fixed] - An effect the background always shows instead (`rain`, `snow`, `cover` or `sun`).
 * @returns {WeatherScene|null} The scene, or null without weather to go by.
 */
export function weatherScene(current, fixed = null) {
    if (fixed === 'rain') return { effect: 'rain', intensity: 0.7, clouds: 1, night: false, fog: false };
    if (fixed === 'snow') return { effect: 'snow', intensity: 0.7, clouds: 1, night: false, fog: false };
    if (fixed === 'cover') return { effect: 'cover', intensity: 0, clouds: 1, night: false, fog: false };
    if (fixed === 'sun') return { effect: 'sun', intensity: 0, clouds: 0, night: false, fog: false };
    if (!current?.condition) return null;

    const condition = current.condition;
    const night = current.isDay === false;
    const cover = Number.isFinite(current.cloudCover) ? Math.min(1, Math.max(0, current.cloudCover / 100)) : null;
    const kind = conditionKind(condition);
    if (kind === 'storm' || kind === 'rain' || kind === 'drizzle') {
        return { effect: 'rain', intensity: kind === 'drizzle' ? 0.35 : heaviness(condition), clouds: 1, night, fog: false };
    }
    if (kind === 'snow') return { effect: 'snow', intensity: heaviness(condition), clouds: 1, night, fog: false };
    if (kind === 'clear') return { effect: 'sun', intensity: 0, clouds: Math.min(cover ?? 0, 0.2), night, fog: false };
    if (kind === 'partly') return { effect: 'sun', intensity: 0, clouds: cover ?? 0.45, night, fog: false };
    return { effect: 'cover', intensity: 0, clouds: cover ?? 1, night, fog: kind === 'fog' };
}
