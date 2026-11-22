import { useState } from 'react';
import { Group } from '../Editor/EditorFields';

/**
 * Reset section of the settings window: goes back to config.yaml, after asking. It happens right
 * away, without the window's Save, and can be undone from the header just after.
 * @param {Object} props
 * @param {() => void} props.onReset - Resets the dashboard.
 * @returns {JSX.Element} The section.
 */
const ResetSettings = ({ onReset }) => {
    const [confirming, setConfirming] = useState(false);
    return (
        <div className="settings-form">
            <Group
                title="Reset Dashboard"
                description="Removes everything changed in the browser, including cards and pages you added, and goes back to config.yaml. You can undo it right after."
            >
                {confirming ? (
                    <div className="settings-confirm">
                        <span>Reset the whole dashboard?</span>
                        <button type="button" className="button-reset editor-dialog-action" onClick={() => setConfirming(false)}>Keep</button>
                        <button type="button" className="button-reset editor-dialog-action destructive" onClick={onReset}>Reset Dashboard</button>
                    </div>
                ) : (
                    <button type="button" className="button-reset settings-danger-button" onClick={() => setConfirming(true)}>
                        Reset Dashboard…
                    </button>
                )}
            </Group>
        </div>
    );
};

export default ResetSettings;
