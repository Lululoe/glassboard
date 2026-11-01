// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setConfig } from '../config.js';
import { getValidEntityIds, handleHaRequest } from './homeassistant.js';
import { printerSettings } from './haPrinter.js';

const CARD = { id: 'p', type: 'printer', printer: 'p2s' };

const STATES = {
    'sensor.p2s_print_status': { state: 'running', attributes: {}, last_changed: '2026-11-01T14:00:00+00:00' },
    'sensor.p2s_current_stage': { state: 'printing', attributes: {} },
    'sensor.p2s_task_name': { state: 'Holder', attributes: {} },
    'sensor.p2s_print_progress': { state: '51', attributes: { unit_of_measurement: '%' } },
    'sensor.p2s_current_layer': { state: '231', attributes: {} },
    'sensor.p2s_total_layer_count': { state: '451', attributes: {} },
    'sensor.p2s_remaining_time': { state: '4.2', attributes: { unit_of_measurement: 'h' } },
    'sensor.p2s_end_time': { state: '2026-11-01T21:04:00+00:00', attributes: {} },
    'sensor.p2s_print_weight': { state: '186.42', attributes: {} },
    'sensor.p2s_print_length': { state: '62.5', attributes: {} },
    'sensor.p2s_nozzle_temperature': { state: '220', attributes: {} },
    'sensor.p2s_nozzle_target_temperature': { state: '220', attributes: {} },
    'sensor.p2s_bed_temperature': { state: '55', attributes: {} },
    'sensor.p2s_bed_target_temperature': { state: '55', attributes: {} },
    'sensor.p2s_chamber_temperature': { state: 'unavailable', attributes: {} },
    'sensor.p2s_printer_name': { state: 'Workshop', attributes: {} },
    'binary_sensor.p2s_online': { state: 'on', attributes: {} },
    'light.p2s_chamber_light': { state: 'off', attributes: {} },
    'button.p2s_pause': { state: 'unknown', attributes: {} },
    'button.p2s_resume': { state: 'unavailable', attributes: {} },
    'button.p2s_stop_printing': { state: '2026-11-01T10:00:00+00:00', attributes: {} },
    'sensor.ams_humidity': { state: '43', attributes: {} },
    'sensor.ams_tray_1': { state: 'Generic PLA', attributes: { friendly_name: 'AMS Tray 1', color: '#AF7933FF', active: true, empty: false } },
    'sensor.ams_tray_2': { state: 'Generic PLA', attributes: { friendly_name: 'AMS Tray 2', color: 'red;', empty: true } },
    'sensor.external_spool_external_spool': { state: 'Generic TPU', attributes: { color: '#FFFFFFFF', empty: true } },
};

/** Answers Home Assistant's API from a table of states; unknown entities are 404s. */
const homeAssistant = (states) => fetch.mockImplementation(async (url) => {
    const match = String(url).match(/\/api\/states\/(.+)$/);
    if (!match) return { ok: true, status: 200, json: async () => [], text: async () => '' };
    const state = states[decodeURIComponent(match[1])];
    return state
        ? { ok: true, status: 200, json: async () => state, text: async () => '' }
        : { ok: false, status: 404, json: async () => ({}), text: async () => 'Not found' };
});

const posted = () => fetch.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => [String(url).split('/api')[1], JSON.parse(init.body)]);

describe('printer service', () => {
    beforeEach(() => {
        vi.stubEnv('HA_URL', 'http://ha.test');
        vi.stubEnv('HA_TOKEN', 'token');
        vi.stubGlobal('fetch', vi.fn());
        setConfig({ pages: [{ cards: [CARD, { id: 'other', type: 'graph', entities: [] }] }] });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('leaves out invalid settings', () => {
        expect(printerSettings({ printer: 'P2S; drop' }).printer).toBeNull();
        expect(printerSettings({ printer: 'p2s' }).ams).toBe('ams');
        expect(printerSettings({ printer: 'p2s', ams: '' }).ams).toBeNull();
        expect(printerSettings({ trays: ['sensor.a', { entity_id: 'sensor.b' }, 'nope', {}] }).trays).toEqual(['sensor.a', 'sensor.b']);
    });

    it('allows the entities of its printer to be read', () => {
        const ids = getValidEntityIds();
        expect(ids.has('sensor.p2s_print_status')).toBe(true);
        expect(ids.has('button.p2s_pause')).toBe(true);
        expect(ids.has('sensor.ams_tray_4')).toBe(true);
    });

    it('loads the printer, with missing entities left empty', async () => {
        homeAssistant(STATES);
        const printer = await handleHaRequest({ endpoint: 'printer', card_id: 'p' });

        expect(printer).toMatchObject({
            name: 'Workshop',
            status: 'running',
            job: 'Holder',
            progress: 51,
            layer: 231,
            totalLayers: 451,
            remaining: 252,
            nozzle: { value: 220, target: 220 },
            chamber: null,
            humidity: 43,
            light: 'off',
        });
    });

    it('offers only the buttons the printer has', async () => {
        homeAssistant(STATES);
        const { controls } = await handleHaRequest({ endpoint: 'printer', card_id: 'p' });
        expect(controls).toEqual({ pause: true, resume: false, stop: true });

        const none = { ...STATES };
        delete none['button.p2s_stop_printing'];
        homeAssistant(none);
        await expect(handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'stop' })).rejects.toMatchObject({ status: 409 });
    });

    it('lists spools, keeping safe colours and an external spool only when loaded', async () => {
        homeAssistant(STATES);
        let { spools } = await handleHaRequest({ endpoint: 'printer', card_id: 'p' });
        expect(spools.map(s => s.entity_id)).toEqual(['sensor.ams_tray_1', 'sensor.ams_tray_2', 'sensor.ams_tray_3', 'sensor.ams_tray_4']);
        expect(spools[0]).toMatchObject({ slot: 'AMS Tray 1', name: 'Generic PLA', color: '#AF7933FF', active: true, empty: false });
        expect(spools[1]).toMatchObject({ color: null, empty: true });
        expect(spools[2]).toMatchObject({ name: null, empty: true });

        homeAssistant({ ...STATES, 'sensor.external_spool_external_spool': { state: 'Generic TPU', attributes: { color: '#FFFFFFFF', empty: false } } });
        ({ spools } = await handleHaRequest({ endpoint: 'printer', card_id: 'p' }));
        expect(spools.at(-1).entity_id).toBe('sensor.external_spool_external_spool');
    });

    it('reads the time left in the unit the sensor reports', async () => {
        homeAssistant({ ...STATES, 'sensor.p2s_remaining_time': { state: '90', attributes: { unit_of_measurement: 'min' } } });
        expect((await handleHaRequest({ endpoint: 'printer', card_id: 'p' })).remaining).toBe(90);
    });

    it('is offline when the printer says so or has no status', async () => {
        homeAssistant({ ...STATES, 'binary_sensor.p2s_online': { state: 'off', attributes: {} } });
        expect((await handleHaRequest({ endpoint: 'printer', card_id: 'p' })).status).toBe('offline');
        homeAssistant({});
        expect(await handleHaRequest({ endpoint: 'printer', card_id: 'p' })).toMatchObject({ status: 'offline', name: 'P2S', light: null });
    });

    it('explains a failed print from the error sensors', async () => {
        homeAssistant({
            ...STATES,
            'binary_sensor.p2s_print_error': { state: 'on', attributes: { code: '1', error: 'Nozzle clog' } },
            'binary_sensor.p2s_hms_errors': { state: 'on', attributes: { Count: 1, '1-Error': 'Other' } },
        });
        expect((await handleHaRequest({ endpoint: 'printer', card_id: 'p' })).error).toBe('Nozzle clog');

        homeAssistant({ ...STATES, 'binary_sensor.p2s_hms_errors': { state: 'on', attributes: { Count: 1, '1-Code': 'HMS_1', '1-Error': 'Fan stalled' } } });
        expect((await handleHaRequest({ endpoint: 'printer', card_id: 'p' })).error).toBe('Fan stalled');
    });

    it('presses the printer\'s buttons, under either of their names', async () => {
        homeAssistant(STATES);
        await handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'pause' });
        await handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'stop' });
        expect(posted()).toEqual([
            ['/services/button/press', { entity_id: 'button.p2s_pause' }],
            ['/services/button/press', { entity_id: 'button.p2s_stop_printing' }],
        ]);
    });

    it('switches the chamber light', async () => {
        homeAssistant(STATES);
        await handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'light_on' });
        await handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'light_off' });
        expect(posted()).toEqual([
            ['/services/light/turn_on', { entity_id: 'light.p2s_chamber_light' }],
            ['/services/light/turn_off', { entity_id: 'light.p2s_chamber_light' }],
        ]);
    });

    it('refuses other cards and unknown actions', async () => {
        homeAssistant(STATES);
        await expect(handleHaRequest({ endpoint: 'printer', card_id: 'other' })).rejects.toMatchObject({ status: 403 });
        await expect(handleHaRequest({ endpoint: 'printer_action', card_id: 'other', action: 'stop' })).rejects.toMatchObject({ status: 403 });
        await expect(handleHaRequest({ endpoint: 'printer_action', card_id: 'p', action: 'constructor' })).rejects.toMatchObject({ status: 400 });
        expect(posted()).toEqual([]);
    });
});
