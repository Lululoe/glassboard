import { Group } from '../Editor/EditorFields';

/**
 * Lock section of the settings window: makes this browser forget the edit password, so editing
 * here needs it again. For tablets and other devices others use too.
 * @param {Object} props
 * @param {() => void} props.onLock - Saves the changes, leaves edit mode and locks.
 * @returns {JSX.Element} The section.
 */
const LockSettings = ({ onLock }) => (
    <div className="settings-form">
        <Group
            title="Lock This Device"
            description="This browser keeps editing unlocked after the edit password is entered once. Lock it on devices others use, such as a wall tablet. Your changes are saved first, as with Done."
        >
            <button type="button" className="button-reset settings-danger-button" onClick={onLock}>
                Save and Lock
            </button>
        </Group>
    </div>
);

export default LockSettings;
