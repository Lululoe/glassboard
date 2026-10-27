import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PageActiveContext } from '../context/pageActive';
import { usePolling } from './usePolling';

/**
 * Test component that renders the polled value.
 * @param {Object} props
 * @param {() => Promise<string>} props.fetcher - Fetch function.
 * @returns {JSX.Element} The polled value.
 */
const Probe = ({ fetcher }) => {
    const { data } = usePolling(fetcher, { interval: 1000 });
    return <span>{data ?? 'none'}</span>;
};

describe('usePolling', () => {
    afterEach(() => vi.useRealTimers());

    it('fetches immediately and then on the interval', async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn(async () => 'value');
        renderHook(() => usePolling(fetcher, { interval: 1000 }));

        await act(async () => {});
        expect(fetcher).toHaveBeenCalledTimes(1);

        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('keeps the last data and reports errors', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce('first')
            .mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => usePolling(fetcher));

        await waitFor(() => expect(result.current.data).toBe('first'));
        act(() => result.current.refresh());
        await waitFor(() => expect(result.current.error).toBe('offline'));
        expect(result.current.data).toBe('first');
    });

    it('does not fetch when disabled', () => {
        const fetcher = vi.fn(async () => 'x');
        const { result } = renderHook(() => usePolling(fetcher, { enabled: false }));
        expect(fetcher).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });

    it('pauses on inactive pages and resumes when the page becomes active', async () => {
        const fetcher = vi.fn(async () => 'loaded');
        const { rerender } = render(
            <PageActiveContext value={false}><Probe fetcher={fetcher} /></PageActiveContext>
        );
        expect(fetcher).not.toHaveBeenCalled();

        rerender(<PageActiveContext value={true}><Probe fetcher={fetcher} /></PageActiveContext>);
        expect(await screen.findByText('loaded')).toBeInTheDocument();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('pauses while the browser tab is hidden', async () => {
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        const fetcher = vi.fn(async () => 'x');
        renderHook(() => usePolling(fetcher));
        expect(fetcher).not.toHaveBeenCalled();

        visibility.mockReturnValue('visible');
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        visibility.mockRestore();
    });
});
