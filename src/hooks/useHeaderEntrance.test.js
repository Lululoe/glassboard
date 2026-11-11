import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHeaderEntrance } from './useHeaderEntrance';

const clock = { align: 'left', title: { type: 'clock' } };
const text = { align: 'left', title: { type: 'text', text: 'Hi' } };

describe('useHeaderEntrance', () => {
    it('enters when the dashboard opens and on pages with a different header', () => {
        const { result, rerender } = renderHook(({ header, page }) => useHeaderEntrance(header, page), {
            initialProps: { header: clock, page: 0 },
        });
        expect(result.current).toBe(true);
        rerender({ header: { ...clock }, page: 1 });
        expect(result.current).toBe(false);
        rerender({ header: text, page: 2 });
        expect(result.current).toBe(true);
    });

    it('holds still when the header is changed while editing the same page', () => {
        const { result, rerender } = renderHook(({ header, page }) => useHeaderEntrance(header, page), {
            initialProps: { header: clock, page: 0 },
        });
        rerender({ header: clock, page: 1 });
        rerender({ header: text, page: 1 });
        expect(result.current).toBe(false);
    });
});
