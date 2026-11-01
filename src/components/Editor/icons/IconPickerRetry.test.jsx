import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import IconPicker from './IconPicker';

afterEach(() => vi.unstubAllGlobals());

describe('IconPicker when a catalog fails', () => {
    it('offers a retry, which loads it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
        render(<IconPicker value="sh-plex" onChange={() => {}} />);
        await screen.findByRole('button', { name: 'try again' });

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => [{ Name: 'Plex', Reference: 'plex', SVG: 'Yes', Light: 'Yes', Tags: '' }],
        })));
        fireEvent.click(screen.getByRole('button', { name: 'try again' }));
        expect(await screen.findByRole('button', { name: 'Plex' })).toHaveAttribute('aria-pressed', 'true');
    });
});
