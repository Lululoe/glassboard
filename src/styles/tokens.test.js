import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Lists the stylesheets under a directory.
 * @param {string} dir - Directory to search.
 * @returns {string[]} Absolute paths of .css files.
 */
function cssFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return cssFiles(full);
        return entry.name.endsWith('.css') ? [full] : [];
    });
}

/**
 * Finds declarations in all stylesheets that match a pattern, outside the token definitions.
 * @param {RegExp} pattern - Pattern a declaration line must not match.
 * @returns {string[]} `file:line: text` of every match.
 */
function offending(pattern) {
    return cssFiles(SRC).flatMap(file => fs.readFileSync(file, 'utf8').split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => pattern.test(line))
        .map(({ line, i }) => `${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`));
}

describe('design tokens', () => {
    it('corner radii use the radius tokens, so styles can reshape them', () => {
        expect(offending(/^\s*border-radius:[^;]*\d+(\.\d+)?(px|%)(?![^(]*\*\s*var\(--(round|radius)-scale\))/)
            .filter(line => !/border-radius:\s*0(\s|;)/.test(line))).toEqual([]);
    });

    it('frosted surfaces scale their blur with --blur-scale, so opaque styles can drop it', () => {
        expect(offending(/backdrop-filter:[^;]*blur\(\d/)).toEqual([]);
    });
});
