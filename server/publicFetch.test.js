// @vitest-environment node
import dns from 'dns';
import http from 'http';
import { once } from 'events';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { allowPrivateAddressesForTests, fetchPublic, isPrivateAddress } from './publicFetch.js';

describe('downloads from the public internet only', () => {
    let site;
    let port;

    beforeAll(async () => {
        site = http.createServer((req, res) => {
            if (req.url === '/hop') {
                res.writeHead(302, { Location: '/picture' });
                res.end();
            } else if (req.url === '/big') {
                res.end(Buffer.alloc(2048));
            } else {
                res.end('picture');
            }
        }).listen(0, '127.0.0.1');
        await once(site, 'listening');
        port = site.address().port;
    });

    afterEach(() => {
        allowPrivateAddressesForTests(false);
        vi.restoreAllMocks();
    });

    afterAll(() => site.close());

    it.each([
        ['127.0.0.1', true], ['10.1.2.3', true], ['172.20.0.1', true], ['192.168.68.59', true], ['169.254.169.254', true],
        ['100.64.0.1', true], ['0.0.0.0', true], ['224.0.0.1', true], ['::1', true], ['::', true], ['fd00::1', true],
        ['fe80::1', true], ['::ffff:127.0.0.1', true], ['::ffff:7f00:1', true], ['64:ff9b::a00:1', true], ['2002:c0a8:0101::1', true],
        ['8.8.8.8', false], ['1.1.1.1', false], ['2606:4700:4700::1111', false], ['::ffff:8.8.8.8', false], ['not an address', true],
    ])('%s is private: %s', (address, expected) => {
        expect(isPrivateAddress(address)).toBe(expected);
    });

    it('refuses addresses on this machine or the local network', async () => {
        await expect(fetchPublic(`http://127.0.0.1:${port}/picture`)).rejects.toMatchObject({ status: 400, code: 'EPRIVATE' });
        await expect(fetchPublic(`http://[::ffff:127.0.0.1]:${port}/picture`)).rejects.toMatchObject({ status: 400 });
        await expect(fetchPublic('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({ status: 400 });
        await expect(fetchPublic('file:///etc/passwd')).rejects.toMatchObject({ status: 400 });
    });

    it('refuses names that resolve to a private address when connecting', async () => {
        const lookup = dns.lookup;
        vi.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => (hostname === 'pictures.example'
            ? callback(null, [{ address: '127.0.0.1', family: 4 }])
            : lookup(hostname, options, callback)));
        await expect(fetchPublic(`http://pictures.example:${port}/picture`)).rejects.toMatchObject({ status: 400, code: 'EPRIVATE' });
        await expect(fetchPublic(`http://localhost:${port}/picture`)).rejects.toMatchObject({ status: 400 });
    });

    it('follows redirects, checking each, and stops at the size limit', async () => {
        allowPrivateAddressesForTests(true);
        const res = await fetchPublic(`http://127.0.0.1:${port}/hop`);
        expect(res.status).toBe(200);
        expect(res.body.toString()).toBe('picture');
        await expect(fetchPublic(`http://127.0.0.1:${port}/big`, { maxBytes: 1024 })).rejects.toMatchObject({ status: 413 });
        await expect(fetchPublic(`http://127.0.0.1:${port}/hop`, { maxRedirects: 0 })).rejects.toMatchObject({ status: 502 });
    });
});
