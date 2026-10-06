# Horse Simulator — Technical Specification (for Claude Code)

A browser game in the style of "Bò Simulator" (grass.hieunt.site): a 3D horse walks around an endless, wind-swept grass field. The horse moves manually (keyboard) or wanders automatically, and the player can change the weather and the graphics quality.

> **How to use this document with Claude Code.** Put this file in the project root as `SPEC.md`, then run: *"Read SPEC.md and build the project step by step, following the milestones in section 12. After each milestone run the app, check it in the browser, and report what works before continuing."* Do the asset steps in section 3 first (the horse model must be downloaded by hand).

---

## 1. Scope

**In scope (what was requested)**

| Feature | Notes |
|---|---|
| Endless 3D grass field | Tens/hundreds of thousands of grass blades, GPU-instanced, wind animation |
| Horse character | Third-person, animated: idle, walk, run (gallop), jump, eat grass, sit |
| Manual control | W A S D move, Shift run, Space jump, plus keys for sit and eat (section 7) |
| Automatic mode | Horse wanders by itself when idle / when "Auto" is toggled; any key press takes back control |
| Weather modes | Clear, Cloudy, Rain, Storm, Fog (Snow optional) |
| Quality setting | Low / Medium / High / Ultra |
| Options panel | Weather, Quality, Auto-wander, Sound on/off |

**Out of scope** (present in the original but not requested): wings/flying, flower collecting, skins, survival, multiplayer, compass/coordinate HUD, share/donate buttons. Keep the code structured so these can be added later.

## 2. Reference: what the original game does

Everything below is taken from the page metadata and two screenshots; the original source code was not available.

- Title "Bò Simulator", described as a 3D endless meadow running in the browser **with WebGPU**.
- Warm sunset lighting, dark green/brown grass, distant farm buildings (barn, windmill, fence), fog toward the horizon.
- Third-person camera behind the animal; grass is taller than the animal's legs and visibly sways.
- Options panel with: Mode (Solo), Skins, Survival, Quality (Ultra), Weather (Clear), Time (Day/night cycle), Sound (On).

The look to aim for: low sun, long soft shadows, strong fog gradient, grass colour darker at the root and lighter at the tip, warm rim light on blades.

## 3. Assets (what to download, where, and licences)

All assets below are CC0 (public domain) unless stated, so they can be used commercially with no credit. Credit anyway where it is courteous.

### 3.1 Horse model (manual download required)

| Option | Source | Licence | Why |
|---|---|---|---|
| **Quaternius "Horse"** (recommended) | https://poly.pizza/m/qvTrSG9pZF | CC0 | Low-poly, glTF, animated. Part of Quaternius's animated animal packs. |
| Quaternius "Ultimate Animated Animal Pack" (12 animals incl. horse and a white horse) | https://quaternius.com/packs/ultimateanimatedanimals.html | CC0 | Pack description lists 12+ animations per animal, including gallop, walk and jump. glTF/FBX/OBJ/Blend. |
| Quaternius "Farm Animal Pack" (7 animals incl. horse) | https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT | CC0 | Smaller pack, has run/idle/jump/walk. Also contains a cow, handy for comparing scale against the original game. |
| Low-Poly Horses Pack (free tier: 4 horses) | https://ahmedamirdev.itch.io/amir-low-poly-horses-pack | Free for personal and commercial use (free and plus tiers) | Idle/Walk/Run, FBX + glTF. Fallback if Quaternius clips are unsuitable. |

**Steps**
1. Download the Horse as **glTF/GLB**. Save to `public/models/horse.glb`. If you get a `.gltf` with separate files, keep them together in the same folder, or convert to a single `.glb` (`npx gltf-transform copy in.gltf out.glb`).
2. Optional compress: `npx gltf-transform optimize public/models/horse.glb public/models/horse.opt.glb`.
3. At first run, log `gltf.animations.map(a => a.name)` and fill in the clip mapping in `src/config/animations.ts` (section 6.2). Clip names differ between packs, so **never hard-code names without checking them**.

**Known gap: "sit".** Most low-poly horse packs have no sit/lie-down clip. Handle it in this order: (a) use a clip such as "lay down"/"rest"/"sleep" if the pack has one; (b) otherwise fake it: play idle, lower the model root by a small amount and blend a head-down/eating pose; (c) or generate the clip in Blender. Make the sit state data-driven so it works with whichever option exists.

### 3.2 Ground / grass textures (Poly Haven, CC0, no login)

Grass blades themselves are procedural geometry (no texture). The textures are for the **ground under the blades** and for a dirt path/patches, so gaps between blades don't show a flat colour.

| Use | Asset id | URL | Licence |
|---|---|---|---|
| Main ground (worn grass on soil) | `grass_ground` | https://polyhaven.com/a/grass_ground | CC0 |
| Alternative ground (sparse grass over damp soil) | `sparse_grass` | https://polyhaven.com/a/sparse_grass | CC0 |
| Dirt path with grass tufts | `grass_path_2` | https://polyhaven.com/a/grass_path_2 | CC0 |
| Forest-floor patches (dry grass, leaves) | `forrest_ground_01` (note the id spelling) | https://polyhaven.com/a/forrest_ground_01 | CC0 |

Use **1K or 2K** JPG maps (Diffuse, `nor_gl` normal, Rough, AO, optionally Displacement). 4K+ wastes memory for a repeating ground tile. The normal map must be the **GL** variant for three.js.

### 3.3 Sky and lighting

Preferred approach: a **procedural sky** with a time-of-day parameter (sun position drives sky colour, light colour and fog colour), because weather and the day/night cycle then blend smoothly. Use HDRIs only as optional image-based lighting (IBL) / fallback.

| Use | Asset id | URL |
|---|---|---|
| Sunset (matches the original's mood) | `toposcope_sunset` | https://polyhaven.com/a/toposcope_sunset |
| Soft sunset, pure sky | `industrial_sunset_02_puresky` | https://polyhaven.com/a/industrial_sunset_02_puresky |
| Overcast / cloudy / rain | `kloofendal_overcast_puresky` | https://polyhaven.com/a/kloofendal_overcast_puresky |
| Overcast, alternate | `overcast_soil_puresky` | https://polyhaven.com/a/overcast_soil_puresky |

All CC0. Download the **1K or 2K `.hdr`** version (not 8K+). Load with `HDRLoader`/`RGBELoader` from the three addons (check which name exists in the installed version) and convert with PMREM.

### 3.4 Weather

No downloadable assets are needed. Rain, snow, fog, lightning and cloud tint are all procedural (section 9). Overcast HDRIs above give cloudy lighting.

### 3.5 Audio (optional, for the Sound toggle)

| Use | Source | Licence |
|---|---|---|
| Footsteps (grass) | OpenGameArt "Fantozzi's Footsteps (Grass/Sand & Stone)" — https://opengameart.org (search the title) | CC0 |
| Footsteps / foley | Kenney "RPG Audio" — https://kenney.nl/assets/rpg-audio | CC0 |
| Rain loop, thunder, wind | OpenGameArt "Rain (loopable)", "100 CC0 SFX #2" (has thunder and air flow), "30 CC0 SFX loops" | CC0 |
| Ambient loops | Freesound.org, filter by CC0 (free account needed) | check each sound |

Mixkit's free ambience (rain loops etc.) is free to use, but its licence is **not** CC0, so read it before shipping. Convert everything to `.ogg` or `.mp3`, mono for one-shots.

### 3.6 Automatic fetching of Poly Haven files

Poly Haven has a public, keyless API: `GET https://api.polyhaven.com/files/{asset_id}` returns download URLs for every map/resolution/format. Send a descriptive `User-Agent` header (their API terms ask for one). Put this in `scripts/fetch-assets.mjs`:

```js
// node scripts/fetch-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'HorseSimulator-asset-fetch/1.0 (personal project)';
const textures = ['grass_ground', 'sparse_grass', 'grass_path_2'];
const hdris = ['toposcope_sunset', 'kloofendal_overcast_puresky'];
const TEX_MAPS = ['Diffuse', 'nor_gl', 'Rough', 'AO']; // keys as listed by the API
const RES = '2k';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
async function save(url, path) {
  const buf = Buffer.from(await (await get(url)).arrayBuffer());
  await writeFile(path, buf);
  console.log('saved', path);
}

for (const id of textures) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  await mkdir(`public/textures/${id}`, { recursive: true });
  for (const map of TEX_MAPS) {
    const entry = files[map]?.[RES]?.jpg;          // verify shape by logging `files` once
    if (entry) await save(entry.url, `public/textures/${id}/${map}_${RES}.jpg`);
    else console.warn('missing', id, map);
  }
}
for (const id of hdris) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  const entry = files.hdri?.['2k']?.hdr;
  await mkdir('public/hdri', { recursive: true });
  if (entry) await save(entry.url, `public/hdri/${id}_2k.hdr`);
}
```

The exact JSON shape should be confirmed by logging `files` once; adapt the keys if they differ. This script runs on the user's machine, not in a restricted sandbox.

## 4. Technology stack

| Layer | Choice | Reason |
|---|---|---|
| Build | **Vite + TypeScript (strict)** | Fast dev server, simple static deploy |
| 3D | **three.js, `three/webgpu` build, `WebGPURenderer`** (use r171 or newer; pin the exact version in `package.json`) | Same tech as the original. The renderer falls back to WebGL2 automatically if WebGPU is unavailable, so the game still runs in more browsers. |
| Shaders | **TSL** (Three Shading Language, `three/tsl`) | One JS-style shader source compiles to WGSL (WebGPU) or GLSL (WebGL2) |
| UI | Plain HTML/CSS overlay (or small Preact) | Keep the UI out of the render loop |
| State | A tiny typed store (no framework needed) | Settings: quality, weather, auto mode, sound |
| Audio | Web Audio API (`AudioContext`), or `howler` | Loops + one-shots |

Optional: a Next.js wrapper is possible but adds nothing; this is a client-only canvas app. Use Vite unless it must live inside an existing Next.js site (then mount the engine in a client component with dynamic import, `ssr: false`).

**Browser support to document in the README:** WebGPU works in recent Chrome/Edge (and Safari on recent OS versions); otherwise the game runs on the WebGL2 fallback with lower grass counts. Mobile is possible but should default to Low/Medium.

## 5. Project structure

```
horse-sim/
├─ public/
│  ├─ models/horse.glb
│  ├─ textures/<asset_id>/{Diffuse,nor_gl,Rough,AO}_2k.jpg
│  ├─ hdri/*.hdr
│  └─ audio/*.ogg
├─ scripts/fetch-assets.mjs
├─ src/
│  ├─ main.ts                 # bootstrap, loop
│  ├─ engine/
│  │  ├─ renderer.ts          # WebGPURenderer setup, resize, pixel ratio
│  │  ├─ loop.ts              # fixed-step update + render
│  │  └─ input.ts             # keyboard + touch -> InputState
│  ├─ world/
│  │  ├─ terrain.ts           # heightAt(x,z) shared CPU/GPU, ground mesh
│  │  ├─ grass.ts             # blade geometry, chunks, TSL material
│  │  ├─ sky.ts               # procedural sky, sun, fog, IBL
│  │  └─ weather.ts           # weather state machine + particles
│  ├─ entities/
│  │  ├─ horse.ts             # model, animation state machine
│  │  ├─ horseController.ts   # movement physics, manual input
│  │  ├─ autoPilot.ts         # wander AI
│  │  └─ cameraRig.ts         # third-person follow camera
│  ├─ config/
│  │  ├─ animations.ts        # clip name mapping
│  │  ├─ quality.ts           # presets
│  │  └─ weatherPresets.ts
│  ├─ audio/audioManager.ts
│  ├─ ui/{optionsPanel.ts,hud.css}
│  └─ state/settings.ts
└─ SPEC.md
```

## 6. Core systems

### 6.1 Coordinate and unit conventions
- 1 world unit = 1 metre. Horse is about 1.6 m at the withers (scale the GLB to match; log its bounding box on load).
- Y up. Horse faces +Z in its local space after load; fix with a wrapper `Group` if the GLB faces another way.
- Update at a fixed 60 Hz step (accumulator) and render with interpolation; keeps movement identical across frame rates.

### 6.2 Horse and animation

Animation config (fill after logging real clip names):

```ts
// src/config/animations.ts
export const CLIPS = {
  idle:  ['Idle'],               // lists of candidate names, first match wins
  walk:  ['Walk'],
  run:   ['Gallop', 'Run'],
  jump:  ['Jump', 'Gallop_Jump'],
  eat:   ['Eating', 'Idle_Eating'],
  sit:   ['LayDown', 'Sit', 'Rest'], // may not exist -> see 3.1 fallback
} as const;
```

State machine: `idle ⇄ walk ⇄ run`, `jump` (one-shot, returns to previous), `eat` (loop while key held or until timer ends), `sit` (toggle). Use `AnimationMixer` with `crossFadeTo(…, 0.2–0.3 s)`. Scale walk/run playback speed by actual ground speed so feet don't slide (`action.timeScale = speed / clipReferenceSpeed`).

Rules:
- Cannot eat or sit while airborne; cannot jump while sitting (stand up first).
- Any movement input while sitting or eating cancels that state and blends to walk.
- The eat clip's head-down moment should coincide with grass being eaten (section 6.4).

### 6.3 Movement (manual)

Input → `InputState { moveX, moveZ, run, jumpPressed, sitToggle, eatHeld }`.

- Direction is relative to the camera yaw: W moves away from the camera, S backs up slowly, A/D steer.
- Horses turn, they don't strafe. Rotate the body toward the desired heading with a limited turn rate (e.g. 2.5 rad/s walking, 1.8 rad/s running), then move forward along the facing direction. Smooth with exponential damping: `v = damp(v, target, lambda, dt)`.
- Speeds (tunable in one config): walk 2.0 m/s, run 7.0 m/s, reverse 1.0 m/s; accel/decel time about 0.25 s.
- Jump: initial vertical velocity ≈ 5 m/s, gravity 14 m/s², allow a short coyote time (0.1 s). Keep horizontal momentum in the air.
- Ground follow: `y = terrain.heightAt(x, z)`; tilt the body to the terrain normal by sampling height at the front/back/left/right of the horse and lerping the rotation (pitch/roll) for realistic slope handling.

### 6.4 Eating grass

- Key `E` (hold) or auto when idle over grass: play `eat`.
- Visual feedback: a "bite point" in front of the horse's head. Keep a small ring buffer (e.g. 16 entries) of `(x, z, time)` uniforms. In the grass vertex shader, blades within ~0.6 m of a bite point have their height scaled toward 20% and regrow over ~30 s. This is cheap and needs no per-blade CPU work.
- Optional: a counter in the HUD ("Grass eaten").

### 6.5 Sit

Toggle with `C`. See the gap note in 3.1. When sitting: stop movement, lower the camera slightly, and let the wander AI idle.

### 6.6 Automatic wander (autoPilot)

- Enabled via an Options toggle "Auto" and when there has been no input for 8 seconds (configurable). Any movement key disables it instantly.
- Behaviour loop: pick a random target within 15–40 m → walk (80%) or run (20%) toward it → at arrival, randomly idle 2–6 s, eat 3–8 s, or pick the next target. Occasionally small jumps if a slope is steep.
- Produces the same `InputState` as the keyboard, so the controller code has a single path.
- Avoid world-edge issues: the world is infinite, so just keep targets near the player.

### 6.7 Camera

- Third-person follow: offset about (0, 2.2, −5.5) behind the horse, look-at point slightly above the horse's back.
- Mouse drag (or right-stick/touch drag) orbits yaw/pitch; clamp pitch to [−10°, 60°]. Auto-recentre behind the horse after 2 s without drag while moving.
- Smooth with damping; keep the camera above terrain (`max(camY, heightAt + 0.6)`), because grass is tall.
- Slight FOV increase while running (60 → 68).

## 7. Controls

| Input | Action |
|---|---|
| W / ↑ | Walk forward |
| S / ↓ | Back up slowly |
| A / D (← / →) | Turn left / right |
| Shift (hold) | Run (gallop) |
| Space | Jump |
| E (hold) | Eat grass |
| C | Sit / stand |
| Mouse drag | Orbit camera |
| Esc / O | Toggle Options panel |
| Touch (mobile) | Left virtual joystick, buttons for Run, Jump, Eat, Sit |

Ignore game keys while a text input or the Options panel has focus.

## 8. Grass rendering (the heart of the project)

### 8.1 Approach
- **One `InstancedMesh`** (or a few, one per chunk) of a single blade geometry. Thousands of draw calls would kill performance, so everything must be instanced.
- Blade geometry: a tapered triangle strip with 3–5 segments (Ultra) or 1–2 (Low), 15–25 vertices, bent as a curve. Store per-vertex `t` (0 at root, 1 at tip) for colour, bending and wind.
- Per-instance data (position x/z, rotation, height, width, colour seed, lean) is **computed in the shader from the instance id and the chunk origin using a hash function**, so no large attribute buffers are uploaded. Positions are jittered grid cells. This also makes chunk recycling free.

### 8.2 Endless field via chunks
- Divide the world into square chunks (e.g. 16 m). Keep a grid of `(2R+1)²` chunks around the player. When the player crosses a chunk border, move the far-side chunks to the near side by changing a per-chunk origin uniform. No allocation, no regeneration.
- Density and detail by distance: near chunks get the full blade count and full segments; mid chunks fewer, wider blades; far chunks very few or fade out into fog. Fade by scaling blade height/width to 0 in the shader at the edge radius, so there is no popping.
- Frustum culling: give each chunk a bounding sphere and let three cull it, or skip chunks behind the camera in the update.

### 8.3 Terrain
Gentle rolling hills using an **analytic height function** so the CPU (horse, camera) and GPU (blade base, ground mesh) always agree:

```ts
// src/world/terrain.ts — same formula written in TS and TSL
export const heightAt = (x: number, z: number) =>
  Math.sin(x * 0.04) * 1.2 + Math.cos(z * 0.035) * 1.0 + Math.sin((x + z) * 0.012) * 2.5;
```

Ground mesh: a large plane that follows the player in whole-tile steps (so the texture doesn't slide), vertices displaced by the same function, with the ground texture from 3.2 tiled by world position (`uv = worldXZ / tileSize`) and a low-frequency noise blend between two textures to hide tiling.

### 8.4 Blade shader (TSL sketch)
A reference sketch to be verified against the installed three.js version's examples and docs. Do not copy it blindly; TSL function names and node semantics change between releases.

```ts
// Pseudocode — adapt to the real TSL API of the pinned three version
const hash = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

positionNode = Fn(() => {
  // 1. instance -> world position inside chunk
  const cell   = vec2(instanceIndex.mod(N), instanceIndex.div(N));
  const jitter = vec2(hash(cell), hash(cell.yx));
  const baseXZ = chunkOrigin.add(cell.add(jitter).mul(cellSize));
  const baseY  = terrainHeight(baseXZ);                 // same formula as CPU

  // 2. per-blade randomness
  const rnd    = hash(baseXZ);
  const height = mix(bladeMin, bladeMax, rnd).mul(heightFade(baseXZ, playerPos));
  const t      = attribute('bladeT');                   // 0 root .. 1 tip

  // 3. bend curve + wind (travelling gust + fast flutter, stronger at tip)
  const wind   = sin(baseXZ.dot(windDir).mul(0.3).add(time.mul(1.2))).mul(windStrength);
  const bend   = t.mul(t).mul(wind.add(lean));

  // 4. push away from the horse (and shrink at bite points)
  const away   = baseXZ.sub(horsePos.xz);
  const push   = smoothstep(1.2, 0.0, length(away)).mul(t.mul(t));
  // ...combine into final world position
})();

colorNode = mix(rootColor, tipColor, t.pow(1.3))        // dark base, bright tip
              .mul(mix(0.85, 1.15, rnd))                // per-blade variation
              .mul(wetnessDarken);                      // weather uniform
```

Visual extras (do after it works): fake translucency (brighter when the sun is behind the blade), a warm rim/Fresnel on the tips, ground-colour projection onto the blade base so blades blend with the soil, and slight normal bending so lighting follows the curve. Render blades double-sided.

### 8.5 Reference implementations to read (do not depend on them blindly)
- `dedekpo/stylized-scene` (MIT) — stylised instanced grass with directional wind in TSL: https://github.com/dedekpo/stylized-scene
- `AskAlice/threejs-grass` — infinite, tile-streamed WebGPU grass for three.js: https://github.com/AskAlice/threejs-grass (**check its licence before copying any code**)
- `CK42BB/procedural-grass-threejs` — notes on bezier blades, wind layers, LOD, interactive displacement: https://github.com/CK42BB/procedural-grass-threejs
- Codrops "False Earth" article on GPU-driven culling and indirect draws: https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/
- three.js TSL guide: https://sbcode.net/tsl/getting-started/ and the official three.js WebGPU examples

Prefer writing our own implementation guided by these. If code is reused, keep the licence notices.

## 9. Weather system

A single `WeatherState` blended over about 3 seconds (all values lerped; never snap). Presets in `src/config/weatherPresets.ts`:

| Preset | Sun intensity | Sky/fog tint | Fog density | Wind | Grass wetness | Precipitation | Extras |
|---|---|---|---|---|---|---|---|
| Clear | 1.0 | warm sunset | low | 0.4 | 0 | none | — |
| Cloudy | 0.45 | grey-blue | medium | 0.7 | 0.1 | none | overcast HDRI for IBL, soft shadows |
| Rain | 0.25 | dark grey | medium-high | 1.0 | 0.8 | rain 1500 streaks | rain loop, grass darker + glossier |
| Storm | 0.15 | very dark | high | 1.8 | 1.0 | heavy rain | lightning flashes, thunder, grass thrashes |
| Fog | 0.35 | pale | very high | 0.2 | 0.3 | none | visibility about 30 m |
| Snow (optional) | 0.5 | white-blue | medium | 0.5 | — | snow flakes | grass tip colour shifts to white |

### 9.1 Precipitation
- One `InstancedMesh` of thin quads (rain streaks) or small sprites (snow). Instances live in a box (e.g. 40×20×40 m) that follows the camera.
- Do **all motion in the vertex shader**: `pos = mod(startPos + vec3(wind, -fallSpeed, 0) * time, boxSize) - boxHalf + cameraPos`. No per-frame CPU updates, so tens of thousands of drops are cheap.
- Rain streaks stretch along the velocity direction; snow drifts with a sine sway. Fade near the box edges.
- Rain splashes on the ground are optional.

### 9.2 Lightning (Storm)
Random timer (4–12 s): briefly (80–150 ms, double flash) spike ambient light and sky brightness, then play thunder after a delay proportional to a fake distance.

### 9.3 Wetness
A `wetness` uniform darkens the grass albedo, lowers roughness, and increases specular highlights on the ground material.

### 9.4 Time of day
Defaults to a fixed warm sunset (like the original's mood). Include a simple `timeOfDay` (0–1) that moves the sun and re-tints sky and fog. A Day/Night cycle toggle is an optional stretch goal, not required.

## 10. Quality presets

`src/config/quality.ts`. Changing quality must apply **live** without reloading (rebuild chunks and resize render targets).

| Setting | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Grass view radius (chunks) | 3 | 5 | 7 | 9 |
| Max grass blades (approx.) | 60 k | 200 k | 500 k | 1 M |
| Blade segments | 1 | 2 | 3 | 5 |
| Pixel ratio cap | 1.0 | 1.25 | 1.5 | 2.0 |
| Shadows | off | 1024 map, horse only | 2048 | 4096 + softer filter |
| Wind detail | single wave | 2 layers | 3 layers | 3 + turbulence |
| Weather particles | 500 | 1500 | 3000 | 6000 |
| Post-processing | none | none | light bloom | bloom + subtle vignette/tone mapping |
| Horse anti-aliasing | off | on | on | on |

Numbers are starting points. Tune by measuring: **auto-quality** (optional) lowers one tier if the average frame time stays above 22 ms for 3 s. On mobile start at Low or Medium. If WebGPU is unavailable (WebGL2 fallback), cap the preset at High.

## 11. Options panel and state

Settings object (persist with `localStorage`, wrapped in try/catch):

```ts
type Settings = {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  weather: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
  autoWander: boolean;
  sound: boolean;
};
```

Panel (top-right "Options" button, like the original): Quality dropdown, Weather dropdown, Auto-wander toggle, Sound toggle. A "Controls" button bottom-left lists the keys in section 7. Style: dark translucent card, rounded corners, uppercase small labels, warm accent colour (the original uses dark green/brown with gold highlights).

## 12. Milestones (build in this order and verify each)

1. **Scaffold**: Vite + TS + `three/webgpu`. A renderer that clears the screen, resize handling, FPS counter, WebGPU/WebGL2 detection message.
2. **Terrain + sky + fog**: rolling ground with the Poly Haven texture, procedural sunset sky, fog. Free-fly debug camera.
3. **Grass v1**: one instanced chunk, static blades, root→tip gradient.
4. **Grass v2**: wind, chunk streaming around the camera, distance fade, LOD by distance.
5. **Horse**: load GLB, log animation names, fill `CLIPS`, play idle; scale and orient correctly.
6. **Controller**: WASD + run + jump, slope tilt, ground follow, animation blending.
7. **Camera rig**: follow camera, orbit, collision with terrain.
8. **Grass interaction**: bend away from the horse; eat bite points; sit toggle.
9. **Auto-wander**: autoPilot and input takeover.
10. **Weather**: presets, blending, rain/snow particles, lightning, wetness.
11. **Quality presets** applied live; auto-quality (optional).
12. **Options UI**, persisted settings, controls help, touch controls (optional).
13. **Audio** (optional): footsteps by speed, wind, rain, thunder; Sound toggle.
14. **Polish and deploy**: loading screen with progress, error screen for unsupported browsers, `vite build`, deploy to any static host. README with credits for all assets.

**Acceptance criteria**
- 60 fps at Medium on a mid-range laptop with integrated GPU; Ultra is allowed to be heavy.
- No visible popping of grass chunks while walking in a straight line for 2 minutes.
- Horse feet do not visibly slide at walk and run speeds.
- Changing weather and quality while moving never freezes the game for more than about 200 ms.
- Works with keyboard only, no console errors, and shows a friendly message if neither WebGPU nor WebGL2 is available.

## 13. Risks and notes

- **TSL API drift.** The WebGPU and TSL APIs change often. Pin the three.js version, read that version's examples (`webgpu_*` demos) before writing shaders, and keep shader code isolated in `world/` so it is easy to patch.
- **Animation clips.** Verify names and loop flags at runtime; some packs ship T-pose or root-motion clips that need `clip.tracks` filtering (remove root position tracks if the model slides away from its origin).
- **Licences.** Keep a `CREDITS.md` listing every asset, URL and licence. All items in section 3 are CC0 except where marked; recheck any asset you add later. Do **not** use the original game's code, art or name; this project reproduces the concept, not its assets. Name the game something of its own (e.g. "Ngựa Simulator" / "Horse Simulator").
- **Memory.** Dispose of textures and geometries on quality changes; avoid leaking chunk materials.
- **Mobile.** Heavy grass can overheat phones; default to Low and let the auto-quality drop further.

## 14. Glossary — Thuật ngữ (technical terms)

| Thuật ngữ (Vietnamese) | English definition |
|---|---|
| Kết xuất (render) | Drawing the 3D scene to the screen each frame |
| Đổ bóng (shader) | A small GPU program that computes vertex positions or pixel colours |
| Dựng hình hàng loạt (instancing) | Drawing many copies of one mesh in a single GPU call |
| Khối cỏ (chunk) | A square tile of the world that holds a batch of grass blades |
| Mức độ chi tiết (LOD, level of detail) | Using simpler geometry for objects that are far away |
| Hoạt ảnh (animation clip) | A named recorded motion such as walk or gallop |
| Chuyển hoạt ảnh mượt (cross-fade) | Blending from one animation to another over a short time |
| Máy trạng thái (state machine) | Logic that allows only certain transitions between states (idle, walk, run…) |
| Sương mù (fog) | Distance-based colour blending that hides the far edge of the world |
| Bản đồ pháp tuyến (normal map) | A texture that fakes small surface bumps in lighting |
| Ánh sáng môi trường (IBL, image-based lighting) | Lighting taken from a panoramic image of the sky |
| Điểm ảnh (pixel ratio) | Number of rendered pixels per CSS pixel; lower is faster |
| Hạt (particles) | Many tiny objects such as raindrops or snowflakes |
| Đi lang thang tự động (auto-wander) | The horse picks its own targets and moves without input |
