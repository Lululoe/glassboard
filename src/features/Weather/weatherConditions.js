/**
 * Sorts a weather condition, as the weather service names it, into a kind the card draws.
 * @param {string} condition - For example `partlycloudy`, `Light rain` or `Clear`.
 * @returns {'storm'|'snow'|'drizzle'|'rain'|'fog'|'partly'|'clear'|'cloud'|'wind'} The kind; cloudy when unknown.
 */
export function conditionKind(condition) {
    const c = (condition || '').toLowerCase();
    if (c.includes('storm') || c.includes('thunder') || c.includes('lightning')) return 'storm';
    if (c.includes('snow')) return 'snow';
    if (c.includes('drizzle')) return 'drizzle';
    if (c.includes('rain') || c.includes('shower') || c.includes('pouring')) return 'rain';
    if (c.includes('fog') || c.includes('mist')) return 'fog';
    if (c.includes('partly') || c.includes('mainly')) return 'partly';
    if (c.includes('clear') || c.includes('sunny')) return 'clear';
    if (c.includes('cloud') || c.includes('overcast')) return 'cloud';
    if (c.includes('wind')) return 'wind';
    return 'cloud';
}

/** Lucide icon of each kind. */
export const CONDITION_ICONS = {
    storm: 'lu-CloudLightning',
    snow: 'lu-CloudSnow',
    drizzle: 'lu-CloudDrizzle',
    rain: 'lu-CloudRain',
    fog: 'lu-CloudFog',
    partly: 'lu-CloudSun',
    clear: 'lu-Sun',
    cloud: 'lu-Cloud',
    wind: 'lu-Wind',
};

/** ASCII drawing of each kind for the Terminal style: three lines of nine characters. */
export const CONDITION_ART = {
    clear: ['  \\ | /  ', ' -- O -- ', '  / | \\  '],
    partly: [' \\ /     ', '- O .--. ', ' (___.__)'],
    cloud: ['   .--.  ', ' .(    ).', '(___.___)'],
    drizzle: ['  .--.   ', '(___.__) ', "  ' . '  "],
    rain: ['  .--.   ', '(___.__) ', " ' ' ' ' "],
    snow: ['  .--.   ', '(___.__) ', ' * * * * '],
    storm: ['  .--.   ', '(___.__) ', '  /_ /_  '],
    fog: [' _ - _ - ', '  _ - _  ', ' _ - _ - '],
    wind: [' ~~~~>   ', '   ~~~~> ', ' ~~~>    '],
};
