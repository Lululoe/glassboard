// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readManifest } from './manifest.js';

const dirs = [];

/**
 * A plugin folder with a manifest and the files it names.
 * @param {Object|string} manifest - The manifest, or raw text.
 * @param {string[]} [files] - Files to create.
 */
function folder(manifest, files = []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-manifest-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'plugin.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
    for (const file of files) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), '');
    }
    return dir;
}

const GOOD = { id: 'hello', name: 'Hello', version: '1.0.0', glassboard: '>=1.0.0', client: 'client.js', server: 'server.js' };

describe('plugin manifest', () => {
    afterEach(() => {
        dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    });

    it('reads a valid manifest, with dist as the default assets folder', () => {
        expect(readManifest(folder(GOOD, ['dist/client.js', 'server.js']))).toMatchObject({ ...GOOD, assets: 'dist' });
    });

    it.each([
        ['no manifest', null, /No plugin.json/],
        ['broken JSON', '{', /not valid JSON/],
        ['an uppercase id', { ...GOOD, id: 'Hello' }, /id must be lowercase/],
        ['a reserved id', { ...GOOD, id: 'install' }, /id is reserved/],
        ['no version', { ...GOOD, version: 'one' }, /version must be a version/],
        ['neither client nor server', { ...GOOD, client: undefined, server: undefined }, /needs a client or a server/],
        ['a path out of its folder', { ...GOOD, server: '../server.js' }, /server must be a path inside/],
        ['a newer Glassboard', { ...GOOD, glassboard: '>=99.0.0' }, /Needs Glassboard >=99.0.0, this is/],
        ['a missing file', { ...GOOD, style: 'style.css' }, /dist\/style.css is named in plugin.json but missing/],
    ])('refuses %s', (_, manifest, message) => {
        let dir;
        if (manifest === null) {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-manifest-'));
            dirs.push(dir);
        } else {
            dir = folder(manifest, ['dist/client.js', 'server.js']);
        }
        expect(() => readManifest(dir)).toThrow(message);
    });
});
