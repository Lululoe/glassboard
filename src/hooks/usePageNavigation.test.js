import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePageNavigation } from './usePageNavigation';

const pages = [{ id: 'home' }, { id: 'secret', hidden: true }, { id: 'server' }];

describe('usePageNavigation', () => {
    beforeEach(() => window.history.replaceState(null, '', '/'));

    it('resolves a deep link once the pages load', () => {
        window.history.replaceState(null, '', '/server');
        const { result, rerender } = renderHook(({ list }) => usePageNavigation(list), { initialProps: { list: [] } });

        rerender({ list: pages });
        expect(result.current.pageIndex).toBe(2);
        expect(window.location.pathname).toBe('/server');
    });

    it('opens the first page for the root URL and normalizes the path', () => {
        const { result } = renderHook(() => usePageNavigation(pages));
        expect(result.current.pageIndex).toBe(0);
        expect(window.location.pathname).toBe('/home');
    });

    it('skips hidden pages but allows opening them by URL', () => {
        const { result } = renderHook(() => usePageNavigation(pages));
        act(() => result.current.next());
        expect(result.current.pageIndex).toBe(2);
        expect(window.location.pathname).toBe('/server');
        expect(result.current.hasNext).toBe(false);

        window.history.replaceState(null, '', '/secret');
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        expect(result.current.pageIndex).toBe(1);
    });

    it('uses the index for pages without an id', () => {
        window.history.replaceState(null, '', '/1');
        const { result } = renderHook(() => usePageNavigation([{}, {}]));
        expect(result.current.pageIndex).toBe(1);
    });
});
