import { describe, it, expect } from 'vitest';
import { canDock, canStop, consumableLevel, consumableText, formatValue, roomOfSegment, statusText, wideLayout } from './vacuumModel';

describe('vacuum model', () => {
    it('writes values in the units people expect', () => {
        expect(formatValue('720', 's')).toBe('12 min');
        expect(formatValue('30', 's')).toBe('30 s');
        expect(formatValue('8160', 'min')).toBe('136 h');
        expect(formatValue('45', 'min')).toBe('45 min');
        expect(formatValue('328200', 's')).toBe('91.2 h');
        expect(formatValue('90000', 'cm²')).toBe('9 m²');
        expect(formatValue('78', '%')).toBe('78%');
        expect(formatValue('298', '')).toBe('298');
        expect(formatValue('no_error')).toBe('No error');
        expect(formatValue(null)).toBe('–');
        expect(formatValue('unavailable', '%')).toBe('–');
    });

    it('fills a consumable bar from its percentage, or while the sensor is not zero', () => {
        expect(consumableLevel({ value: '100', percent: 50 })).toEqual({ width: 50, level: 'ok' });
        expect(consumableLevel({ value: '100', percent: 15 })).toEqual({ width: 15, level: 'low' });
        expect(consumableLevel({ value: '100', percent: 5 })).toEqual({ width: 5, level: 'empty' });
        expect(consumableLevel({ value: '8160', percent: null })).toEqual({ width: 100, level: 'ok' });
        expect(consumableLevel({ value: 'ok', percent: null })).toEqual({ width: 100, level: 'ok' });
        expect(consumableLevel({ value: '0', percent: null })).toEqual({ width: 0, level: 'empty' });
        expect(consumableLevel({ value: null, percent: null })).toEqual({ width: 0, level: 'empty' });
    });

    it('lists a percentage once when it is also the value', () => {
        expect(consumableText({ value: '100', unit: '%', percent: 100 })).toBe('100%');
        expect(consumableText({ value: '100', unit: '', percent: 100 })).toBe('100%');
        expect(consumableText({ value: '8160', unit: 'min', percent: 15 })).toBe('136 h · 15%');
        expect(consumableText({ value: '8160', unit: 'min', percent: null })).toBe('136 h');
    });

    it('shares the columns of wide cards between sections', () => {
        const robot = { map: 'camera.m', stats: [{}], consumables: [{}] };
        const all = { show_map: true, show_stats: true, show_consumables: true };
        expect(wideLayout({ ...all, colSpan: 1 }, robot).columns).toEqual([]);
        expect(wideLayout({ colSpan: 3 }, robot).columns).toEqual([]);
        expect(wideLayout({ show_stats: true, colSpan: 2 }, robot)).toEqual({ columns: [['stats']], tabs: false });
        expect(wideLayout({ ...all, colSpan: 2 }, robot)).toEqual({ columns: [['map', 'stats', 'consumables']], tabs: true });
        expect(wideLayout({ show_map: true, show_stats: true, colSpan: 3 }, robot)).toEqual({ columns: [['map'], ['stats']], tabs: false });
        expect(wideLayout({ ...all, colSpan: 3 }, robot)).toEqual({ columns: [['map'], ['stats', 'consumables']], tabs: false });
        // A section without content is left out
        expect(wideLayout({ ...all, colSpan: 2 }, { map: null, stats: [], consumables: [{}] })).toEqual({ columns: [['consumables']], tabs: false });
    });

    it('matches map segments to rooms by id, else by name', () => {
        const rooms = [{ name: 'Living', segment: '5', area: 'a' }, { name: 'Kitchen', segment: null, area: 'b' }];
        expect(roomOfSegment({ id: '5', name: 'Whatever' }, rooms).area).toBe('a');
        expect(roomOfSegment({ id: '1', name: 'kitchen' }, rooms).area).toBe('b');
        expect(roomOfSegment({ id: '2', name: 'Hall' }, rooms)).toBeUndefined();
        expect(roomOfSegment({ id: '2', name: '' }, rooms)).toBeUndefined();
    });

    it('describes states', () => {
        expect(statusText({ state: 'docked', battery: 77.6 })).toBe('Docked · 78%');
        expect(statusText({ state: 'docked', battery: null })).toBe('Docked');
        expect(statusText({ state: 'idle' })).toBe('Stopped');
        expect(statusText({ state: 'some_new_state' })).toBe('Some new state');
        expect([canStop({ state: 'docked' }), canStop({ state: 'cleaning' }), canDock({ state: 'returning' }), canDock({ state: 'idle' })]).toEqual([false, true, false, true]);
    });
});
