import { useEffect, useRef } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { useTheme } from '../../context/ThemeContext';
import { weatherScene } from './weatherScene';
import { startRain, startSnow } from './weatherEffects';
import './WeatherBackground.css';

/** How often the current weather is checked. */
const REFRESH_INTERVAL = 15 * 60 * 1000;

/** Where the clouds sail: height on the page (vh), size (vmax), seconds to cross, and start offset (s). */
const CLOUDS = [
    [6, 34, 140, -20], [22, 26, 180, -95], [2, 44, 210, -150], [34, 30, 160, -60],
    [14, 38, 240, -200], [46, 24, 190, -120], [28, 48, 260, -30],
];

/**
 * A canvas running one of the weather effects.
 * @param {Object} props
 * @param {(canvas: HTMLCanvasElement, options: {intensity: number, light: boolean}) => () => void} props.start - Starts the effect.
 * @param {number} props.intensity - How strong, from 0 to 1.
 * @param {boolean} props.light - Whether the page is light.
 * @returns {JSX.Element} The canvas.
 */
const EffectCanvas = ({ start, intensity, light }) => {
    const ref = useRef(null);
    useEffect(() => (ref.current ? start(ref.current, { intensity, light }) : undefined), [start, intensity, light]);
    return <canvas ref={ref} className="weather-canvas" />;
};

/**
 * The weather outside as a moving background: rain running down the glass, falling snow,
 * drifting clouds, or the sun (the moon and stars at night). It follows the current weather of
 * the dashboard's first weather card, checked every 15 minutes, unless an effect is fixed.
 * @param {Object} props
 * @param {string|null} [props.fixed] - An effect to always show: `rain`, `snow`, `cover` or `sun`.
 * @returns {JSX.Element|null} The scene, or null without weather to show.
 */
const WeatherBackground = ({ fixed = null }) => {
    const { mode } = useTheme();
    const light = mode === 'light';
    const { data } = usePolling(
        () => callService('weather', { type: 'current' }),
        { interval: REFRESH_INTERVAL, enabled: !fixed, key: 'weather-current' },
    );
    const scene = weatherScene(fixed ? null : data, fixed);
    if (!scene) return null;

    const cloudCount = scene.clouds < 0.05 ? 0 : Math.round(2 + scene.clouds * (CLOUDS.length - 2));
    const wet = scene.effect === 'rain' || scene.effect === 'snow';
    return (
        <div
            className={`weather-scene effect-${scene.effect}${scene.night ? ' is-night' : ''}${scene.fog ? ' is-fog' : ''}${wet ? ' is-wet' : ''}`}
            style={{ '--clouds': scene.clouds, '--intensity': scene.intensity }}
        >
            <div className="weather-veil" />
            {scene.effect === 'sun' && !scene.night && (
                <div className="weather-sun">
                    <i className="weather-sun-rays" />
                    <i className="weather-sun-glow" />
                    <i className="weather-flare" />
                    <i className="weather-flare" />
                    <i className="weather-flare" />
                </div>
            )}
            {scene.effect === 'sun' && scene.night && (
                <div className="weather-night">
                    <i className="weather-stars" />
                    <i className="weather-stars" />
                    <i className="weather-moon" />
                </div>
            )}
            {cloudCount > 0 && (
                <div className="weather-clouds">
                    {CLOUDS.slice(0, cloudCount).map(([y, base, duration, delay]) => {
                        // An overcast sky has bigger clouds
                        const size = scene.effect === 'cover' ? base * 1.5 : base;
                        return (
                        <i
                            key={`${y}-${base}`}
                            className="weather-cloud"
                            style={{
                                '--y': `${y}vh`,
                                '--s': `${size}vmax`,
                                '--d': `${duration}s`,
                                '--delay': `${delay}s`,
                                // Where it stands when nothing moves: as far across as it would have sailed
                                '--x': `${(-delay / duration) * 100}vw`,
                            }}
                        />
                        );
                    })}
                </div>
            )}
            {scene.effect === 'rain' && <EffectCanvas start={startRain} intensity={scene.intensity} light={light} />}
            {scene.effect === 'snow' && <EffectCanvas start={startSnow} intensity={scene.intensity} light={light} />}
        </div>
    );
};

export default WeatherBackground;
