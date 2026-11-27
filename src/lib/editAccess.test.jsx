import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import UnlockDialog from '../components/Editor/UnlockDialog';
import { EDIT_HEADER, editFetch, ensureUnlocked, finishUnlock, getEditKey, requestUnlock, setEditKey, unlock, unlockAsked } from './editAccess';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const LOCKED = () => json(401, { error: 'Enter the edit password to make changes.', code: 'edit_locked' });

describe('edit password in the browser', () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    });

    afterEach(() => {
        finishUnlock(false);
        setEditKey(null);
        vi.unstubAllGlobals();
    });

    it('sends the key with changes and keeps it across visits', async () => {
        const fetchMock = vi.fn(async () => json(200, { ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        setEditKey('k1');
        expect(localStorage.getItem('glassboard.editKey')).toBe('k1');
        await editFetch('/api/config/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
        expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', [EDIT_HEADER]: 'k1' });
        setEditKey(null);
        expect(localStorage.getItem('glassboard.editKey')).toBeNull();
    });

    it('asks for the password when the server refuses the key, then sends the change again', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(LOCKED()).mockResolvedValueOnce(json(200, { ok: true }));
        vi.stubGlobal('fetch', fetchMock);
        setEditKey('old');
        const sent = editFetch('/api/config/layout', { method: 'DELETE' });
        await vi.waitFor(() => expect(unlockAsked()).toBe(true));
        setEditKey('new');
        finishUnlock(true);
        expect((await sent).status).toBe(200);
        expect(fetchMock.mock.calls[1][1].headers).toEqual({ [EDIT_HEADER]: 'new' });
    });

    it('gives up when the password isn’t entered', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => LOCKED()));
        const sent = editFetch('/api/config/layout', { method: 'DELETE' });
        await vi.waitFor(() => expect(unlockAsked()).toBe(true));
        finishUnlock(false);
        expect((await sent).status).toBe(401);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('checks the key before edit mode starts', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(200, { editable: true, unlocked: true })));
        setEditKey('good');
        expect(await ensureUnlocked()).toBe(true);

        vi.stubGlobal('fetch', vi.fn(async () => json(200, { editable: true, unlocked: false })));
        const asked = ensureUnlocked();
        await vi.waitFor(() => expect(unlockAsked()).toBe(true));
        expect(getEditKey()).toBeNull();
        finishUnlock(false);
        expect(await asked).toBe(false);
    });

    it('keeps the key the password unlocks, and says why a password is refused', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(401, { error: 'That password is wrong.', code: 'wrong_password' })).mockResolvedValueOnce(json(200, { key: 'k2' })));
        await expect(unlock('nope')).rejects.toThrow('That password is wrong.');
        await unlock('right');
        expect(getEditKey()).toBe('k2');
    });

    it('asks in a dialog', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(json(401, { error: 'That password is wrong.', code: 'wrong_password' }))
            .mockResolvedValueOnce(json(200, { key: 'k3' })));
        render(<UnlockDialog />);
        expect(screen.queryByRole('dialog')).toBeNull();

        let answer;
        act(() => { answer = requestUnlock(); });
        const field = await screen.findByLabelText('Edit password');
        fireEvent.change(field, { target: { value: 'nope' } });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That password is wrong.');

        fireEvent.change(field, { target: { value: 'right' } });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
        expect(await answer).toBe(true);
        expect(getEditKey()).toBe('k3');
        await vi.waitFor(() => expect(screen.queryByLabelText('Edit password')).toBeNull());
    });
});
