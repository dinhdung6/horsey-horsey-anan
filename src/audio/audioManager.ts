import { playChime } from './chime';

type SoundName = 'wind_calm' | 'wind_strong' | 'rain' | 'night' | 'horse_walk' | 'horse_trot' | 'horse_gallop' | 'horse_eat';
type BusName = 'weather' | 'night' | 'hooves' | 'eat' | 'sfx';
type HorseAudioState = { speed: number; grounded: boolean; eating: boolean; sitting: boolean };
type LoopTrack = { audio: HTMLAudioElement; gain: GainNode; target: number; source: MediaElementAudioSourceNode; rate: number };

const FILES: Record<SoundName, string> = {
  wind_calm: 'wind_calm.ogg',
  wind_strong: 'wind_strong.ogg',
  rain: 'rain.ogg',
  night: 'night.wav',
  horse_walk: 'horse_walk.ogg',
  horse_trot: 'horse_trot.ogg',
  horse_gallop: 'horse_gallop.ogg',
  horse_eat: 'horse_eat.ogg',
};

const BUS_FOR: Record<SoundName, BusName> = {
  wind_calm: 'weather', wind_strong: 'weather', rain: 'weather', night: 'night',
  horse_walk: 'hooves', horse_trot: 'hooves', horse_gallop: 'hooves', horse_eat: 'eat',
};

const WEATHER_MIX: Record<string, Partial<Record<SoundName, number>>> = {
  clear: { wind_calm: 0.32 },
  cloudy: { wind_strong: 0.38 },
  rain: { wind_strong: 0.22, rain: 0.55 },
  night: { wind_calm: 0.2, night: 0.2 },
  fog: { wind_calm: 0.2 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<BusName, GainNode>();
  private ambienceDuck: GainNode | null = null;
  private readonly tracks = new Map<SoundName, LoopTrack>();
  private readonly targets = new Map<SoundName, number>();
  private enabled: boolean;
  private weather = 'clear';
  private horse: HorseAudioState = { speed: 0, grounded: true, eating: false, sitting: false };
  private horseUpdateTimer = 0;
  private variationTimer = 4;
  private hoofGainVariation = 1;
  private hoofRateVariation = 1;
  private nightBusGain = 1;
  private gustTimer = 8;
  private gust = 1;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    document.addEventListener('keydown', this.onGesture);
    document.addEventListener('pointerdown', this.onGesture);
  }

  private onGesture = () => {
    if (this.enabled) this.activate();
  };

  private activate() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.context.destination);
      this.ambienceDuck = this.context.createGain();
      this.ambienceDuck.connect(this.master);
      for (const name of ['weather', 'night', 'hooves', 'eat', 'sfx'] as const) {
        const bus = this.context.createGain();
        bus.connect(name === 'weather' || name === 'night' ? this.ambienceDuck : this.master);
        if (name === 'sfx') {
          const echo = this.context.createDelay(0.3);
          const echoGain = this.context.createGain();
          echo.delayTime.value = 0.14;
          echoGain.gain.value = 0.12;
          bus.connect(echo);
          echo.connect(echoGain).connect(this.master);
        }
        this.buses.set(name, bus);
      }
      document.removeEventListener('keydown', this.onGesture);
      document.removeEventListener('pointerdown', this.onGesture);
    }
    void this.context.resume();
    this.applyWeather(0.8);
    this.applyHorse(0.3);
    for (const track of this.tracks.values()) this.play(track);
  }

  setWeather(name: string) {
    this.weather = WEATHER_MIX[name] ? name : 'clear';
    this.applyWeather(3);
  }

  playAchievementChime(milestone: boolean) {
    if (!this.enabled) return;
    if (!this.context) this.activate();
    if (!this.context) return;
    const now = this.context.currentTime;
    this.ambienceDuck?.gain.cancelScheduledValues(now);
    this.ambienceDuck?.gain.setTargetAtTime(0.707, now, 0.04);
    this.ambienceDuck?.gain.setTargetAtTime(1, now + 1.5, 0.18);
    playChime(this.context, this.buses.get('sfx')!, milestone);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      if (this.master && this.context) {
        this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.07);
        if (this.suspendTimer) clearTimeout(this.suspendTimer);
        this.suspendTimer = setTimeout(() => {
          for (const track of this.tracks.values()) track.audio.pause();
          void this.context?.suspend();
        }, 250);
      }
      return;
    }
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.activate();
    if (this.master && this.context) this.master.gain.setTargetAtTime(1, this.context.currentTime, 0.07);
  }

  update(dt: number, horse: HorseAudioState) {
    this.horse = horse;
    if (!this.context || !this.enabled || this.context.state !== 'running') return;
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gust = 0.85 + Math.random() * 0.3;
      this.gustTimer = 6 + Math.random() * 6;
      this.applyWeather(1.5);
    }
    this.variationTimer -= dt;
    if (this.variationTimer <= 0) {
      this.variationTimer = 4 + Math.random() * 3;
      this.hoofGainVariation = 0.95 + Math.random() * 0.1;
      this.hoofRateVariation = 0.97 + Math.random() * 0.06;
    }
    const nightTarget = this.weather === 'night'
      ? (this.horse.speed > 5 ? 0.6 : 1) * (this.horse.sitting ? 1.1 : 1)
      : 1;
    if (Math.abs(nightTarget - this.nightBusGain) > 0.03) {
      this.nightBusGain = nightTarget;
      this.buses.get('night')?.gain.setTargetAtTime(
        nightTarget,
        this.context.currentTime,
        this.horse.speed > 5 ? 1 : 6
      );
    }
    this.horseUpdateTimer -= dt;
    if (this.horseUpdateTimer <= 0) {
      this.horseUpdateTimer = 0.08;
      this.applyHorse(0.3);
    }
  }

  private applyWeather(duration: number) {
    const mix = WEATHER_MIX[this.weather] ?? WEATHER_MIX.clear;
    for (const name of ['wind_calm', 'wind_strong', 'rain', 'night'] as const) {
      this.setLoopGain(name, (mix[name] ?? 0) * (name.startsWith('wind_') ? this.gust : 1), duration);
    }
  }

  private applyHorse(duration: number) {
    const speed = Math.abs(this.horse.speed);
    const active = this.horse.grounded && !this.horse.eating && !this.horse.sitting;
    let walk = 0;
    let trot = 0;
    let gallop = 0;

    if (active && this.horse.speed < -0.3) {
      walk = 0.32;
    } else if (active && speed > 0.3 && speed < 3) {
      walk = smoothstep(0.3, 1, speed);
    } else if (active && speed < 4 && speed >= 3) {
      const t = (speed - 3) * Math.PI / 2;
      walk = Math.cos(t);
      trot = Math.sin(t);
    } else if (active && speed < 5 && speed >= 4) {
      trot = 1;
    } else if (active && speed <= 6 && speed >= 5) {
      const t = (speed - 5) * Math.PI / 2;
      trot = Math.cos(t);
      gallop = Math.sin(t);
    } else if (active && speed > 6) {
      gallop = 1;
    }

    this.setLoopGain('horse_walk', walk * (this.horse.speed < 0 ? 0.5 : 0.32) * this.hoofGainVariation, duration);
    this.setLoopGain('horse_trot', trot * 0.34 * this.hoofGainVariation, duration);
    this.setLoopGain('horse_gallop', gallop * 0.38 * this.hoofGainVariation, duration);
    this.setLoopGain('horse_eat', this.horse.eating ? 0.3 : 0, duration);

    this.setRate('horse_walk', clamp((this.horse.speed < 0 ? 0.85 : speed / 2) * this.hoofRateVariation, 0.85, 1.15));
    this.setRate('horse_trot', clamp(speed / 4.5 * this.hoofRateVariation, 0.85, 1.15));
    this.setRate('horse_gallop', clamp(speed / 7 * this.hoofRateVariation, 0.85, 1.15));
  }

  private setLoopGain(name: SoundName, target: number, duration: number) {
    this.targets.set(name, target);
    if (!this.enabled || !this.context) return;
    let track = this.tracks.get(name);
    if (!track && target > 0.005) track = this.createTrack(name);
    if (!track || Math.abs(track.target - target) < 0.015) return;
    track.target = target;
    track.gain.gain.setTargetAtTime(target, this.context.currentTime, Math.max(0.03, duration / 3));
  }

  private setRate(name: SoundName, rate: number) {
    const track = this.tracks.get(name);
    if (!track || Math.abs(track.rate - rate) < 0.025 || !this.context) return;
    track.rate = rate;
    track.audio.playbackRate = rate;
  }

  private createTrack(name: SoundName): LoopTrack {
    const audio = new Audio(`/audio/${FILES[name]}`);
    audio.loop = true;
    audio.preload = 'none';
    const source = this.context!.createMediaElementSource(audio);
    const gain = this.context!.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.buses.get(BUS_FOR[name])!);
    const track: LoopTrack = { audio, source, gain, target: 0, rate: 1 };
    this.tracks.set(name, track);
    this.play(track);
    return track;
  }

  private play(track: LoopTrack) {
    if (track.audio.paused) void track.audio.play().catch((error: unknown) => {
      console.warn('Audio playback could not start:', error);
    });
  }

  dispose() {
    document.removeEventListener('keydown', this.onGesture);
    document.removeEventListener('pointerdown', this.onGesture);
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    for (const track of this.tracks.values()) {
      track.audio.pause();
      track.source.disconnect();
      track.gain.disconnect();
    }
    this.tracks.clear();
    void this.context?.close();
  }
}
