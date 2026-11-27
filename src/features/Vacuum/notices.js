/**
 * What the Vacuum card reports to the sidebar through `useCardNotice`: a plain function from
 * the data the card already shows to its notices, so the rules can be tested without rendering it.
 * It returns a list, which is empty when there is nothing to tell.
 */
import { consumableLevel } from './vacuumModel';
import { plural } from '../../lib/format';

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
