import { createContext, useContext } from 'react';

/**
 * The entities the server lets page header widgets read: those of the widgets in the saved
 * config. Widgets added while editing show their values once they are saved. `null` (outside
 * the dashboard, e.g. in tests) allows every entity.
 */
export const HeaderEntitiesContext = createContext(/** @type {Set<string>|null} */ (null));

/**
 * Returns the entities page header widgets can read.
 * @returns {Set<string>|null} The entity ids, or null for all.
 */
export const useHeaderEntities = () => useContext(HeaderEntitiesContext);
