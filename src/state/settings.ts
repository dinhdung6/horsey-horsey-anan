const SETTINGS_KEY = 'horse-sim-settings';
const WEATHER_CYCLE_KEY = 'horse-sim-weather-cycle-v1';

export type Settings = {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  weather: 'auto' | 'clear' | 'cloudy' | 'rain' | 'night' | 'fog';
  autoWander: boolean;
  sound: boolean;
  touchControls: boolean;
};

const DEFAULTS: Settings = {
  quality: 'medium',
  weather: 'auto',
  autoWander: false,
  sound: true,
  touchControls: false,
};

let cached: Settings | null = null;

export function loadSettings(): Settings {
  if (cached) return { ...cached };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const weather = localStorage.getItem(WEATHER_CYCLE_KEY) === '1'
        ? saved.weather === 'storm' ? 'night' : saved.weather
        : 'auto';
      cached = { ...DEFAULTS, ...saved, weather } as Settings;
      localStorage.setItem(WEATHER_CYCLE_KEY, '1');
      return { ...cached };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  cached = { ...s };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    localStorage.setItem(WEATHER_CYCLE_KEY, '1');
  } catch {
    // ignore storage errors (e.g. private mode)
  }
}
