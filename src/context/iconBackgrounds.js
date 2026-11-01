import { createContext } from 'react';

/**
 * The user's own icon background presets, shared by every icon on the dashboard.
 * @type {import('react').Context<{presets: string[], onChange: (presets: string[]) => void}>}
 */
export const IconBackgroundsContext = createContext({ presets: [], onChange: () => {} });
