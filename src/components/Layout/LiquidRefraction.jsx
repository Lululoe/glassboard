import { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { startRefraction } from '../../styles/refraction.js';

/** Glass surfaces whose rim bends the backdrop in the Liquid Glass style. */
export const REFRACTED_SURFACES = '.glass-card, .ha-tile.off, .header-right > button, .sidebar-rail';

/**
 * Bends the backdrop at the rim of glass surfaces while the Liquid Glass style is shown with
 * refraction on and supported. Renders nothing.
 * @returns {null} Nothing.
 */
const LiquidRefraction = () => {
    const { refraction } = useTheme();

    useEffect(() => {
        if (!refraction.active) return undefined;
        return startRefraction(REFRACTED_SURFACES);
    }, [refraction.active]);

    return null;
};

export default LiquidRefraction;
