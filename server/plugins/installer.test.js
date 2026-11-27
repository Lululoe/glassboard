// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginContext } from './context.js';
import { createPluginHost } from './host.js';
import { PREVIEW_TTL_MS, download, installPreview, parseSource, previewPlugin, previewUpdate, removePlugin, resolveDownload } from './installer.js';
import { unloadPlugin } from './loader.js';
import { makeTarGz } from './testArchive.js';

const ASSET = 'https://github.com/someone/hello/releases/download/v1.0.0/hello.tgz';

/**
 * The archive of a plugin, as GitHub would serve it.
 * @param {Object} [options]
 * @param {string} [options.id='hello'] - Its id.
 * @param {string} [options.version='1.0.0'] - Its version.
 * @param {string} [options.server] - Source of its server part.
 * @param {boolean} [options.manifest=true] - Whether it has a manifest.
 */
function archive({ id = 'hello', version = '1.0.0', server = 'export function setup() { return { services: { hello: () => "hi" } }; }', manifest = true } = {}) {
    const entries = [
        { name: 'hello-v1/dist/client.js', data: 'export default {}' },
        { name: 'hello-v1/server.js', data: server },
    ];
    if (manifest) {
        entries.push({
            name: 'hello-v1/plugin.json',
            data: JSON.stringify({ id, name: 'Hello', version, glassboard: '>=1.0.0', client: 'client.js', server: 'server.js' }),
        });
    }
    return makeTarGz(entries);
}

const COMMIT_1 = 'a'.repeat(40);
const COMMIT_2 = 'b'.repeat(40);

/**
 * A fake GitHub: the latest release of someone/hello has the archive attached.
 * @param {() => Buffer} serve - Gives the archive to serve.
 * @param {Object} [state] - What the release is: its tag and the commit the tag points at.
 */
function github(serve, state = { tag: 'v1.0.0', commit: COMMIT_1 }) {
    return vi.fn(async (url) => {
        if (url === 'https://api.github.com/repos/someone/hello/releases/latest') {
            return Response.json({
                tag_name: state.tag, html_url: `https://github.com/someone/hello/releases/tag/${state.tag}`, published_at: '2026-11-01T00:00:00Z', body: 'Fixed things',
                tarball_url: 'https://api.github.com/repos/someone/hello/tarball/v1.0.0', assets: [{ name: 'hello.tgz', browser_download_url: ASSET }],
            });
        }
        if (url === ASSET) return new Response(serve());
        if (url.startsWith('https://api.github.com/repos/someone/hello/commits/')) return Response.json({ sha: state.commit });
        if (url === 'https://api.github.com/repos/someone/hello') {
            return Response.json({ owner: { login: 'someone' }, stargazers_count: 12, created_at: '2020-01-01T00:00:00Z', pushed_at: '2026-11-01T00:00:00Z', archived: false });
        }
        return new Response('not found', { status: 404 });
    });
}

/**
 * Previews and installs, as the settings window does after a look at the preview.
 * @param {string} input - The repository.
 * @param {Object} options - As for previewPlugin.
 */
async function install(input, options) {
    const preview = await previewPlugin(input, options);
    return installPreview(preview.preview, options);
}

/**
 * Previews the newest release of an installed plugin and installs it.
 * @param {string} id - The plugin.
 * @param {Object} options - As for previewUpdate.
 */
async function update(id, options) {
    const preview = await previewUpdate(id, options);
    return installPreview(preview.preview, options);
}

describe('installing plugins from GitHub', () => {
    let root;
    let host;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-install-'));
        host = createPluginHost(createPluginContext);
    });

    afterEach(() => {
        [...host.ids].forEach(id => unloadPlugin(host, id));
        fs.rmSync(root, { recursive: true, force: true });
    });

    it.each([
        ['someone/hello', { owner: 'someone', repo: 'hello', ref: undefined }],
        ['https://github.com/someone/hello', { owner: 'someone', repo: 'hello', ref: undefined }],
        ['https://github.com/someone/hello.git', { owner: 'someone', repo: 'hello', ref: undefined }],
        ['someone/hello@v1.2.0', { owner: 'someone', repo: 'hello', ref: 'v1.2.0' }],
        ['github.com/someone/hello#main', { owner: 'someone', repo: 'hello', ref: 'main' }],
        ['https://github.com/someone/hello/tree/feature/x', { owner: 'someone', repo: 'hello', ref: 'feature/x' }],
    ])('reads %s', (input, expected) => {
        expect(parseSource(input)).toEqual({ ...expected, url: 'https://github.com/someone/hello' });
    });

    it.each(['', 'hello', 'https://gitlab.com/someone/hello', 'someone/hello/extra', 'some one/hello', 'someone/hello@a b'])('refuses %j', (input) => {
        expect(() => parseSource(input)).toThrow('Enter a GitHub repository');
    });

    it('falls back to the release’s source, then the default branch', async () => {
        const noAsset = vi.fn(async () => Response.json({ tag_name: 'v2', tarball_url: 'https://api.github.com/repos/o/r/tarball/v2', assets: [] }));
        expect(await resolveDownload(parseSource('o/r'), noAsset)).toMatchObject({ url: 'https://api.github.com/repos/o/r/tarball/v2', ref: 'v2', kind: 'tarball' });

        const noRelease = vi.fn(async url => (url.endsWith('/releases/latest') ? new Response('', { status: 404 }) : Response.json({ default_branch: 'main' })));
        expect(await resolveDownload(parseSource('o/r'), noRelease)).toEqual({ url: 'https://api.github.com/repos/o/r/tarball/main', ref: 'main', kind: 'tarball', release: null });

        const missing = vi.fn(async () => new Response('', { status: 404 }));
        await expect(resolveDownload(parseSource('o/r'), missing)).rejects.toMatchObject({ status: 404 });
    });

    it('downloads only from GitHub', async () => {
        const fetchImpl = vi.fn();
        await expect(download('https://example.com/plugin.tgz', fetchImpl)).rejects.toMatchObject({ status: 400 });
        expect(fetchImpl).not.toHaveBeenCalled();

        const redirected = vi.fn(async () => {
            const res = new Response('x');
            Object.defineProperty(res, 'url', { value: 'https://example.com/elsewhere' });
            return res;
        });
        await expect(download(ASSET, redirected)).rejects.toMatchObject({ status: 502 });
    });

    it('shows what would be installed without installing it', async () => {
        const preview = await previewPlugin('someone/hello', { host, dir: root, fetchImpl: github(() => archive()) });
        expect(preview).toMatchObject({
            preview: expect.stringMatching(/^[0-9a-f]{32}$/),
            upToDate: false,
            plugin: { id: 'hello', name: 'Hello', version: '1.0.0', hasServer: true, hasClient: true },
            repository: { url: 'https://github.com/someone/hello', owner: 'someone', stars: 12, isNew: false },
            release: { ref: 'v1.0.0', kind: 'asset', commit: COMMIT_1, notes: 'Fixed things' },
            sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
            installed: null,
        });
        expect(host.ids).toEqual([]);
        expect(fs.readdirSync(root)).toEqual([]);
    });

    it('installs exactly the previewed download, and only once', async () => {
        let served = archive();
        const fetchImpl = github(() => served);
        const preview = await previewPlugin('someone/hello', { host, dir: root, fetchImpl });
        // What GitHub serves after the preview doesn't matter
        served = archive({ version: '6.6.6' });
        const result = await installPreview(preview.preview, { host, dir: root });

        expect(result).toMatchObject({ updated: false, restartRecommended: false, plugin: { id: 'hello', version: '1.0.0', services: ['hello'] } });
        expect(host.ids).toEqual(['hello']);
        expect(JSON.parse(fs.readFileSync(path.join(root, 'hello', '.glassboard-source.json'), 'utf-8'))).toMatchObject({
            url: 'https://github.com/someone/hello', ref: 'v1.0.0', kind: 'asset', commit: COMMIT_1, sha256: preview.sha256,
        });
        expect(host.find('hello')).toMatchObject({ source: { url: 'https://github.com/someone/hello', commit: COMMIT_1 } });
        expect(fs.readdirSync(root)).toEqual(['hello']);
        await expect(installPreview(preview.preview, { host, dir: root })).rejects.toMatchObject({ status: 410 });
    });

    it('lets previews expire', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            const preview = await previewPlugin('someone/hello', { host, dir: root, fetchImpl: github(() => archive()) });
            vi.setSystemTime(Date.now() + PREVIEW_TTL_MS + 1000);
            await expect(installPreview(preview.preview, { host, dir: root })).rejects.toMatchObject({ status: 410 });
        } finally {
            vi.useRealTimers();
        }
    });

    it('refuses a release whose code changed after it was installed', async () => {
        const state = { tag: 'v1.0.0', commit: COMMIT_1 };
        let served = archive();
        const fetchImpl = github(() => served, state);
        await install('someone/hello', { host, dir: root, fetchImpl });

        // Nothing new
        expect(await previewUpdate('hello', { host, dir: root, fetchImpl })).toMatchObject({ upToDate: true, installed: { version: '1.0.0', ref: 'v1.0.0' } });

        // The tag was moved to another commit
        state.commit = COMMIT_2;
        await expect(previewUpdate('hello', { host, dir: root, fetchImpl })).rejects.toMatchObject({
            status: 409, message: expect.stringContaining('is no longer the code that was installed'),
        });

        // The file attached to the release was replaced
        state.commit = COMMIT_1;
        served = archive({ server: 'export function setup() { return {}; } // changed' });
        await expect(previewUpdate('hello', { host, dir: root, fetchImpl })).rejects.toMatchObject({ status: 409 });
        expect(host.find('hello')).toMatchObject({ version: '1.0.0' });
    });

    it('refuses an update that is another plugin', async () => {
        const state = { tag: 'v1.0.0', commit: COMMIT_1 };
        let served = archive();
        const fetchImpl = github(() => served, state);
        await install('someone/hello', { host, dir: root, fetchImpl });
        state.tag = 'v2.0.0';
        served = archive({ id: 'other' });
        await expect(previewUpdate('hello', { host, dir: root, fetchImpl })).rejects.toMatchObject({ status: 409, message: expect.stringContaining('now has the plugin other') });
    });

    it('updates a plugin, and puts the old version back when the new one fails', async () => {
        const state = { tag: 'v1.0.0', commit: COMMIT_1 };
        let next = archive();
        const fetchImpl = github(() => next, state);
        await install('someone/hello', { host, dir: root, fetchImpl });

        state.tag = 'v1.1.0';
        state.commit = COMMIT_2;
        next = archive({ version: '1.1.0' });
        const preview = await previewUpdate('hello', { host, dir: root, fetchImpl });
        expect(preview).toMatchObject({ upToDate: false, plugin: { version: '1.1.0' }, installed: { version: '1.0.0', ref: 'v1.0.0', commit: COMMIT_1 } });
        const updated = await installPreview(preview.preview, { host, dir: root });
        expect(updated).toMatchObject({ updated: true, restartRecommended: true, plugin: { version: '1.1.0' } });

        state.tag = 'v1.2.0';
        next = archive({ version: '1.2.0', server: 'throw new Error("broken release")' });
        await expect(update('hello', { host, dir: root, fetchImpl })).rejects.toMatchObject({
            status: 422, message: expect.stringContaining('broken release'),
        });
        expect(host.find('hello')).toMatchObject({ version: '1.1.0' });
        expect(host.failed).toEqual([]);
        expect(fs.readdirSync(root)).toEqual(['hello']);
    });

    it('refuses archives that aren’t plugins, and replacing built-in plugins', async () => {
        await expect(previewPlugin('someone/hello', { host, dir: root, fetchImpl: github(() => archive({ manifest: false })) }))
            .rejects.toMatchObject({ status: 422, message: expect.stringContaining('has no plugin.json') });
        await expect(previewPlugin('someone/hello', { host, dir: root, fetchImpl: github(() => archive({ version: 'one' })) }))
            .rejects.toMatchObject({ status: 422, message: expect.stringContaining('version must be a version') });

        host.add([{ id: 'core', setup: () => ({}) }], { builtIn: true });
        await expect(previewPlugin('someone/hello', { host, dir: root, fetchImpl: github(() => archive({ id: 'core' })) }))
            .rejects.toMatchObject({ status: 409 });
        await expect(removePlugin('core', { host, dir: root })).rejects.toMatchObject({ status: 409 });
        expect(fs.readdirSync(root)).toEqual([]);
    });

    it('removes a plugin and its folder', async () => {
        await install('someone/hello', { host, dir: root, fetchImpl: github(() => archive()) });
        expect(await removePlugin('hello', { host, dir: root })).toEqual({ restartRecommended: true });
        expect(host.ids).toEqual([]);
        expect(fs.existsSync(path.join(root, 'hello'))).toBe(false);
        await expect(removePlugin('hello', { host, dir: root })).rejects.toMatchObject({ status: 404 });
        await expect(removePlugin('../etc', { host, dir: root })).rejects.toMatchObject({ status: 404 });
    });

    it('updates only plugins installed from a repository', async () => {
        await expect(previewUpdate('hello', { host, dir: root })).rejects.toMatchObject({ status: 404 });
    });
});
