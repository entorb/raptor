// Procedural unit art shared by every sector: the palette and `Draw`/`Spec` contract, `drawUnit`
// (frame `t` of an original picture name, drawn at 3x its original size with the same hitbox, nose
// pointing down; dispatches to the sector art `s1_sim.ts` holograms, `s2_bravo.ts`, `s3_bugs.ts`)
// and the player ship.
import {
  type Ctx,
  canopy,
  glow,
  hashString,
  metal,
  mirrorPath,
  type Pt,
  panelLines,
  polyPath,
  seeded,
} from "./draw"
import { drawTrainingUnit } from "./s1_sim"
import { bravoSpec } from "./s2_bravo"
import { BUG_SPECS } from "./s3_bugs"

export interface Palette {
  dark: string
  mid: string
  light: string
  accent: string
  engine: string
  glass: string
}

export const PLAYER_PAL: Palette = {
  dark: "#0f1c33",
  mid: "#3f6fb8",
  light: "#eaf4ff",
  accent: "#39d0ff",
  engine: "#39d0ff",
  glass: "#7fe7ff",
}

/** web: 2P co-op player 2, amber hull (glow tint `Game.ts P2_TINT`) */
export const PLAYER2_PAL: Palette = {
  dark: "#33200f",
  mid: "#b8783f",
  light: "#fff3e6",
  accent: "#ffa040",
  engine: "#ffa040",
  glass: "#ffd27f",
}

export type Draw = (ctx: Ctx, w: number, h: number, t: number, r: () => number, p: Palette) => void

export interface Spec {
  draw: Draw
  pal: Palette
}

/** Draw frame `frame` of `frames` for an original picture name into a w x h canvas area. */
export function drawUnit(
  ctx: Ctx,
  name: string,
  w: number,
  h: number,
  frame: number,
  frames: number,
  train = false,
): void {
  const t = frames > 1 ? frame / frames : 0
  if (train) {
    drawTrainingUnit(ctx, name, w, h, t)
    return
  }
  const spec = BUG_SPECS[name] ?? bravoSpec(name, w, h)
  spec.draw(ctx, w, h, t, seeded(hashString(name)), spec.pal)
}

/**
 * Player ship, nose up; bank -3..3 (DOS playerpic 0..6, 3 = level). The bank is drawn as a roll:
 * the lowered wing (left for bank < 0) shrinks and darkens, the raised one stays wide and lit,
 * the hull shows its side on the lowered side.
 */
export function drawPlayer(ctx: Ctx, w: number, h: number, bank: number, p = PLAYER_PAL): void {
  const k = bank / 3 // -1..1, roll direction
  const roll = Math.abs(k) * ((55 * Math.PI) / 180)
  const cx = w / 2 - k * w * 0.03
  const shift = -k * w * 0.05 // top side turns toward the raised wing
  ctx.save()
  const wing = (s: number) => {
    const up = -s * k // +1 = raised wing, -1 = lowered wing
    const sc = Math.cos(roll) + up * 0.25
    const drop = up < 0 ? -up * h * 0.04 : 0
    const pts: Pt[] = [
      [cx + s * w * 0.08, h * 0.35],
      [cx + s * w * 0.48 * sc, h * 0.7 + drop],
      [cx + s * w * 0.46 * sc, h * 0.82 + drop],
      [cx + s * w * 0.1, h * 0.78],
    ]
    polyPath(ctx, pts)
    metal(ctx, cx - w / 2, cx + w / 2, p.dark, p.mid, p.light)
    if (up !== 0) {
      ctx.fillStyle = up < 0 ? `rgba(0,0,0,${-up * 0.45})` : `rgba(255,255,255,${up * 0.12})`
      ctx.fill()
    }
    ctx.save()
    ctx.globalAlpha = up < 0 ? 1 + up * 0.5 : 1
    glow(ctx, cx + s * w * 0.45 * sc, h * 0.74 + drop, w * 0.05, s < 0 ? "#ff4050" : "#40ff90")
    ctx.restore()
  }
  wing(-1)
  wing(1)
  mirrorPath(ctx, cx, [
    [w * 0.02, h * 0.0],
    [w * 0.08, h * 0.18],
    [w * 0.12, h * 0.6],
    [w * 0.16, h * 0.9],
    [w * 0.1, h * 0.98],
  ])
  metal(ctx, cx - w * 0.16 + shift, cx + w * 0.16 + shift, p.dark, p.mid, p.light)
  if (k !== 0) {
    // hull side on the lowered side
    const s = Math.sign(k)
    ctx.save()
    ctx.clip()
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.fillRect(
      s < 0 ? cx - w * 0.17 : cx + w * 0.17 - Math.abs(k) * w * 0.09,
      0,
      Math.abs(k) * w * 0.09,
      h,
    )
    ctx.restore()
  }
  panelLines(ctx, [
    [
      [cx + shift * 0.6, h * 0.45],
      [cx + shift * 0.6, h * 0.9],
    ],
  ])
  canopy(ctx, cx + shift, h * 0.34, w * 0.055 * (1 - Math.abs(k) * 0.2), h * 0.1, p.glass)
  ctx.restore()
}
