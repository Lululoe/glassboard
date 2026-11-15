// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setConfig } from '../config.js';
import { demoHandlers } from './demo.js';
import { handleHaRequest, resetTemplateCache } from './homeassistant.js';

const TEMPLATE = "{{ states('sensor.outside') }} °C";
const textResponse = (text) => ({ ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) });

describe('page header templates', () => {
    beforeEach(() => {
        resetTemplateCache();
        setConfig({
            services: { homeassistant: { url: 'http://ha.local/', token: 'tkn' } },
            pageHeader: { subtitle: { type: 'template', template: TEMPLATE } },
            pages: [{ id: 'home' }, { id: 'quiet', pageHeader: false }],
        });
        vi.stubGlobal('fetch', vi.fn(async () => textResponse('  12.5\n°C ')));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("renders the config's template through Home Assistant and returns plain text", async () => {
        const result = await handleHaRequest({ endpoint: 'template', page: 'home', line: 'subtitle' });
        expect(result).toEqual({ text: '12.5 °C' });
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('http://ha.local/api/template');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer tkn');
        expect(JSON.parse(init.body)).toEqual({ template: TEMPLATE });
    });

    it('never renders a template sent by the browser', async () => {
        await expect(handleHaRequest({ endpoint: 'template', page: 'home', line: 'title', template: '{{ 1 }}' }))
            .rejects.toMatchObject({ status: 404 });
        await expect(handleHaRequest({ endpoint: 'template', page: 'quiet', line: 'subtitle' }))
            .rejects.toMatchObject({ status: 404 });
        await expect(handleHaRequest({ endpoint: 'template', page: 'nope', line: 'subtitle' }))
            .rejects.toMatchObject({ status: 404 });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('renders a template at most once every 10 seconds, however many browsers ask', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const ask = () => handleHaRequest({ endpoint: 'template', page: 'home', line: 'subtitle' });
        await Promise.all([ask(), ask(), ask()]);
        await ask();
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(10_001);
        await ask();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('passes on Home Assistant errors and tries again on the next request', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request', text: async () => 'TemplateError', json: async () => ({}) });
        await expect(handleHaRequest({ endpoint: 'template', page: 'home', line: 'subtitle' })).rejects.toBeTruthy();
        await expect(handleHaRequest({ endpoint: 'template', page: 'home', line: 'subtitle' })).resolves.toEqual({ text: '12.5 °C' });
    });

    it('simulates templates in demo mode without calling Home Assistant', async () => {
        const result = await demoHandlers.homeassistant({ endpoint: 'template', page: 'home', line: 'subtitle' });
        expect(result.text).toMatch(/^\d+(\.\d)? °C$/);
        expect(fetch).not.toHaveBeenCalled();
    });
});
