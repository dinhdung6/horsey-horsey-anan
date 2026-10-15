// src/main.ts
import { Scene, PerspectiveCamera, Box3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRenderer, disposeRenderer, getBackendName } from './engine/renderer';
import { startLoop } from './engine/loop';
import { InputManager } from './engine/input';
import { createTerrain, updateTerrain } from './world/terrain';
import { setupSkyAndFog } from './world/sky';
import { GrassSystem } from './world/grass';
import { Weather } from './world/weather';
import { Insects } from './world/insects';
import { Horse } from './entities/horse';
import { HorseController } from './entities/horseController';
import { CameraRig } from './entities/cameraRig';
import { AutoPilot } from './entities/autoPilot';
import { AudioManager } from './audio/audioManager';
import { createOptionsPanel } from './ui/optionsPanel';
import './ui/hud.css';
import { loadSettings, saveSettings } from './state/settings';
import { QUALITY_PRESETS } from './config/quality';
import { WEATHER_PRESETS } from './config/weatherPresets';
import type { QualityPreset } from './config/quality';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseClient } from './lib/supabase';
import { restoreSession, signOut, submitAuth, watchAuth } from './auth/auth';
import { fetchMessages, type Message } from './data/messages';
import { getOrCreateWorldSeed } from './data/profile';
import { createLoginScreen } from './ui/login';
import { createStaminaBar } from './ui/staminaBar';
import { createTouchControls } from './ui/touchControls';
import '@fontsource/be-vietnam-pro/600.css';
import { fetchAchievements, markAchievementRead, resetOwnAchievements, unlockAchievement, type Achievement } from './data/achievements';
import { createAchievementPanel } from './ui/achievementPanel';
import { createAchievementToast } from './ui/achievementToast';
import { MessageBoards } from './world/messageBoards';

type PlayerSession = { userId: string; email: string; worldSeed: number; messages: Message[]; achievements: Achievement[] };

async function init() {
  let supabase: SupabaseClient | null = null;
  const loginScreen = createLoginScreen({
    onSubmit: (mode, email, password) => {
      if (!supabase) throw new Error('Set the Supabase values in .env and restart the dev server.');
      return submitAuth(supabase, mode, email, password);
    },
  });
  loginScreen.show('Checking your session…');

  try {
    supabase = createSupabaseClient();
  } catch (error) {
    loginScreen.setStatus(error instanceof Error ? error.message : 'Supabase configuration is missing.', true);
    return;
  }

  let session: PlayerSession | null = null;
  let stopGame: (() => void) | null = null;
  let requestedUserId: string | null | undefined;
  let authRevision = 0;

  async function enterUser(user: User | null) {
    const userId = user?.id ?? null;
    if (userId === requestedUserId) return;
    requestedUserId = userId;
    const revision = ++authRevision;
    stopGame?.();
    stopGame = null;
    session = null;
    delete (window as any).horseSim;

    if (!user) {
      loginScreen.show();
      return;
    }

    loginScreen.show('Loading your messages and player profile…');
    try {
      const [messages, worldSeed, achievements] = await Promise.all([
        fetchMessages(supabase!),
        getOrCreateWorldSeed(supabase!, user.id),
        fetchAchievements(supabase!, user.id),
      ]);
      if (revision !== authRevision) return;
      session = { userId: user.id, email: user.email ?? 'Signed in player', worldSeed, messages, achievements };
      console.info(`Loaded ${messages.length} active messages for the signed-in player.`);
      const cleanup = await startGame(session, supabase!);
      if (revision !== authRevision) {
        cleanup();
        return;
      }
      stopGame = cleanup;
      loginScreen.hide();
    } catch (error) {
      if (revision !== authRevision) return;
      requestedUserId = null;
      session = null;
      loginScreen.show();
      loginScreen.setStatus(
        error instanceof Error ? `Could not load player data: ${error.message}` : 'Could not load player data. Check the connection and try again.',
        true
      );
    }
  }

  const unsubscribe = watchAuth(supabase, (user) => { void enterUser(user); });
  try {
    await enterUser(await restoreSession(supabase));
  } catch (error) {
    loginScreen.show();
    loginScreen.setStatus(error instanceof Error ? error.message : 'Could not restore the sign-in session.', true);
  }

  const viteHot = (import.meta as any).hot;
  viteHot?.dispose(() => {
    unsubscribe();
    stopGame?.();
    loginScreen.destroy();
  });
}

async function startGame(session: PlayerSession, supabase: SupabaseClient): Promise<() => void> {
  await document.fonts.load('600 48px "Be Vietnam Pro"');
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
  const touchControls = createTouchControls(input, settings.touchControls);
  const audio = new AudioManager(settings.sound);
  const staminaBar = createStaminaBar();
  const toast = createAchievementToast();
  let achievements = [...session.achievements];
  const pendingUnlocks = new Set<number>();
  let achievementPanel: ReturnType<typeof createAchievementPanel>;
  let messageBoards: MessageBoards;
  let disposed = false;
  achievementPanel = createAchievementPanel(session.messages, achievements, async (messageId) => {
    await markAchievementRead(supabase, session.userId, messageId);
    achievements = achievements.map((item) => item.messageId === messageId
      ? { ...item, readAt: new Date().toISOString() }
      : item);
  }, async () => {
    await resetOwnAchievements(supabase);
    achievements = [];
    messageBoards.setCollected([]);
    achievementPanel.setAchievements(achievements);
  });
  let automaticWeather = settings.weather === 'auto';
  let isNight = false;
  let activeWeather: keyof typeof WEATHER_PRESETS =
    settings.weather === 'auto' ? 'clear' : settings.weather;
  let weatherChangeTimer = 120;
  let dayNightTimer = 300;
  const initialWeather = automaticWeather ? 'clear' : settings.weather;
  audio.setWeather(initialWeather);
  const quality: QualityPreset =
    QUALITY_PRESETS[settings.quality] ?? QUALITY_PRESETS.medium;

  const grassSystem = new GrassSystem(quality);
  grassSystem.addTo(scene);
  const query = new URLSearchParams(location.search);
  const seedParam = import.meta.env.DEV ? query.get('seed') : null;
  const seedOverride = seedParam !== null && /^\d+$/.test(seedParam) && Number(seedParam) <= 0xffffffff
    ? Number(seedParam)
    : null;
  const boardSeed = seedOverride ?? session.worldSeed;
  const nearBoardTest = import.meta.env.DEV && query.get('debugBoards') === '1' && query.get('boardNear') === '1';
  const nearbyBoardId = nearBoardTest
    ? session.messages.find((message) => !achievements.some((item) => item.messageId === message.id))?.id ?? session.messages[0]?.id
    : undefined;
  messageBoards = new MessageBoards(scene, grassSystem, renderer, boardSeed, session.messages, async (placement) => {
    if (disposed || pendingUnlocks.has(placement.id) || achievements.some((item) => item.messageId === placement.id)) return;
    pendingUnlocks.add(placement.id);
    try {
      const unlocked = await unlockAchievement(supabase, session.userId, placement.id);
      if (disposed) return;
      if (!unlocked) {
        achievements = await fetchAchievements(supabase, session.userId);
        if (disposed) return;
        achievementPanel.setAchievements(achievements);
        messageBoards.setCollected(achievements.map((item) => item.messageId));
        return;
      }
      achievements = [...achievements, unlocked].sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt)
        || a.messageId - b.messageId);
      achievementPanel.setAchievements(achievements);
      messageBoards.setCollected(achievements.map((item) => item.messageId));
      toast.discovery(achievements.length, session.messages.length, placement.text);
      audio.playAchievementChime([1, 10, 25, 50].includes(achievements.length));
    } catch (error) {
      console.error('Could not save message discovery:', error);
      if (!disposed) toast.error();
    } finally {
      pendingUnlocks.delete(placement.id);
    }
  }, nearbyBoardId);
  messageBoards.setCollected(achievements.map((item) => item.messageId));
  messageBoards.setNight(settings.weather === 'night');
  const boardDebug = import.meta.env.DEV && query.get('debugBoards') === '1'
    ? document.createElement('pre')
    : null;
  if (boardDebug) {
    boardDebug.className = 'board-debug';
    document.body.append(boardDebug);
  }
  function updateBoardDebug() {
    if (!boardDebug) return;
    const active = messageBoards.activePlacement;
    const activeText = active
      ? `Active: #${active.id} at chunk ${active.chunkX},${active.chunkZ}`
      : 'Active: none (waiting for a new 10×10-chunk square)';
    boardDebug.textContent = `Seed ${boardSeed}${seedOverride === null ? ' (database)' : ' (debug override)'} · ${messageBoards.placements.length} messages · ${messageBoards.loadedCount} loaded${nearBoardTest ? ' · NEAR-SPAWN TEST' : ''}\n${activeText}`;
  }
  updateBoardDebug();
  const insects = new Insects(grassSystem, scene);
  insects.setNight(initialWeather === 'night');

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
  weather.setPreset(initialWeather);

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
  let runWasDown = false;
  const autoPilot = new AutoPilot();
  autoPilot.setEnabled(settings.autoWander);

  function setWeather(name: string) {
    if (name === 'auto') {
      automaticWeather = true;
      isNight = false;
      weatherChangeTimer = 120;
      dayNightTimer = 300;
      settings.weather = 'auto';
    } else if (WEATHER_PRESETS[name]) {
      automaticWeather = false;
      settings.weather = name as typeof settings.weather;
    } else {
      return;
    }
    applyWeather(name === 'auto' ? 'clear' : name as keyof typeof WEATHER_PRESETS);
    saveSettings(settings);
  }

  function applyWeather(name: keyof typeof WEATHER_PRESETS) {
    activeWeather = name;
    weather.setPreset(name);
    insects.setNight(name === 'night');
    messageBoards.setNight(name === 'night');
    audio.setWeather(name);
  }

  function updateAutomaticWeather(dt: number) {
    if (!automaticWeather) return;
    dayNightTimer -= dt;
    if (dayNightTimer <= 0) {
      isNight = !isNight;
      dayNightTimer += 300;
      if (isNight) {
        applyWeather('night');
      } else {
        weatherChangeTimer = 120;
        applyWeather('clear');
      }
    }
    if (!isNight) weatherChangeTimer -= dt;
    if (!isNight && weatherChangeTimer <= 0) {
      const transient = (['cloudy', 'rain', 'fog'] as const)
        .filter((name) => name !== activeWeather);
      const name = transient[Math.floor(Math.random() * transient.length)];
      weatherChangeTimer += 120;
      applyWeather(name);
    }
  }

  function setQuality(name: string) {
    const preset = QUALITY_PRESETS[name];
    if (!preset) return;
    applyQualityPreset(preset);
    settings.quality = name as typeof settings.quality;
    saveSettings(settings);
  }

  const destroyOptionsPanel = createOptionsPanel({
    settings,
    accountEmail: session.email,
    onSignOut: () => signOut(supabase),
    weatherNames: ['auto', ...Object.keys(WEATHER_PRESETS)],
    qualityNames: Object.keys(QUALITY_PRESETS),
    onWeather: setWeather,
    onQuality: setQuality,
    onSound: (enabled) => {
      settings.sound = enabled;
      saveSettings(settings);
      audio.setEnabled(enabled);
    },
    onAutoWander: (enabled) => {
      settings.autoWander = enabled;
      saveSettings(settings);
      autoPilot.setEnabled(enabled);
    },
    onTouchControls: (enabled) => {
      settings.touchControls = enabled;
      saveSettings(settings);
      touchControls.setEnabled(enabled);
    },
  });

  const loader = new GLTFLoader();
  loader.load(
    '/models/horse.glb',
    (gltf) => {
      if (disposed) return;
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
      if (input.state.run && !runWasDown && controller?.stamina.exhausted) staminaBar.shake();
      runWasDown = input.state.run;
      updateAutomaticWeather(dt);
      weather.update(dt, camera.position);
      messageBoards.setWetness(weather.current.wetness);

      if (controller && cameraRig) {
        const autoInput = autoPilot.update(
          dt,
          controller.horse.root.position.x,
          controller.horse.root.position.z,
          controller.yaw,
          input.state,
          controller.stamina.value,
          controller.eating
        );
        controller.update(dt, autoInput);
        staminaBar.update(
          controller.stamina.value,
          controller.stamina.exhausted,
          controller.grounded && Math.abs(controller.speed) < 0.2 && !controller.eating && !controller.sitting,
          dt
        );

        cameraRig.update(
          dt,
          controller.horse.root.position,
          controller.yaw,
          Math.abs(controller.speed) > 0.3,
          controller.speed
        );
        updateTerrain(
          terrain,
          controller.horse.root.position.x,
          controller.horse.root.position.z
        );

        if (messageBoards.update(controller.horse.root.position.x, controller.horse.root.position.z, controller.yaw)) updateBoardDebug();
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

      weather.updateHorseSplashes(dt, controller ? {
        x: controller.horse.root.position.x,
        z: controller.horse.root.position.z,
        yaw: controller.yaw,
        speed: controller.speed,
        grounded: controller.grounded,
      } : undefined);

      audio.update(dt, {
        speed: controller?.speed ?? 0,
        grounded: controller?.grounded ?? false,
        eating: controller?.eating ?? false,
        sitting: controller?.sitting ?? false,
      });

      insects.update(weather.time);

      horse?.update(dt);
    },
    fpsEl
  );

  // ponytail: console helpers for weather and quality
  (window as any).horseSim = {
    setWeather: (name: string) => {
      if (name !== 'auto' && !WEATHER_PRESETS[name]) {
        console.warn(
          'Unknown weather:',
          name,
          'Available:',
          Object.keys(WEATHER_PRESETS)
        );
        return;
      }
      setWeather(name);
      console.log('Weather set to', name);
    },
    setQuality: (name: string) => {
      if (!QUALITY_PRESETS[name]) {
        console.warn(
          'Unknown quality:',
          name,
          'Available:',
          Object.keys(QUALITY_PRESETS)
        );
        return;
      }
      setQuality(name);
      console.log('Quality set to', name);
    },
    weather,
    grassSystem,
    messageBoards,
  };

  return () => {
    disposed = true;
    input.detach();
    touchControls.destroy();
    cameraRig?.destroy();
    weather.dispose();
    insects.dispose();
    messageBoards.destroy();
    grassSystem.destroy();
    audio.dispose();
    staminaBar.destroy();
    achievementPanel.destroy();
    toast.destroy();
    boardDebug?.remove();
    destroyOptionsPanel();
    stopLoop();
    scene.background = null;
    scene.environment = null;
    for (const texture of Object.values(skyResult.hdris)) texture.dispose?.();
    (terrain.material as any).map?.dispose?.();
    terrain.geometry.dispose();
    (terrain.material as any).dispose?.();
    disposeRenderer(renderer);
    gpuEl.textContent = '';
  };
}

init().catch((err: unknown) => {
  console.error('Init failed:', err);
  const gpuEl = document.getElementById('gpu-message')!;
  gpuEl.style.color = '#f55';
  gpuEl.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
});
