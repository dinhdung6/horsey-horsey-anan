import { Scene, PerspectiveCamera, Box3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRenderer, getBackendName } from './engine/renderer';
import { startLoop } from './engine/loop';
import { InputManager } from './engine/input';
import { createTerrain } from './world/terrain';
import { setupSkyAndFog } from './world/sky';
import { GrassSystem } from './world/grass';
import { Horse } from './entities/horse';
import { HorseController } from './entities/horseController';
import { CameraRig } from './entities/cameraRig';
import { AutoPilot } from './entities/autoPilot';

async function init() {
  const container = document.getElementById('canvas-container')!;
  const fpsEl = document.getElementById('fps-counter')!;
  const gpuEl = document.getElementById('gpu-message')!;

  const renderer = await createRenderer(container);
  const info = getBackendName(renderer);
  console.log('GPU backend:', info);
  gpuEl.textContent = info;

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500);
  camera.position.set(0, 8, 20);

  const input = new InputManager();
  input.attach();

  const terrain = createTerrain();
  scene.add(terrain);

  const grassSystem = new GrassSystem();
  grassSystem.addTo(scene);

  setupSkyAndFog(scene);

  let horse: Horse | null = null;
  let controller: HorseController | null = null;
  let cameraRig: CameraRig | null = null;
  const autoPilot = new AutoPilot();

  const loader = new GLTFLoader();
  loader.load('/models/horse.glb', (gltf) => {
    console.log('Horse animations:', gltf.animations.map((a: any) => a.name));
    const box = new Box3().setFromObject(gltf.scene);
    console.log('Horse bounding box:', box);
    horse = new Horse(gltf);
    scene.add(horse.root);

    controller = new HorseController(horse);
    cameraRig = new CameraRig(container, camera);
    cameraRig.snapTo(horse.root.position, controller.yaw);
  }, undefined, (err: any) => {
    console.error('Horse load error:', err);
  });

  const stopLoop = startLoop(
    renderer,
    scene,
    camera,
    (dt) => {
      input.tick();

      if (controller && cameraRig) {
        const autoInput = autoPilot.update(dt, controller.horse.root.position.x, controller.horse.root.position.z, controller.yaw, input.state);
        controller.update(dt, autoInput);

        cameraRig.update(
          dt,
          controller.horse.root.position,
          controller.yaw,
          Math.abs(controller.speed) > 0.3,
          controller.speed
        );

        grassSystem.update(camera.position);
        grassSystem.setHorsePos(controller.horse.root.position.x, controller.horse.root.position.z);
        if (controller.frameBite) {
          grassSystem.addBitePoint(controller.frameBite.x, controller.frameBite.z);
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
      stopLoop();
    });
  }
}

init().catch((err: unknown) => {
  console.error('Init failed:', err);
  const gpuEl = document.getElementById('gpu-message')!;
  gpuEl.style.color = '#f55';
  gpuEl.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
});
