# Raptor: Call of the Void - web remake

Remake of the 1994 MS-DOS game **Raptor: Call of the Shadows** (episode 1, shareware) with a
space theme and new, modern (non-retro) procedural art.

Tech stack: Phaser 4, Vite 8, TypeScript, pnpm, vitest, biome, knip, vite-plugin-pwa.
Template/sister project: `../last-eichhof` (same structure and tooling).

## Instructions

- Stay close to the DOS game: enemy movement, spawn timing, weapons, economy and difficulty are a
  1:1 port of `dosraptor/SOURCE`. Only graphics, theme, menus and controls are new.
- Never ship original bitmaps. Art is generated in code (`src/game/art/`); the original pictures
  are only a reference (`node original_game/scripts/extract-glb.mjs --data --ref` dumps them to `tmp/ref/`).
- Landscape 16:10 (the DOS 320x200 screen x3 = 960x600), optimized for mobile touch.
- Use context7 for current Phaser 4 APIs. Use American English.
- Put debugging scripts in `./tmp/` (gitignored), not `/tmp/`.
- Update this file after research or when a gotcha cost time, so future work is faster.

## Commands

- `pnpm dev` (<http://localhost:5173/raptor/>), `pnpm build`, `pnpm preview`, `pnpm test`
- After each task: `scripts/chk_js_format.sh`; after each feature: `scripts/run_checks.sh`
  (biome, tsc, knip, vitest, audit, prek). Spelling: `scripts/run_spelling.sh`
  (add intentional DOS identifiers to `cspell-words.txt`).
- Deploy: `scripts/deploy.sh` (checks, build, rsync to `html/raptor/`; vite `base` is `/raptor/`).

## Layout

- `src/game/sim/`: the DOS game logic, pure TS, no Phaser. One module per DOS file (see
  [original_game/docs/dos_src.md](original_game/docs/dos_src.md)). `World.step(input)` = one DOS frame.
- `src/game/scenes/`: `Boot` (audio + procedural textures), `Menu`, `Hangar` (hangar + text shop),
  `Game` (fixed-step sim at `FRAME_MS`, rendering with interpolation).
- `src/game/render/`: `terrainView.ts` (scrolling terrain chunks, destructible modules),
  `effects.ts` (particles for the original ANIMS).
- `src/game/art/`: procedural Canvas2D art: `ships.ts` (unit archetypes per original picture name,
  `SPECS`), `fx.ts` (shots, pickups, structures), `terrain.ts` (terrain chunks), `textures.ts`
  (texture keys, built once in `Boot`).
- `src/game/input/gameInput.ts`: keyboard, touch (relative
  drag anywhere incl. letterbox, on-screen NOVA/SWAP/pause buttons). Auto-fire
  (`Settings.autoFire`, default on) fires continuously; toggles: Options menu, pause menu, F key.
  When off, fire = Space/Ctrl or a finger on the screen. Note: like DOS `OBJS_Think`,
  the shield only recharges while not firing, so auto-fire means no recharge.
  `SPECIAL_KEYS` = the DOS number keys for special weapons (also used by the mission briefing).
- Hidden god mode: key G in `Game` (`toggleGod`): `World.god` (DOS `godmode`: no damage, no
  death) and +10000000 CR per activation; stays on for later missions (`session.godMode`, not
  saved). Keep it out of the briefing; it is documented in README.
- Mission start (`Game.controlsPanel`): sector/wave banner + a controls briefing (touch or
  keyboard variant) listing the special weapons on board with their keys; fades after 6 s,
  closed by pause.
- HUD weapon strip (`Game.updateWeaponBar`): special weapons on board with their keys at the bottom,
  tappable on touch (`w<type>` touch buttons -> `GameInput.selectWeapon`); a switch flashes the
  weapon name under the score.
- `src/game/data/stats.ts`: global mission counter shared with the other entorb.net pages
  (`web-stats-json.php?origin=raptor`). `reportMissionStart()` on every mission launch (`Hangar.launch`, not demos);
  `readGlobalMissions()` feeds "Total Missions Globally" at the bottom of the start screen.
- `src/game/audio/audio.ts`: FX table (sample, DMX pitch, volume), 3D pan/volume, music (songs
  load lazily).
- `src/game/campaign.ts`: WIN_MainLoop between-wave logic (pure). `session.ts`: current pilot.
  `data/save.ts`: localStorage (validate on load, it is untrusted): pilot list `raptor.pilots.v1`,
  unique names (case-insensitive), most recently saved first; autosaved by Hangar and `Game.end`.
  Web changes to WIN_MainLoop: the difficulty is fixed per pilot (Rookie/Veteran/Elite, no
  raise after the episode; a finished sector stays replayable); Training (DIFF_TRAIN, 4 waves) is a
  second sector of every pilot (`PilotSave.train`, Hangar "Sector" toggle, `p.sector`).
  `PilotSave.done` = Bravo waves ever finished. Hangar "Replay Mission": `afterWave(p, result,
  sector, wave, earned)` with `wave != nextWave` keeps credits/loadout. `PilotSave.stats[b<w>|t<w>]`
  = completions + top-10 earnings; a replay ends on the Hangar `result` top-10 table. A completed wave refills the shield to at least 50% (`Game.end`).
- Hangar background: `art/hangar.ts` (`hangar-bg`, open bay door = transparent `BAY`); the
  dogfight sprites live in a container created before the frame so they stay behind it.
- Start menu (`Menu`): Play -> pilot list (last played first) + New Pilot; name entry = Phaser DOM `<input>` (`dom.createContainer` in
  `main.ts`; scene keyboard is disabled while it has focus), Install/Share/Contact row (`pwa.ts`).
  The attract demos are not in the menu anymore; `scene.start("Game", { demo: n })` still works.
- `src/game/data/ep1.ts`: GENERATED, never hand-edit. `data/types.ts`: its types.
- `original_game/scripts/extract-glb.mjs`: GLB -> `ep1.ts`, plus the original sfx/music as a comparison archive
  in `original_game/audio/` (gitignored, never ship it). Needs `original_game/shareware/FILE000[01].GLB`
  (`original_game/scripts/get_shareware.sh`). Formats: [original_game/docs/glb_format.md](original_game/docs/glb_format.md).
  `original_game/scripts/vendor/opl3/` = vendored MIT OPL3 emulator + MUS driver (excluded from biome/cspell).
- `scripts/gen-audio.mjs` (+ `lib/synth.mjs`): the shipped audio, synthesized from code for license
  reasons: sfx designs and a seeded song composer (`SONGS` specs), same file keys as the originals.
  `node scripts/gen-audio.mjs sfx|music [name]`. Needs a native ffmpeg (`FFMPEG_BIN` overrides
  ffmpeg-static). Songs are ~60 s seamless loops (reverb tails wrap), vorbis q2 to stay < 1 MB.
- `src/review/`: dev-only pages (not in the prod build): `art.html` (all procedural sprites next to
  `tmp/ref` originals, enemies per mission) and `sounds.html` (new vs archived audio).
- `original_game/dosraptor/`: original DOS source (reference, gitignored).

## Shop rules (STORE.C / OBJECTS.C, verified)

- Buy list = `OBJS_CanBuy` items (all weapons: the registered-version rule, `Inventory.reg`),
  sorted by price; sell list = `OBJS_CanSell`, resale = half price.
- Every weapon purchase adds a new object; only the first is equipped, the rest are spares that
  get equipped when the active one is lost (low shield hits, `OBJS_LoseObj`) or sold. Twin Blasters
  can only be bought while none is equipped. Max 20 objects on board.
- Stackables (`onlyflag`): shield energy (25% per unit, max 100%, can't sell below 25%), nova
  bombs (max 5), damage scanner (max 1). Phase shields are separate objects, max 5.
- Unaffordable items stay selectable (dimmed) and answer "Not enough credits", like DOS.

## Porting rules (sim)

- Keep DOS names in comments (`ENEMY_Think`, `SHOTS_PlayerShoot`, ...) and keep the statement
  order: RNG calls must happen in the same order (`sim/rng.ts` = Watcom `rand`).
- Coordinates are DOS pixels; never mix in render (x3) coordinates. `SCALE` lives in
  `data/playfield.ts`.
- Lists keep DOS insertion order; remove while iterating with `splice(i--, 1)`.
- Any sim sound call goes through `World.sfx`/`sfx3d` (they consume RNG like `SND_Patch`).
- New sim logic gets a vitest case. `sim/demo.test.ts` replays the three original attract demos
  through the whole sim (a regression smoke test; divergence from DOS cannot be measured without
  a DOSBox reference).

## Browser debugging

`playwright-core` is a dev dependency; Chromium lives in `PLAYWRIGHT_BROWSERS_PATH`
(`pnpm exec playwright-core install chromium` if missing). Start `pnpm dev`, then drive
`window.__game` (dev only) from a `./tmp/*.mjs` script:

```js
import { chromium } from "playwright-core"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
page.on("pageerror", (e) => console.error(e))
await page.goto("http://localhost:5173/raptor/", { waitUntil: "load" })
await page.waitForTimeout(2000)
await page.evaluate(() => window.__game.scene.getScenes(true)[0].scene.start("Game", { demo: 0 }))
const w = await page.evaluate(() => { const s = window.__game.scene.getScene("Game").world; return { frame: s.frame, shield: s.shield } })
await page.screenshot({ path: "tmp/shot.png" })
await browser.close()
```

- Wrap `page.evaluate` calls that return Phaser objects in `void(...)`; they serialize huge graphs.
- Always mock the stats API in browser tests, or every scripted game start increments the live
  counter: `await ctx.route("**/web-stats-json.php**", (r) => r.fulfill({ json: { accesscounts: 1 } }))`.
- `scene.start("Game")` needs a pilot (`session.ts`); without one it returns to the menu. Start via
  the menu (New Pilot -> difficulty -> Launch) or use `{ demo: n }`.
- Useful sim pokes: `world.startendwave = 45` (finish wave), `world.inv.p_objs[16].num = 0`
  (die), `world.god = true`, `scene.end("abort")`.
- Mobile: `browser.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true })`, drags via CDP `Input.dispatchTouchEvent`.

## Gotchas

- Original shot pictures are mostly padding (Twin Blaster = 2x2 dot in 8x8): `fx.ts SHOT_BOX`
  holds the visible box per picture; draw shot art inside it, not across the whole texture.
- Enums: use `as const` objects (`Obj`, `Anim`, `Buy`), not `const enum` (isolatedModules).
- Generated `ep1.ts` is biome-formatted; read it via TS import (`node tmp/x.mts`), not JSON regex.
- Terrain chunks are expensive (~25 ms desktop): `TerrainView` builds the next chunks with
  `ChunkJob.step(3)` time slices; only the first screen is built synchronously.
- Canvas textures: `textures.addCanvas` + `texture.add(frameName, 0, x, y, w, h)` for frames;
  single images use frame `"__BASE"`.
- `Math.random` is not used (Sonar S2245); visuals use seeded noise (`art/draw.ts seeded`).
- Vite 8 / rolldown needs `manualChunks` as a function. `base` must match the deploy dir.
- `#app` must not use `100dvh` + flex (stale height on Chrome Android); keep `100svh` and
  Phaser `CENTER_BOTH`. Landscape is enforced by the CSS `#rotate` overlay.
- Fullscreen needs a user gesture; the menu entry is hidden where the API is unavailable (iPhone).
- Web Audio starts suspended until the first gesture; songs are loaded on demand by
  `Audio.playSong(scene, key)`.
- The music OGGs are up to ~1 MB; the prek large-file limit is 1024 KB.
