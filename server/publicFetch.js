import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

/**
 * Address ranges that aren't on the public internet: this machine, the home or company network,
 * link-local, carrier-grade NAT, documentation, multicast and reserved ranges. A download the
 * browser asks for must not reach them, or anyone who can edit could use the server to look
 * into the network it sits in (router pages, Home Assistant, cloud metadata at 169.254.169.254).
 */
const PRIVATE = new net.BlockList();
[
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
    ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([address, prefix]) => PRIVATE.addSubnet(String(address), Number(prefix), 'ipv4'));
[
    ['::', 128], ['::1', 128], ['64:ff9b:1::', 48], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
].forEach(([address, prefix]) => PRIVATE.addSubnet(String(address), Number(prefix), 'ipv6'));

/**
 * The IPv4 address inside an IPv6 one that only wraps it: `::ffff:10.0.0.1`, the NAT64
 * `64:ff9b::10.0.0.1`, or 6to4 `2002:0a00:0001::`.
 * @param {string} address - An IPv6 address.
 * @returns {string|null} The IPv4 address, if any.
 */
function embeddedIpv4(address) {
    const lower = address.toLowerCase();
    const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (dotted) return dotted[1];
    const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/.exec(lower);
    const parts = hex || sixToFour;
    if (!parts) return null;
    const high = parseInt(parts[1], 16);
    const low = parseInt(parts[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

/**
 * Whether an IP address is outside the public internet (see PRIVATE).
 * @param {string} address - An IPv4 or IPv6 address.
 * @returns {boolean} True for private, local and reserved addresses, and for anything that
 *   isn't an IP address.
 */
export function isPrivateAddress(address) {
    const plain = String(address).replace(/^\[|\]$/g, '').replace(/%.*$/, '');
    const family = net.isIP(plain);
    if (family === 4) return PRIVATE.check(plain, 'ipv4');
    if (family === 6) {
        const inner = embeddedIpv4(plain);
        if (inner) return isPrivateAddress(inner);
        return PRIVATE.check(plain, 'ipv6');
    }
    return true;
}

/** Lets tests download from a server on this machine. */
let allowPrivate = false;

/**
 * Lets downloads reach private addresses, or stops them again. For tests only.
 * @param {boolean} allow - Whether to allow them.
 */
export function allowPrivateAddressesForTests(allow) {
    allowPrivate = allow;
}

/**
 * Error for an address the download may not reach.
 * @param {string} host - The host asked for.
 * @returns {Error & {status: number, code: string}} The error.
 */
const blocked = host => Object.assign(new Error(`${host} is on a private network, so it can't be downloaded from`), { status: 400, code: 'EPRIVATE' });

/**
 * DNS lookup for connections that checks every address a name resolves to. It runs when the
 * connection is made, so a name can't resolve to a public address when checked and a private
 * one when used.
 * @param {string} hostname - The name.
 * @param {Object} options - Options from the connection.
 * @param {Function} callback - Called as dns.lookup calls it.
 */
function publicLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);
        const list = /** @type {dns.LookupAddress[]} */ (/** @type {unknown} */ (addresses));
        if (!allowPrivate && (list.length === 0 || list.some(a => isPrivateAddress(a.address)))) return callback(blocked(hostname));
        if (options?.all) return callback(null, list);
        return callback(null, list[0].address, list[0].family);
    });
}

/**
 * @typedef {Object} PublicResponse
 * @property {number} status - The HTTP status.
 * @property {import('http').IncomingHttpHeaders} headers - The response headers.
 * @property {Buffer} body - The body, at most `maxBytes`.
 */

/**
 * Downloads from the public internet only: http and https, never private addresses (checked
 * for every redirect and at the moment each connection is made), at most `maxBytes`.
 * @param {string|URL} url - The address.
 * @param {Object} [options]
 * @param {Object<string, string>} [options.headers] - Request headers.
 * @param {number} [options.timeout=15000] - Milliseconds for the whole download.
 * @param {number} [options.maxBytes] - Largest body; more fails with status 413.
 * @param {number} [options.maxRedirects=5] - Redirects to follow.
 * @returns {Promise<PublicResponse>} The response.
 * @throws {Error} With `status` 400 for unusable or private addresses, 413 when too large, and
 *   `code` from the network for connection failures.
 */
export async function fetchPublic(url, { headers = {}, timeout = 15000, maxBytes = Infinity, maxRedirects = 5 } = {}) {
    const deadline = Date.now() + timeout;
    let current = new URL(url);
    for (let redirects = 0; ; redirects++) {
        if (!['http:', 'https:'].includes(current.protocol)) {
            throw Object.assign(new Error('Only http and https addresses can be downloaded'), { status: 400 });
        }
        const host = current.hostname.replace(/^\[|\]$/g, '');
        // Connections to an IP address skip the lookup, so they are checked here
        if (!allowPrivate && net.isIP(host) && isPrivateAddress(host)) throw blocked(host);

        const response = await request(current, headers, Math.max(1, deadline - Date.now()), maxBytes);
        const location = response.headers.location;
        if (response.status >= 300 && response.status < 400 && location) {
            if (redirects >= maxRedirects) throw Object.assign(new Error('Too many redirects'), { status: 502 });
            current = new URL(location, current);
            continue;
        }
        return response;
    }
}

/**
 * Makes one request through publicLookup.
 * @param {URL} url - The address.
 * @param {Object<string, string>} headers - Request headers.
 * @param {number} timeout - Milliseconds left.
 * @param {number} maxBytes - Largest body.
 * @returns {Promise<PublicResponse>} The response; the body of a redirect is left unread.
 */
function request(url, headers, timeout, maxBytes) {
    const client = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        // The whole download, not just a pause between packets, has to fit in the time
        const timer = setTimeout(() => req.destroy(Object.assign(new Error('Timed out'), { code: 'ETIMEDOUT' })), timeout);
        const done = (fn, value) => {
            clearTimeout(timer);
            fn(value);
        };
        const req = client.get(url, { headers, lookup: publicLookup }, (res) => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                done(resolve, { status, headers: res.headers, body: Buffer.alloc(0) });
                return;
            }
            if (Number(res.headers['content-length']) > maxBytes) {
                res.destroy();
                done(reject, Object.assign(new Error('Too large'), { status: 413 }));
                return;
            }
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > maxBytes) {
                    res.destroy();
                    done(reject, Object.assign(new Error('Too large'), { status: 413 }));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => done(resolve, { status, headers: res.headers, body: Buffer.concat(chunks) }));
            res.on('error', err => done(reject, err));
        });
        req.on('error', err => done(reject, err));
    });
}
