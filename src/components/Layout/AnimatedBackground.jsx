import { useEffect, useRef } from 'react';
import { backgroundMotion, backgroundWeather, isBackgroundColor } from '../../../shared/pageBackground.js';
import WeatherBackground from './WeatherBackground';
import './AnimatedBackground.css';

/** Characters the matrix rain is made of. */
const RAIN = '01<>/{}[]=+*#$%&;:~|';
/** Frames per second of the matrix rain; low enough for a Raspberry Pi. */
const RAIN_FPS = 20;

/**
 * Falling characters in the accent color, drawn on a canvas. Draws one still frame for people
 * who asked for less motion, and pauses while the tab is hidden.
 * @returns {JSX.Element} The canvas.
 */
const MatrixRain = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext?.('2d');
        if (!ctx) return undefined;
        const size = 16;
        let drops = [];
        const style = getComputedStyle(document.documentElement);
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50);
        };
        const tick = () => {
            if (document.hidden) return;
            const light = document.documentElement.getAttribute('data-theme') === 'light';
            // Fading the last frame leaves trails behind the falling characters
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = style.getPropertyValue('--color-primary').trim() || '#30d158';
            ctx.globalAlpha = light ? 0.5 : 0.8;
            ctx.font = `${size - 2}px ${style.getPropertyValue('--font-mono') || 'monospace'}`;
            drops.forEach((y, i) => {
                ctx.fillText(RAIN[Math.floor(Math.random() * RAIN.length)], i * size, y * size);
                drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
            });
            ctx.globalAlpha = 1;
        };
        resize();
        window.addEventListener('resize', resize);
        // Start with the rain already falling
        for (let i = 0; i < 60; i++) tick();
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const timer = still ? 0 : setInterval(tick, 1000 / RAIN_FPS);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="page-motion-canvas" />;
};

/**
 * A moving layer over the page background: soft drifting color fields (`aurora`), shapes
 * floating behind the cards (`blobs`), falling characters (`matrix`), or the weather outside
 * (`weather`, see WeatherBackground). Aurora and blobs take
 * their colors from the background's color when it has one. Nothing moves for people who asked
 * for less motion.
 * @param {Object} props
 * @param {{color?: string, motion?: string, weather?: string}|null|undefined} props.background - The background of the page shown.
 * @returns {JSX.Element|null} The layer, or null for a still background.
 */
const AnimatedBackground = ({ background }) => {
    const motion = backgroundMotion(background);
    if (!motion) return null;
    if (motion === 'weather') {
        return (
            <div className="page-motion motion-weather" aria-hidden="true">
                <WeatherBackground fixed={backgroundWeather(background)} />
            </div>
        );
    }
    const color = isBackgroundColor(background?.color) ? background.color : null;
    const colors = color ? /** @type {import('react').CSSProperties} */ ({
        '--motion-a': color,
        '--motion-b': `color-mix(in srgb, ${color} 55%, #8a5cff)`,
        '--motion-c': `color-mix(in srgb, ${color} 55%, #00d2b4)`,
    }) : undefined;
    return (
        <div className={`page-motion motion-${motion}`} style={colors} aria-hidden="true">
            {motion === 'matrix' ? <MatrixRain /> : <><i /><i /><i />{motion === 'blobs' && <><i /><i /><i /></>}</>}
        </div>
    );
};

export default AnimatedBackground;
