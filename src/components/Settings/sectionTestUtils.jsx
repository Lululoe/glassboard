import { act, render } from '@testing-library/react';
import { SettingsSectionContext } from './settingsSection';

/**
 * Renders a section of the settings window on its own, for tests.
 * @param {import('react').ReactElement} ui - The section.
 * @returns {ReturnType<typeof render> & {save: () => Promise<void>}} The render result (`rerender` keeps
 *   the section in the window), and `save`,
 *   which does what the window's Save does with the section; it rejects when the section can't be saved.
 */
export function renderSection(ui) {
    /** @type {Array<() => (void|Promise<void>)>} */
    const commits = [];
    const register = (commit) => {
        commits.push(commit);
        return () => {
            const at = commits.indexOf(commit);
            if (at >= 0) commits.splice(at, 1);
        };
    };
    const wrap = (/** @type {import('react').ReactElement} */ el) => <SettingsSectionContext value={register}>{el}</SettingsSectionContext>;
    const result = render(wrap(ui));
    const save = async () => {
        let failure = null;
        await act(async () => {
            try {
                for (const commit of [...commits]) await commit();
            } catch (err) {
                failure = err;
            }
        });
        if (failure) throw failure;
    };
    return { ...result, rerender: (/** @type {import('react').ReactElement} */ el) => result.rerender(wrap(el)), save };
}
