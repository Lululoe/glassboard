// @vitest-environment node
import zlib from 'zlib';
import { describe, expect, it } from 'vitest';
import { untarGz } from './tar.js';
import { makeTarGz, paxRecord } from './testArchive.js';

const text = files => Object.fromEntries([...files].map(([p, data]) => [p, data.toString('utf-8')]));

describe('untarGz', () => {
    it('unpacks files and removes the single top folder GitHub adds', () => {
        const files = untarGz(makeTarGz([
            { name: 'owner-repo-abc123/', type: '5' },
            { name: 'owner-repo-abc123/plugin.json', data: '{}' },
            { name: 'owner-repo-abc123/dist/client.js', data: 'export default 1' },
        ]));
        expect(text(files)).toEqual({ 'plugin.json': '{}', 'dist/client.js': 'export default 1' });
    });

    it('keeps paths as they are without a single top folder', () => {
        expect(text(untarGz(makeTarGz([{ name: 'plugin.json', data: '{}' }, { name: 'dist/client.js', data: 'x' }]))))
            .toEqual({ 'plugin.json': '{}', 'dist/client.js': 'x' });
    });

    it('reads long names from pax headers', () => {
        const long = `top/${'a'.repeat(120)}/file.js`;
        const files = untarGz(makeTarGz([
            { name: 'PaxHeader', type: 'x', data: paxRecord('path', long) },
            { name: 'cut-off-name', data: 'long' },
            { name: 'top/plugin.json', data: '{}' },
        ]));
        expect(text(files)).toEqual({ [`${'a'.repeat(120)}/file.js`]: 'long', 'plugin.json': '{}' });
    });

    it('leaves out links', () => {
        const files = untarGz(makeTarGz([{ name: 'plugin.json', data: '{}' }, { name: 'link', type: '2' }]));
        expect([...files.keys()]).toEqual(['plugin.json']);
    });

    it.each(['../evil.js', 'top/../../evil.js', '/etc/passwd', 'C:/evil.js'])('refuses the unsafe path %s', (name) => {
        expect(() => untarGz(makeTarGz([{ name, data: 'x' }]))).toThrow(/unsafe path/);
    });

    it('refuses what isn’t a gzipped tar', () => {
        expect(() => untarGz(Buffer.from('not an archive'))).toThrow('The download is not a .tar.gz archive');
    });

    it('refuses archives that are cut off', () => {
        const tar = zlib.gunzipSync(makeTarGz([{ name: 'plugin.json', data: 'x'.repeat(2000) }]));
        expect(() => untarGz(zlib.gzipSync(tar.subarray(0, 1024)))).toThrow('The archive is cut off');
    });
});
