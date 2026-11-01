import { useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import { useWeather } from './useWeather';
import Icon from '../../components/Shared/Icon';
import './WeatherCard.css';
import { useElementSize } from '../../hooks/useElementSize';
import { useFitCount } from '../../hooks/useFitCount';

/** Content height from which the other forecast fits underneath, in pixels. */
const STRIP_FROM = 190;
/** Content height from which a forecast with a strip also has room for the condition. */
const ROOMY_FROM = 270;
/** Most forecast entries shown side by side. */
const MAX_DAYS = 7;
/** Width each entry in the strip needs, in pixels. */
const STRIP_ITEM_WIDTH = 72;

/**
 * Turns a forecast entry's time into its label.
 * @param {Object} item - The forecast entry.
 * @param {number} index - Its position in the forecast.
 * @param {string} type - 'daily' or 'hourly'.
 * @returns {string} For example `Today`, `Mon` or `14:00`.
 */
const labelOf = (item, index, type) => {
    const date = new Date(item.datetime);
    if (type === 'daily') return index === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' });
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
};

/**
 * Maps a weather condition string to a corresponding Lucide React icon name.
 * @param {string} condition - The weather condition string.
 * @returns {string} The matched icon name.
 */
const getWeatherIcon = (condition) => {
    const conditionLower = (condition || '').toLowerCase();

    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return 'lu-CloudLightning';
    if (conditionLower.includes('snow')) return 'lu-CloudSnow';
    if (conditionLower.includes('drizzle')) return 'lu-CloudDrizzle';
    if (conditionLower.includes('rain') || conditionLower.includes('shower')) return 'lu-CloudRain';
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) return 'lu-CloudFog';
    if (conditionLower.includes('partly') || conditionLower.includes('mainly')) return 'lu-CloudSun';
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) return 'lu-Sun';
    if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) return 'lu-Cloud';
    if (conditionLower.includes('wind')) return 'lu-Wind';

    return 'lu-Cloud'; // Default
};

/**
 * WeatherCard component displaying current weather conditions and forecast.
 * @param {Object} props
 * @param {Object} props.config - Configuration for the WeatherCard.
 * @returns {JSX.Element} The rendered WeatherCard.
 */
const WeatherCard = ({ config = {} }) => {
    const icon = config.icon || "lu-CloudSun";
    // Default gradient for WeatherCard
    const defaultBackground = "linear-gradient(45deg,rgba(54, 111, 255, 1) 0%, rgba(128, 227, 255, 1) 100%)";
    const iconBackground = config.iconBackground || defaultBackground;
    const iconColor = config.iconColor;

    const [forecastType, setForecastType] = useState('daily');
    // As many as fit the card's current width, so a wide card shows more instead of gaps
    const [visibleCols, gridRef] = useFitCount(80, MAX_DAYS);
    const { weather, loading, error } = useWeather(config.id, forecastType);
    const [bodySize, measureBody] = useElementSize();
    const showStrip = bodySize.height >= STRIP_FROM;
    const stripType = forecastType === 'daily' ? 'hourly' : 'daily';
    const { weather: stripWeather } = useWeather(config.id, stripType, showStrip);
    const stripItems = stripWeather?.forecast || [];
    const stripCount = Math.max(4, Math.floor(bodySize.width / STRIP_ITEM_WIDTH));

    const toggleType = () => {
        setForecastType(prev => prev === 'daily' ? 'hourly' : 'daily');
    };

    if (loading && !weather) {
        return (
            <TwoToneBase
                title="Weather"
                subtitle={<span>Loading...</span>}
                icon={icon}
                iconBackground={iconBackground}
                iconColor={iconColor}
            >
                <div className="weather-loading">Loading weather data...</div>
            </TwoToneBase>
        );
    }

    if (!weather) {
        return (
            <TwoToneBase
                title="Weather"
                subtitle={<span>Error</span>}
                icon={icon}
                iconBackground={iconBackground}
                iconColor={iconColor}
            >
                <div className="weather-error">
                    {error || 'No weather data available'}
                </div>
            </TwoToneBase>
        );
    }

    const forecast = weather.forecast || [];
    const currentItem = forecast[0] || {};
    const currentCondition = currentItem.condition || 'Unknown';
    const currentIcon = getWeatherIcon(currentCondition);


    return (
        <TwoToneBase
            title="Weather"
            subtitle={
                <div className="weather-header-info">
                    <Icon icon={currentIcon} size={20} className="weather-header-icon" />
                    <span className="weather-condition">{currentCondition}</span>
                    <span className="weather-temp-range">
                        {currentItem.temperature !== undefined && `${Math.round(currentItem.temperature)}°`}
                        {/* Only show high/low if available (daily) */}
                        {currentItem.templow !== undefined && currentItem.temperature !== undefined && ' / '}
                        {currentItem.templow !== undefined && `${Math.round(currentItem.templow)}°`}
                    </span>
                </div>
            }
            icon={icon}
            iconBackground={iconBackground}
            iconColor={iconColor}
            actions={
                <button
                    type="button"
                    className="button-reset two-tone-header-action"
                    onClick={toggleType}
                    title={`Show ${forecastType === 'daily' ? 'hourly' : 'daily'} forecast`}
                    aria-label={`Show ${forecastType === 'daily' ? 'hourly' : 'daily'} forecast`}
                >
                    {forecastType === 'daily' ? <Icon icon="lu-Clock" size={20} /> : <Icon icon="lu-CalendarDays" size={20} />}
                </button>
            }
        >
            <div className={`weather-body${showStrip && bodySize.height < ROOMY_FROM ? ' has-strip' : ''}`} ref={measureBody}>
                <div className="weather-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${visibleCols}, minmax(0, 1fr))` }}>
                    {forecast.slice(0, visibleCols).map((item, idx) => (
                        <div key={idx} className="weather-day">
                            <div className="weather-day-header">{labelOf(item, idx, forecastType)}</div>
                            <div className="weather-day-body">
                                <Icon icon={getWeatherIcon(item.condition)} size={32} className="weather-day-icon" />
                                <div className="weather-day-condition">{item.condition}</div>
                                <div className="weather-day-temp">
                                    {item.temperature !== undefined && (
                                        <span className="weather-temp-high">{Math.round(item.temperature)}°</span>
                                    )}
                                    {item.templow !== undefined && (
                                        <span className="weather-temp-low">{Math.round(item.templow)}°</span>
                                    )}
                                </div>
                                {item.precipitation !== undefined && item.precipitation > 0 && (
                                    <div className="weather-day-precip">
                                        <Icon icon="lu-Droplets" size={14} />
                                        <span>{Math.round(item.precipitation)}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {showStrip && stripItems.length > 0 && (
                    <div
                        className="weather-strip"
                        role="group"
                        aria-label={stripType === 'hourly' ? 'Next hours' : 'Next days'}
                        style={{ gridTemplateColumns: `repeat(${Math.min(stripItems.length, stripCount)}, minmax(0, 1fr))` }}
                    >
                        {stripItems.slice(0, stripCount).map((item, idx) => (
                            <div key={idx} className="weather-strip-item">
                                <span className="weather-strip-label">{labelOf(item, idx, stripType)}</span>
                                <Icon icon={getWeatherIcon(item.condition)} size={20} className="weather-day-icon" />
                                <span className="weather-strip-temp">{Math.round(item.temperature)}°</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </TwoToneBase>
    );
};

export default WeatherCard;
