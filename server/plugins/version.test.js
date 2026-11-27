// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GLASSBOARD_VERSION, parseVersion, satisfies } from './version.js';

describe('plugin version ranges', () => {
    it('reads versions', () => {
        expect(parseVersion('1.4.0')).toEqual([1, 4, 0]);
        expect(parseVersion('v2.0.10-beta.1')).toEqual([2, 0, 10]);
        expect(parseVersion('1.4')).toBeNull();
        expect(parseVersion(GLASSBOARD_VERSION)).not.toBeNull();
    });

    it.each([
        ['1.4.0', '>=1.4.0 <2', true],
        ['2.0.0', '>=1.4.0 <2', false],
        ['1.3.9', '>=1.4.0', false],
        ['1.9.0', '^1.4.0', true],
        ['2.0.0', '^1.4.0', false],
        ['0.3.5', '^0.3.1', true],
        ['0.4.0', '^0.3.1', false],
        ['1.4.9', '~1.4.1', true],
        ['1.5.0', '~1.4.1', false],
        ['1.7.2', '1.x', true],
        ['1.4.2', '1.4', true],
        ['1.5.0', '1.4', false],
        ['1.4.0', '1.4.0', true],
        ['1.4.1', '=1.4.0', false],
        ['3.0.0', '^1.0.0 || ^3.0.0', true],
        ['1.0.0', '*', true],
        ['1.4.0', '>= 1.4.0', true],
    ])('%s in %s is %s', (version, range, expected) => {
        expect(satisfies(version, range)).toBe(expected);
    });

    it('refuses ranges it can’t read', () => {
        expect(() => satisfies('1.0.0', 'latest')).toThrow(/Can't read the version range/);
        expect(() => satisfies('one', '*')).toThrow(/Can't read the version/);
    });
});
