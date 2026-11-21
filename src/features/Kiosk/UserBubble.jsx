import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import './UserBubble.css';

/** Avatar colours; each name always gets the same one. */
const GRADIENTS = 4;

/**
 * Which avatar colour a name gets.
 * @param {string} name - The name.
 * @returns {number} 0 to GRADIENTS - 1.
 */
const colourOf = (name) => [...name].reduce((sum, ch) => (sum * 31 + ch.codePointAt(0)) % 9973, 7) % GRADIENTS;

/**
 * The address of the logged-in person's profile picture. The name only keeps one person's
 * picture from being shown, from the cache, for the next.
 * @param {string} name - The person.
 * @returns {string} The address.
 */
const pictureOf = (name) => `/api/ha/kiosk-avatar?name=${encodeURIComponent(name)}`;

/**
 * A round avatar: the person's profile picture from Home Assistant, or their initial when they
 * have none.
 * @param {Object} props
 * @param {string} props.name - The person.
 * @param {boolean} [props.large] - The size of the popover, rather than of the header icons.
 * @returns {JSX.Element} The avatar.
 */
const Avatar = ({ name, large = false }) => {
    const picture = pictureOf(name);
    const [failed, setFailed] = useState(/** @type {string|null} */ (null));
    return (
        <span className={`user-avatar user-avatar-${colourOf(name)}${large ? ' is-large' : ''}`} aria-hidden="true">
            {[...name][0].toUpperCase()}
            {failed !== picture && (
                <img className="user-avatar-picture" src={picture} alt="" draggable={false} onError={() => setFailed(picture)} />
            )}
        </span>
    );
};

/**
 * A time of day, like 14:05.
 * @param {Date} date - The time.
 * @returns {string} The time.
 */
const timeText = (date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * The bubble in the header that shows who is logged in on the kiosk tablet. Tapping it shows
 * their name, since when they are logged in and until when, and a button to log them out.
 * @param {Object} props
 * @param {import('./useKioskUser').KioskUser} props.user - The person logged in.
 * @returns {JSX.Element} The bubble and, when open, its popover.
 */
const UserBubble = ({ user }) => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const dialogRef = useRef(null);

    useEffect(() => {
        if (open) dialogRef.current?.showModal?.();
    }, [open]);

    /** Closes the popover, and forgets a failed logout. */
    const close = () => {
        setOpen(false);
        setFailed(false);
    };

    /** Logs the person out; the bubble goes once they are. */
    const logout = async () => {
        setBusy(true);
        setFailed(false);
        try {
            await user.logout();
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                className={`button-reset icon-button user-bubble${open ? ' active' : ''}`}
                onClick={() => (open ? close() : setOpen(true))}
                title={`${user.name} is logged in`}
                aria-label={`${user.name} is logged in`}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <Avatar name={user.name} />
            </button>
            {open && (
                <dialog
                    ref={dialogRef}
                    className="user-popover"
                    aria-label="Logged in"
                    onClose={close}
                    // The dialog fills only its box, so a click on the element itself is on the backdrop
                    onClick={(e) => { if (e.target === e.currentTarget) close(); }}
                >
                    <div className="user-popover-person">
                        <Avatar name={user.name} large />
                        <div>
                            <strong>{user.name}</strong>
                            <span>
                                {user.since ? `Logged in since ${timeText(user.since)}` : 'Logged in'}
                                {user.expires ? `, until ${timeText(user.expires)}` : ''}
                            </span>
                        </div>
                    </div>
                    {user.logout && (
                        <button type="button" className="button-reset user-popover-logout" onClick={logout} disabled={busy}>
                            <LogOut size={16} aria-hidden="true" />
                            {busy ? 'Logging out…' : 'Log Out'}
                        </button>
                    )}
                    {failed && <p className="user-popover-error" role="alert">Couldn’t log out.</p>}
                </dialog>
            )}
        </>
    );
};

export default UserBubble;
