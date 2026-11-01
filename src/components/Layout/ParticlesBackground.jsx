import React, { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadFull } from 'tsparticles';
import { useTheme } from '../../context/ThemeContext';

/**
 * Renders an interactive particle background using tsparticles if enabled in the theme config.
 * @returns {JSX.Element|null} The particles canvas or null if disabled/uninitialized.
 */
const ParticlesBackground = () => {
    const { particles } = useTheme();
    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadFull(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    // Moving particles are decoration, so they stay away for people who asked for less motion
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!init || !particles || particles.enable === false || reducedMotion) {
        return null;
    }

    // Merge config but explicitly disable fullscreen to keep canvas in the normal flow
    const mergedOptions = {
        ...particles,
        fullScreen: {
            enable: false
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            pointerEvents: 'none'
        }}>
            <Particles
                id="tsparticles"
                options={mergedOptions}
            />
        </div>
    );
};

export default ParticlesBackground;
