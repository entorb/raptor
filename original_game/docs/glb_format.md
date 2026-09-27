# Raptor GLB data format

How `scripts/extract-glb.mjs` reads the v1.2 shareware data (`original_game/shareware/`). The
C references are in `dosraptor/` (GPL source release).

## Archive (`GFX/GLBAPI.C`)

- Files: `FILE0000.GLB` (texts, music, sfx), `FILE0001.GLB` (episode 1 graphics + data).
- Directory entry `KEYFILE`, 28 bytes: `u32 opt, u32 offset, u32 filesize, char name[16]`.
- Entry 0 is the header, its `offset` field holds the item count; entries 1..n follow.
- Every directory entry is encrypted on its own; item data only when `opt == 1`.
- Cipher (`GLB_DeCrypt`): key `"32768GLB"`, start index `25 % 8`, `prev = key[idx]`,
  `out = in - key[k] - prev`, then `prev = in` (the cipher byte). Implemented in
  `scripts/lib/glb.mjs`.
- Zero-size items are labels (`STARTG1TILES`, `START_SFX`, ...). `GLB_GetItemID` returns the first
  item with a name; animation frames are the following items with the same name.

## Pictures (`GFX/GFXAPI.H`, `scripts/lib/pic.mjs`)

- `GFX_PIC` header, 20 bytes: `i32 type, opt1, opt2, width, height`.
- `type 1` (GPIC): raw `width*height` palette indices (tiles are 32x32 GPIC, 1044 bytes).
- `type 0` (GSPRITE): runs `{i32 x, y, offset, length}` + `length` pixels until `offset == -1`.
- `PALETTE_DAT`: 768 bytes, 6-bit VGA RGB.

## Game data (Watcom 32-bit, `-zp4`: int/enum/BOOL = 4 bytes)

- `SPRITE1_ITM`: array of `SPRITE` (`SOURCE/MAP.H`), 528 bytes each (131 records):
  `iname[16]` + 26 ints (item, bonus, exptype, shotspace, ground, suck, frame_rate, num_frames,
  countdown, rewind, animtype, shadow, bossflag, hits, money, shootstart, shootcnt, shootframe,
  movespeed, numflight, repos, flighttype, numguns, numengs, sfx, song) + shorts
  `shoot_type/engx/engy/englx/shootx/shooty[24]`, `flightx/flighty[30]`.
- `FLATSG1_ITM`: `FLATS {i32 linkflat; i16 bonus (tile hit points); i16 bounty (money)}` per
  tile index (672 tiles). A tile is destructible when `linkflat != index`.
- `MAPnG1_MAP` (n = wave 1..9): `MAZELEVEL {u32 sizerec, u32 spriteoff, i32 numsprites,
  MAZEDATA map[150*9] {i16 flats, i16 fgame}}` followed by `CSPRITE[numsprites]
  {i32 link, slib, x, y, game, level}`. Row 0 is the top; the game scrolls from row 149 upwards.
  `level` 3/4/5 = easy/medium/hard spawn (bit masks in `ENEMY.H`), 0..2 = unused secrets.
- `DEMOnG1_REC`: `RECORD {u8 b1..b4, i16 px, py, playerpic, fil}` (12 bytes); record 0 is the
  header (`px` game, `py` wave, `playerpic` record count).

## Audio

- Sound effects (`SOURCE/FX.C`): a zero-size label `<NAME>_FX` followed by 4 variants, the
  digital one at +4: DMX format 3 `u16 3, u16 rate, u32 len`, unsigned 8-bit PCM from byte 24,
  `len - 32` samples (`apodmx/DMX.C SFX_PlayPatch`).
- Music: DMX `.MUS` songs (`*_MUS`) + the OPL2 bank `GENMIDI_OP2`, played at 140 Hz ticks.
  Rendered offline with the vendored OPL3 emulator (`scripts/vendor/opl3`, MIT) in
  `scripts/lib/music.mjs`, then encoded to OGG with `ffmpeg-static`.
- Episode 1 wave songs (`WINDOWS.C songsg1`): RAP8, RAP2, RAP4, RAP7, RAP6, RAP2, RAP3, RAP4, RAP6.

## Space re-theme (derived data)

`TILE_CELLS` in `src/game/data/ep1.ts`: each tile is split into 4x4 cells of 8x8 px and
classified by palette color: water -> open space (`0`), land -> asteroid rock (`1`), grey
roads/buildings -> station hull (`2`), vegetation -> alien lichen (`3`). `src/game/art/terrain.ts`
renders the new terrain from these cells.
