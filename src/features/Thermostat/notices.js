/**
 * What the Thermostat card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { plural } from '../../lib/format';

/**
 * Thermostats: thermostats that can't be reached. Heating is normal and not reported.
 * @param {Array<{name: string, available: boolean}>} rooms - Each thermostat, and whether Home Assistant can reach it.
 * @param {boolean} loaded - Whether the states have loaded.
 * @returns {Array<Object>} The notices.
 */
export function thermostatNotices(rooms, loaded) {
    if (!loaded) return [];
    const down = rooms.filter(r => !r.available);
    if (down.length === 0) return [];
    return [{
        level: 'alert',
        count: down.length,
        title: down.length === 1 ? `${down[0].name} is unavailable` : `${plural(down.length, 'thermostat')} unavailable`,
    }];
}
