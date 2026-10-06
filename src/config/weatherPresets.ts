// src/config/weatherPresets.ts

export interface WeatherPresetData {
  name: string;
  sunIntensity: number;
  sunColor: number; // hex
  ambientIntensity: number;
  ambientColor: number; // hex
  skyTop: number; // hex
  skyMid: number; // hex
  skyBot: number; // hex
  fogColor: number; // hex
  fogDensity: number;
  windStrength: number;
  wetness: number;
  hdriIntensity: number;
  precipitation: 'none' | 'rain' | 'heavy-rain';
  lightning: boolean;
}

export const WEATHER_PRESETS: Record<string, WeatherPresetData> = {
  clear: {
    name: 'Clear',
    sunIntensity: 2.5,
    sunColor: 0xffe0b0,
    ambientIntensity: 0.4,
    ambientColor: 0x406080,
    skyTop: 0x6a8cbc,
    skyMid: 0xd98c6a,
    skyBot: 0xffc870,
    fogColor: 0xd4a76a,
    fogDensity: 0.012,
    windStrength: 0.3,
    wetness: 0.0,
    hdriIntensity: 0.3,
    precipitation: 'none',
    lightning: false,
  },
  cloudy: {
    name: 'Cloudy',
    sunIntensity: 1.1,
    sunColor: 0xd0d8e8,
    ambientIntensity: 0.35,
    ambientColor: 0x506070,
    skyTop: 0x666e80,
    skyMid: 0x99a0a8,
    skyBot: 0xc0c5cc,
    fogColor: 0xa8b0b8,
    fogDensity: 0.018,
    windStrength: 0.5,
    wetness: 0.1,
    hdriIntensity: 0.3,
    precipitation: 'none',
    lightning: false,
  },
  rain: {
    name: 'Rain',
    sunIntensity: 0.6,
    sunColor: 0xb0b8c0,
    ambientIntensity: 0.25,
    ambientColor: 0x404c58,
    skyTop: 0x333840,
    skyMid: 0x4d5560,
    skyBot: 0x667078,
    fogColor: 0x4d5560,
    fogDensity: 0.022,
    windStrength: 0.8,
    wetness: 0.8,
    hdriIntensity: 0.19,
    precipitation: 'rain',
    lightning: false,
  },
  storm: {
    name: 'Storm',
    sunIntensity: 0.4,
    sunColor: 0x889098,
    ambientIntensity: 0.2,
    ambientColor: 0x303840,
    skyTop: 0x1a1a20,
    skyMid: 0x26262a,
    skyBot: 0x333338,
    fogColor: 0x26262a,
    fogDensity: 0.078,
    windStrength: 1.5,
    wetness: 1.0,
    hdriIntensity: 0.1,
    precipitation: 'heavy-rain',
    lightning: true,
  },
  fog: {
    name: 'Fog',
    sunIntensity: 0.9,
    sunColor: 0xd0d0c8,
    ambientIntensity: 0.3,
    ambientColor: 0x506058,
    skyTop: 0xb3b8c0,
    skyMid: 0xccd0d5,
    skyBot: 0xe6e8ea,
    fogColor: 0xd9dde0,
    fogDensity: 0.095,
    windStrength: 0.15,
    wetness: 0.3,
    hdriIntensity: 0.3,
    precipitation: 'none',
    lightning: false,
  },
};
