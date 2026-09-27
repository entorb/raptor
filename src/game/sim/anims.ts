// Port of dosraptor/SOURCE/ANIMS.C: explosions, sparks, smoke. Pure visuals, but kept in the
// sim so positions/lifetimes match the original; the renderer draws each by its `kind`.
import { PIC_SIZES } from "../data/ep1"
import type { Ship } from "./enemy"
import type { World } from "./world"

const MAX_ANIMS = 100

export type Layer = "ground" | "mid" | "high"

export interface AnimLib {
  /** original picture name (the renderer keys its effect off this) */
  kind: string
  numframes: number
  layer: Layer
  playerflag: boolean
  transparent: boolean
  /** 0 A_NORM, 1 A_MOVEUP, 2 A_MOVEDOWN */
  adir: number
  xoff: number
  yoff: number
}

function reg(
  kind: string,
  numframes: number,
  layer: Layer,
  playerflag = false,
  transparent = false,
  adir = 0,
  sizeKey = kind,
): AnimLib {
  const [w, h] = PIC_SIZES[sizeKey] ?? [16, 16]
  return { kind, numframes, layer, playerflag, transparent, adir, xoff: w >> 1, yoff: h >> 1 }
}

/** ANIMS_Init registrations, index = Anim handle. */
export const ANIM_LIB: AnimLib[] = [
  reg("GEXPLO_BLK", 42, "ground"),
  reg("BOOM_PIC", 35, "ground"),
  reg("SPLAT_BLK", 7, "ground"),
  reg("BIGSPLAT_BLK", 10, "ground"),
  reg("LGFLAK_BLK", 12, "high"),
  reg("EXPLO2_BLK", 13, "ground"),
  reg("SMFLAK_BLK", 14, "high"),
  reg("AIRBOOM_PIC", 16, "high"),
  reg("NRGBANG_BLK", 12, "high"),
  reg("LRBLST_BLK", 4, "high"),
  reg("SSMOKE_BLK", 9, "mid"),
  reg("SSMOKE_DOWN", 5, "mid", false, true, 2, "SSMOKE_BLK4"),
  reg("SMOKTRAL_BLK", 4, "mid", false, true, 1),
  reg("LGHTIN_BLK", 14, "mid"),
  reg("BSPARK_BLK", 9, "mid"),
  reg("OSPARK_BLK", 9, "mid"),
  reg("GUNSTR_BLK", 4, "mid", true),
  reg("FLARE_PIC", 26, "ground"),
  reg("SPARKLE_PIC", 17, "ground"),
  reg("LGHTIN_HIGH", 14, "high", false, false, 0, "LGHTIN_BLK"),
  reg("SHIPGLOW_BLK", 4, "high", true, true),
]

const ADIR = [0, -1, 1]

export interface AnimObj {
  id: number
  lib: AnimLib
  /** draw position (top-left) */
  dx: number
  dy: number
  x: number
  y: number
  curframe: number
  layer: Layer
  en: Ship | null
  edone: boolean
}

function get(w: World, handle: number, x: number, y: number, layer?: Layer): AnimObj | null {
  if (w.anims.length >= MAX_ANIMS) return null
  const lib = ANIM_LIB[handle]
  if (!lib) return null
  const a: AnimObj = {
    id: w.newId(),
    lib,
    dx: x,
    dy: y,
    x,
    y,
    curframe: 0,
    layer: layer ?? lib.layer,
    en: null,
    edone: false,
  }
  w.anims.push(a)
  return a
}

/** ANIMS_StartAnim: centered on x/y */
export function startAnim(w: World, h: number, x: number, y: number): void {
  const lib = ANIM_LIB[h]
  if (lib) get(w, h, x - lib.xoff, y - lib.yoff)
}

/** ANIMS_StartGAnim: top-left at x/y, forced ground layer */
export function startGAnim(w: World, h: number, x: number, y: number): void {
  get(w, h, x, y, "ground")
}

/** ANIMS_StartAAnim: centered, forced high layer */
export function startAAnim(w: World, h: number, x: number, y: number): void {
  const lib = ANIM_LIB[h]
  if (lib) get(w, h, x - lib.xoff, y - lib.yoff, "high")
}

/** ANIMS_StartEAnim: locked onto an enemy */
export function startEAnim(w: World, en: Ship, h: number, x: number, y: number): void {
  const lib = ANIM_LIB[h]
  if (!lib) return
  const a = get(w, h, x - lib.xoff, y - lib.yoff, "high")
  if (a) a.en = en
}

/** ANIMS_Think */
export function animsThink(w: World): void {
  for (let i = 0; i < w.anims.length; i++) {
    const cur = w.anims[i] as AnimObj
    const lib = cur.lib
    if (cur.curframe >= lib.numframes) {
      w.anims.splice(i--, 1)
      continue
    }
    if (lib.playerflag) {
      cur.dx = w.player_cx + cur.x
      cur.dy = w.player_cy + cur.y
    } else if (cur.en) {
      if (cur.en.removed) cur.edone = true
      if (!cur.edone) {
        cur.dx = cur.en.move.x + cur.x
        cur.dy = cur.en.move.y + cur.y
      }
    } else {
      cur.dx = cur.x
      cur.dy = cur.y
    }
    // DOS applies the direction twice (switch + adir table)
    if (lib.adir === 2) cur.y++
    else if (lib.adir === 1) cur.y--
    cur.y += ADIR[lib.adir] as number
    if (lib.layer === "ground" && w.tiles.scroll_flag) cur.y++
    cur.curframe++
  }
}
