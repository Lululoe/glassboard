import { describe, it, expect } from 'vitest';
import { formatFullTime, formatRelativeTime, formatUsage } from './format';

describe('format', () => {
    it('shows usage in one unit, chosen from the total', () => {
        expect(formatUsage(28.4, 64)).toBe('28.4 / 64 GB');
        expect(formatUsage(1204, 1863)).toBe('1.2 / 1.8 TB');
    });

    it('shows times relative to now', () => {
        const now = new Date('2026-11-01T12:00:00Z');
        const ago = (minutes) => new Date(now.getTime() - minutes * 60000).toISOString();
        expect(formatRelativeTime(ago(5), now)).toMatch(/5 min/);
        expect(formatRelativeTime(ago(180), now)).toMatch(/3 hours/);
        expect(formatRelativeTime(ago(60 * 24 * 3), now)).toMatch(/3 days/);
        expect(formatRelativeTime(ago(60 * 24 * 90), now)).toMatch(/2026/);
    });

    it('passes on what is not a date', () => {
        expect(formatRelativeTime('1h ago')).toBe('1h ago');
        expect(formatRelativeTime(undefined)).toBe('');
        expect(formatFullTime('1h ago')).toBeUndefined();
    });
});
