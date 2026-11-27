import zlib from 'zlib';

/**
 * Builds a gzipped tar archive in memory, for tests.
 * @param {Array<{name: string, data?: string|Buffer, type?: string}>} entries - Files (type `0`),
 *   folders (`5`), symlinks (`2`) or pax headers (`x`, with `data` as the records).
 * @returns {Buffer} The `.tar.gz`.
 */
export function makeTarGz(entries) {
    const blocks = [];
    for (const { name, data = '', type = '0' } of entries) {
        const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const header = Buffer.alloc(512);
        header.write(name.slice(0, 100), 0, 'utf-8');
        header.write('0000644\0', 100);
        header.write('0000000\0', 108);
        header.write('0000000\0', 116);
        header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
        header.write('00000000000\0', 136);
        header.write('        ', 148);
        header.write(type, 156);
        header.write('ustar\0', 257);
        header.write('00', 263);
        let sum = 0;
        for (const b of header) sum += b;
        header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
        blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
    }
    blocks.push(Buffer.alloc(1024));
    return zlib.gzipSync(Buffer.concat(blocks));
}

/** A pax header record, as `<length> <key>=<value>\n`. */
export function paxRecord(key, value) {
    const text = ` ${key}=${value}\n`;
    let length = text.length + 1;
    while (String(length).length + text.length !== length) length = String(length).length + text.length;
    return `${length}${text}`;
}
