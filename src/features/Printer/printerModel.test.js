import { describe, it, expect } from 'vitest';
import { formatClock, formatDuration, progressOf, readout, spoolLabel, stageText, statusInfo } from './printerModel';

const NOW = new Date(2026, 10, 1, 18, 0);
const at = (day, hour, minute) => new Date(2026, 10, day, hour, minute).toISOString();
const printer = (over = {}) => ({
    status: 'running', stage: 'printing', progress: 51, remaining: 252, endTime: at(1, 22, 4), changedAt: at(1, 17, 32),
    weight: 186.42, length: 62.5, error: null, humidity: 43, ...over,
});

describe('printer model', () => {
    it('sorts the print statuses', () => {
        expect(statusInfo('running')).toEqual({ kind: 'running', label: 'Printing' });
        expect(statusInfo('prepare')).toEqual({ kind: 'running', label: 'Preparing' });
        expect(statusInfo('finish').kind).toBe('finished');
        expect(statusInfo('unknown')).toEqual({ kind: 'offline', label: 'Offline' });
        expect(statusInfo('constructor').kind).toBe('offline');
    });

    it('writes durations and times', () => {
        expect(formatDuration(252)).toBe('4h 12m');
        expect(formatDuration(120)).toBe('2h');
        expect(formatDuration(12)).toBe('12m');
        expect(formatDuration(0)).toBe('1m');
        expect(formatDuration(null)).toBe('');
        expect(formatClock(at(1, 22, 4), NOW)).toBe('22:04');
        expect(formatClock(at(3, 9, 30), NOW)).toBe('Tue 09:30');
        expect(formatClock('unknown', NOW)).toBe('');
    });

    it('turns stages into text', () => {
        expect(stageText('heatbed_preheating')).toBe('Heatbed preheating');
        expect(stageText('paused_nozzle_clog')).toBe('Nozzle clog');
        expect(stageText('paused_filament_runout')).toBe('Filament ran out');
        expect(stageText('paused_user')).toBe('');
        expect(stageText('printing')).toBe('');
        expect(stageText(null)).toBe('');
    });

    it('keeps the bar empty when idle and full when finished, whatever the sensor says', () => {
        expect(progressOf(printer())).toBe(51);
        expect(progressOf(printer({ status: 'idle', progress: 100 }))).toBe(0);
        expect(progressOf(printer({ status: 'offline', progress: 80 }))).toBe(0);
        expect(progressOf(printer({ status: 'finish', progress: 0 }))).toBe(100);
        expect(progressOf(printer({ progress: null }))).toBe(0);
    });

    it('writes the readout for each state', () => {
        expect(readout(printer(), NOW)).toEqual({ big: '51%', time: '4h 12m left', detail: 'Done at 22:04' });
        expect(readout(printer({ status: 'prepare', stage: 'heatbed_preheating', progress: 0 }), NOW).time).toBe('Heatbed preheating');
        expect(readout(printer({ status: 'pause', stage: 'paused_filament_runout' }), NOW))
            .toEqual({ big: '51%', time: 'Filament ran out', detail: '4h 12m still to go' });
        expect(readout(printer({ status: 'pause', stage: 'paused_user' }), NOW).time).toBe('Paused');
        expect(readout(printer({ status: 'failed', stage: 'idle', error: 'Nozzle clog' }), NOW))
            .toEqual({ big: '51%', time: 'Nozzle clog', detail: 'Stopped at 17:32' });
        expect(readout(printer({ status: 'failed', stage: 'idle' }), NOW).time).toBe('Print failed');
        expect(readout(printer({ status: 'finish', progress: 100, endTime: at(1, 16, 13) }), NOW))
            .toEqual({ big: '100%', time: 'Finished at 16:13', detail: '186 g · 62.5 m' });
        expect(readout(printer({ status: 'idle' }), NOW))
            .toEqual({ big: 'Ready', time: 'Nothing printing', detail: 'AMS at 43% humidity' });
        expect(readout(printer({ status: 'idle', humidity: null }), NOW).detail).toBe('');
        expect(readout(printer({ status: 'offline' }), NOW).big).toBe('Offline');
    });

    it('names spools', () => {
        expect(spoolLabel({ slot: 'AMS Tray 1', name: 'Generic PLA', active: true, empty: false })).toBe('AMS Tray 1, Generic PLA, in use');
        expect(spoolLabel({ slot: 'AMS Tray 2', name: null, active: false, empty: true })).toBe('AMS Tray 2, empty');
    });
});
