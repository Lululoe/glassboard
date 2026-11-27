// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPluginContext } from './context.js';
import { createPluginHost } from './host.js';
import { assetsDirFor, loadExternalPlugins, unloadPlugin } from './loader.js';

/**
 * Writes a plugin folder.
 * @param {string} root - The plugins folder.
 * @param {string} folder - The plugin's folder name.
 * @param {Object<string, string|Object>} files - Files by path; objects are written as JSON.
 */
function write(root, folder, files) {
    for (const [rel, content] of Object.entries(files)) {
        const file = path.join(root, folder, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    }
}

const manifest = (id, extra = {}) => ({ id, name: id, version: '1.0.0', glassboard: '>=1.0.0', client: 'client.js', ...extra });
const CLIENT = { 'dist/client.js': 'export default {}' };

describe('loading plugins from the plugins folder', () => {
    let root;
    let host;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-plugins-'));
        host = createPluginHost(createPluginContext);
    });

    afterEach(() => {
        [...host.ids].forEach(id => unloadPlugin(host, id));
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('loads good plugins and lists bad ones as failed, without throwing', async () => {
        write(root, 'hello', {
            'plugin.json': manifest('hello', { server: 'server.js', style: 'style.css', description: 'Says hello' }),
            ...CLIENT,
            'dist/style.css': '',
            'server.js': 'export function setup(ctx) { return { services: { hello: () => `hi from ${ctx.id}` } }; }',
        });
        write(root, 'broken', { 'plugin.json': '{ nope' });
        write(root, 'misnamed', { 'plugin.json': manifest('other'), ...CLIENT });
        write(root, 'future', { 'plugin.json': manifest('future', { glassboard: '>=99' }), ...CLIENT });
        write(root, 'crashes', { 'plugin.json': manifest('crashes', { server: 'server.js' }), ...CLIENT, 'server.js': 'throw new Error("bad import")' });
        write(root, 'throws', { 'plugin.json': manifest('throws', { server: 'server.js' }), ...CLIENT, 'server.js': 'export default { setup() { throw new Error("bad setup"); } }' });
        write(root, 'nosetup', { 'plugin.json': manifest('nosetup', { server: 'server.js' }), ...CLIENT, 'server.js': 'export const x = 1' });
        // Installs in progress are hidden and skipped
        write(root, '.install-hello-1234', { 'plugin.json': '{ nope' });

        await expect(loadExternalPlugins(host, root)).resolves.toBeUndefined();

        expect(host.ids).toEqual(['hello']);
        expect(await host.services.hello({})).toBe('hi from hello');
        expect(host.find('hello')).toMatchObject({
            id: 'hello', name: 'hello', version: '1.0.0', description: 'Says hello', external: true, hasServer: true, services: ['hello'],
            client: expect.stringMatching(/^\/_plugins\/hello\/client\.js\?v=1\.0\.0-\d+$/),
            style: expect.stringMatching(/^\/_plugins\/hello\/style\.css\?v=/),
            source: null,
        });
        expect(assetsDirFor('hello')).toBe(path.join(root, 'hello', 'dist'));

        const failed = Object.fromEntries(host.failed.map(f => [f.id, f.error]));
        expect(failed).toEqual({
            broken: expect.stringContaining('not valid JSON'),
            // Named by the id its manifest gives
            other: 'The folder is named misnamed, but the plugin\'s id is other',
            future: expect.stringContaining('Needs Glassboard >=99'),
            crashes: 'server.js could not be loaded: bad import',
            throws: expect.stringContaining('bad setup'),
            nosetup: 'server.js exports no setup function',
        });
        expect(assetsDirFor('throws')).toBeUndefined();
    });

    it('stops serving a plugin’s files once it is unloaded', async () => {
        write(root, 'hello', { 'plugin.json': manifest('hello'), ...CLIENT });
        await loadExternalPlugins(host, root);
        expect(host.ids).toEqual(['hello']);
        unloadPlugin(host, 'hello');
        expect(host.ids).toEqual([]);
        expect(assetsDirFor('hello')).toBeUndefined();
    });

    it('does nothing without a plugins folder', async () => {
        await loadExternalPlugins(host, path.join(root, 'missing'));
        expect(host.ids).toEqual([]);
        expect(host.failed).toEqual([]);
    });
});
