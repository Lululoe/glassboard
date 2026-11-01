import { describe, it, expect } from 'vitest';
import { FOLLOW_TEXT, canTakeColor, iconTab, isMonochrome, readIcon, storedColor, writeIcon } from './iconModel';

describe('iconModel', () => {
    it('reads strings and the object form', () => {
        expect(readIcon('lu-Clock')).toEqual({ ref: 'lu-Clock', color: undefined });
        expect(readIcon({ source: 'sh', value: 'plex-light', color: '#fff' })).toEqual({ ref: 'sh-plex-light', color: '#fff' });
        expect(readIcon({ source: 'url', value: 'https://x/y.svg' }).ref).toBe('https://x/y.svg');
        expect(readIcon(undefined).ref).toBe('');
    });

    it('writes a string, or the object form when there is a color', () => {
        expect(writeIcon('mdi:fan')).toBe('mdi:fan');
        expect(writeIcon('mdi:fan', '#f00')).toEqual({ source: 'mdi', value: 'fan', color: '#f00' });
        expect(writeIcon('lu-Clock', '#f00')).toEqual({ source: 'lucide', value: 'Clock', color: '#f00' });
        expect(writeIcon('https://x/y.svg', '#f00')).toEqual({ source: 'url', value: 'https://x/y.svg', color: '#f00' });
    });

    it('round-trips through the object form', () => {
        ['lu-Clock', 'mdi:fan', 'sh-plex-light', 'local-mine', 'https://x/y.svg'].forEach((ref) => {
            expect(readIcon(writeIcon(ref, '#000')).ref).toBe(ref);
        });
    });

    it('finds the tab of an icon', () => {
        expect(iconTab('lu-Clock')).toBe('lucide');
        expect(iconTab('Mail')).toBe('lucide');
        expect(iconTab('mdi:fan')).toBe('mdi');
        expect(iconTab('sh-plex')).toBe('selfhst');
        expect(iconTab('https://x/y.png')).toBe('image');
    });

    it('knows which icons take a color', () => {
        expect(canTakeColor('lu-Clock')).toBe(true);
        expect(canTakeColor('mdi:fan')).toBe(true);
        expect(canTakeColor('sh-plex-light')).toBe(true);
        expect(canTakeColor('sh-plex')).toBe(false);
        expect(canTakeColor('sh-plex-png')).toBe(false);
        expect(canTakeColor('https://x/y.svg')).toBe(true);
        expect(canTakeColor('https://x/y.png')).toBe(false);
        expect(isMonochrome('sh-home-assistant-dark')).toBe(true);
    });

    it('makes monochrome icons follow the text color unless one is chosen', () => {
        expect(storedColor('sh-plex-light')).toBe(FOLLOW_TEXT);
        expect(storedColor('sh-plex-light', '#f00')).toBe('#f00');
        expect(storedColor('lu-Clock', FOLLOW_TEXT)).toBeUndefined();
        expect(storedColor('lu-Clock', '#f00')).toBe('#f00');
        expect(storedColor('sh-plex', '#f00')).toBeUndefined();
    });
});
