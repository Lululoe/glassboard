import { afterEach, describe, expect, it, vi } from 'vitest';
import { listServerPlugins } from '../lib/api';
import { loadExternalPlugin, loadExternalPlugins, shareModules, unloadExternalPlugin } from './external';
import { getCardComponent, getPluginFailures, getPluginsPending } from './registry';

vi.mock('../lib/api', () => ({ listServerPlugins: vi.fn() }));

/** A module URL with the given source. */
const moduleUrl = source => `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;

const HELLO = `export default {
    id: 'hello',
    register(api) { api.registerCard('hello', { Component: () => null, name: 'Hello', icon: 'lu-Hand' }); },
};`;

describe('external plugins in the browser', () => {
    afterEach(() => {
        ['hello', 'wrong', 'missing'].forEach(unloadExternalPlugin);
        vi.clearAllMocks();
    });

    it('shares React and the SDK with plugins', async () => {
        shareModules();
        const modules = globalThis.__glassboard.modules;
        expect(Object.keys(modules)).toEqual(['react', 'react/jsx-runtime', 'react-dom', '@glassboard/sdk']);
        expect(modules.react.useState).toBeTypeOf('function');
        expect(modules['@glassboard/sdk'].BaseCard).toBeDefined();
    });

    it('loads a plugin’s module and stylesheet, and takes them off again', async () => {
        expect(await loadExternalPlugin({ id: 'hello', name: 'Hello', client: moduleUrl(HELLO), style: '/_plugins/hello/style.css' })).toBe(true);
        expect(getCardComponent('hello')).toBeTypeOf('function');
        expect(document.querySelector('link[data-glassboard-plugin="hello"]')).toHaveAttribute('href', '/_plugins/hello/style.css');

        unloadExternalPlugin('hello');
        expect(getCardComponent('hello')).toBeNull();
        expect(document.querySelector('link[data-glassboard-plugin="hello"]')).toBeNull();
    });

    it('lists plugins whose browser file fails or exports the wrong plugin', async () => {
        expect(await loadExternalPlugin({ id: 'wrong', name: 'Wrong', client: moduleUrl(HELLO) })).toBe(false);
        expect(await loadExternalPlugin({ id: 'missing', name: 'Missing', client: moduleUrl('throw new Error("boom")') })).toBe(false);
        expect(getPluginFailures()).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'wrong', error: 'Its browser file must export a plugin with the id wrong as default' }),
            expect.objectContaining({ id: 'missing', error: expect.stringContaining('Its browser file could not be loaded') }),
        ]));
    });

    it('loads every external plugin the server lists, and waits for them', async () => {
        vi.mocked(listServerPlugins).mockResolvedValueOnce({
            plugins: [
                { id: 'core', builtIn: true },
                { id: 'hello', name: 'Hello', external: true, client: moduleUrl(HELLO), style: null },
            ],
        });
        const done = loadExternalPlugins();
        expect(getPluginsPending()).toBe(true);
        await done;
        expect(getPluginsPending()).toBe(false);
        expect(getCardComponent('hello')).toBeTypeOf('function');
    });

    it('stops waiting when the server can’t be reached', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(listServerPlugins).mockRejectedValueOnce(new Error('down'));
        await loadExternalPlugins();
        expect(getPluginsPending()).toBe(false);
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
