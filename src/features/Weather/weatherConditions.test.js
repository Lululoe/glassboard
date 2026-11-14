import { describe, expect, it } from 'vitest';
import { CONDITION_ART, CONDITION_ICONS, conditionKind } from './weatherConditions';

describe('weather conditions', () => {
    it('sorts the names weather services use', () => {
        expect(conditionKind('partlycloudy')).toBe('partly');
        expect(conditionKind('Light rain')).toBe('rain');
        expect(conditionKind('lightning-rainy')).toBe('storm');
        expect(conditionKind('Clear')).toBe('clear');
        expect(conditionKind('Overcast')).toBe('cloud');
        expect(conditionKind(undefined)).toBe('cloud');
    });

    it('has an icon and an evenly sized ASCII drawing for every kind', () => {
        Object.keys(CONDITION_ICONS).forEach(kind => {
            expect(CONDITION_ART[kind]).toHaveLength(3);
            CONDITION_ART[kind].forEach(line => expect(line).toHaveLength(9));
        });
    });
});
