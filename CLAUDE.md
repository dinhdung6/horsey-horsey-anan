# Horse Simulator — project instructions

Read `SPEC.md` fully before doing anything. It is the source of truth for scope, stack, structure and milestones.

## Stack
- Vite + TypeScript (strict), three.js `three/webgpu` (WebGPURenderer, TSL). Pin the exact three.js version in package.json.
- No UI framework needed; plain HTML/CSS overlay.

## How to work
- Build the milestones in SPEC.md section 12 in order. After each milestone: run `npm run dev`, check it works, and summarise what works and what does not before continuing. Do not start the next milestone until the current one runs without console errors.
- Before writing any TSL/WebGPU shader code, read the official three.js `webgpu_*` examples and docs for the pinned version. The TSL sketch in SPEC.md is pseudocode, not working code.
- The horse model is `public/models/horse.glb` (downloaded by the user). On first load, log `gltf.animations.map(a => a.name)` and the model's bounding box, then fill `src/config/animations.ts` from the real names. Never guess clip names.
- If an asset in `public/` is missing, stop and ask the user for it (name the exact file and where to put it). Do not substitute a placeholder silently.
- Keep shader code isolated in `src/world/` so it is easy to patch when the three.js API changes.
- Keep a `CREDITS.md` listing every asset, its URL and licence.
- Do not copy code from reference repos without checking their licence. Write our own implementation.

## Commands
- `npm run dev` — dev server
- `npm run build` — type-check + production build
- `node scripts/fetch-assets.mjs` — download Poly Haven textures and HDRIs (run on the user's machine)

## Conventions
- 1 world unit = 1 metre, Y up, fixed 60 Hz update step.
- All tunable numbers (speeds, densities, quality presets) live in `src/config/`, not inline.
- Settings persisted via localStorage inside try/catch.

## Do not
- Use the original game's name, code or art.
- Add features outside SPEC.md section 1 (wings, flowers, skins, survival, multiplayer) unless asked.
