// src/world/weather.ts
import {
  Color,
  InstancedMesh,
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  DirectionalLight,
  AmbientLight,
  Scene,
  Object3D,
  DoubleSide,
  MeshBasicNodeMaterial,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three/webgpu';
import {
  uniform,
  float,
  instanceIndex,
  positionLocal,
  sin,
  floor,
  vec3,
} from 'three/tsl';
import { Vector3 } from 'three/webgpu';
import { WEATHER_PRESETS, WeatherPresetData } from '../config/weatherPresets';
import { QualityPreset } from '../config/quality';
import { GrassSystem } from './grass';
import { HDRIs } from './sky';
import { heightAt } from './terrain';

const MAX_PARTICLES = 12000;
const MAX_SPLASH_EVENTS = 12;
const DROPLETS_PER_SPLASH = 6;
const TRANSITION_DURATION = 3.0;
const LIGHTNING_MIN_INTERVAL = 4.0;
const LIGHTNING_MAX_INTERVAL = 12.0;
const BASE_GROUND_HEX = 0x29351e;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeCubic(t: number): number {
  return t * t * (3 - 2 * t);
}
function colorToRgbComponents(hex: number) {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

// TSL hash in [0,1] — no fract() needed
function tslHash(seed: any) {
  const v = sin(seed.mul(12.9898)).mul(43758.5453);
  return v.sub(floor(v));
}

// Wrapping helper: val mod size for any signed val
function wrapVal(val: any, size: any) {
  return val.sub(floor(val.div(size)).mul(size));
}

type HorseSplashState = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  grounded: boolean;
};

type SplashEvent = {
  x: number;
  y: number;
  z: number;
  age: number;
  droplets: Array<{ x: number; y: number; z: number }>;
};

class WeatherValues {
  sunIntensity = 0;
  ambientIntensity = 0;
  fogDensity = 0;
  windStrength = 0;
  wetness = 0;
  hdriIntensity = 0;
  sunColor = new Color();
  ambientColor = new Color();
  skyTop = new Color();
  skyMid = new Color();
  skyBot = new Color();
  fogColor = new Color();
  precipitation: 'none' | 'rain' | 'heavy-rain' = 'none';
  lightning = false;

  copyFromPreset(p: WeatherPresetData) {
    this.sunIntensity = p.sunIntensity;
    this.ambientIntensity = p.ambientIntensity;
    this.fogDensity = p.fogDensity;
    this.windStrength = p.windStrength;
    this.wetness = p.wetness;
    this.hdriIntensity = p.hdriIntensity;
    this.sunColor.setHex(p.sunColor);
    this.ambientColor.setHex(p.ambientColor);
    this.skyTop.setHex(p.skyTop);
    this.skyMid.setHex(p.skyMid);
    this.skyBot.setHex(p.skyBot);
    this.fogColor.setHex(p.fogColor);
    this.precipitation = p.precipitation;
    this.lightning = p.lightning;
  }

  lerpTo(target: WeatherPresetData, from: WeatherValues, t: number) {
    const tc = new Color();
    tc.setHex(target.sunColor);
    this.sunColor.lerpColors(from.sunColor, tc, t);
    tc.setHex(target.ambientColor);
    this.ambientColor.lerpColors(from.ambientColor, tc, t);
    tc.setHex(target.skyTop);
    this.skyTop.lerpColors(from.skyTop, tc, t);
    tc.setHex(target.skyMid);
    this.skyMid.lerpColors(from.skyMid, tc, t);
    tc.setHex(target.skyBot);
    this.skyBot.lerpColors(from.skyBot, tc, t);
    tc.setHex(target.fogColor);
    this.fogColor.lerpColors(from.fogColor, tc, t);

    this.sunIntensity = lerp(from.sunIntensity, target.sunIntensity, t);
    this.ambientIntensity = lerp(from.ambientIntensity, target.ambientIntensity, t);
    this.fogDensity = lerp(from.fogDensity, target.fogDensity, t);
    this.windStrength = lerp(from.windStrength, target.windStrength, t);
    this.wetness = lerp(from.wetness, target.wetness, t);
    this.hdriIntensity = lerp(from.hdriIntensity, target.hdriIntensity, t);
    this.precipitation = t > 0.5 ? target.precipitation : from.precipitation;
    this.lightning = t > 0.5 ? target.lightning : from.lightning;
  }

  clone(): WeatherValues {
    const v = new WeatherValues();
    v.sunIntensity = this.sunIntensity;
    v.ambientIntensity = this.ambientIntensity;
    v.fogDensity = this.fogDensity;
    v.windStrength = this.windStrength;
    v.wetness = this.wetness;
    v.hdriIntensity = this.hdriIntensity;
    v.sunColor.copy(this.sunColor);
    v.ambientColor.copy(this.ambientColor);
    v.skyTop.copy(this.skyTop);
    v.skyMid.copy(this.skyMid);
    v.skyBot.copy(this.skyBot);
    v.fogColor.copy(this.fogColor);
    v.precipitation = this.precipitation;
    v.lightning = this.lightning;
    return v;
  }
}

const HDRI_MAP: Record<string, keyof HDRIs> = {
  clear: 'sunset',
  cloudy: 'overcast',
  rain: 'overcast',
  night: 'night',
  fog: 'mistyMorning',
};

export class Weather {
  current = new WeatherValues();
  fromState = new WeatherValues();
  targetPreset = WEATHER_PRESETS.clear;
  transition = 1.0;
  time = 0;

  sun: DirectionalLight;
  ambient: AmbientLight;
  groundMat: any;
  grassSystem: GrassSystem;
  scene: Scene;
  hdris: HDRIs;

  lightningTimer = 0;
  nextLightning = 9999;
  lightningFlashRemaining = 0;
  lightningFlashDuration = 0;
  baseAmbientIntensity = 0;

  rainMesh: InstancedMesh | null = null;
  rainTimeNode = uniform(0.0);
  rainCamNode = uniform(new Vector3());
  rainWindNode = uniform(new Vector3(0.5, 0, 0.1));
  maxParticles = 1500;
  private splashRings: InstancedMesh | null = null;
  private splashDroplets: InstancedMesh | null = null;
  private splashEvents: SplashEvent[] = [];
  private readonly splashDummy = new Object3D();
  private splashDistance = 0;
  private stepSide = 1;

  constructor(
    sun: DirectionalLight,
    ambient: AmbientLight,
    groundMat: any,
    grassSystem: GrassSystem,
    scene: Scene,
    quality: QualityPreset,
    hdris: HDRIs
  ) {
    this.sun = sun;
    this.ambient = ambient;
    this.groundMat = groundMat;
    this.grassSystem = grassSystem;
    this.scene = scene;
    this.hdris = hdris;
    this.maxParticles = quality.weatherParticles;
    this.current.copyFromPreset(WEATHER_PRESETS.clear);
    this.fromState.copyFromPreset(WEATHER_PRESETS.clear);
    this.baseAmbientIntensity = this.current.ambientIntensity;
  }

  setPreset(name: string) {
    if (!WEATHER_PRESETS[name]) {
      console.warn('Unknown weather preset:', name);
      return;
    }
    this.fromState = this.current.clone();
    this.targetPreset = WEATHER_PRESETS[name];
    this.transition = 0;
    this.resetLightning();
  }

  setQuality(q: QualityPreset) {
    this.maxParticles = q.weatherParticles;
    this.updateRainCount();
  }

  resetLightning() {
    if (this.targetPreset.lightning) {
      this.nextLightning =
        LIGHTNING_MIN_INTERVAL +
        Math.random() * (LIGHTNING_MAX_INTERVAL - LIGHTNING_MIN_INTERVAL);
    } else {
      this.nextLightning = 9999;
    }
    this.lightningFlashRemaining = 0;
  }

  update(dt: number, cameraPos: Vector3) {
    this.time += dt;
    this.transition = Math.min(1, this.transition + dt / TRANSITION_DURATION);
    const t = easeCubic(this.transition);
    this.current.lerpTo(this.targetPreset, this.fromState, t);

    this.applyToScene();
    this.updateRain(cameraPos);
    this.updateLightning(dt);
  }

  applyToScene() {
    this.sun.intensity = this.current.sunIntensity;
    this.sun.color.copy(this.current.sunColor);
    this.ambient.intensity = this.current.ambientIntensity;
    this.ambient.color.copy(this.current.ambientColor);
    if (this.scene.fog) {
      (this.scene.fog as any).color.copy(this.current.fogColor);
      (this.scene.fog as any).density = this.current.fogDensity;
    }

    // Dim HDRI brightness per preset
    this.scene.backgroundIntensity = this.current.hdriIntensity;
    this.scene.environmentIntensity = this.current.hdriIntensity;

    // Swap HDRI based on weather preset
    const presetName = this.targetPreset.name.toLowerCase();
    const hdriKey = HDRI_MAP[presetName] ?? 'sunset';
    const targetHDR = this.hdris[hdriKey];
    if (this.scene.background !== targetHDR) {
      this.scene.background = targetHDR;
      this.scene.environment = targetHDR;
    }

    // Wetness on terrain & grass
    const w = this.current.wetness;
    const dark = 1.0 - w * 0.3;
    const { r, g, b } = colorToRgbComponents(BASE_GROUND_HEX);
    this.groundMat.color.setRGB(r * dark, g * dark, b * dark);
    this.groundMat.roughness = clampNum(0.85 - w * 0.4, 0.1, 0.85);
    this.grassSystem.setWindStrength(this.current.windStrength);
    this.grassSystem.setWetness(this.current.wetness);
    this.grassSystem.setBrightness(0.45 + 0.55 * Math.min(1, this.current.sunIntensity / 0.6));
  }

  createRainSystem() {
    if (this.rainMesh) return;

    const geo = new BufferGeometry();
    const verts = new Float32Array([
      -0.005, -0.075, 0,
       0.005, -0.075, 0,
      -0.005,  0.075, 0,
       0.005,  0.075, 0,
    ]);
    const idx = new Uint16Array([0, 1, 2, 2, 1, 3]);
    geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
    geo.setIndex(new Uint16BufferAttribute(idx, 1));

    const time = this.rainTimeNode;
    const cam = this.rainCamNode;
    const wind = this.rainWindNode;

    const i = float(instanceIndex);
    const h1 = tslHash(i);
    const h2 = tslHash(i.mul(1.37));
    const h3 = tslHash(i.mul(2.71));
    const h4 = tslHash(i.mul(3.91));

    const boxX = float(40.0);
    const boxY = float(20.0);
    const boxZ = float(40.0);
    const halfX = float(20.0);
    const halfY = float(10.0);
    const halfZ = float(20.0);

    const startX = h1.mul(boxX).sub(halfX);
    const startY = h2.mul(boxY);
    const startZ = h3.mul(boxZ).sub(halfZ);
    const fallSpeed = float(8.0).add(h4.mul(4.0));

    const totalX = startX.add(wind.x.mul(time));
    const totalY = startY.sub(fallSpeed.mul(time));
    const totalZ = startZ.add(wind.z.mul(time));

    const wrappedX = wrapVal(totalX, boxX).sub(halfX).add(cam.x);
    const wrappedY = wrapVal(totalY, boxY).sub(halfY).add(cam.y);
    const wrappedZ = wrapVal(totalZ, boxZ).sub(halfZ).add(cam.z);

    const worldPos = vec3(
      wrappedX.add(positionLocal.x),
      wrappedY.add(positionLocal.y),
      wrappedZ.add(positionLocal.z)
    );

    const material = new MeshBasicNodeMaterial();
    (material as any).colorNode = vec3(0.65, 0.7, 0.78);
    (material as any).positionNode = worldPos;
    material.side = DoubleSide;
    material.transparent = true;
    material.opacity = 0.5;
    material.depthWrite = false;

    const mesh = new InstancedMesh(geo, material, MAX_PARTICLES);
    mesh.count = 0;
    mesh.frustumCulled = false;
    const dummy = new Object3D();
    for (let idx = 0; idx < MAX_PARTICLES; idx++) {
      mesh.setMatrixAt(idx, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(mesh);
    this.rainMesh = mesh;
  }

  updateRain(cameraPos: Vector3) {
    const active = this.current.precipitation !== 'none';
    if (!active) {
      if (this.rainMesh) this.rainMesh.count = 0;
      return;
    }
    if (!this.rainMesh) this.createRainSystem();
    if (!this.rainMesh) return;

    this.rainTimeNode.value = this.time;
    this.rainCamNode.value.copy(cameraPos);
    this.rainWindNode.value.set(
      this.current.windStrength * 3.0,
      0,
      this.current.windStrength * 0.5
    );
    this.updateRainCount();
  }

  updateRainCount() {
    if (!this.rainMesh) return;
    const target = this.current.precipitation === 'none' ? 0 : this.maxParticles;
    this.rainMesh.count = target;
  }

  updateHorseSplashes(dt: number, horse?: HorseSplashState) {
    const raining = this.current.precipitation !== 'none';
    if (raining && horse?.grounded && Math.abs(horse.speed) > 0.35) {
      this.splashDistance += Math.abs(horse.speed) * dt;
      const stepDistance = Math.abs(horse.speed) > 4 ? 1.4 : 0.65;
      while (this.splashDistance >= stepDistance) {
        this.splashDistance -= stepDistance;
        this.addHorseSplash(horse);
      }
    } else {
      this.splashDistance = 0;
    }

    for (let i = this.splashEvents.length - 1; i >= 0; i--) {
      this.splashEvents[i].age += dt;
      if (this.splashEvents[i].age >= 0.55) this.splashEvents.splice(i, 1);
    }
    this.updateSplashMeshes();
  }

  private addHorseSplash(horse: HorseSplashState) {
    if (!this.splashRings || !this.splashDroplets) this.createSplashMeshes();
    const side = this.stepSide * 0.32;
    this.stepSide *= -1;
    const x = horse.x + Math.cos(horse.yaw) * side;
    const z = horse.z - Math.sin(horse.yaw) * side;
    const event: SplashEvent = {
      x,
      y: heightAt(x, z) + 0.035,
      z,
      age: 0,
      droplets: Array.from({ length: DROPLETS_PER_SPLASH }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.55;
        return {
          x: Math.cos(angle) * speed,
          y: 0.55 + Math.random() * 0.85,
          z: Math.sin(angle) * speed,
        };
      }),
    };
    this.splashEvents.push(event);
    if (this.splashEvents.length > MAX_SPLASH_EVENTS) this.splashEvents.shift();
  }

  private createSplashMeshes() {
    this.splashRings = new InstancedMesh(
      new RingGeometry(0.045, 0.15, 20),
      new MeshBasicMaterial({ color: 0x7899a0, transparent: true, opacity: 0.28, depthWrite: false }),
      MAX_SPLASH_EVENTS
    );
    const ringPositions = this.splashRings.geometry.getAttribute('position');
    for (let i = 0; i < ringPositions.count; i++) {
      const x = ringPositions.getX(i);
      const y = ringPositions.getY(i);
      const angle = Math.atan2(y, x);
      const irregularity = 1 + 0.07 * Math.sin(angle * 3) + 0.035 * Math.sin(angle * 7);
      ringPositions.setXY(i, x * irregularity, y * irregularity);
    }
    ringPositions.needsUpdate = true;
    this.splashDroplets = new InstancedMesh(
      new SphereGeometry(0.018, 5, 4),
      new MeshBasicMaterial({ color: 0xa8c5cc, transparent: true, opacity: 0.58, depthWrite: false }),
      MAX_SPLASH_EVENTS * DROPLETS_PER_SPLASH
    );
    this.splashRings.frustumCulled = false;
    this.splashDroplets.frustumCulled = false;
    this.scene.add(this.splashRings, this.splashDroplets);
  }

  private updateSplashMeshes() {
    if (!this.splashRings || !this.splashDroplets) return;
    const dummy = this.splashDummy;
    let dropletIndex = 0;
    this.splashRings.count = this.splashEvents.length;
    for (let i = 0; i < this.splashEvents.length; i++) {
      const event = this.splashEvents[i];
      const progress = event.age / 0.55;
      dummy.position.set(event.x, event.y, event.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(0.2 + progress * 1.8);
      dummy.updateMatrix();
      this.splashRings.setMatrixAt(i, dummy.matrix);

      for (const velocity of event.droplets) {
        const t = event.age;
        dummy.position.set(
          event.x + velocity.x * t,
          event.y + velocity.y * t - 2.5 * t * t,
          event.z + velocity.z * t
        );
        const size = Math.max(0, 1 - progress);
        dummy.scale.set(0.65 * size, 1.5 * size, 0.65 * size);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.splashDroplets.setMatrixAt(dropletIndex++, dummy.matrix);
      }
    }
    this.splashDroplets.count = dropletIndex;
    this.splashRings.instanceMatrix.needsUpdate = true;
    this.splashDroplets.instanceMatrix.needsUpdate = true;
  }

  updateLightning(dt: number) {
    if (!this.current.lightning) {
      this.lightningFlashRemaining = 0;
      return;
    }

    if (this.lightningFlashRemaining > 0) {
      this.lightningFlashRemaining -= dt;
      const elapsed =
        this.lightningFlashDuration -
        Math.max(0, this.lightningFlashRemaining);
      const progress = Math.min(1, elapsed / this.lightningFlashDuration);
      const spike = Math.exp(-progress * 6) * 12;
      this.ambient.intensity = this.baseAmbientIntensity * (1 + spike * 0.5);
      this.sun.intensity = this.current.sunIntensity * (1 + spike);
      if (this.lightningFlashRemaining <= 0) {
        this.ambient.intensity = this.baseAmbientIntensity;
        this.sun.intensity = this.current.sunIntensity;
      }
      return;
    }

    this.lightningTimer += dt;
    if (this.lightningTimer >= this.nextLightning) {
      this.lightningFlashDuration = 0.08 + Math.random() * 0.07;
      this.lightningFlashRemaining = this.lightningFlashDuration;
      this.lightningTimer = 0;
      this.nextLightning =
        LIGHTNING_MIN_INTERVAL +
        Math.random() * (LIGHTNING_MAX_INTERVAL - LIGHTNING_MIN_INTERVAL);
    }
  }

  dispose() {
    if (this.rainMesh) {
      this.rainMesh.removeFromParent();
      this.rainMesh.geometry.dispose();
      (this.rainMesh.material as any).dispose?.();
      this.rainMesh = null;
    }
    for (const mesh of [this.splashRings, this.splashDroplets]) {
      if (!mesh) continue;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.splashRings = null;
    this.splashDroplets = null;
  }
}

function clampNum(v: number, minV: number, maxV: number) {
  return Math.max(minV, Math.min(maxV, v));
}
