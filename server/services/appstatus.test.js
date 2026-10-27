// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetch } from 'undici';
import { setConfig } from '../config.js';
import { handleAppStatusRequest } from './appstatus.js';

vi.mock('undici', () => ({
    Agent: vi.fn(),
    fetch: vi.fn(),
}));

describe('appstatus service', () => {
    beforeEach(() => {
        fetch.mockReset();
        setConfig({
            launcher: { apps: [{ name: 'L', url: 'http://launcher.local' }] },
            pages: [{
                cards: [
                    {
                        id: 'apps', type: 'appgrid', data: {
                            apps: [
                                { name: 'Up', url: 'http://up.local' },
                                { name: 'Down', url: 'http://down.local' },
                                { name: 'Error', url: 'http://error.local' },
                                { name: 'Skip', url: 'http://skip.local', statusCheck: false },
                                { name: 'Alt', url: 'http://alt.local', statusUrl: 'http://forbidden.local/ping' },
                                { name: 'Relative', url: '/local' },
                            ],
                        },
                    },
                    { id: 'fallback', type: 'appgrid' },
                    { id: 'off', type: 'appgrid', statusCheck: false },
                    { id: 'other', type: 'git' },
                ],
            }],
        });
    });

    it('reports reachability per app from the card config', async () => {
        fetch.mockImplementation(async (url) => {
            if (url.startsWith('http://down')) throw new Error('ECONNREFUSED');
            if (url.startsWith('http://error')) return { status: 502 };
            if (url.startsWith('http://forbidden')) return { status: 403 };
            return { status: 200 };
        });

        const result = await handleAppStatusRequest({ cardId: 'apps', url: 'http://evil.local' });

        expect(result.statuses).toEqual([true, false, false, null, true, null]);
        expect(fetch.mock.calls.map(c => c[0])).not.toContain('http://evil.local');
        expect(fetch.mock.calls.map(c => c[0])).toContain('http://forbidden.local/ping');
    });

    it('falls back to the launcher apps', async () => {
        fetch.mockResolvedValue({ status: 200 });
        expect(await handleAppStatusRequest({ cardId: 'fallback' })).toEqual({ statuses: [true] });
    });

    it('skips checking when disabled on the card', async () => {
        expect(await handleAppStatusRequest({ cardId: 'off' })).toEqual({ statuses: [] });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects unknown or non-appgrid cards', async () => {
        await expect(handleAppStatusRequest({ cardId: 'nope' })).rejects.toMatchObject({ status: 404 });
        await expect(handleAppStatusRequest({ cardId: 'other' })).rejects.toMatchObject({ status: 404 });
    });
});
