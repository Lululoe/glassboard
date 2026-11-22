import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * Given by the settings window to each of its sections: registers what the section does when
 * the window's Save is pressed, and returns a function that unregisters it.
 * @type {import('react').Context<((commit: () => (void|Promise<void>)) => () => void)|null>}
 */
export const SettingsSectionContext = createContext(null);

/**
 * Registers what a section of the settings window keeps when Save is pressed. The window keeps a
 * section open from the first time it is shown until it closes, so its changes wait for Save
 * while other sections are shown. Throwing stops saving, shows the section and the error's message.
 * @param {() => (void|Promise<void>)} commit - Keeps the section's changes.
 */
export function useSectionCommit(commit) {
    const register = useContext(SettingsSectionContext);
    const latest = useRef(commit);
    useEffect(() => {
        latest.current = commit;
    });
    useEffect(() => register?.(() => latest.current()), [register]);
}
