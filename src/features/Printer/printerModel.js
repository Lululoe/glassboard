const STATUS = {
    running: { kind: 'running', label: 'Printing' },
    prepare: { kind: 'running', label: 'Preparing' },
    slicing: { kind: 'running', label: 'Slicing' },
    init: { kind: 'running', label: 'Starting' },
    pause: { kind: 'paused', label: 'Paused' },
    failed: { kind: 'failed', label: 'Failed' },
    finish: { kind: 'finished', label: 'Finished' },
    idle: { kind: 'idle', label: 'Ready' },
};
const OFFLINE = { kind: 'offline', label: 'Offline' };
/** Stages that say nothing beyond the printer's status. */
const QUIET_STAGES = new Set(['idle', 'printing', 'unknown', 'offline', 'paused_user']);
const STAGE_NAMES = { paused_filament_runout: 'Filament ran out' };

/**
 * What a printer's status means for the card.
 * @param {string} status - The print status sensor's state.
 * @returns {{kind: string, label: string}} The kind (`running`, `paused`, `failed`, `finished`,
 *   `idle` or `offline`) and the text to show.
 */
export function statusInfo(status) {
    return Object.hasOwn(STATUS, status) ? STATUS[status] : OFFLINE;
}

/**
 * Formats a number of minutes.
 * @param {number|null} minutes - The minutes.
 * @returns {string} For example `4h 12m`, or an empty string when unknown.
 */
export function formatDuration(minutes) {
    if (minutes === null || minutes === undefined) return '';
    const total = Math.max(1, Math.round(minutes));
    const hours = Math.floor(total / 60);
    if (hours === 0) return `${total}m`;
    return total % 60 ? `${hours}h ${total % 60}m` : `${hours}h`;
}

/**
 * Formats a time, with the weekday when it isn't today.
 * @param {string|null} iso - An ISO timestamp.
 * @param {Date} [now] - The current time.
 * @returns {string} For example `22:04` or `Tue 09:30`, or an empty string when unknown.
 */
export function formatClock(iso, now = new Date()) {
    const date = new Date(iso || NaN);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (date.toDateString() === now.toDateString()) return time;
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

/**
 * Turns a stage from the printer into text.
 * @param {string|null} stage - The current stage sensor's state.
 * @returns {string} For example `Heatbed preheating`; empty when the stage adds nothing.
 */
export function stageText(stage) {
    if (!stage || QUIET_STAGES.has(stage)) return '';
    if (Object.hasOwn(STAGE_NAMES, stage)) return STAGE_NAMES[stage];
    const words = stage.replace(/^paused_/, '').replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Joins the parts of a line that are known.
 * @param {...(string|false|null|undefined)} parts - The parts.
 * @returns {string} The parts between dots.
 */
export const joinParts = (...parts) => parts.filter(Boolean).join(' · ');

/**
 * The print's progress as a whole percentage, for the bar.
 * @param {Object} printer - The printer.
 * @returns {number} 0 to 100: empty while idle or offline, full when finished.
 */
export function progressOf(printer) {
    const { kind } = statusInfo(printer.status);
    if (kind === 'idle' || kind === 'offline') return 0;
    if (kind === 'finished') return 100;
    return Math.min(100, Math.max(0, Math.round(printer.progress ?? 0)));
}

/**
 * The headline of the card and the two lines beside it.
 * @param {Object} printer - The printer.
 * @param {Date} [now] - The current time.
 * @returns {{big: string, time: string, detail: string}} The texts.
 */
export function readout(printer, now = new Date()) {
    const { kind } = statusInfo(printer.status);
    const percent = `${progressOf(printer)}%`;
    const left = formatDuration(printer.remaining);
    const stage = stageText(printer.stage);
    switch (kind) {
        case 'running': {
            const end = formatClock(printer.endTime, now);
            const preparing = printer.status !== 'running';
            return {
                big: percent,
                time: (preparing && stage) || (left ? `${left} left` : stage || 'Printing'),
                detail: end ? `Done at ${end}` : '',
            };
        }
        case 'paused':
            return { big: percent, time: stage || 'Paused', detail: left ? `${left} still to go` : '' };
        case 'failed': {
            const at = formatClock(printer.changedAt, now);
            return { big: percent, time: printer.error || stage || 'Print failed', detail: at ? `Stopped at ${at}` : '' };
        }
        case 'finished': {
            const at = formatClock(printer.endTime, now);
            return {
                big: '100%',
                time: at ? `Finished at ${at}` : 'Finished',
                detail: joinParts(printer.weight !== null && `${Math.round(printer.weight)} g`, printer.length !== null && `${printer.length} m`),
            };
        }
        case 'idle':
            return { big: 'Ready', time: 'Nothing printing', detail: printer.humidity !== null ? `AMS at ${printer.humidity}% humidity` : '' };
        default:
            return { big: 'Offline', time: "Can't reach the printer", detail: '' };
    }
}

/**
 * The accessible name of a spool.
 * @param {Object} spool - The spool.
 * @returns {string} For example `AMS Tray 1, Generic PLA, in use`.
 */
export const spoolLabel = (spool) => joinParts(spool.slot, spool.empty ? 'empty' : spool.name, spool.active && 'in use').replace(/ · /g, ', ');
