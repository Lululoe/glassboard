import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRACTION_KEY, SCREEN_EFFECTS_KEY, ThemeProvider } from '../../context/ThemeContext';
import Header from './Header';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

/**
 * Renders the header inside a theme provider and opens the Theme menu.
 * @param {Object} config - The dashboard config.
 */
const openMenu = (config) => {
    render(<ThemeProvider config={config}><Header config={config} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
};

describe('Theme menu', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.documentElement.removeAttribute('data-style');
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-effects');
        document.documentElement.style.removeProperty('--surface-solid');
        document.documentElement.style.removeProperty('--surface-clear');
    });

    it('picks light or dark for this browser only', () => {
        openMenu({});
        fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(localStorage.getItem('theme-mode')).toBe('light');
        expect(fetch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('radio', { name: 'Automatic' }));
        expect(localStorage.getItem('theme-mode')).toBeNull();
    });

    it("saves the dashboard's style for everyone and shows it right away", async () => {
        openMenu({});
        expect(document.documentElement.getAttribute('data-style')).toBe('glass');
        fireEvent.click(screen.getByRole('radio', { name: /Material/ }));
        expect(document.documentElement.getAttribute('data-style')).toBe('material');
        expect(fetch).toHaveBeenCalledWith('/api/config/appearance', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ style: 'material' }),
        }));
    });

    it('goes back to the saved style and says why when saving fails', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Editing is disabled' }) });
        openMenu({ appearance: { style: 'liquid' } });
        fireEvent.click(screen.getByRole('radio', { name: /Neon/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Editing is disabled');
        await waitFor(() => expect(document.documentElement.getAttribute('data-style')).toBe('liquid'));
    });

    it('sets the accent color for everyone, or goes back to the theme color', () => {
        openMenu({});
        fireEvent.click(screen.getByRole('radio', { name: 'Pink' }));
        expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff375f');
        expect(fetch).toHaveBeenLastCalledWith('/api/config/appearance', expect.objectContaining({ body: JSON.stringify({ accent: '#ff375f' }) }));

        fireEvent.click(screen.getByRole('radio', { name: 'Theme color' }));
        expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
        expect(fetch).toHaveBeenLastCalledWith('/api/config/appearance', expect.objectContaining({ body: JSON.stringify({ accent: null }) }));
    });

    it('saves a picked color once the picker stops on it', () => {
        vi.useFakeTimers();
        openMenu({});
        const picker = screen.getByLabelText('Other color');
        fireEvent.change(picker, { target: { value: '#123456' } });
        fireEvent.change(picker, { target: { value: '#654321' } });
        expect(fetch).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('/api/config/appearance', expect.objectContaining({ body: JSON.stringify({ accent: '#654321' }) }));
        vi.useRealTimers();
    });

    it('cannot change the style when editing is off', () => {
        openMenu({ editable: false });
        expect(screen.getByRole('radio', { name: /Liquid Glass/ })).toBeDisabled();
        expect(screen.getByText('Set in config.yaml.')).toBeInTheDocument();
    });

    it('offers refraction with Liquid Glass, kept in this browser', () => {
        const userAgent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0 Safari/537.36');
        openMenu({ appearance: { style: 'liquid' } });
        const toggle = screen.getByRole('switch', { name: 'Refraction' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);
        expect(localStorage.getItem(REFRACTION_KEY)).toBe('off');
        expect(toggle).not.toBeChecked();
        userAgent.mockRestore();
    });

    it('says when the browser cannot refract', () => {
        const userAgent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15');
        openMenu({ appearance: { style: 'liquid' } });
        expect(screen.queryByRole('switch', { name: 'Refraction' })).toBeNull();
        expect(screen.getByText(/Not available in this browser/)).toBeInTheDocument();
        userAgent.mockRestore();
    });

    it('shows the Terminal screen effects by default and turns them off in this browser only', () => {
        openMenu({ appearance: { style: 'terminal' } });
        expect(document.documentElement.getAttribute('data-effects')).toBe('crt');
        const toggle = screen.getByRole('switch', { name: 'Screen effects' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);
        expect(document.documentElement.hasAttribute('data-effects')).toBe(false);
        expect(localStorage.getItem(SCREEN_EFFECTS_KEY)).toBe('off');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('offers Neon and holds Terminal back unless the dashboard uses it', () => {
        openMenu({});
        expect(screen.getByRole('radio', { name: /Neon/ })).toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /Terminal/ })).toBeNull();
    });

    it('still shows Terminal while the dashboard is set to it', () => {
        openMenu({ appearance: { style: 'terminal' } });
        expect(screen.getByRole('radio', { name: /Terminal/ })).toBeChecked();
    });

    it('makes Glass cards clearer while dragging and saves the transparency once it stops', async () => {
        vi.useFakeTimers();
        try {
            openMenu({});
            const slider = screen.getByRole('slider', { name: 'Transparency' });
            expect(slider).toHaveValue('0.5');
            fireEvent.change(slider, { target: { value: '0.7' } });
            fireEvent.change(slider, { target: { value: '1' } });
            expect(document.documentElement.style.getPropertyValue('--surface-clear')).toBe('0.25');
            expect(fetch).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(500);
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenLastCalledWith('/api/config/appearance', expect.objectContaining({ body: JSON.stringify({ transparency: 1 }) }));
        } finally {
            vi.useRealTimers();
        }
    });

    it('offers the transparency for Glass and Liquid Glass only', () => {
        openMenu({ appearance: { style: 'material' } });
        expect(screen.queryByRole('slider', { name: 'Transparency' })).toBeNull();
        expect(document.documentElement.style.getPropertyValue('--surface-clear')).toBe('');
    });

    it("can't change a theme config.yaml locks, but still picks light or dark", () => {
        openMenu({ appearance: { style: 'liquid', locked: true } });
        expect(screen.getByRole('radio', { name: /Material/ })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'Pink' })).toBeDisabled();
        expect(screen.getByRole('slider', { name: 'Transparency' })).toBeDisabled();
        expect(screen.getByText('The theme is locked in config.yaml.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('offers screen effects only with the Terminal style', () => {
        openMenu({ appearance: { style: 'material' } });
        expect(screen.queryByRole('switch', { name: 'Screen effects' })).toBeNull();
        expect(document.documentElement.hasAttribute('data-effects')).toBe(false);
    });

    it('is left out when the config turns the theme button off', () => {
        render(<ThemeProvider config={{ themeToggle: false }}><Header config={{ themeToggle: false }} /></ThemeProvider>);
        expect(screen.queryByRole('button', { name: 'Theme' })).toBeNull();
    });
});
