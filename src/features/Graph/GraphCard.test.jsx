import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GraphCard from './GraphCard';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const requestBodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
const DAY = 86400000;
const start = new Date(2026, 9, 19).getTime();

/** Graph data as the server sends it. */
const lineData = (range = '24h') => ({
    chart: 'line', range, minutes: 60, end: start + 4 * 3600000,
    times: [0, 1, 2, 3].map(h => start + h * 3600000),
    series: [
        { entity_id: 'sensor.in', name: 'Inside', unit: '°C', color: null, kind: 'mean', current: 21.4, values: [20, 21, null, 21.5] },
        { entity_id: 'sensor.out', name: 'Outside', unit: '°C', color: 'teal', kind: 'mean', current: 8, values: [7, 8, 9, 8] },
    ],
});
const weekData = (units = ['kWh', 'kWh']) => ({
    chart: 'week', range: '14d', minutes: 1440, end: start + 14 * DAY,
    times: Array.from({ length: 14 }, (_, i) => start + i * DAY),
    series: units.map((unit, k) => ({
        entity_id: `sensor.m${k}`, name: `Meter ${k}`, unit, color: null, kind: 'change', current: null,
        values: Array.from({ length: 14 }, (_, i) => (i < 7 ? 1 : 2) + k),
    })),
});

describe('Graph card', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        // Give charts a size, which jsdom doesn't measure
        vi.stubGlobal('ResizeObserver', class {
            constructor(cb) { this.cb = cb; }
            observe() { this.cb([{ contentRect: { width: 300, height: 200 } }]); }
            disconnect() {}
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('draws lines, switches the range and hides sensors', async () => {
        fetch.mockImplementation(async (_url, init) => jsonResponse(lineData(JSON.parse(init.body).range)));
        render(<GraphCard config={{ id: 'g', title: 'Temperatures', entities: ['sensor.in', 'sensor.out'] }} />);

        expect(await screen.findByText('Inside 21.4°C · Outside 8.0°C')).toBeInTheDocument();
        expect(requestBodies()[0]).toEqual({ service: 'homeassistant', endpoint: 'graph', card_id: 'g', range: '24h' });

        fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
        await waitFor(() => expect(requestBodies().at(-1)).toMatchObject({ range: '7d' }));
        expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');

        // Read values with the keyboard: the last point first
        const chart = screen.getByRole('group', { name: /Line chart of Inside, Outside/ });
        fireEvent.keyDown(chart, { key: 'ArrowLeft' });
        const tip = screen.getByRole('status');
        expect(tip).toHaveTextContent('Inside–');
        expect(tip).toHaveTextContent('Outside9.0°C');

        const sensors = within(screen.getByRole('group', { name: 'Sensors' }));
        fireEvent.click(sensors.getByRole('button', { name: /Outside/ }));
        expect(sensors.getByRole('button', { name: /Outside/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('group', { name: /Line chart of Inside\./ })).toBeInTheDocument();
        // The last visible sensor can't be hidden
        fireEvent.click(sensors.getByRole('button', { name: /Inside/ }));
        expect(sensors.getByRole('button', { name: /Inside/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('moves the time range above the chart on narrow cards', async () => {
        vi.stubGlobal('ResizeObserver', class {
            constructor(cb) { this.cb = cb; }
            observe() { this.cb([{ contentRect: { width: 250, height: 200 } }]); }
            disconnect() {}
        });
        fetch.mockResolvedValue(jsonResponse(lineData()));
        const { container } = render(<GraphCard config={{ id: 'g', entities: ['sensor.in'] }} />);
        await screen.findByRole('group', { name: /Line chart/ });
        expect(container.querySelector('.graph-body > .graph-seg')).toBeInTheDocument();
        expect(container.querySelector('.two-tone-header .graph-seg')).not.toBeInTheDocument();
        // Fewer time labels where five don't fit
        expect(container.querySelector('.graph-xlabs').children).toHaveLength(4);
    });

    it('names a fixed range instead of the selector', async () => {
        fetch.mockResolvedValue(jsonResponse(lineData()));
        render(<GraphCard config={{ id: 'g', ranges: false, range: '24h', entities: ['sensor.in'], colSpan: 2 }} />);
        expect(await screen.findByText('Last 24 hours')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Time range' })).not.toBeInTheDocument();
        // Two wide: a sensor list with current values
        expect(screen.getByRole('button', { name: /Inside\s*21.4°C/ })).toBeInTheDocument();
    });

    it('compares weeks with a breakdown and part tooltips', async () => {
        fetch.mockResolvedValue(jsonResponse(weekData()));
        const { container } = render(<GraphCard config={{ id: 'w', chart: 'week', colSpan: 2, entities: ['sensor.m0', 'sensor.m1'] }} />);

        expect(await screen.findByText('This week 35.0 kWh · +67% vs last')).toBeInTheDocument();
        expect(screen.getByText('5.0 kWh')).toBeInTheDocument();
        expect(requestBodies()[0]).toEqual({ service: 'homeassistant', endpoint: 'graph', card_id: 'w' });
        expect(container.querySelectorAll('.graph-breakdown-row')).toHaveLength(2);

        fireEvent.pointerOver(container.querySelector('[data-day="2"] [data-part="1"]'), { pointerType: 'mouse' });
        expect(screen.getByRole('status')).toHaveTextContent(/Meter 1\s*2.0 kWh/);
        expect(screen.getByRole('status')).toHaveTextContent('67% of 3.0 kWh');

        fireEvent.click(container.querySelector('[data-day="2"]'));
        expect(container.querySelector('[data-day="2"]')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('3.0 kWh')).toBeInTheDocument();
    });

    it('hides the day breakdown when turned off', async () => {
        fetch.mockResolvedValue(jsonResponse(weekData()));
        const { container } = render(<GraphCard config={{ id: 'w', chart: 'week', colSpan: 2, breakdown: false, entities: ['sensor.m0', 'sensor.m1'] }} />);
        await screen.findByText('5.0 kWh');
        expect(container.querySelector('.graph-breakdown')).not.toBeInTheDocument();
    });

    it('switches between sensors with different units', async () => {
        fetch.mockResolvedValue(jsonResponse(weekData(['kWh', 'm³'])));
        render(<GraphCard config={{ id: 'w', chart: 'week', entities: ['sensor.m0', 'sensor.m1'] }} />);
        const switcher = within(await screen.findByRole('group', { name: 'Sensor' }));
        expect(screen.getByText(/This week 14.0 kWh/)).toBeInTheDocument();
        fireEvent.click(switcher.getByRole('button', { name: 'Meter 1' }));
        expect(screen.getByText(/This week 21.0 m³/)).toBeInTheDocument();
    });

    it('asks for sensors when there are none', () => {
        render(<GraphCard config={{ id: 'e' }} />);
        expect(screen.getByText('Add sensors in the card settings.')).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });
});
