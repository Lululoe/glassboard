import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, Wind } from 'lucide-react';
import { monthWeeks } from './kioskModel';
import './ClockFace.css';

/** Lucide icons for Home Assistant weather conditions. */
const WEATHER_ICONS = {
    'clear-night': Moon,
    cloudy: Cloud,
    fog: CloudFog,
    hail: CloudSnow,
    lightning: CloudLightning,
    'lightning-rainy': CloudLightning,
    partlycloudy: CloudSun,
    pouring: CloudRain,
    rainy: CloudRain,
    snowy: CloudSnow,
    'snowy-rainy': CloudSnow,
    sunny: Sun,
    windy: Wind,
    'windy-variant': Wind,
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * The weather as the clock shows it: an icon, the temperature and the condition.
 * @param {Object} props
 * @param {{condition: string, kind: string, temperature: string|null}|null} props.weather - The weather.
 * @param {boolean} [props.short] - Leaves out the condition.
 * @returns {JSX.Element|null} The weather, or nothing without one.
 */
const WeatherLine = ({ weather, short = false }) => {
    if (!weather) return null;
    const Icon = WEATHER_ICONS[weather.kind] ?? Cloud;
    return (
        <span className="kc-weather">
            <Icon className="kc-weather-icon" aria-hidden="true" />
            {[weather.temperature, short ? null : weather.condition].filter(Boolean).join(' ')}
        </span>
    );
};

/**
 * A watch face: hour and minute hands from the time, and a second hand that sweeps by itself.
 * @param {Object} props
 * @param {Date} props.now - The time.
 * @returns {JSX.Element} The face.
 */
const AnalogDial = ({ now }) => {
    const seconds = now.getSeconds();
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const day = now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase().replace('.', '');
    return (
        <svg className="kc-dial" viewBox="0 0 200 200" role="img" aria-label={now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}>
            {Array.from({ length: 60 }, (_, i) => (
                <line
                    key={i}
                    className={i % 5 === 0 ? 'kc-tick-hour' : 'kc-tick'}
                    x1="100" y1={i % 5 === 0 ? 6 : 7} x2="100" y2={i % 5 === 0 ? 18 : 12}
                    transform={`rotate(${i * 6} 100 100)`}
                />
            ))}
            <rect className="kc-date-window" x="132" y="92" width="32" height="16" rx="3" />
            <text className="kc-date-text" x="148" y="104" textAnchor="middle">{`${day} ${now.getDate()}`}</text>
            <line className="kc-hand-hour" x1="100" y1="100" x2="100" y2="54" transform={`rotate(${hours * 30} 100 100)`} />
            <line className="kc-hand-minute" x1="100" y1="100" x2="100" y2="26" transform={`rotate(${minutes * 6} 100 100)`} />
            {/* Restarted every minute from the current second, so it sweeps without a render per frame */}
            <g className="kc-hand-second" key={now.getMinutes()} style={{ animationDelay: `-${seconds}s` }}>
                <line x1="100" y1="116" x2="100" y2="20" />
            </g>
            <circle className="kc-pin" cx="100" cy="100" r="4" />
            <circle className="kc-pin-hole" cx="100" cy="100" r="1.6" />
        </svg>
    );
};

/**
 * This month's calendar, starting on Monday, with today marked.
 * @param {Object} props
 * @param {Date} props.now - Today.
 * @returns {JSX.Element} The calendar.
 */
const MonthCalendar = ({ now }) => {
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i)
        .toLocaleDateString(undefined, { weekday: 'narrow' }));
    return (
        <div className="kc-month">
            <div className="kc-month-name">{now.toLocaleDateString(undefined, { month: 'long' })}</div>
            <div className="kc-month-grid" role="grid" aria-label="This month">
                {weekdays.map((d, i) => <span key={`d${i}`} className="kc-month-dow">{d}</span>)}
                {monthWeeks(now).flat().map((cell, i) => (
                    <span
                        key={i}
                        className={!cell.current ? 'kc-month-other' : cell.day === now.getDate() ? 'kc-month-today' : undefined}
                        aria-current={cell.current && cell.day === now.getDate() ? 'date' : undefined}
                    >
                        {cell.day}
                    </span>
                ))}
            </div>
        </div>
    );
};

/**
 * One of the kiosk's clock faces, in day or night colours. At night everything is dark red on
 * black, so the screen doesn't light up the room.
 * @param {Object} props
 * @param {string} props.face - The face: `lockscreen`, `analog`, `standby` or `stacked`.
 * @param {Date} props.now - The time.
 * @param {boolean} [props.night] - Night colours.
 * @param {{condition: string, kind: string, temperature: string|null}|null} [props.weather] - The weather to show.
 * @returns {JSX.Element} The clock.
 */
const ClockFace = ({ face, now, night = false, weather = null }) => {
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const longDate = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const className = `kiosk-clock-face kc-${face}${night ? ' is-night' : ''}`;

    if (face === 'analog') {
        return (
            <div className={className}>
                <AnalogDial now={now} />
                <div className="kc-corner">
                    <WeatherLine weather={weather} />
                    <span>{longDate}</span>
                </div>
            </div>
        );
    }

    if (face === 'standby') {
        return (
            <div className={className}>
                <div className="kc-panel kc-panel-time">
                    <div className="kc-time">{hh}:{mm}</div>
                    <div className="kc-date">{longDate}</div>
                    <WeatherLine weather={weather} />
                </div>
                <div className="kc-panel">
                    <MonthCalendar now={now} />
                </div>
            </div>
        );
    }

    if (face === 'stacked') {
        return (
            <div className={className}>
                <div className="kc-digits" aria-label={`${hh}:${mm}`}>
                    <span>{hh}</span>
                    <span>{mm}</span>
                </div>
                <div className="kc-side">
                    <div className="kc-day">
                        {now.toLocaleDateString(undefined, { weekday: 'long' })}
                        <small>{now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</small>
                    </div>
                    <WeatherLine weather={weather} />
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="kc-date">{longDate}</div>
            <div className="kc-time">{hh}:{mm}</div>
            {weather && (
                <div className="kc-widgets">
                    <div className="kc-widget"><WeatherLine weather={weather} /></div>
                </div>
            )}
        </div>
    );
};

export default ClockFace;
