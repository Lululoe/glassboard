import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrinterCard from './PrinterCard';
import PrinterEditor from './PrinterEditor';
import { cardInfo, getCardComponent } from '../registry';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const actions = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body)).filter(b => b.endpoint === 'printer_action').map(b => b.action);

const printer = (over = {}) => ({
    name: 'P2S', status: 'running', stage: 'printing', job: 'Headphone Holder', progress: 51, layer: 231, totalLayers: 451,
    remaining: 252, endTime: null, changedAt: null, weight: 186, length: 62.5, error: null,
    nozzle: { value: 220, target: 220 }, bed: { value: 55, target: 55 }, chamber: 38, humidity: 43,
    spools: [
        { entity_id: 'sensor.ams_tray_1', slot: 'AMS Tray 1', name: 'Generic PLA', color: '#AF7933FF', active: true, empty: false },
        { entity_id: 'sensor.ams_tray_2', slot: 'AMS Tray 2', name: null, color: null, active: false, empty: true },
    ],
    controls: { pause: true, resume: true, stop: true },
    light: 'off',
    ...over,
});

const backend = (data) => fetch.mockImplementation(async (_u, init) => (JSON.parse(init.body).endpoint === 'printer' ? jsonResponse(data) : jsonResponse([])));
const CONFIG = { id: 'p', printer: 'p2s' };

describe('Printer card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('is registered with half and one wide sizes', () => {
        expect(getCardComponent('printer')).toBe(PrinterCard);
        expect(cardInfo.printer.sizes).toEqual(['half', '1']);
    });

    it('asks for a printer until one is set', () => {
        render(<PrinterCard config={{ id: 'p' }} />);
        expect(screen.getByText('Choose a printer in the card settings.')).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('shows progress, temperatures, layers and spools', async () => {
        backend(printer());
        render(<PrinterCard config={CONFIG} />);

        expect(await screen.findByText('51%')).toBeInTheDocument();
        expect(screen.getByText('P2S')).toBeInTheDocument();
        expect(screen.getByText('Printing')).toBeInTheDocument();
        expect(screen.getByText('Headphone Holder')).toBeInTheDocument();
        expect(screen.getByText('4h 12m left')).toBeInTheDocument();
        expect(screen.getByText('Nozzle / 220°')).toBeInTheDocument();
        expect(screen.getByText('Chamber')).toBeInTheDocument();
        expect(screen.getByText('Layer 231 of 451')).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Print progress' })).toHaveAttribute('aria-valuenow', '51');
        expect(screen.getByRole('img', { name: 'AMS Tray 1, Generic PLA, in use' }).style.getPropertyValue('--spool')).toBe('#AF7933FF');
        expect(screen.getByRole('img', { name: 'AMS Tray 2, empty' })).toHaveClass('empty');
    });

    it('shows 100% when finished', async () => {
        backend(printer({ status: 'finish', progress: 100 }));
        render(<PrinterCard config={CONFIG} />);
        expect(await screen.findByText('100%')).toBeInTheDocument();
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });

    it.each([[{}], [{ tileSize: 'half' }]])('keeps an empty, grey progress bar while idle (%j)', async (size) => {
        backend(printer({ status: 'idle', progress: 100 }));
        render(<PrinterCard config={{ ...CONFIG, ...size }} />);
        expect(await screen.findByText('Ready', { selector: size.tileSize ? 'b' : '.printer-big' })).toBeInTheDocument();

        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '0');
        expect(bar.querySelector('i')).toHaveStyle({ width: '0%' });
    });

    it('fits the same parts on fewer lines at half height, with the job in the header', async () => {
        backend(printer());
        render(<PrinterCard config={{ ...CONFIG, tileSize: 'half' }} />);

        expect(await screen.findByText('Printing · Headphone Holder')).toBeInTheDocument();
        expect(screen.getByText('51%')).toBeInTheDocument();
        expect(screen.getByText('Nozzle 220° · Bed 55° · Chamber 38°')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'AMS Tray 1, Generic PLA, in use' })).toBeInTheDocument();
    });

    it('hides the buttons the printer does not have', async () => {
        backend(printer({ controls: { pause: false, resume: false, stop: false }, light: null }));
        render(<PrinterCard config={CONFIG} />);
        await screen.findByText('51%');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('only offers pause and stop while a print is in progress', async () => {
        backend(printer({ status: 'idle' }));
        render(<PrinterCard config={CONFIG} />);
        await screen.findByRole('button', { name: 'Turn chamber light on' });
        expect(screen.queryByRole('button', { name: 'Pause print' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Stop print' })).not.toBeInTheDocument();
    });

    it('pauses and resumes, showing the change at once', async () => {
        backend(printer());
        render(<PrinterCard config={CONFIG} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Pause print' }));

        expect(await screen.findByText('Paused', { selector: '.printer-status' })).toBeInTheDocument();
        await waitFor(() => expect(actions()).toEqual(['pause']));

        fireEvent.click(screen.getByRole('button', { name: 'Resume print' }));
        await waitFor(() => expect(actions()).toEqual(['pause', 'resume']));
    });

    it('stops only after a second tap', async () => {
        backend(printer());
        render(<PrinterCard config={CONFIG} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Stop print' }));
        expect(actions()).toEqual([]);

        fireEvent.click(screen.getByRole('button', { name: 'Confirm stopping the print' }));
        await waitFor(() => expect(actions()).toEqual(['stop']));
    });

    it('forgets the stop request after a moment', async () => {
        backend(printer());
        render(<PrinterCard config={CONFIG} />);
        const stop = await screen.findByRole('button', { name: 'Stop print' });

        vi.useFakeTimers();
        fireEvent.click(stop);
        expect(screen.getByRole('button', { name: 'Confirm stopping the print' })).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(3000); });
        expect(screen.getByRole('button', { name: 'Stop print' })).toBeInTheDocument();
        expect(actions()).toEqual([]);
    });

    it('switches the chamber light', async () => {
        backend(printer());
        render(<PrinterCard config={CONFIG} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Turn chamber light on' }));

        expect(await screen.findByRole('button', { name: 'Turn chamber light off' })).toHaveAttribute('aria-pressed', 'true');
        await waitFor(() => expect(actions()).toEqual(['light_on']));
    });

    it('goes back when an action fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetch.mockImplementation(async (_u, init) => (JSON.parse(init.body).endpoint === 'printer'
            ? jsonResponse(printer())
            : { ok: false, status: 409, json: async () => ({ error: 'No button' }) }));
        render(<PrinterCard config={CONFIG} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Pause print' }));

        expect(await screen.findByRole('button', { name: 'Pause print' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Printing')).toBeInTheDocument());
    });

    it('edits the printer and its AMS', () => {
        const onChange = vi.fn();
        render(<PrinterEditor config={{ id: 'p', type: 'printer' }} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Printer'), { target: { value: 'p2s' } });
        expect(onChange).toHaveBeenCalledWith({ id: 'p', type: 'printer', printer: 'p2s' });
        expect(screen.getByLabelText('AMS')).toHaveAttribute('placeholder', 'ams');
    });
});
