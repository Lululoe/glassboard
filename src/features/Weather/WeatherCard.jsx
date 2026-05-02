import { useState } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import { useWeather } from './useWeather';
import Icon from '../../components/Shared/Icon';
import './WeatherCard.css';

/**
 * Maps a weather condition string to a corresponding Lucide React icon name.
 * @param {string} condition - The weather condition string.
 * @returns {string} The matched icon name.
 */
const getWeatherIcon = (condition) => {
    const conditionLower = (condition || '').toLowerCase();

    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) return 'lu-Sun';
    if (conditionLower.includes('cloud')) return 'lu-Cloud';
    if (conditionLower.includes('rain') || conditionLower.includes('shower')) return 'lu-CloudRain';
    if (conditionLower.includes('snow')) return 'lu-CloudSnow';
    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return 'lu-CloudLightning';
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) return 'lu-CloudFog';
    if (conditionLower.includes('wind')) return 'lu-Wind';
    if (conditionLower.includes('partly')) return 'lu-CloudSun';

    return 'lu-Cloud'; // Default
};

/**
 * WeatherCard component displaying current weather conditions and forecast.
 * @param {Object} props
 * @param {Object} props.config - Configuration for the WeatherCard.
 * @returns {JSX.Element} The rendered WeatherCard.
 */
const WeatherCard = ({ config = {} }) => {
    const colSpan = config.colSpan || 1;
    const entityId = config.entity_id || config.data?.entity_id;
    const icon = config.icon || "local-weather";
    // Default gradient for WeatherCard
    const defaultBackground = "linear-gradient(45deg,rgba(54, 111, 255, 1) 0%, rgba(128, 227, 255, 1) 100%)";
    const iconBackground = config.iconBackground || defaultBackground;
    const iconColor = config.iconColor;

    const [forecastType, setForecastType] = useState('daily');
    const service = config.service || 'weather';
    const { weather, loading, error } = useWeather(entityId, forecastType, service);

    const toggleType = () => {
        setForecastType(prev => prev === 'daily' ? 'hourly' : 'daily');
    };

    if (loading) {
        return (
            <TwoToneBase
                colSpan={colSpan}
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

    if (error || !weather) {
        return (
            <TwoToneBase
                colSpan={colSpan}
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

    const visibleCols = colSpan * 2;

    return (
        <TwoToneBase
            colSpan={colSpan}
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
                <div
                    className="two-tone-header-action"
                    onClick={toggleType}
                    title={`Switch to ${forecastType === 'daily' ? 'Hourly' : 'Daily'}`}
                >
                    {forecastType === 'daily' ? <Icon icon="lu-Clock" size={18} /> : <Icon icon="lu-CalendarDays" size={18} />}
                </div>
            }
        >
            <div className={`weather-grid weather-grid-cols-${visibleCols}`}>
                {forecast.slice(0, visibleCols).map((item, idx) => {
                    const itemIcon = getWeatherIcon(item.condition);
                    const date = new Date(item.datetime);

                    let label;
                    if (forecastType === 'daily') {
                        label = idx === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' });
                    } else {
                        // Hourly: show time (e.g. 14:00)
                        label = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
                    }

                    return (
                        <div key={idx} className="weather-day">
                            <div className="weather-day-header">{label}</div>
                            <div className="weather-day-body">
                                <Icon icon={itemIcon} size={32} className="weather-day-icon" />
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
                    );
                })}
            </div>
        </TwoToneBase>
    );
};

export default WeatherCard;
