import { createContext, useContext } from 'react';

/**
 * Whether the page containing a component is the one currently shown.
 * Defaults to true so components rendered outside a page (and in tests) behave normally.
 */
export const PageActiveContext = createContext(true);

/**
 * Returns whether the surrounding dashboard page is currently visible.
 * @returns {boolean} True when the page is active.
 */
export const usePageActive = () => useContext(PageActiveContext);
