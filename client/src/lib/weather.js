// Weather condition options used by the Log Run selector and displayed on
// run cards / detail pages.
export const WEATHER_OPTIONS = [
  { value: 'Sunny', icon: '☀️' },
  { value: 'Partly Cloudy', icon: '⛅' },
  { value: 'Cloudy', icon: '☁️' },
  { value: 'Rainy', icon: '🌧️' },
  { value: 'Stormy', icon: '⛈️' },
  { value: 'Snowy', icon: '❄️' },
];

const ICONS = Object.fromEntries(WEATHER_OPTIONS.map((o) => [o.value, o.icon]));

export function weatherIcon(value) {
  return ICONS[value] || '';
}
