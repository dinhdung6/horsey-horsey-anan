// src/main.ts
import { Scene, PerspectiveCamera, Box3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRenderer, getBackendName } from './engine/renderer';
import { startLoop } from './engine/loop';
import { InputManager } from './engine/input';
import { createTerrain } from './world/terrain';
import { setupSkyAndFog } from './world/sky';
import { GrassSystem } from './world/grass';
import { Weather } from './world/weather';
import { Horse } from './entities/horse';
import { HorseController } from './entities/horseController';
import { CameraRig } from './entities/cameraRig';
import { AutoPilot } from './entities/autoPilot';
import { loadSettings, saveSettings } from './state/settings';
import { QUALITY_PRESETS } from './config/quality';
import { WEATHER_PRESETS } from './config/weatherPresets';
import type { QualityPreset } from './config/quality';

async function init() {
  const container = document.getElementById('canvas-container')!;
  const fpsEl = document.getElementById('fps-counter')!;
  const gpuEl = document.getElementById('gpu-message')!;

  const renderer = await createRenderer(container);
  const info = getBackendName(renderer);
  console.log('GPU backend:', info);
  gpuEl.textContent = info;

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    500
  );
  camera.position.set(0, 8, 20);

  const input = new InputManager();
  input.attach();

  const terrain = createTerrain();
  scene.add(terrain);

  const skyResult = await setupSkyAndFog(scene);

  const settings = loadSettings();
  const quality: QualityPreset =
    QUALITY_PRESETS[settings.quality] ?? QUALITY_PRESETS.medium;

  const grassSystem = new GrassSystem(quality);
  grassSystem.addTo(scene);

  renderer.shadowMap.enabled = true;

  const weather = new Weather(
    skyResult.sun,
    skyResult.ambient,
    terrain.material,
    grassSystem,
    scene,
    quality,
    skyResult.hdris
  );
  weather.setPreset(settings.weather);

  function setShadowMapSize(sun: any, size: number) {
    if (sun.shadow.map) {
      sun.shadow.map.dispose?.();
      sun.shadow.map = null;
    }
    sun.castShadow = size > 0;
    if (size > 0) {
      sun.shadow.mapSize.width = size;
      sun.shadow.mapSize.height = size;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 200;
      sun.shadow.camera.left = -50;
      sun.shadow.camera.right = 50;
      sun.shadow.camera.top = 50;
      sun.shadow.camera.bottom = -50;
    }
  }

  function applyQualityPreset(q: QualityPreset) {
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, q.pixelRatioCap)
    );
    setShadowMapSize(skyResult.sun, q.shadowMapSize);
    grassSystem.reconfigure(q, scene);
    weather.setQuality(q);
  }

  applyQualityPreset(quality);

  let horse: Horse | null = null;
  let controller: HorseController | null = null;
  let cameraRig: CameraRig | null = null;
  const autoPilot = new AutoPilot();

  const loader = new GLTFLoader();
  loader.load(
    '/models/horse.glb',
    (gltf) => {
      console.log(
        'Horse animations:',
        gltf.animations.map((a: any) => a.name)
      );
      const box = new Box3().setFromObject(gltf.scene);
      console.log('Horse bounding box:', box);
      horse = new Horse(gltf);
      scene.add(horse.root);

      controller = new HorseController(horse);
      cameraRig = new CameraRig(container, camera);
      cameraRig.snapTo(horse.root.position, controller.yaw);
    },
    undefined,
    (err: any) => {
      console.error('Horse load error:', err);
    }
  );

  const stopLoop = startLoop(
    renderer,
    scene,
    camera,
    (dt) => {
      input.tick();
      weather.update(dt, camera.position);

      if (controller && cameraRig) {
        const autoInput = autoPilot.update(
          dt,
          controller.horse.root.position.x,
          controller.horse.root.position.z,
          controller.yaw,
          input.state
        );
        controller.update(dt, autoInput);

        cameraRig.update(
          dt,
          controller.horse.root.position,
          controller.yaw,
          Math.abs(controller.speed) > 0.3,
          controller.speed
        );

        grassSystem.update(camera.position);
        grassSystem.setHorsePos(
          controller.horse.root.position.x,
          controller.horse.root.position.z
        );
        if (controller.frameBite) {
          grassSystem.addBitePoint(
            controller.frameBite.x,
            controller.frameBite.z
          );
          controller.frameBite = null;
        }
      } else {
        grassSystem.update(camera.position);
      }

      horse?.update(dt);
    },
    fpsEl
  );

  const viteHot = (import.meta as any).hot;
  if (viteHot) {
    viteHot.dispose(() => {
      input.detach();
      cameraRig?.destroy();
      weather.dispose();
      stopLoop();
    });
  }

  // ponytail: console helpers for testing weather/quality until milestone-12 UI arrives
  (window as any).horseSim = {
    setWeather: (name: string) => {
      if (!WEATHER_PRESETS[name]) {
        console.warn(
          'Unknown weather:',
          name,
          'Available:',
          Object.keys(WEATHER_PRESETS)
        );
        return;
      }
      weather.setPreset(name);
      settings.weather = name as any;
      saveSettings(settings);
      console.log('Weather set to', name);
    },
    setQuality: (name: string) => {
      const q = QUALITY_PRESETS[name];
      if (!q) {
        console.warn(
          'Unknown quality:',
          name,
          'Available:',
          Object.keys(QUALITY_PRESETS)
        );
        return;
      }
      applyQualityPreset(q);
      settings.quality = name as any;
      saveSettings(settings);
      console.log('Quality set to', name);
    },
    weather,
    grassSystem,
  };
}

init().catch((err: unknown) => {
  console.error('Init failed:', err);
  const gpuEl = document.getElementById('gpu-message')!;
  gpuEl.style.color = '#f55';
  gpuEl.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
});
