import fs from 'fs';

/**
 * The version of Glassboard, from package.json. Plugins say which versions they work with in
 * the `glassboard` field of their manifest.
 */
export const GLASSBOARD_VERSION = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')).version;

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
const PARTIAL = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:[-+].*)?$/;

/**
 * Reads a version such as `1.4.0` into its numbers.
 * @param {string} version - The version.
 * @returns {number[]|null} Major, minor and patch, or null when it isn't one.
 */
export function parseVersion(version) {
    const m = VERSION.exec(String(version).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Compares two versions.
 * @param {number[]} a - A version.
 * @param {number[]} b - Another.
 * @returns {number} Below 0 when `a` is lower, 0 when equal, above 0 when higher.
 */
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Turns one comparator of a range into a test.
 * @param {string} token - Such as `>=1.4.0`, `^1.4`, `~1.4.1`, `1.x` or `1.4.0`.
 * @returns {(v: number[]) => boolean} Whether a version meets it.
 * @throws {Error} For a comparator that can't be read.
 */
function comparator(token) {
    const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);
    const op = m?.[1] || '';
    const p = m && PARTIAL.exec(m[2]);
    if (!p) throw new Error(`Can't read the version range "${token}"`);
    const wild = (x) => x === undefined || x === 'x' || x === '*';
    const major = Number(p[1]);
    const minor = wild(p[2]) ? null : Number(p[2]);
    const patch = wild(p[3]) ? null : Number(p[3]);
    const low = [major, minor ?? 0, patch ?? 0];

    if (op === '^') {
        const high = major > 0 ? [major + 1, 0, 0] : minor !== null && minor > 0 ? [0, minor + 1, 0] : [0, 0, (patch ?? 0) + 1];
        return v => compare(v, low) >= 0 && compare(v, high) < 0;
    }
    // `~1.4.1`, `~1.4`, `1.4`, `1.4.x`: that minor version; `~1`, `1`, `1.x`: that major version
    const partial = minor === null || patch === null;
    if (op === '~' || ((op === '' || op === '=') && partial)) {
        const high = minor === null ? [major + 1, 0, 0] : [major, minor + 1, 0];
        return v => compare(v, low) >= 0 && compare(v, high) < 0;
    }
    if (op === '>=') return v => compare(v, low) >= 0;
    if (op === '>') return v => compare(v, low) > 0;
    if (op === '<=') return v => compare(v, low) <= 0;
    if (op === '<') return v => compare(v, low) < 0;
    return v => compare(v, low) === 0;
}

/**
 * Checks a version against a range in the style of npm: comparators separated by spaces must
 * all hold, and `||` separates alternatives. Supports `>=`, `>`, `<=`, `<`, `=`, `^`, `~`, `*`
 * and partial versions such as `1.x`.
 * @param {string} version - A version such as `1.4.0`.
 * @param {string} range - Such as `>=1.4.0 <2` or `^1.4.0`.
 * @returns {boolean} Whether the version is in the range.
 * @throws {Error} When the version or range can't be read.
 */
export function satisfies(version, range) {
    const v = parseVersion(version);
    if (!v) throw new Error(`Can't read the version "${version}"`);
    return String(range).split('||').some((alternative) => {
        const tokens = alternative.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
        if (tokens.length === 0 || tokens.every(t => t === '*' || t === 'x')) return true;
        return tokens.map(comparator).every(test => test(v));
    });
}
