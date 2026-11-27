import { describe, expect, it } from 'vitest';
import * as sdk from './index';
import { SDK_EXPORTS } from '../../shared/sdkExports';
import { version } from '../../package.json';

describe('plugin SDK', () => {
    it('exports exactly the names the server’s shim module hands on', () => {
        expect(Object.keys(sdk).sort()).toEqual([...SDK_EXPORTS].sort());
        expect(Object.values(sdk).every(value => value !== undefined)).toBe(true);
        expect(sdk.GLASSBOARD_VERSION).toBe(version);
    });
});
