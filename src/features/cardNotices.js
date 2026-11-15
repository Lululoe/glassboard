/**
 * What each card reports to the sidebar through `useCardNotice`: plain functions from the data
 * a card already shows to its notices, so the rules can be tested without rendering the cards.
 * Every function returns a list, which is empty when there is nothing to tell.
 */
import { consumableLevel } from './Vacuum/vacuumModel';
import { statusInfo, stageText } from './Printer/printerModel';
import { usageLevel } from '../components/Shared/usageLevel';

/** Temperature of a server from which it is reported, in °C, as the card colours it red. */
export const SERVER_TEMP_HIGH = 85;

/**
 * Names a number of things.
 * @param {number} n - How many.
 * @param {string} one - The word for one.
 * @param {string} [many] - The word for several; `one` with an `s` by default.
 * @returns {string} Such as `1 app` or `3 apps`.
 */
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Whether a Home Assistant state means the device can't be reached.
 * @param {Object|undefined} state - The entity's state.
 * @returns {boolean} True for missing, unavailable or unknown entities.
 */
const unreachable = (state) => !state || state.state === 'unavailable' || state.state === 'unknown';

/**
 * App Grid: apps that fail their status check.
 * @param {Array<Object>} apps - The card's apps.
 * @param {Array<boolean|null>} statuses - Whether each app answered; null when not checked.
 * @returns {Array<Object>} The notices.
 */
export function appGridNotices(apps, statuses) {
    const offline = apps.filter((app, i) => statuses[i] === false && app?.statusCheck !== false);
    if (offline.length === 0) return [];
    return [{
        level: 'alert',
        count: offline.length,
        title: offline.length === 1 ? `${offline[0].name || 'An app'} is offline` : `${plural(offline.length, 'app')} offline`,
    }];
}

/**
 * Pull Requests: open pull requests that wait for review. Drafts are still being worked on.
 * @param {Array<Object>} prs - The pull requests the card shows.
 * @returns {Array<Object>} The notices.
 */
export function gitNotices(prs) {
    const open = prs.filter(pr => pr.state === 'open');
    if (open.length === 0) return [];
    return [{ level: 'todo', count: open.length, title: `${plural(open.length, 'open pull request')}` }];
}

/**
 * Vacuum and Multiple Vacuums: robots with an error, parts that need replacing, and robots
 * that are cleaning.
 * @param {Array<Object>} robots - The robots, as the vacuum cards load them.
 * @returns {Array<Object>} The notices.
 */
export function vacuumNotices(robots) {
    const notices = [];
    robots.forEach((robot) => {
        if (robot.state === 'error') {
            const reason = robot.stats?.find(s => /error/i.test(String(s.name)) && s.value && !/^no.error$/i.test(String(s.value)));
            notices.push({ level: 'alert', title: `${robot.name} has a problem${reason ? `: ${reason.value}` : ''}` });
        }
        const worn = (robot.consumables || []).filter(c => consumableLevel(c).level !== 'ok');
        if (worn.length > 0) {
            notices.push({
                level: 'todo',
                count: worn.length,
                title: worn.length === 1
                    ? `${robot.name}: ${worn[0].name} needs replacing`
                    : `${robot.name}: ${plural(worn.length, 'part')} need replacing`,
            });
        }
        if (robot.state === 'cleaning' || robot.state === 'returning') {
            notices.push({ level: 'activity', title: `${robot.name} is ${robot.state === 'cleaning' ? 'cleaning' : 'returning to its dock'}` });
        }
    });
    return notices;
}

/**
 * 3D Printer: a print that failed or stopped on an error, one that is paused, and one that is
 * running. A finished print isn't reported: the printer stays "finished" until the next print,
 * so the notice would never go away.
 * @param {Object|null} printer - The printer, as the card loads it.
 * @returns {Array<Object>} The notices.
 */
export function printerNotices(printer) {
    if (!printer) return [];
    const { kind } = statusInfo(printer.status);
    const name = printer.name || 'Printer';
    const job = printer.job ? ` ${printer.job}` : '';
    // Pauses the printer makes itself, such as running out of filament, need a hand
    const stoppedByPrinter = kind === 'paused' && /^paused_/.test(printer.stage || '') && printer.stage !== 'paused_user';
    if (kind === 'failed' || stoppedByPrinter || (printer.error && kind !== 'idle' && kind !== 'finished')) {
        const reason = printer.error || stageText(printer.stage) || (kind === 'failed' ? 'Print failed' : '');
        return [{ level: 'alert', title: `${name}: ${reason || 'Print stopped'}` }];
    }
    if (kind === 'paused') return [{ level: 'todo', title: `${name}: print paused` }];
    if (kind === 'running') {
        const progress = Number.isFinite(printer.progress) ? ` · ${Math.round(printer.progress)} %` : '';
        return [{ level: 'activity', title: `${name}: printing${job}${progress}` }];
    }
    return [];
}

/**
 * Transmission: torrents with an error, stalled ones, and downloads in progress. A server that
 * can't be reached is an alert of its own.
 * @param {Array<Object>} torrents - The torrents, with their simplified `state`.
 * @param {string|null} [error] - Why loading failed.
 * @returns {Array<Object>} The notices.
 */
export function transmissionNotices(torrents, error = null) {
    if (error) return [{ level: 'alert', title: "Can't reach Transmission" }];
    const count = (state) => torrents.filter(t => t.state === state).length;
    const failed = count('error');
    const stalled = count('stalled');
    const downloading = count('downloading');
    return [
        failed > 0 && { level: 'alert', count: failed, title: `${plural(failed, 'torrent')} with an error` },
        stalled > 0 && { level: 'todo', count: stalled, title: `${plural(stalled, 'torrent')} stalled` },
        downloading > 0 && { level: 'activity', count: downloading, title: `${plural(downloading, 'download')} in progress` },
    ].filter(Boolean);
}

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

/**
 * Proxmox: the host can't be reached. Stopped guests are not reported, as many are stopped on
 * purpose.
 * @param {string|null} error - Why loading failed.
 * @returns {Array<Object>} The notices.
 */
export function proxmoxNotices(error) {
    return error ? [{ level: 'alert', title: "Can't reach Proxmox" }] : [];
}

/**
 * Media Calendar: episodes and films that have come out but haven't been downloaded.
 * @param {Array<Object>} events - The calendar's events, with their `status`.
 * @returns {Array<Object>} The notices.
 */
export function mediaNotices(events) {
    const missing = events.filter(e => e.status === 'missing');
    if (missing.length === 0) return [];
    return [{
        level: 'todo',
        count: missing.length,
        title: missing.length === 1 ? `${missing[0].title} is missing` : `${plural(missing.length, 'release')} missing`,
    }];
}

/**
 * HA Control: a device that can't be reached, and a lock that is unlocked. Lights and switches
 * that are on are left alone.
 * @param {Array<Object>} entities - The card's entities (`entity_id`, `name`).
 * @param {Object<string, Object>} states - Their states by entity id.
 * @param {boolean} loaded - Whether the states have loaded, so a slow start isn't reported.
 * @returns {Array<Object>} The notices.
 */
export function haControlNotices(entities, states, loaded) {
    if (!loaded) return [];
    return entities.flatMap((entity) => {
        const state = states[entity.entity_id];
        const name = entity.name || state?.attributes?.friendly_name || entity.entity_id;
        if (unreachable(state)) return [{ level: 'alert', title: `${name} is unavailable` }];
        if (entity.entity_id.startsWith('lock.') && ['unlocked', 'open', 'opening'].includes(state.state)) {
            return [{ level: 'todo', title: `${name} is ${state.state === 'unlocked' ? 'unlocked' : 'open'}` }];
        }
        return [];
    });
}

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
