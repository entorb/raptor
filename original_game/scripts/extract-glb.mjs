// Extract episode 1 game data + audio from the Raptor v1.2 shareware GLB archives.
//   node scripts/extract-glb.mjs            data + original sfx + music (reference archive)
//   node scripts/extract-glb.mjs --data     only src/game/data/ep1.ts
//   node scripts/extract-glb.mjs --ref      also dump reference PNGs to tmp/ref/ (art design only)
// Inputs: original_game/shareware/FILE0000.GLB, FILE0001.GLB (not committed).
// Outputs: src/game/data/ep1.ts (committed, never hand-edit); the original audio goes to
// original_game/audio/ (gitignored, comparison only: the game ships scripts/gen_audio.mjs sounds).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseGlb, runGlbSelfCheck } from "./lib/glb.mjs"
import { renderMus } from "./lib/music.mjs"
import { toOgg } from "../../scripts/lib/ogg.mjs"
import { decodePic, parsePalette, picSize, toRgba } from "./lib/pic.mjs"
import { encodePng } from "./lib/png.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "original_game/shareware")
const args = new Set(process.argv.slice(2))
const onlyData = args.has("--data")

runGlbSelfCheck()
const glb0 = parseGlb(readFileSync(join(SRC, "FILE0000.GLB")))
const glb1 = parseGlb(readFileSync(join(SRC, "FILE0001.GLB")))

/** GLB_GetItemID: first item with that name (case-insensitive). */
function itemIndex(items, name) {
  const i = items.findIndex((it) => it.name.toUpperCase() === name.toUpperCase())
  if (i < 0) throw new Error(`GLB item not found: ${name}`)
  return i
}
const item1 = (name, frame = 0) => glb1[itemIndex(glb1, name) + frame]

// ---- SPRITE1_ITM (ENEMY.H SPRITE, Watcom -zp4: 528 bytes) -------------------------------------
const SPRITE_SIZE = 528
function parseSprites(buf) {
  if (buf.length % SPRITE_SIZE) throw new Error("SPRITE1_ITM size is not a multiple of 528")
  const out = []
  for (let o = 0; o < buf.length; o += SPRITE_SIZE) {
    const i32 = (off) => buf.readInt32LE(o + off)
    const shorts = (off, n) => Array.from({ length: n }, (_, k) => buf.readInt16LE(o + off + k * 2))
    const raw = buf.subarray(o, o + 16)
    const end = raw.indexOf(0)
    const iname = raw.subarray(0, end < 0 ? 16 : end).toString("latin1")
    const numguns = i32(104)
    const numengs = i32(108)
    const numflight = i32(92)
    const idx = glb1.findIndex((it) => it.name.toUpperCase() === iname.toUpperCase())
    const size = idx >= 0 ? picSize(glb1[idx].data()) : { w: 0, h: 0 }
    out.push({
      iname,
      w: size.w,
      h: size.h,
      bonus: i32(20),
      exptype: i32(24),
      shotspace: i32(28),
      ground: i32(32),
      suck: i32(36),
      frame_rate: i32(40),
      num_frames: i32(44),
      countdown: i32(48),
      rewind: i32(52),
      animtype: i32(56),
      shadow: i32(60),
      bossflag: i32(64),
      hits: i32(68),
      money: i32(72),
      shootstart: i32(76),
      shootcnt: i32(80),
      shootframe: i32(84),
      movespeed: i32(88),
      numflight,
      repos: i32(96),
      flighttype: i32(100),
      numguns,
      numengs,
      sfx: i32(112),
      song: i32(116),
      shoot_type: shorts(120, numguns),
      engx: shorts(168, numengs),
      engy: shorts(216, numengs),
      englx: shorts(264, numengs),
      shootx: shorts(312, numguns),
      shooty: shorts(360, numguns),
      // RAP_ENEMY reads flightx/flighty up to index numflight (F_LINEAR reads one past), keep 30
      flightx: shorts(408, 30),
      flighty: shorts(468, 30),
    })
  }
  return out
}

// ---- FLATSG1_ITM (MAP.H FLATS: int linkflat, short bonus, short bounty) ---------------------
function parseFlats(buf) {
  const link = []
  const hp = []
  const bounty = []
  for (let o = 0; o < buf.length; o += 8) {
    link.push(buf.readInt32LE(o))
    hp.push(buf.readInt16LE(o + 4))
    bounty.push(buf.readInt16LE(o + 6))
  }
  return { link, hp, bounty }
}

// ---- MAPnG1_MAP (MAP.H MAZELEVEL + CSPRITE[]) --------------------------------------------------
const MAP_SIZE = 150 * 9
function parseMap(buf) {
  const numsprites = buf.readInt32LE(8)
  const flats = []
  for (let i = 0; i < MAP_SIZE; i++) {
    if (buf.readInt16LE(12 + i * 4 + 2) !== 0) throw new Error("episode 1 map uses fgame != 0")
    flats.push(buf.readInt16LE(12 + i * 4))
  }
  const base = 12 + MAP_SIZE * 4
  if (base + numsprites * 24 !== buf.length) throw new Error("MAZELEVEL/CSPRITE size mismatch")
  const spawns = []
  for (let i = 0; i < numsprites; i++) {
    const o = base + i * 24
    // [link, slib, x, y, game, level]
    spawns.push([0, 4, 8, 12, 16, 20].map((k) => buf.readInt32LE(o + k)))
  }
  return { flats, spawns }
}

// ---- picture sizes the game logic depends on (hlx/hly/xoff/yoff in SHOTS/ESHOT/ANIMS) ------
const SIZE_ITEMS = [
  "NMSHOT_BLK",
  "PLASMA_BLK",
  "MICROM_BLK",
  "MISDUM_BLK",
  "MISRAT_BLK",
  "MISGRD_BLK",
  "BLDGBOMB_PIC",
  "POWDIS_BLK",
  "MEGABM_BLK",
  "SHOKWV_BLK",
  "FRNTLAS_BLK",
  "DETHRY_BLK",
  "ESHOT_BLK",
  "EMISLE_BLK",
  "MINE_BLK",
  "ELASER_BLK",
  "EPLASMA_PIC",
  "COCONUT_PIC",
  "ICNGLW_BLK",
  // ANIMS.C ANIMS_Init registrations (xoff/yoff = half size of first frame)
  "GEXPLO_BLK",
  "BOOM_PIC",
  "SPLAT_BLK",
  "BIGSPLAT_BLK",
  "LGFLAK_BLK",
  "EXPLO2_BLK",
  "SMFLAK_BLK",
  "AIRBOOM_PIC",
  "NRGBANG_BLK",
  "LRBLST_BLK",
  "SSMOKE_BLK",
  "SMOKTRAL_BLK",
  "LGHTIN_BLK",
  "BSPARK_BLK",
  "OSPARK_BLK",
  "GUNSTR_BLK",
  "FLARE_PIC",
  "SPARKLE_PIC",
  "SHIPGLOW_BLK",
]

// ---- tile classification for the space re-theme ------------------------------------------------
// Per tile 16 cells (4x4, 8x8 DOS px each, row-major) as a string of materials:
// 0 = water -> open space, 1 = land -> asteroid rock, 2 = grey road/building -> station hull,
// 3 = vegetation -> alien lichen.
/** Material (0..3) of the 8x8 px cell (cx, cy) of a decoded tile. */
function classifyCell(p, pal, cx, cy) {
  const n = [0, 0, 0, 0]
  for (let y = cy * 8; y < cy * 8 + 8; y++)
    for (let x = cx * 8; x < cx * 8 + 8; x++) {
      const [r, g, b] = pal[p.px[y * 32 + x]] ?? [0, 0, 0]
      if (b > r + 20 && g > r) n[0]++
      else if (Math.max(r, g, b) - Math.min(r, g, b) < 28 && r + g + b > 150) n[2]++
      else if (g >= r * 0.85 && b < g * 0.7) n[3]++
      else n[1]++
    }
  // water only wins with a clear majority; otherwise the most common solid material
  if (n[0] > 32) return 0
  return [1, 2, 3].reduce((best, k) => (n[k] > n[best] ? k : best), 1)
}

function classifyTiles(count, pal) {
  const t0 = itemIndex(glb1, "STARTG1TILES") + 1
  const cells = []
  for (let t = 0; t < count; t++) {
    const p = decodePic(glb1[t0 + t].data())
    let out = ""
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) out += classifyCell(p, pal, cx, cy)
    cells.push(out)
  }
  return cells
}

function buildData() {
  const sprites = parseSprites(item1("SPRITE1_ITM").data())
  const flats = parseFlats(item1("FLATSG1_ITM").data())
  const tiles = classifyTiles(flats.hp.length, parsePalette(item1("PALETTE_DAT").data()))
  const maps = []
  for (let w = 1; w <= 9; w++) maps.push(parseMap(item1(`MAP${w}G1_MAP`).data()))
  const sizes = Object.fromEntries(
    [...SIZE_ITEMS.map((n) => [n, item1(n)]), ["SSMOKE_BLK4", item1("SSMOKE_BLK", 4)]].map(
      ([n, it]) => {
        const s = picSize(it.data())
        return [n, [s.w, s.h]]
      },
    ),
  )
  // DEMOnG1_REC: INPUT.H RECORD { u8 b1..b4, i16 px, py, playerpic, fil } = 12 bytes
  const demos = [1, 2, 3].map((n) => {
    const d = item1(`DEMO${n}G1_REC`).data()
    const out = []
    for (let o = 0; o + 12 <= d.length; o += 12)
      out.push([
        d[o],
        d[o + 1],
        d[o + 2],
        d[o + 3],
        d.readInt16LE(o + 4),
        d.readInt16LE(o + 6),
        d.readInt16LE(o + 8),
      ])
    return out
  })
  const json = (v) => JSON.stringify(v)
  const lines = [
    "// GENERATED by scripts/extract-glb.mjs from the Raptor v1.2 shareware FILE0001.GLB.",
    "// Do not hand-edit: change the extractor and re-run `pnpm extract`.",
    'import type { EnemyLib } from "./types"',
    "",
    "/** SPRITE1_ITM: enemy library (ENEMY.H SPRITE); w/h = first frame size. */",
    `export const ENEMY_LIB: EnemyLib[] = ${json(sprites)}`,
    "",
    "/** FLATSG1_ITM: per tile index destroyed-link, hit points (bonus) and money (bounty). */",
    `export const FLATS = ${json(flats)}`,
    "",
    "/** MAPnG1_MAP: 9 waves, 150x9 tile indices (row 0 = top) + CSPRITE spawns [link, slib, x, y, game, level]. */",
    `export const MAPS: { flats: number[]; spawns: number[][] }[] = ${json(maps)}`,
    "",
    "/** Space re-theme per tile index: 16 cells (4x4 row-major), 0 space, 1 rock, 2 hull, 3 lichen. */",
    `export const TILE_CELLS: string[] = ${json(tiles)}`,
    "",
    "/** DEMOnG1_REC attract-mode recordings: [b1, b2, b3, b4, px, py, playerpic]; [0] = header (px game, py wave, playerpic count). */",
    `export const DEMOS: number[][][] = ${json(demos)}`,
    "",
    "/** [width, height] of original shot/effect pictures (logic uses their half sizes). */",
    `export const PIC_SIZES: Record<string, [number, number]> = ${json(sizes)}`,
    "",
  ]
  const out = join(ROOT, "src/game/data/ep1.ts")
  writeFileSync(out, lines.join("\n"))
  console.log(
    `wrote ${out}: ${sprites.length} enemies, ${flats.hp.length} tiles, ${maps.length} maps`,
  )
  return { sprites, flats, maps }
}

// ---- reference PNGs (tmp/ref, gitignored) -----------------------------------------------------
function sheet(pics, cols, scale, pal) {
  const cell = Math.max(...pics.map((p) => Math.max(p.w, p.h))) + 2
  const rows = Math.ceil(pics.length / cols)
  const W = cols * cell * scale
  const H = rows * cell * scale
  const rgba = Buffer.alloc(W * H * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 40
    rgba[i + 1] = 0
    rgba[i + 2] = 60
    rgba[i + 3] = 255
  }
  pics.forEach((p, n) => {
    const src = toRgba(p, pal)
    const ox = (n % cols) * cell * scale
    const oy = Math.floor(n / cols) * cell * scale
    for (let y = 0; y < p.h * scale; y++)
      for (let x = 0; x < p.w * scale; x++) {
        const s = (Math.floor(y / scale) * p.w + Math.floor(x / scale)) * 4
        if (!src[s + 3]) continue
        const d = ((oy + y) * W + ox + x) * 4
        src.copy(rgba, d, s, s + 4)
      }
  })
  return encodePng(W, H, rgba)
}

function dumpRef(data) {
  const dir = join(ROOT, "tmp/ref")
  mkdirSync(dir, { recursive: true })
  const pal = parsePalette(item1("PALETTE_DAT").data())
  const tiles0 = itemIndex(glb1, "STARTG1TILES") + 1
  const tiles = data.flats.hp.map((_, i) => decodePic(glb1[tiles0 + i].data()))
  writeFileSync(join(dir, "tiles.png"), sheet(tiles, 32, 1, pal))
  // each map as one tall image
  data.maps.forEach((m, w) => {
    const pics = []
    for (let r = 0; r < 150; r++) for (let c = 0; c < 9; c++) pics.push(tiles[m.flats[r * 9 + c]])
    writeFileSync(join(dir, `map${w + 1}.png`), sheetTight(pics, 9, pal))
  })
  const seen = new Set()
  for (const s of data.sprites) {
    if (!s.w || seen.has(s.iname)) continue
    seen.add(s.iname)
    const i0 = itemIndex(glb1, s.iname)
    const frames = Array.from({ length: Math.max(1, s.num_frames) }, (_, k) =>
      decodePic(glb1[i0 + k].data()),
    )
    writeFileSync(join(dir, `enemy_${s.iname}.png`), sheet(frames, frames.length, 3, pal))
  }
  for (const name of [...SIZE_ITEMS, "LPLAYER_PIC", "BONUS00_PIC"]) {
    const i0 = itemIndex(glb1, name)
    const pics = []
    for (let k = i0; k < glb1.length && glb1[k].name === name && pics.length < 12; k++)
      pics.push(decodePic(glb1[k].data()))
    writeFileSync(join(dir, `fx_${name}.png`), sheet(pics, pics.length, 3, pal))
  }
  const bonus = glb1
    .filter((it) => /^BONUS\d\d_PIC$/.test(it.name))
    .map((it) => decodePic(it.data()))
  writeFileSync(join(dir, "bonus.png"), sheet(bonus, 12, 3, pal))
  console.log(`wrote reference PNGs to ${dir}`)
}

function sheetTight(pics, cols, pal) {
  const cw = 32
  const W = cols * cw
  const H = Math.ceil(pics.length / cols) * cw
  const rgba = Buffer.alloc(W * H * 4)
  pics.forEach((p, n) => {
    const src = toRgba(p, pal)
    const ox = (n % cols) * cw
    const oy = Math.floor(n / cols) * cw
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const s = (y * p.w + x) * 4
        const d = ((oy + y) * W + ox + x) * 4
        src.copy(rgba, d, s, s + 3)
        rgba[d + 3] = 255
      }
  })
  return encodePng(W, H, rgba)
}

// ---- audio ------------------------------------------------------------------------------------
// FX.C SND_Setup: every sound is a label item followed by 4 variants; +4 is the digital one
// (DMX format 3: u16 3, u16 rate, u32 len, PCM u8 from byte 24, len - 32 samples).
const SFX = [
  "EXPLO",
  "EXPLO2",
  "BONUS",
  "CRASH",
  "FLYBY",
  "EGRAB",
  "GEXPLO",
  "GUN",
  "LASER",
  "MISSLE",
  "SWEP",
  "TURRET",
  "WARN",
  "BOSS",
  "HIT",
  "ESHOT",
  "MON1",
]
// WINDOWS.C songsg1 (episode 1 waves), menu, hangar and RAP5 (death). APOGEE/RINTRO are intro-only.
const SONGS = ["MAINMENU", "HANGAR", "RAP2", "RAP3", "RAP4", "RAP5", "RAP6", "RAP7", "RAP8"]

function wav(pcm, rate, channels, bits) {
  const h = Buffer.alloc(44)
  h.write("RIFF", 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write("WAVEfmt ", 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(channels, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE((rate * channels * bits) / 8, 28)
  h.writeUInt16LE((channels * bits) / 8, 32)
  h.writeUInt16LE(bits, 34)
  h.write("data", 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

function extractSfx() {
  const dir = join(ROOT, "original_game/audio/sfx")
  mkdirSync(dir, { recursive: true })
  for (const name of SFX) {
    const d = glb0[itemIndex(glb0, `${name}_FX`) + 4].data()
    if (d.readUInt16LE(0) !== 3) throw new Error(`${name}_FX: not a digital sample`)
    const rate = d.readUInt16LE(2)
    const len = d.readUInt32LE(4) - 32
    toOgg(wav(d.subarray(24, 24 + len), rate, 1, 8), join(dir, `${name.toLowerCase()}.ogg`), "4")
  }
  console.log(`wrote ${SFX.length} sfx to ${dir}`)
}

async function extractMusic() {
  const dir = join(ROOT, "original_game/audio/music")
  mkdirSync(dir, { recursive: true })
  const genmidi = glb0[itemIndex(glb0, "GENMIDI_OP2")].data()
  for (const name of SONGS) {
    const mus = glb0[itemIndex(glb0, `${name}_MUS`)].data()
    const { pcm, rate } = renderMus(mus, genmidi)
    toOgg(wav(pcm, rate, 2, 16), join(dir, `${name.toLowerCase()}.ogg`), "3")
    process.stdout.write(`${name} `)
  }
  console.log(`\nwrote ${SONGS.length} songs to ${dir}`)
}

const data = buildData()
if (args.has("--ref")) dumpRef(data)
if (!onlyData) {
  extractSfx()
  await extractMusic()
}
