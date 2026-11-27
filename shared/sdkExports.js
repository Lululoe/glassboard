/**
 * The names `@glassboard/sdk` exports to plugins, in the browser. The server needs the list to
 * write the module plugins import (`/_glassboard/modules/sdk.js`), and a test checks it against
 * `src/sdk/index.js`. Adding a name is fine; removing or changing one breaks plugins, so it
 * needs a new major version of Glassboard.
 */
export const SDK_EXPORTS = [
    // Card frames and parts
    'BaseCard',
    'TwoToneBase',
    'StatusPill',
    'UsageBar',
    'EmptyState',
    'Icon',
    // Settings forms for the card editor
    'Field',
    'Group',
    'TextField',
    'NumberField',
    'SegmentedField',
    'ToggleField',
    'ListField',
    'EntityPicker',
    'EntityListPicker',
    'setIn',
    // Data
    'callService',
    'usePolling',
    'BACKGROUND_FAST',
    'BACKGROUND_SLOW',
    'useHomeAssistant',
    'useNow',
    // Layout and theme
    'useElementSize',
    'useTheme',
    // Sidebar notices
    'useCardNotice',
    // Formatting
    'formatUsage',
    'formatRelativeTime',
    'formatFullTime',
    'plural',
    'usageLevel',
    'chartColor',
    // Version of Glassboard the page runs
    'GLASSBOARD_VERSION',
];

/**
 * Modules plugins import, which the page shares with them instead of each plugin bundling its
 * own copy. The import map in the page points each specifier at `/_glassboard/modules/<file>`.
 */
export const SHARED_MODULES = {
    react: 'react.js',
    'react/jsx-runtime': 'react-jsx-runtime.js',
    'react-dom': 'react-dom.js',
    '@glassboard/sdk': 'sdk.js',
};
