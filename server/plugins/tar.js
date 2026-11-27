import path from 'path';
import zlib from 'zlib';

/** Largest archive, unpacked, a plugin may come in. */
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
/** Most files a plugin may have. */
export const MAX_FILES = 5000;

/**
 * Reads a NUL-terminated string from a tar header.
 * @param {Buffer} buf - The header.
 * @param {number} start - Offset.
 * @param {number} length - Field length.
 * @returns {string} The value.
 */
const text = (buf, start, length) => {
    const field = buf.subarray(start, start + length);
    const end = field.indexOf(0);
    return field.subarray(0, end === -1 ? length : end).toString('utf-8');
};

/**
 * Reads an octal number from a tar header.
 * @param {Buffer} buf - The header.
 * @param {number} start - Offset.
 * @param {number} length - Field length.
 * @returns {number} The value.
 */
const octal = (buf, start, length) => parseInt(text(buf, start, length).trim() || '0', 8);

/**
 * Reads the `path` of a pax extended header.
 * @param {Buffer} data - The header's records.
 * @returns {string|undefined} The path, if it sets one.
 */
function paxPath(data) {
    const records = data.toString('utf-8').split('\n');
    for (const record of records) {
        const m = /^\d+ path=(.*)$/.exec(record);
        if (m) return m[1];
    }
    return undefined;
}

/**
 * Checks a path from an archive and makes it relative and clean.
 * @param {string} name - The path in the archive.
 * @returns {string} The cleaned path.
 * @throws {Error} For absolute paths and paths that leave the archive.
 */
function safePath(name) {
    const clean = path.posix.normalize(name.replace(/\\/g, '/')).replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (!clean || clean === '.' || path.posix.isAbsolute(clean) || clean.split('/').includes('..') || /^[a-zA-Z]:/.test(clean)) {
        throw new Error(`The archive has an unsafe path: ${name}`);
    }
    return clean;
}

/**
 * Unpacks a gzipped tar archive into memory. Only folders and regular files are kept; links
 * and devices are skipped. When every entry is in one top folder, as in GitHub's archives,
 * that folder is removed from the paths.
 * @param {Buffer} gzipped - The `.tar.gz` file.
 * @returns {Map<string, Buffer>} The files by relative path.
 * @throws {Error} For archives that are broken, too large or have unsafe paths.
 */
export function untarGz(gzipped) {
    let tar;
    try {
        tar = zlib.gunzipSync(gzipped, { maxOutputLength: MAX_UNPACKED_BYTES });
    } catch (err) {
        throw new Error(err?.code === 'ERR_BUFFER_TOO_LARGE' ? 'The archive is too large' : 'The download is not a .tar.gz archive');
    }

    /** @type {Map<string, Buffer>} */
    const files = new Map();
    const dirs = new Set();
    let longName;
    let offset = 0;
    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);
        if (header.every(b => b === 0)) break;
        const size = octal(header, 124, 12);
        const type = String.fromCharCode(header[156] || 48);
        const dataStart = offset + 512;
        const data = tar.subarray(dataStart, dataStart + size);
        if (data.length < size) throw new Error('The archive is cut off');
        offset = dataStart + Math.ceil(size / 512) * 512;

        if (type === 'x' || type === 'L') {
            longName = type === 'L' ? text(data, 0, data.length) : paxPath(data);
            continue;
        }
        if (type === 'g') continue;
        const prefix = text(header, 345, 155);
        const name = longName ?? (prefix ? `${prefix}/${text(header, 0, 100)}` : text(header, 0, 100));
        longName = undefined;

        if (type === '5') {
            dirs.add(safePath(name));
        } else if (type === '0' || type === '\0' || type === '7') {
            if (files.size >= MAX_FILES) throw new Error('The archive has too many files');
            files.set(safePath(name), Buffer.from(data));
        }
        // Links, devices and others are left out
    }

    // GitHub puts everything in one folder named after the repository and commit
    const tops = new Set([...files.keys(), ...dirs].map(p => p.split('/')[0]));
    const [top] = tops;
    if (tops.size === 1 && !files.has(top)) {
        return new Map([...files].map(([p, data]) => [p.slice(top.length + 1), data]));
    }
    return files;
}
