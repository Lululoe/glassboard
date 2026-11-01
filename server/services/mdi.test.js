// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as paths from '@mdi/js';
import { exportName, iconName, mdiNames, mdiSvg } from './mdi.js';

describe('mdi', () => {
    it('turns export names into icon names', () => {
        expect(iconName('mdiLightbulbOff')).toBe('lightbulb-off');
        expect(iconName('mdiPrinter3dNozzle')).toBe('printer-3d-nozzle');
        expect(iconName('mdiAlphaABox')).toBe('alpha-a-box');
        expect(iconName('mdiNumeric10Box')).toBe('numeric-10-box');
    });

    it('lists names that all resolve to an icon', async () => {
        const names = await mdiNames();
        expect(names.length).toBeGreaterThan(7000);
        expect(names).toContain('robot-vacuum');
        expect(names.filter(name => typeof paths[exportName(name)] !== 'string')).toEqual([]);
        expect(await mdiSvg('axis-x-y-arrow-lock')).toContain('<svg');
    });
});
