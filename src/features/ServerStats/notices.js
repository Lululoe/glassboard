/**
 * What the Server Stats card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { usageLevel } from '../../components/Shared/usageLevel';

/** Temperature of a server from which it is reported, in °C, as the card colours it red. */
export const SERVER_TEMP_HIGH = 85;

/**
 * Server Stats: a host that runs hot or is running out of storage.
 * @param {Object} stats - The stats, as the card loads them.
 * @param {string[]} sensors - The rows the card shows; only those are reported.
 * @returns {Array<Object>} The notices.
 */
export function serverStatsNotices(stats, sensors) {
    const host = stats.info?.hostname || 'Server';
    const notices = [];
    const temp = stats.temp?.[stats.temp.length - 1];
    if (sensors.includes('temp') && Number.isFinite(temp) && temp >= SERVER_TEMP_HIGH) {
        notices.push({ level: 'alert', title: `${host} is running hot (${Math.round(temp)} °C)` });
    }
    const { used, total } = stats.storage || {};
    if (sensors.includes('storage') && total > 0 && usageLevel((used / total) * 100) === 'high') {
        notices.push({ level: 'alert', title: `${host} storage is ${Math.round((used / total) * 100)} % full` });
    }
    return notices;
}
