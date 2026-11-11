import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { headerBarHides } from '../../../shared/pageHeader';
import Header from './Header';

const bar = () => document.querySelector('.app-header');

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

describe('Header auto-hide', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('hides with the page header or always, never by default', () => {
        expect(headerBarHides(undefined, true)).toBe(false);
        expect(headerBarHides('never', true)).toBe(false);
        expect(headerBarHides('with-page-header', true)).toBe(true);
        expect(headerBarHides('with-page-header', false)).toBe(false);
        expect(headerBarHides('always', false)).toBe(true);
    });

    it('stays visible without auto-hide', () => {
        render(<Header config={{}} />);
        expect(bar()).not.toHaveClass('is-auto-hide');
        expect(document.querySelector('.header-reveal')).toBeNull();
    });

    it('shows while the pointer is on the top edge or the bar, and hides again after it leaves', () => {
        render(<Header config={{}} autoHide />);
        expect(bar()).toHaveClass('is-hidden');
        fireEvent.pointerEnter(document.querySelector('.header-reveal'), { pointerType: 'mouse' });
        expect(bar()).not.toHaveClass('is-hidden');
        fireEvent.pointerLeave(bar(), { pointerType: 'mouse' });
        expect(bar()).not.toHaveClass('is-hidden');
        act(() => vi.advanceTimersByTime(1000));
        expect(bar()).toHaveClass('is-hidden');
    });

    it('shows for a few seconds after a tap at the top of a touch screen', () => {
        render(<Header config={{}} autoHide />);
        fireEvent.click(document.querySelector('.header-reveal'));
        expect(bar()).not.toHaveClass('is-hidden');
        act(() => vi.advanceTimersByTime(3000));
        expect(bar()).not.toHaveClass('is-hidden');
        act(() => vi.advanceTimersByTime(1500));
        expect(bar()).toHaveClass('is-hidden');
    });

    it('shows when reached with the keyboard and while its menu is open', () => {
        render(<Header config={{ launcher: { apps: [] } }} autoHide />);
        fireEvent.focus(screen.getByRole('button', { name: 'Apps' }));
        expect(bar()).not.toHaveClass('is-hidden');
        fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
        fireEvent.blur(screen.getByRole('button', { name: 'Apps' }), { relatedTarget: document.body });
        act(() => vi.advanceTimersByTime(2000));
        expect(bar()).not.toHaveClass('is-hidden');
    });
});
