const SETTINGS_KEY = 'horse-sim-settings';
const DEFAULTS = {
    quality: 'medium',
    weather: 'clear',
    autoWander: false,
    sound: true,
};
let cached = null;
export function loadSettings() {
    if (cached)
        return { ...cached };
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            cached = { ...DEFAULTS, ...JSON.parse(raw) };
            return { ...cached };
        }
    }
    catch {
        // ignore parse errors
    }
    return { ...DEFAULTS };
}
export function saveSettings(s) {
    cached = { ...s };
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    catch {
        // ignore storage errors (e.g. private mode)
    }
}
