# DOS source map (`dosraptor/`) and how the web port maps to it

`dosraptor/` is the GPL v1.2 source release (Watcom C + TASM). It is reference only and not
committed (gitignored). `SOURCE/` is the game, `GFX/` the engine library, `apodmx/` + `audiolib/`
the sound system.

| DOS file | Purpose | Web port |
| --- | --- | --- |
| `SOURCE/RAP.C` | `main`, `Do_Game` loop, `RAP_DisplayStats`, `InitMobj/MoveMobj/MoveSobj` | `src/game/sim/world.ts` (`World.step`, `displayStats`), `sim/move.ts` |
| `SOURCE/ENEMY.C` | spawns from the map, flight paths, firing, damage, explosions | `sim/enemy.ts` |
| `SOURCE/SHOTS.C` | player weapons | `sim/shots.ts` |
| `SOURCE/ESHOT.C` | enemy projectiles | `sim/eshot.ts` |
| `SOURCE/TILE.C` | map scroll, destructible tiles | `sim/tile.ts`, view: `render/terrainView.ts` |
| `SOURCE/OBJECTS.C` | inventory, shop rules, shield energy | `sim/objects.ts` |
| `SOURCE/BONUS.C` | pickups | `sim/bonus.ts` |
| `SOURCE/ANIMS.C` | explosion/smoke/spark animations | `sim/anims.ts` (logic), `render/effects.ts` (particles) |
| `SOURCE/INPUT.C` | keyboard/mouse/joystick movement, demo record/playback | `World.movePlayer`, `input/gameInput.ts`, `World.playDemo` |
| `SOURCE/WINDOWS.C` | menus, hangar, `WIN_MainLoop`, wave songs | `scenes/Menu.ts`, `scenes/Hangar.ts`, `campaign.ts`, `audio/audio.ts` |
| `SOURCE/STORE.C` | supply shop | `scenes/Hangar.ts` + `Inventory.buyList/sellList` |
| `SOURCE/FX.C` | sound table, 3D panning | `audio/audio.ts` (`FX`, `spatial`), `World.sfx/sfx3d` |
| `SOURCE/LOADSAVE.C` | pilot files, `RAP_LoadMap`, difficulty masks | `data/save.ts` (localStorage), `World` ctor, `diffMask` |
| `SOURCE/SHADOWS.C`, `FLAME.C` | shadows, engine flames | not ported (new art has its own glow) |
| `SOURCE/INTRO.C`, `MOVIE.C` | intro/landing/death movies | replaced by short text overlays |
| `SOURCE/HELP.C` | help windows | shop descriptions in `Hangar.ts` |
| `GFX/GLBAPI.C` | GLB archives | `original_game/scripts/lib/glb.mjs` |
| `GFX/GFXAPI.*` | VGA drawing, picture formats | `original_game/scripts/lib/pic.mjs` (reference dumps only) |

## Semantics to keep

- One `World.step` = one DOS frame (3 ticks of 70 Hz, `FRAME_MS` ~42.9 ms). All positions are
  integer DOS pixels (320x200); the view multiplies by `SCALE` (3) and interpolates.
- Frame order (`Do_Game`): move player, special-weapon keys, fire (`OBJS_Use` guns, plasma,
  micro missiles, then the special), cycle/mega buttons, `startendwave` countdown, `TILE_Think`,
  `ENEMY_Think`, `ESHOT_Think`, `BONUS_Think`, `SHOTS_Think`, `ANIMS_Think`, `OBJS_Think`, then
  the display-phase logic (tile scroll in `TILE_Display`, turret line removal in `SHOTS_Display`,
  mega bomb fade, `RAP_DisplayStats`).
- Randomness is Watcom `rand()` (`sim/rng.ts`) seeded with `1024 * wave`. Sound calls with
  `rpflag` consume `random(40)` for their pitch, so `World.sfx` does too. (The DOS game skipped
  sounds when too many were playing, so exact RNG replay depended on the sound card anyway.)
- List iteration order matters (DOS link lists append at the tail): the sim uses arrays in the
  same order and removes while iterating with `splice(i--, 1)`.
- Spawns: `ENEMY_Think` spawns while `cur_enemy->y == tiley`, including linked groups (`link` not
  -1/1). Group heads must be ordered by row (vitest checks this on all 9 maps).
- Intentional differences: the `WEPDEST` "weapon lost" blink only shows after a real loss (DOS
  showed it from the start because `damage` starts at -1); pilots autosave in the hangar and a
  death reloads the last save; all registered-version weapons are purchasable (`Inventory.reg`);
  selling the damage scanner really removes it (DOS only unequipped it, which blocked buying it
  again); optional auto-fire (default on).
