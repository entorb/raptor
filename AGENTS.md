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
- Git commits: subject line only, never a Claude `Co-Authored-By` trailer.

## Commands

- `pnpm dev` (<http://localhost:5173/raptor/>), `pnpm build`, `pnpm preview`, `pnpm test`
- After each task: `scripts/chk_js_format.sh`; after each feature: `scripts/run_checks.sh`
  (biome, tsc, knip, vitest, audit, prek). Spelling: `scripts/run_spelling.sh`
  (add intentional DOS identifiers to `cspell-words.txt`).
- Deploy: `scripts/deploy.sh` (checks, build, rsync to `html/raptor/`; vite `base` is `/raptor/`).
- SonarCloud: `scripts/get_sonar_issues.sh` refreshes `tmp/sonar.json`. Recurring findings to avoid
  up front: nested template literals (extract inner template to `const`), nested ternaries (extract
  the inner one into its own `const`), comma operator in arrow functions (use block-bodied arrow
  with proper `await` lines instead), `void` on a non-Promise expression (use a block-bodied arrow
  instead), cognitive complexity > 15 (split branches into `private` helper methods, as in
  `terrain.ts` `simPanel`/`simStripe`/`simGrid`; an `if/else` drawing two variants = two helper
  functions, as in `icons.ts` `autoGlyph`/`cycleGlyph`), plain `for (let i...)` over a simple
  iteration (`for-of` instead), > 7 function params (group optional ones into an options object,
  as in `glowText(..., { glow, color })`), consecutive `push()` calls (one `push(a, b)`),
  `await` inside a loop in scripts (sequential steps: `inOrder` promise chain in
  `gen_screen_exports.mjs`, else `Promise.all`), and `TODO` comments (none committed; dated
  "delete after" migrations get removed once the date passes). Repetitive key->string tables
  (`data/ep1.ts`, `i18n/strings.ts`) are excluded from duplication (`sonar.cpd.exclusions` in
  `.sonarcloud.properties`): every new entry matches dozens of others; don't reshape them.

## Layout

- `src/game/sim/`: the DOS game logic, pure TS, no Phaser. One module per DOS file (see
  [original_game/docs/dos_src.md](original_game/docs/dos_src.md)). `World.step(input)` = one DOS frame.
- `src/game/scenes/`: `Boot` (audio + procedural textures), `Menu`, `Hangar` (Launch / Shop / Exit),
  `Shop` (own scene: BUY/SELL tabs, icon list, detail card with the buy/sell button, `← HANGAR`),
  `Game` (fixed-step sim at `FRAME_MS`, rendering with interpolation).
- `src/game/render/`: `terrainView.ts` (scrolling terrain chunks, destructible modules),
  `effects.ts` (particles for the original ANIMS).
- Shadows (`Game.trackShadow`, SHADOWS.C rules): enemies with `lib.shadow` and the player
  (while `draw_player`). Ground: 3 px left, 4 px down (`D.groundShadow`, under ground enemies).
  Sky + player: 10 px left, 20 px down, then projected 200/280 toward (160, 100), also scaled
  200/280 (`D.skyShadow`, above ground enemies). Look = violet rim + dark core (`SHADOW_LAYERS`).
- `src/game/art/`: procedural Canvas2D art: `ships.ts` (one distinct design per original picture name,
  `SPECS`: own silhouette per enemy, hull tint by threat (pale fodder, steel fighters, copper light
  gunships, crimson armored, hazard yellow kamikaze, gunmetal specialists, violet elite); turrets via
  `turretOf(sides, guns, len, aim?)`; keep new enemies distinguishable from all others in their waves; `drawPlayer` = 7 bank frames drawn as a roll: lowered wing short/dark, raised wing wide/lit), `fx.ts` (shots, structures), `icons.ts` (item icons `icon-<t>` + hex pickups
  `pickup-<t>`, used by shop, HUD strip, drops, mobile nova button), `shop.ts` (`shop-bg`), `briefing.ts` (`brief-<sector>`: mission briefing room per sector, crossfaded by `Hangar.show`; over it the per-wave `brief-<sector>-<wave>` overlay, `textures.ts briefingTexture`, built on first use: the wave's toughest boss on the scan table + 4 signature enemies on the intel cards, `briefingUnits`: types new to the wave first, then the most frequent; no bonus carriers/critters), `terrain.ts` (terrain chunks), `textures.ts`
  (texture keys, built once in `Boot`).
- `src/game/i18n/`: EN (default) + DE. `strings.ts` = `STRINGS` (`en`/`de` per key, `{name}` placeholders),
  `i18n.ts` = `t(key, params)`, `setLang` (localStorage `raptor.lang`, also sets `<html lang>` + the `#rotate`
  overlay). Toggle = main menu item (restarts the scene). All UI text goes through `t()`: never
  cache a translated string in a module constant. Headers (RAPTOR, CALL OF THE VOID, HANGAR, SUPPLY SHOP,
  MISSION BRIEFING) and item names (`OBJ_LIB`) stay English. `Game.ts` imports it as `tr` (local `t` vars).
  German words in `strings.ts` go into `cspell-words.txt`.
- `src/game/input/gamepad.ts` (web addition): polls the standard-mapping gamepad and dispatches
  synthetic keyboard events on `window` (keyCode patched in, Phaser reads it): D-pad/stick = arrows,
  A = Enter, B = Esc, X = Space, Start = P, LB = Alt, RB = Shift. No scene has gamepad code.
- `ui/textMenu.ts` shared UI (reuse, don't re-inline): `bindKeys` (arrows/WASD/Enter/Space with a guard), `glowText` (glow title, padding 1.5x blur), `statusText`, `changeVolume`, `backButton(...).focus`,
  `rollCredits` (status line credits roll up: Hangar arrival via `HangarData.earned`, shop trades),
  `stepVolume`; `TextMenu` plays `Audio.ui("move"|"confirm"|"back")` menu sounds.
- Shared helpers: reuse them, never re-implement inline:
  - `ui/textMenu.ts`: `bindKeys(scene, guard, {up,down,left,right,confirm})` (arrows + WASD,
    Enter/Space; registration order matters for keys bound twice), `glowText` (bold glow title,
    padding = 1.5x blur), `header(scene, title, sub?, y?, size?)`, `statusText` (bottom status line),
    `changeVolume(kind, d)` (step + save + apply), `backButton(...).focus(on)` (keyboard focus).
  - `campaign.ts`: `statusLine(inv, cr)`, `levelStats`, `topHeader`, `topRunLine`, `isReplay`,
    `refillShield`. `session.ts`: `saveLoadout(lo)`.
  - `Game.ts` private: `specials()` (equipped special weapons), `pillButton` (Start/Continue).
  - `art/draw.ts`: `seeded`, `glow`, `metal`, `canopy`, `roundRect`, `polyPath`, `makeCanvas`,
    `sphere` (lit ball), `softDot` (fading radial dot, fills only its own box).
  - `sim/consts.ts`: `XPOS`/`YPOS` circle tables; `sim/tile.ts hitSpot`; `PlayerShip.syncCenter`.
  - Art refactors must stay pixel-identical: compare all `review/art.html` canvases (`toDataURL`)
    and the screen exports against a `git worktree` of HEAD on a second dev port (don't stash).
- Shop: maxed items (`Inventory.full`) are dimmed with `MAX`; the card shows the max per item,
  the status line the cargo (`MAX_OBJS`).
- Pause menu: volume rows (LEFT/RIGHT adjust on them), else LEFT/RIGHT step the special weapon.
- `src/game/input/gameInput.ts`: keyboard, touch (relative
  drag anywhere incl. letterbox, on-screen NOVA/SWAP/pause buttons). Auto-fire
  (`Settings.autoFire`, default on) fires continuously; toggles: touch AUTO button, Space key (in flight, not while paused/waiting).
  When off, fire = a finger on the screen (no single-shot key on desktop). Note: like DOS `OBJS_Think`,
  the shield only recharges while not firing, so auto-fire means no recharge. Web change: +1
  per `CHARGE_SHIELD` = 48 idle frames (DOS 96), firing pauses the counter (DOS reset it).
  `SPECIAL_KEYS` = number keys for special weapons in shop order (by price, not DOS order; also
  used by the mission briefing and the HUD weapon strip).
- 2P co-op (web addition, desktop keyboard only): fixed per pilot at creation (`PilotSave.coop`,
  `name` = team name; new pilot flow `Menu`: players -> difficulty -> name, the players step is
  skipped on `TOUCH`; coop saves are listed "2P" and not flyable on touch). Shared inventory,
  credits and shield (both ships explode at 0); each player has an own special weapon
  (`PlayerState.sweapon` / `sweapon2`, `Inventory` methods take a `SpecialSlot`; a weapon that
  runs out / is lost / sold moves every slot holding it). Sim: `World.ships: PlayerShip[]`
  (1 or 2, ctor `players`), `World.cur` = ship being processed (fires, gets hit via `hitShip`),
  own fire cooldown (`PlayerShip.shotLib`), `Shot.owner` / `AnimObj.ship` for followers; enemy
  aim and kamikaze chase target `nearestShip`; hits/pickups test every ship; no ship-vs-ship
  collision; fly-off in own lanes (`flyLanes`, left ship left of center); enemies get 50% more hits (`enemy.ts coopHits`). With one ship every loop is a single
  iteration: 1P RNG order stays DOS-exact (`demo.test.ts`). Keys (`GameInput.readTwo`): P1 arrows,
  Shift/Alt, Enter, 1..0,-; P2 WASD, E/Q, Tab; Space = auto-fire for both; gamepad = P1.
  P2 art: `player2` texture (`ships.ts PLAYER2_PAL`, amber; `Game.ts P2_TINT`).
- Hidden god mode: key G in `Game` (`toggleGod`, dev builds only, `import.meta.env.DEV`): `World.god` (DOS `godmode`: no damage, no
  death) and +10000000 CR per activation; stays on for later missions (`session.ts`
  `godMode()`/`setGodMode()`, not saved). Keep it out of the briefing; it is documented in README.
- Mission start (`Game.controlsPanel`): sector/wave banner + a controls briefing (touch or
  keyboard variant) listing the special weapons on board with their keys, plus a START button.
  The sim holds (`Game.waiting`, no pause) until START is tapped or Enter/Space is released
  (keyup, armed by a keydown in this scene: no nova from the held key, no start from the Hangar's Enter).
- HUD weapon strip (`Game.updateWeaponBar`): special weapons on board with their keys at the bottom,
  tappable on touch (`w<type>` touch buttons -> `GameInput.selectWeapon`); a switch flashes the
  weapon name at the top center.
- Sentry: `@sentry/browser` (not `@sentry/node`, this is a browser app), `Sentry.init` in `src/main.ts`,
  deployed prod build only (skipped in dev and on localhost, like `stats.ts`).
- `src/game/data/stats.ts`: global mission counter shared with the other entorb.net pages
  (`web-stats-json.php?origin=raptor`). `reportMissionStart()` on every mission launch (`Hangar.launch`, not demos, skipped in dev and on localhost);
  a failed write is counted offline in `raptor.statsPending` (localStorage) and sent after the next successful write, like `../flashcards`; `readGlobalMissions()` feeds "Global Missions" at the bottom of the start screen.
- `src/game/audio/audio.ts`: FX table (sample, DMX pitch, volume), 3D pan/volume, music (songs
  load lazily). `WAVE_SONGS[sector][wave]`: every sector has its own music theme and every wave its
  own song (`gen_audio.mjs SONGS`: `bravo*` = Bravo, saw/analog combat; `train*` = Training, own synth palette
  via `voices: SIM_VOICES` (sync lead, bitcrushed arp, acid bass and grid pad layered over the Bravo pad/bass/drums for weight; the sim voices alone sounded thin) + `sim*` drums; driving electro/techno, tempo rises per wave, 132 -> 150 BPM). When adding more
  sectors: add new music too (a new song per wave; a new sector theme = own `voices` remap / drums, not just new keys).
- `src/game/campaign.ts`: WIN_MainLoop between-wave logic (pure). `session.ts`: current pilot.
  `data/save.ts`: localStorage (validate on load, it is untrusted): pilot list `raptor.pilots.v1`,
  unique names (case-insensitive), most recently saved first; autosaved by Hangar and `Game.end`.
  Web changes to WIN_MainLoop: the difficulty is fixed per pilot (Rookie/Veteran/Elite, no
  raise after the episode; a finished sector stays replayable); Training (DIFF_TRAIN, 5 waves) is a
  second sector of every pilot (`PilotSave.train`, `p.sector` = last selected sector; finishing
  training switches it to Bravo).
  Training wave 1 is a web-only beginner wave (`data/training.ts BEGINNER_MAP`: map 0 terrain,
  hand-picked spawns, shield carriers only, early boss with `easyBoss`); waves 2-5 fly DOS maps
  0-3. `campaign.ts waveMap(sector, wave)` maps a sector wave to its DOS map index + map.
  `PilotSave.done` = Bravo waves ever finished. Hangar = Mission Briefing / Shop (Buy/Sell toggle row) /
  Exit. Launch screen (`Hangar.buildLaunch`, own keyboard grid: sector boxes, wave boxes, Launch):
  preselects `p.sector` + `defaultWave` (next unfinished), any `playable` wave, the level's top 10
  below. A wave != `nextWave` is a replay: `afterWave(p, result, sector, wave, earned)` keeps
  credits/loadout. `PilotSave.stats[b<w>|t<w>]` = completions + top-10 runs (`TopRun`: credits + enemy kill %, old saves stored plain numbers). A completed
  wave (replay or not) shows a results panel (`Game.showResults`): credits, a mission report
  (`Game.reportRows`: enemies/buildings destroyed, damage taken, shots fired; 2P: one column per
  player with a header in the engine glow color + credits earned each, scaled to the payout) from
  `PlayerShip.stats` (kills/buildings credited to the last hitter: `Ship.hitBy`, `Tiles.hitBy`,
  `World.hitter` = `shooter` during SHOTS_Think, else `cur`; boss money is split evenly) and the
  level's top 10 with this run in gold; a death shows the same panel (red title, half payout); Continue (tap, Enter/Space keyup) goes to the Hangar main screen. A completed wave refills the shield to at least 50% (`Game.end`); 100% enemy kills pay a +10% credit bonus (`Game.end`, shown on the results panel). Death and abort reload the
  last save (`reloadPilot`): weapons lost in flight come back. The HUD shows credits earned this run.
  The Hangar back icon is only shown on the shop and launch screens (hangar has an Exit row).
- Training sector look (`Game.create` `sim`): a holographic simulator instead of a real fight.
  `buildTrainingTextures` (lazy, first training mission): `ut-<PIC>` hologram target drones (`ships.ts TRAIN_LOOK`: own shape + color per picture, the
  bullseye takes the unit color; armed ground units = polygon/round `emplacement`s with guns, never
  the square passive `tstruct-` pads), `tstruct-/twreck-` target pads, `sim-*`
  grid backdrop; `ChunkJob(..., train)` renders the map as a gridded deck; `Effects(..., sim)` uses
  cyan "derez" explosions; banners say SIMULATION. Sim/gameplay is identical to Bravo.
- Hangar background: `art/hangar.ts` (`hangar-bg`, open bay door = transparent `BAY`); the
  dogfight sprites live in a container created before the frame so they stay behind it.
- Start menu (`Menu`): Play -> pilot list (last played first) + New Pilot; name entry = Phaser DOM
  `<input>` (`dom.createContainer` in `main.ts`; scene keyboard is disabled while it has focus).
  Action row below the menu (`Menu.actionRow`): Install/Share/Contact/Home/Source (install prompt
  via `pwa.ts`; `Home` = `https://entorb.net/games/`, `Source` = `https://github.com/entorb/raptor`).
  Every start screen must expose contact, source, home, share and install. The row is a second
  focusable strip, like `../last-eichhof`: DOWN off the last menu item enters it
  (`TextMenu.onDownFromEnd`, main mode only; other modes wrap), UP/DOWN/LEFT/RIGHT step through the
  links, DOWN past the last wraps to the first menu item; `Menu.setActionFocus` hands arrow/confirm keys over by clearing
  `TextMenu.enabled` (UP returns them); the focused link gets a gold pill (`actionPills`), pointer
  hover is white. Clicking a link does *not* steal keyboard focus (it would strand touch users on
  a row they can't see).
  The attract demos are not in the menu anymore; `scene.start("Game", { demo: n })` still works.
- `src/game/data/ep1.ts`: GENERATED, never hand-edit. `data/types.ts`: its types.
- `original_game/scripts/extract-glb.mjs`: GLB -> `ep1.ts`, plus the original sfx/music as a comparison archive
  in `original_game/audio/` (gitignored, never ship it). Needs `original_game/shareware/FILE000[01].GLB`,
  downloaded manually per `original_game/README.md` (archive.org, not committed). Formats:
  [original_game/docs/glb_format.md](original_game/docs/glb_format.md).
  `original_game/scripts/vendor/opl3/` = vendored MIT OPL3 emulator + MUS driver (excluded from biome/cspell).
- `scripts/gen_audio.mjs` (+ `lib/synth.mjs`): the shipped audio, synthesized from code for license
  reasons: sfx designs and a seeded song composer (`SONGS` specs), same file keys as the originals.
  `node scripts/gen_audio.mjs sfx|music [name]`. Needs a native ffmpeg (`FFMPEG_BIN` overrides
  ffmpeg-static). Songs are ~60 s seamless loops (reverb tails wrap), vorbis q2 to stay < 1 MB.
- `src/review/`: dev-only pages (not in the prod build): `art.html` (all procedural sprites next to
  `tmp/ref` originals, enemies per sector wave via `campaign.ts waveMap`: Bravo missions 1-9, Training waves 1-5) and `sounds.html` (new vs archived audio); both share
  the sector/wave filter `filter.ts` (empty = unfiltered).
- `original_game/dosraptor/`: original DOS source (reference, gitignored).

## Shop rules (STORE.C / OBJECTS.C, verified)

- Shop keyboard focus: list -> UP off the first row -> BUY/SELL tabs (LEFT/RIGHT switch) -> UP -> `← HANGAR`
  (`Shop.focus`; scene keys are bound after the menu, `skipKey` swallows the menu's own UP).
- Buy list = `OBJS_CanBuy` items (all weapons: the registered-version rule, `Inventory.reg`),
  sorted by price; sell list = `OBJS_CanSell`, resale = half price.
- Every weapon purchase adds a new object; only the first is equipped, the rest are spares that
  get equipped when the active one is lost (low shield hits, `OBJS_LoseObj`) or sold. Twin Blasters
  can only be bought while none is equipped. Max 20 objects on board.
- Web change: Twin Blasters can't be sold (`canSell`) and are never lost on shield hits.
- Stackables (`onlyflag`): shield energy (25% per unit, max 100%, can't sell below 25%), nova
  bombs (max 5), damage scanner (max 1). Phase shields are separate objects, max 5.
- Unaffordable items stay selectable (dimmed) and answer "Not enough credits", like DOS.
- Web change (touch): shop rows are two-tap (`TextMenu.tapToSelect`): the first tap selects and
  shows the detail card, a tap on the selected row or the card button buys/sells; a swipe never
  activates a row. LEFT/RIGHT switch the BUY/SELL tab.

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
- Mock the stats API in browser tests (dev/localhost skips the write, but the read still hits
  the live server): `await ctx.route("**/web-stats-json.php**", (r) => r.fulfill({ json: { accesscounts: 1 } }))`.
- `scene.start("Game")` needs a pilot (`session.ts`); without one it returns to the menu. Start via
  the menu (New Pilot -> difficulty -> Launch) or use `{ demo: n }`.
- Useful sim pokes: `world.startendwave = 45` (finish wave), `world.inv.p_objs[16].num = 0`
  (die), `world.god = true`, `scene.end("abort")`.
- Mobile: `browser.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true })`, drags via CDP `Input.dispatchTouchEvent`.

## Screen exports (UI review)

`node scripts/gen_screen_exports.mjs [--screen=shop-buy] [--device=mobile]` (needs `pnpm dev`) writes
`tmp/screens/<device>-<NN>-<name>.png` + `.txt`: every visible text (design box, CSS font px, `TINY` < 12 px)
and every pointer target (CSS size, `SMALL` < 44 px). Mobile = 800x360 touch, where the 960x600 game
renders at 0.6x. Dev modules are served from `/raptor/game/...` (vite `root: "src"`). Headless needs
the swiftshader launch args, or `page.screenshot` hangs.

## Gotchas

- A text glow (`setShadow(..., blur, true, true)`) needs `setPadding` >= 1.5x blur, or the blur is
  cut at the text texture edge and shows as a faint grey box. Padding moves origin-0/1 texts: shift x/y back.
- Phones render the 960x600 game at ~0.6x: `ui/textMenu.ts TOUCH` (`pointer: coarse`) enlarges menu
  rows, the link row and launch boxes. Check with the screen exports (`SMALL`/`TINY`).
- Original shot pictures are mostly padding (Twin Blaster = 2x2 dot in 8x8): `fx.ts SHOT_BOX`
  holds the visible box per picture; draw shot art inside it, not across the whole texture.
- `scene.start(key)` without data reuses the scene's last start data: one-shot data (Hangar
  `message`) must be consumed in `init`.
- Enums: use `as const` objects (`Obj`, `Anim`, `Buy`), not `const enum` (isolatedModules).
- Generated `ep1.ts` is biome-formatted; read it via TS import (`node tmp/x.mts`), not JSON regex.
- Terrain chunks are expensive (~25 ms desktop): `TerrainView` builds the next chunks with
  `ChunkJob.step(3)` time slices; only the first screen is built synchronously.
- Canvas textures: `textures.addCanvas` + `texture.add(frameName, 0, x, y, w, h)` for frames;
  single images use frame `"__BASE"`.
- `Math.random` is not used (Sonar S2245); visuals use seeded noise (`art/draw.ts seeded`).
- Old iOS (iPhone 7, iOS 15 Safari): no `ctx.roundRect` (use `art/draw.ts roundRect`, it has an `arcTo` fallback), no canvas `ctx.filter` (ignored, Hangar shadow unblurred), no Ogg Vorbis (< iOS 17: the loader skips all samples, so `Audio` disables itself via `device.audio.ogg`, or any play throws "key not found in cache"; deliberately OGG only, no second format).
- Vite 8 / rolldown needs `manualChunks` as a function. `base` must match the deploy dir.
- `#app` must not use `100dvh` + flex (stale height on Chrome Android); keep `100svh` and
  Phaser `CENTER_BOTH`. Landscape is enforced by the CSS `#rotate` overlay.
- Fullscreen needs a user gesture; the menu entry is hidden where the API is unavailable (iPhone).
- Web Audio starts suspended until the first gesture; songs are loaded on demand by
  `Audio.playSong(scene, key)`.
- Firefox: an `<audio>` element caches a partial (range) response; a later Phaser XHR for the same
  URL then gets status 206 and the loader rejects it (silent song, no console error). `review/sounds.ts`
  players therefore use `?review` URLs. Never play game assets via `<audio>` under their game URL.
- The music OGGs are up to ~1 MB; the prek large-file limit is 1024 KB.
- PWA precache (`vite/config.prod.mjs`) excludes `assets/music/**` and the 512 px icons (first
  visit ~1.4 MB gzipped); songs go to the CacheFirst `music` runtime cache when first played.
- PWA updates: `registerType: "prompt"` (no auto skipWaiting). Every `Menu.create` runs
  `pwa.ts checkForUpdate()` (`registration.update()`, waits for the install) and shows Update/Skip
  (mode `update`); Skip asks again on the next start-screen visit. Update = `SKIP_WAITING` message +
  reload on `controllerchange`. Plain SW API, not `virtual:pwa-register`: the dev config has no PWA
  plugin. Test from `pnpm build` + `pnpm preview` (first visit: no controller until a reload).
