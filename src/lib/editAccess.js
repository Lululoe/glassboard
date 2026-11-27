import { useSyncExternalStore } from 'react';

/** Header that carries the edit key with each change. */
export const EDIT_HEADER = 'X-Glassboard-Edit';

const STORAGE_KEY = 'glassboard.editKey';

/**
 * Reads the edit key this browser keeps. Storage can be blocked, as in private windows.
 * @returns {string|null} The key.
 */
function readStored() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

let key = readStored();
/** @type {{promise: Promise<boolean>, resolve: (ok: boolean) => void}|null} */
let prompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());

/**
 * The edit key this browser got by entering the password, if any.
 * @returns {string|null} The key.
 */
export const getEditKey = () => key;

/**
 * Keeps an edit key in this browser, or forgets it with null, which locks editing here.
 * @param {string|null} value - The key.
 */
export function setEditKey(value) {
    key = value || null;
    try {
        if (key) localStorage.setItem(STORAGE_KEY, key);
        else localStorage.removeItem(STORAGE_KEY);
    } catch { /* kept for this visit only */ }
    notify();
}

/**
 * The header that sends the edit key, to add to a request that changes something.
 * @returns {Object<string, string>} The header, or none without a key.
 */
export const editHeaders = () => (key ? { [EDIT_HEADER]: key } : {});

/**
 * Asks for the edit password. The unlock dialog shows until it is entered or cancelled; asking
 * again meanwhile waits for the same answer.
 * @returns {Promise<boolean>} Whether editing was unlocked.
 */
export function requestUnlock() {
    if (!prompt) {
        let resolve;
        const promise = new Promise((r) => { resolve = r; });
        prompt = { promise, resolve };
        notify();
    }
    return prompt.promise;
}

/**
 * Closes the unlock dialog.
 * @param {boolean} unlocked - Whether the password was entered.
 */
export function finishUnlock(unlocked) {
    const current = prompt;
    prompt = null;
    notify();
    current?.resolve(unlocked);
}

/**
 * Whether the password is being asked for.
 * @returns {boolean} True while the unlock dialog shows.
 */
export const unlockAsked = () => prompt !== null;

/**
 * Whether the unlock dialog should show.
 * @returns {boolean} True while the password is asked for.
 */
export function useUnlockPrompt() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        unlockAsked,
        () => false,
    );
}

/**
 * Whether this browser has a key, as it changes.
 * @returns {boolean} True when editing is unlocked here.
 */
export function useEditUnlocked() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => key !== null,
        () => false,
    );
}

/**
 * Sends the password and keeps the key the server answers.
 * @param {string} password - What was entered.
 * @returns {Promise<void>} Resolves once unlocked.
 * @throws {Error} With the server's reason, such as a wrong password.
 */
export async function unlock(password) {
    const res = await fetch('/api/config/edit/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || typeof data?.key !== 'string') throw new Error(data?.error || `Unlocking failed (${res.status})`);
    setEditKey(data.key);
}

/**
 * Makes sure this browser may edit before edit mode starts: checks the key it has, and asks for
 * the password when it has none or the password has changed.
 * @returns {Promise<boolean>} Whether editing is unlocked.
 */
export async function ensureUnlocked() {
    if (key) {
        try {
            const res = await fetch('/api/config/edit', { headers: editHeaders(), cache: 'no-store' });
            const state = await res.json();
            if (state?.unlocked) return true;
            setEditKey(null);
        } catch {
            // The server can't be reached; the first change will say so
            return true;
        }
    }
    return requestUnlock();
}

/**
 * Sends a request that changes something, with the edit key. When the server asks for the
 * password, because this browser has no key or an old one, asks for it and sends the request
 * once more.
 * @param {string} url - The endpoint.
 * @param {RequestInit} [init] - As for fetch.
 * @returns {Promise<Response>} The response.
 */
export async function editFetch(url, init = {}) {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, { ...init, headers: { ...init.headers, ...editHeaders() } });
        if (res.status !== 401 || attempt > 0) return res;
        const data = await res.clone().json().catch(() => null);
        if (data?.code !== 'edit_locked') return res;
        setEditKey(null);
        if (!(await requestUnlock())) return res;
    }
}
