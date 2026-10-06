const SETTINGS_KEY = 'horse-sim-settings';

export type Settings = {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  weather: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
  autoWander: boolean;
  sound: boolean;
};

const DEFAULTS: Settings = {
  quality: 'medium',
  weather: 'clear',
  autoWander: false,
  sound: true,
};

let cached: Settings | null = null;

export function loadSettings(): Settings {
  if (cached) return { ...cached };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cached = { ...DEFAULTS, ...JSON.parse(raw) } as Settings;
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
  } catch {
    // ignore storage errors (e.g. private mode)
  }
}
