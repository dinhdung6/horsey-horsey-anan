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

## 1. FOLDER

## 2. Coding Rules

### 2.1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Use OpenSpec workflow.

Before implementing:
- Read proposal
- Read design
- Complete tasks.md

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

- You MUST follow the spec strictly, if anything in the spec is conflict or not clear, raise a question so user can decide. DO NOT guess

## 2.2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- Your code have to be tested seperately.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- The number of code lines in a single file must be under 500 lines (but don't modify legacy code files just to achieve this)
- ALWAYS use Ponytail plugins for coding.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 2.3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 2.4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 2.5. Prompt Editing:

- Never change any business logic in prompt, only change how the prompt work
- After any prompt change, audit the prompt, the result and give me a short change analytic

## 2.6 Explaining Language:
In brainstorm, explaining, proposal phase, explain like I am an idiot

## 2.7 Finishing:

After everytime you finished your work, you should give me an explanation on what you have done. And you should give me which container I should build or up again if needed.