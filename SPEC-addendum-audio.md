# SPEC Addendum — Audio (âm thanh)

Extends SPEC.md section 3.5 and milestone 13. It replaces the audio sources named there. Weather names and `windStrength` / `precipitation` values come from the weather presets (clear, cloudy, rain, night, fog).

The current `public/audio/` folder contains wind, rain, one night ambience, horse walk/trot/gallop, and one eating loop. Separate rain-drop, landing, thunder, and layered night wildlife recordings are not present; use the available combined ambience until those recordings are added.

## 2. Preparing the files

Convert and trim once, on the user's machine, with ffmpeg. Keep files small, because they all load before the game starts.

```bash
# ambience (stereo), cap at 90 s, ~100 kbps
ffmpeg -i night_crickets.wav -t 90 -c:a libvorbis -q:a 3 night_crickets.ogg
# horse sounds and thunder (mono is enough, smaller)
ffmpeg -i horse_walk.wav -ac 1 -c:a libvorbis -q:a 4 horse_walk.ogg
# normalise loudness so all sounds start at a similar level
ffmpeg -i in.ogg -af loudnorm=I=-23:TP=-2 out.ogg
```

Target total size of `public/audio/` below about 20 MB. If the browser build needs Safari, also keep `.mp3` copies and choose by `Audio.canPlayType`.

## 3. Audio engine (`src/audio/audioManager.ts`)

Use the Web Audio API. Create one `AudioContext` and **resume it on the first key press or click**, because browsers block sound before a user gesture. Graph:

```
sources → per-sound GainNode → bus (hooves | eat | weather | night) → master GainNode → destination
```

- Settings.sound = false sets master gain to 0 (fade over 0.2 s) and suspends the context.
- All gain changes use `gain.setTargetAtTime(target, ctx.currentTime, 0.3)` so nothing jumps.
- Decode every file once at load time (`decodeAudioData`) and show progress in the loading screen.
- Loops: `AudioBufferSourceNode` with `loop = true`. To hide a bad seam, play two copies of the same buffer offset by half the length and crossfade, or set `loopStart` / `loopEnd` a little inside the file.

## 4. Hoof steps by speed (nhịp chân theo tốc độ)

The controller already has the ground speed in m/s (walk about 2.0, run about 7.0). Three looping layers run permanently at gain 0 and fade in by speed:

| Layer | Plays when speed is about | Gain curve |
|---|---|---|
| `horse_walk` | 0.3 – 3.5 m/s | fades in 0.3 → 1.0 m/s, fades out 3.0 → 4.0 m/s |
| `horse_trot` | 3.0 – 6.0 m/s | fades in 3.0 → 4.0, fades out 5.0 → 6.0 |
| `horse_gallop` | above 5.0 m/s | fades in 5.0 → 6.0, stays up to max speed |

- Use equal-power crossfades (`gain = cos(t·π/2)` / `sin(t·π/2)`) so the volume stays even between layers.
- Set `playbackRate` from speed so the rhythm matches the animation: `rate = clamp(speed / refSpeed, 0.85, 1.15)`. Web Audio changes pitch together with playback rate, so keep the range narrow. Pick `refSpeed` per layer by ear (start with 2.0, 4.5, 7.0).
- The recordings are not synced to the foot contact frames of the animation. That is acceptable for background steps. If it looks off, slice the files into single hoof beats and trigger them from the animation (optional upgrade, section 8).
- When the horse is airborne, drop all hoof layers to 0 within 0.05 s. On landing, play `land_*` with volume scaled by fall speed, then bring the layers back.
- When sitting or eating or idle (speed below 0.3), all hoof layers fade to 0.
- Add small random variation (±5 % gain, ±3 % rate) every few seconds so the loop doesn't feel mechanical.
- Reverse walking (S key) uses the walk layer at lower rate (0.85) and lower gain.

## 5. Eating (`horse_eat_*`)
- Start when the eat state starts. Pick `horse_eat_1` or `horse_eat_2` at random and begin at a random offset inside the file, so repeats don't sound identical.
- Loop while the E key is held or the eat animation plays. Fade out over 0.25 s when the state ends. Hoof layers are off at that time.
- Optional: play `horse_breath_*` once after eating finishes.

## 6. Weather audio (âm thanh thời tiết)

All values come from the existing presets, so there is nothing new to configure per weather:

| Sound | Gain formula (0–1) |
|---|---|
| `wind_strong` | `0.8 × smoothstep(0.5, 1.5, windStrength)` |
| `wind_calm` | `0.15 + 0.5 × (1 − smoothstep(0.5, 1.5, windStrength))` |
| rain level `r` | `precipitation`: none = 0, rain = 0.55, heavy-rain = 0.9 |
| `rain_leaves` | `0.9 × r` |
| `rain_bed` | `1.1 × r²` (so light rain is mostly separate drops, heavy rain a fuller roar) |
| single drops (`rain_drops_puddle`) | triggered randomly, `4 + 20 × r` drops per second (see below) |
| thunder | not used (there is no storm preset or thunder recording) |
| night layers | see section 6b (all scaled by `nightFactor × (1 − r)`) |

- Weather changes use the same 3 s blend as the visuals. Never switch a sound on or off abruptly.
- **Rain (clearly audible drops):** three layers.
  1. **Bed:** `rain_bed` as a crossfaded loop (section 3). It gives the steady rain.
  2. **Leaves:** `rain_leaves` (24 s) as a crossfaded loop. It gives the pattering of drops on vegetation. Because it is short, start two copies at different offsets and give each a slightly different playback rate (0.97 and 1.03) so the repeat is not noticeable.
  3. **Single drops (the part you will hear most clearly):** slice `rain_drops_puddle` (and optionally `rain_drops_concrete`) into individual drops, then trigger them at random. Write a one-off script `scripts/slice-drops.py` (numpy; run it with `python -I`): find the loudest short peaks of the recording (an energy envelope with a threshold, minimum 0.15 s apart), cut 0.2–0.35 s around each peak with a 5 ms fade in and a 30 ms fade out, normalise, and save 30–60 files as `public/audio/drops/drop_000.ogg` and so on. Listen to the result and delete the ones that sound like clicks or are mostly silence. At runtime a scheduler fires a random drop `4 + 20 × r` times per second, with random gain (0.3–1.0), random playback rate (0.9–1.15) and random stereo position (`StereoPannerNode`, −0.8 to 0.8). Never play the same drop twice in a row. This is also why the rain never feels like a loop.
  Fall back to the Ylmir `rain_loop` clips (play clip A, and 2 s before it ends crossfade to clip B) only if the layers above sound wrong.
- **Wind:** modulate `wind_calm` and `wind_strong` gain slowly with a low-frequency random value (±15 %, period 6–12 s), so the wind seems to gust. This matches the visual gusts of the grass.
- **Thunder:** use the same timer as the lightning effect in SPEC.md section 9.2. On every flash, pick a random thunder file and start it after a delay: delay in seconds = fake distance in km × 3 (so 0.3 to 4 s). Closer strikes (short delay) play louder and with more high frequencies. Far strikes play quieter through a low-pass filter (about 800 Hz). Never repeat the same file twice in a row.
- **Night:** the Night weather preset sets `nightFactor` to 1; all other current presets set it to 0. The full recipe for a peaceful night is in section 6b.
- Rain and Night are separate presets in the current app. If they are combined later, rain should lower the night crickets and grass-movement sounds because the rain covers them.

## 6b. A peaceful night (đêm yên bình)

Goal: a soft, small-scale night, with crickets that sit under everything else and nothing sudden. Let `nf = nightFactor` and `r` = rain level (section 6).

**Layers** (all fade in over about 8 s when night begins, and out again at dawn):

| Layer | Gain | Notes |
|---|---|---|
| `night_meadow` (field crickets, rare frogs, a little wind) | `0.35 × nf × (1 − r)` | The base. Crossfaded loop, trimmed to 90 s. |
| `night_crickets_a` (small crickets, clean) | `0.30 × nf × (1 − r)` | Crossfaded loop. |
| `night_crickets_b` (midnight crickets) | `0.20 × nf × (1 − r)` | Start at a different offset and `playbackRate` 0.97–1.03 from layer a, so the two form a soft chorus that never lines up. |
| `night_crickets_c` (optional) | `0.12 × nf × (1 − r)` | Adds variety. Skip if it sounds too busy or too foreign. |
| `wind_calm` | normal formula × 0.6 at night | Keep the wind low and steady. |
| `owl_*` | one hoot every 40–90 s, gain 0.15–0.3 | Only when `r < 0.2`. Random pan (−0.7…0.7), low-pass about 3 kHz so it sounds far away, never the same file twice in a row. |
| `night_nightingale` | one 20–40 s excerpt every 3–6 min, gain 0.10–0.14 | Only when `r < 0.2`. Start at a random offset and fade in and out over 3 s. |

**Making the crickets "small" and gentle:**
- Put a gentle low-pass filter (about 6–7 kHz) on the cricket bus, and a mild high-pass (about 400 Hz). That removes both the harsh sizzle and the low rumble.
- Keep the total cricket level below the wind. If you can clearly hear crickets while the horse gallops, they are too loud.
- Give each cricket layer a slow, random volume drift (±15 %, period 15–30 s) so the sound breathes and never sounds like a looped file.

**Calm touches that make it feel alive:**
- **Hush near the horse:** crickets go quiet around a large animal. While the speed is above about 5 m/s (gallop), lower the cricket layers to 60 % with a 1 s attack, and bring them back over 6 s when the horse slows. Standing, eating or sitting keeps them at full level.
- **No sudden sounds at night.** No thunder (night is only used with clear, cloudy and fog weather), no bird or owl screech, and no sound louder than the horse's own footsteps.
- **Dusk to night:** during the change from sunset to night, fade `dusk_birds` out (it is the last birds before nightfall) while the cricket layers fade in, so the evening closes naturally. In plain sunset (night off) you can play `dusk_birds` quietly, at gain 0.2.
- **Fog at night:** lower all night layers by 20 % for a more muffled, close feeling.
- If the player sits down (C key), fade the hoof layers out as usual and raise the cricket layers by 10 % for a restful moment.

**Quality checks (listen):** the Defelozedd94 file was cleaned with noise removal, so it may sound a little processed. If so, use sengjinn's recording as the main layer, or the same author's unprocessed "Raw sound" version. All three Freesound files need a free Freesound account to download.

## 7. Acceptance checks
- No sound plays before the first key press or click, and there is no console warning about the audio context.
- Going from standing to full run, the hoof sound changes smoothly from walk to trot to gallop, with no click and no gap.
- Jumping silences the hooves, and landing gives a thud.
- Eating is clearly audible and the hooves are silent during it.
- Switching weather fades sounds in and out over about 3 s. Storm has thunder at irregular times, never the same file twice in a row.
- In light rain you can pick out single drops by ear, and in heavy rain they merge into a steady roar. There is no audible loop point.
- At night the crickets are soft and small, below the wind in level, and quieter while the horse gallops. Nothing sudden happens at night, and every night layer fades in and out smoothly (about 8 s).
- Sound off in the Options panel silences everything immediately, and turning it on again resumes the correct mix.
- Total audio download is below about 20 MB. `CREDITS.md` lists each file's source URL and licence.

## 8. Optional upgrades
- Slice the three hoof recordings into single hoof beats in Audacity and trigger them from animation foot contacts for exact sync.
- Add a faint "grass rustle" layer that rises with speed.
- Positional audio (`PannerNode`) for thunder and owls.

## 9. Thuật ngữ (glossary)

| Thuật ngữ (Vietnamese) | English definition |
|---|---|
| Vòng lặp (loop) | A sound that restarts from the beginning when it ends |
| Hòa trộn chéo (crossfade) | Fading one sound out while another fades in |
| Âm lượng (gain) | The volume multiplier of a sound |
| Tốc độ phát (playback rate) | How fast a sound plays; faster also raises the pitch |
| Bộ lọc thông thấp (low-pass filter) | A filter that removes high frequencies, so a sound seems distant or muffled |
| Kênh trộn (bus) | A group of sounds that share one volume control |
| Chuẩn hóa âm lượng (loudness normalisation) | Making different recordings play at a similar loudness |
