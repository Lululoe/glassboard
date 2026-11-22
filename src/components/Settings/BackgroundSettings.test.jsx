import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BackgroundSettings from './BackgroundSettings';
import { renderSection } from './sectionTestUtils';

describe('BackgroundSettings', () => {
    afterEach(() => vi.unstubAllGlobals());

    it("keeps the theme's background by default", async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        expect(screen.getByRole('radio', { name: 'Theme' })).toHaveAttribute('aria-checked', 'true');
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: undefined, pageBackground: undefined }));
    });

    it('makes the gradient from a picked or custom color', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Color' }));
        fireEvent.click(screen.getByRole('radio', { name: '#1f8a4c' }));
        fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#123456' } });
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { color: '#123456' }, pageBackground: undefined }));
    });

    it('adds a moving layer to the theme gradient or a color', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings background={{ color: '#5e3bd1' }} onSave={onSave} />);
        expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByRole('radio', { name: 'Aurora' }));
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { color: '#5e3bd1', motion: 'aurora' }, pageBackground: undefined }));

    });

    it('shows the weather, live or with a fixed effect', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Weather' }));
        expect(screen.getByRole('radio', { name: 'Live' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByRole('radio', { name: 'Snow' }));
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { motion: 'weather', weather: 'snow' }, pageBackground: undefined }));
    });

    it("can move the theme's own gradient", async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Matrix' }));
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { motion: 'matrix' }, pageBackground: undefined }));
    });

    it('uploads a picture and saves it with its darkening', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: '/api/config/background/a.jpg' }) })));
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Picture' }));
        await expect(save()).rejects.toThrow('Choose a picture');

        const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
        fireEvent.change(screen.getByLabelText('Picture file'), { target: { files: [file] } });
        await waitFor(() => expect(screen.getByLabelText('Or a web address')).toHaveValue('/api/config/background/a.jpg'));
        expect(fetch).toHaveBeenCalledWith('/api/config/background', expect.objectContaining({ method: 'POST', body: file }));

        fireEvent.change(screen.getByLabelText(/Darken/), { target: { value: '0.4' } });
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { image: '/api/config/background/a.jpg', dim: 0.4 }, pageBackground: undefined }));
    });

    it('downloads a picture from a web address before saving it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: '/api/config/background/b.webp' }) })));
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings onSave={onSave} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Picture' }));
        fireEvent.change(screen.getByLabelText('Or a web address'), { target: { value: 'https://x.test/wall.webp' } });
        await save();

        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { image: '/api/config/background/b.webp', dim: 0.25 }, pageBackground: undefined }));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ url: 'https://x.test/wall.webp' });
    });

    it("isn't saved, with the reason, when the download fails", async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({ error: 'x.test answered 403' }) })));
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings background={{ image: 'https://x.test/wall.webp' }} onSave={onSave} />);
        await expect(save()).rejects.toThrow('x.test answered 403');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('gives one page its own background and keeps that of all pages', async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings background={{ color: '#5e3bd1' }} pageName="Garden" onSave={onSave} />);
        fireEvent.click(screen.getByRole('tab', { name: 'This page: Garden' }));
        expect(screen.getByRole('radio', { name: 'All pages' })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByRole('radio', { name: 'Color' }));
        fireEvent.click(screen.getByRole('radio', { name: '#1f8a4c' }));
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { color: '#5e3bd1' }, pageBackground: { color: '#1f8a4c' } }));
    });

    it("opens on the page's own background, and can show the theme's there", async () => {
        const onSave = vi.fn();
        const { save } = renderSection(<BackgroundSettings background={{ color: '#5e3bd1' }} pageBackground={{ color: '#1f8a4c' }} pageName="Garden" onSave={onSave} />);
        expect(screen.getByRole('tab', { name: 'This page: Garden' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('radio', { name: 'Theme' }));
        await save();
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ background: { color: '#5e3bd1' }, pageBackground: { theme: true } }));
    });

    it('opens on the saved picture', () => {
        renderSection(<BackgroundSettings background={{ image: 'https://x.test/p.jpg', dim: 0.2 }} onSave={() => {}} />);
        expect(screen.getByRole('radio', { name: 'Picture' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByLabelText('Darken: 20%')).toHaveValue('0.2');
    });
});
