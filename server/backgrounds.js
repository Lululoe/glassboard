import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getLayoutPath } from './layout.js';
import logger from './logger.js';

/** Picture types a page background can be uploaded as, with the extension each is stored under. */
export const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
};

/** Largest picture that is uploaded or downloaded. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 20 * 1000;

/** Path uploaded pictures are served from; the file name follows it. */
export const IMAGE_ROUTE = '/api/config/background/';

/** File names of uploaded pictures: a content hash and an extension. */
export const IMAGE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif|avif)$/;

/**
 * Directory uploaded background pictures are kept in: `BACKGROUNDS_DIR`, else `backgrounds`
 * next to layout.yaml, so a Docker volume that keeps the layout also keeps the pictures.
 * @returns {string} Absolute path.
 */
export function getBackgroundsDir() {
    return path.resolve(process.cwd(), process.env.BACKGROUNDS_DIR || path.join(path.dirname(getLayoutPath()), 'backgrounds'));
}

/**
 * Stores an uploaded picture under a name made from its content, so uploading the same
 * picture again reuses the file.
 * @param {Buffer} data - The picture.
 * @param {string} type - Its media type, one of `IMAGE_TYPES`.
 * @returns {string} The URL the picture is served at.
 */
export function saveBackgroundImage(data, type) {
    const dir = getBackgroundsDir();
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.createHash('sha256').update(data).digest('hex').slice(0, 32)}.${IMAGE_TYPES[type]}`;
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, data);
    return `${IMAGE_ROUTE}${name}`;
}

/**
 * Returns the path of an uploaded picture, or null when the name isn't one.
 * @param {string} name - File name from the URL.
 * @returns {string|null} The file path.
 */
export function backgroundImagePath(name) {
    return IMAGE_NAME.test(name) ? path.join(getBackgroundsDir(), name) : null;
}

/**
 * Deletes uploaded pictures that no saved background uses any more.
 * @param {Array<string|undefined>} inUse - Picture URLs that are still used.
 */
export function pruneBackgroundImages(inUse) {
    const keep = new Set(inUse.filter(url => typeof url === 'string' && url.startsWith(IMAGE_ROUTE)).map(url => url.slice(IMAGE_ROUTE.length)));
    const dir = getBackgroundsDir();
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
        .filter(name => IMAGE_NAME.test(name) && !keep.has(name))
        .forEach(name => {
            try {
                fs.rmSync(path.join(dir, name));
            } catch (e) {
                logger.warn(`Could not remove unused background ${name}: ${e.message}`);
            }
        });
}

/**
 * Tells the picture type from a file's first bytes, so a download is stored only if it really
 * is a picture, whatever the server that sent it called it.
 * @param {Buffer} data - The file.
 * @returns {string|null} Its media type, one of `IMAGE_TYPES`, or null.
 */
export function sniffImageType(data) {
    const ascii = (start, end) => data.subarray(start, end).toString('latin1');
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
    if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (ascii(0, 4) === 'GIF8') return 'image/gif';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
    if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
    return null;
}

/**
 * Downloads a picture from the web and stores it like an uploaded one, so the dashboard
 * shows it from this server instead of loading it from the other site every time.
 * @param {string} url - An http(s) address.
 * @returns {Promise<string>} The URL the stored picture is served at.
 * @throws {Error} With a `status` of 400 when the address isn't usable or isn't a picture,
 *   413 when it is too large, and 502 when the other server can't be reached.
 */
export async function downloadBackgroundImage(url) {
    const fail = (status, message) => Object.assign(new Error(message), { status });
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw fail(400, 'That is not a web address');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw fail(400, 'Only http and https addresses can be downloaded');

    let res;
    try {
        res = await fetch(parsed, {
            headers: { 'User-Agent': 'Glassboard', Accept: Object.keys(IMAGE_TYPES).join(', ') },
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
            redirect: 'follow',
        });
    } catch (e) {
        throw fail(502, `Could not reach ${parsed.host} (${e.cause?.code || e.name})`);
    }
    if (!res.ok || !res.body) throw fail(502, `${parsed.host} answered ${res.status}`);
    if (Number(res.headers.get('content-length')) > MAX_IMAGE_BYTES) throw fail(413, 'The picture is larger than 20 MB');

    // Read at most the limit, whatever the server claimed
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) {
            throw fail(413, 'The picture is larger than 20 MB');
        }
        chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    const type = sniffImageType(data);
    if (!type) throw fail(400, 'The address is not a JPEG, PNG, WebP, GIF or AVIF picture');
    return saveBackgroundImage(data, type);
}
