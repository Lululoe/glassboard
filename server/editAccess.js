import crypto from 'crypto';
import { getBaseConfig } from './config.js';
import { HttpError } from './errors.js';
import logger from './logger.js';

/** Request header that carries the edit key, which the browser gets by entering the password. */
export const EDIT_HEADER = 'x-glassboard-edit';

/** Wrong passwords one address may try before it has to wait. */
export const MAX_FAILED_ATTEMPTS = 10;
/** How long an address waits after too many wrong passwords. */
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Shortest password accepted, so it can't be guessed within the attempts allowed. */
export const MIN_PASSWORD_LENGTH = 8;

/** @type {Map<string, {count: number, since: number}>} Wrong passwords per address */
const failures = new Map();

/**
 * The password that unlocks editing: EDIT_PASSWORD, if it is long enough.
 * @returns {string|null} The password, or null when editing can't be unlocked.
 */
export function editPassword() {
    const password = process.env.EDIT_PASSWORD;
    return typeof password === 'string' && password.trim().length >= MIN_PASSWORD_LENGTH ? password.trim() : null;
}

/**
 * Why editing is off, or null when it is on: it needs `editable: true` in config.yaml and an
 * EDIT_PASSWORD of at least MIN_PASSWORD_LENGTH characters.
 * @returns {string|null} The reason.
 */
export function editingBlocked() {
    if (getBaseConfig().editable !== true) return 'Editing is off; set editable: true in config.yaml to turn it on.';
    if (!process.env.EDIT_PASSWORD?.trim()) return 'Editing is off until an edit password is set in the EDIT_PASSWORD environment variable.';
    if (!editPassword()) return `Editing is off: EDIT_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters.`;
    return null;
}

/**
 * Whether editing is on: `editable: true` and a usable EDIT_PASSWORD.
 * @returns {boolean} True when it is.
 */
export const editingEnabled = () => editingBlocked() === null;

/**
 * The key a browser sends with each change once its user entered the password. It is derived
 * from the password, so it stays valid across restarts until the password changes, and the
 * password itself is never stored in the browser.
 * @param {string|null} [password] - The password.
 * @returns {string|null} The key, or null without a password.
 */
export function editKey(password = editPassword()) {
    if (!password) return null;
    return crypto.createHmac('sha256', password).update('glassboard-edit-key-v1').digest('base64url');
}

/**
 * Compares two strings in constant time.
 * @param {string} a - One.
 * @param {string} b - The other.
 * @returns {boolean} Whether they are equal.
 */
function same(a, b) {
    const hash = s => crypto.createHash('sha256').update(String(s)).digest();
    return crypto.timingSafeEqual(hash(a), hash(b));
}

/**
 * Whether a request carries the current edit key.
 * @param {import('express').Request} req - The request.
 * @returns {boolean} True when it does.
 */
export function hasEditKey(req) {
    const key = req.get(EDIT_HEADER);
    const expected = editKey();
    return expected !== null && typeof key === 'string' && key.length > 0 && same(key, expected);
}

/**
 * Throws unless editing is on (`editable: true` in config.yaml and EDIT_PASSWORD set) and the request carries the edit
 * key. The dashboard has no login, so while editing is on the password is what keeps others from
 * changing which Home Assistant entities and actions it controls, or installing plugins.
 * @param {import('express').Request} req - The request.
 * @throws {HttpError} 403 when editing is off, 401 (code `edit_locked`) without the key.
 */
export function assertEditable(req) {
    const blocked = editingBlocked();
    if (blocked) throw new HttpError(403, blocked);
    if (!hasEditKey(req)) throw new HttpError(401, 'Enter the edit password to make changes.', 'edit_locked');
}

/**
 * Whether editing is on and whether a request carries the edit key.
 * @param {import('express').Request} req - The request.
 * @returns {{editable: boolean, unlocked: boolean}} The state.
 */
export function getEditState(req) {
    const editable = editingEnabled();
    return { editable, unlocked: editable && hasEditKey(req) };
}

/**
 * Checks an entered password and answers the edit key. An address that enters a wrong password
 * too often has to wait.
 * @param {import('express').Request} req - The request, for its address.
 * @param {unknown} password - What was entered.
 * @returns {string} The edit key.
 * @throws {HttpError} 403 when editing is off, 429 while locked out, 401 for a wrong password.
 */
export function unlockEditing(req, password) {
    const blocked = editingBlocked();
    if (blocked) throw new HttpError(403, blocked);
    const address = req.ip || 'unknown';
    const now = Date.now();
    for (const [ip, entry] of failures) {
        if (now - entry.since > LOCKOUT_MS) failures.delete(ip);
    }
    const entry = failures.get(address);
    if (entry && entry.count >= MAX_FAILED_ATTEMPTS) {
        const minutes = Math.ceil((LOCKOUT_MS - (now - entry.since)) / 60000);
        throw new HttpError(429, `Too many wrong passwords. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`);
    }
    const expected = /** @type {string} */ (editPassword());
    if (typeof password === 'string' && password.length > 0 && same(password.trim(), expected)) {
        failures.delete(address);
        logger.info(`Editing unlocked from ${address}`);
        return editKey();
    }
    failures.set(address, { count: (entry?.count ?? 0) + 1, since: entry?.since ?? now });
    logger.warn(`Wrong edit password from ${address}`);
    throw new HttpError(401, 'That password is wrong.', 'wrong_password');
}

/**
 * Says at start, and when config.yaml turns editing on, whether editing works. The password
 * itself is never logged.
 */
export function announceEditing() {
    if (getBaseConfig().editable !== true) return;
    const blocked = editingBlocked();
    if (blocked) logger.warn(`config.yaml has editable: true, but ${blocked.charAt(0).toLowerCase()}${blocked.slice(1)}`);
    else logger.info('Editing is on; it needs the password set in EDIT_PASSWORD');
}

/** Forgets wrong passwords. For tests. */
export function resetEditAccess() {
    failures.clear();
}
