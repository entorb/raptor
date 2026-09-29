// Builds every procedural texture once (Boot). Keys:
//   u-<PICNAME>      enemy/unit frames "0".."n-1" (3x original size)
//   player           frames "0".."6" (DOS playerpic, 3 = level)
//   shot-<PICNAME>   shots (3x original size)
//   pickup-<type>    bonus icons (48 px, hex badge)
//   icon-<type>      item icons (96 px, shop)
//   hudbar-off, hudbar-shield, hudbar-energy  HUD shield bars (dim / all lit)
//   struct-<k>, wreck-<k>  destructible map structures (96 px)
//   dot, smoke, shard, stars-far, stars-near, nebula, hangar-bg, shop-bg, brief-bravo, brief-train (960x600)
// Training sector (buildTrainingTextures, on the first training mission):
//   ut-<PICNAME>, tstruct-<k>, twreck-<k>, sim-floor, sim-grid, sim-dots
import type { Scene } from "phaser"
import { ENEMY_LIB, PIC_SIZES } from "../data/ep1"
import { SCALE } from "../data/playfield"
import { Obj } from "../sim/consts"
import { drawBriefing } from "./briefing"
import { makeCanvas, seeded } from "./draw"
import {
  drawDot,
  drawHudBar,
  drawShard,
  drawShot,
  drawSmoke,
  drawStructure,
  drawWreck,
  HUD_BAR,
} from "./fx"
import { drawHangar } from "./hangar"
import { drawIcon, drawPickup } from "./icons"
import { drawPlayer, drawUnit } from "./ships"
import { drawShop } from "./shop"

export const STRUCT_KINDS = 4
export const WRECK_KINDS = 3

function addFrames(
  scene: Scene,
  key: string,
  w: number,
  h: number,
  frames: number,
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void,
): void {
  if (scene.textures.exists(key)) return
  const pad = 2
  const { c, ctx } = makeCanvas((w + pad) * frames, h)
  for (let f = 0; f < frames; f++) {
    ctx.save()
    ctx.translate(f * (w + pad), 0)
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    draw(ctx, f)
    ctx.restore()
  }
  const tex = scene.textures.addCanvas(key, c)
  if (!tex) return
  for (let f = 0; f < frames; f++) tex.add(String(f), 0, f * (w + pad), 0, w, h)
}

function single(
  scene: Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return
  const { c, ctx } = makeCanvas(w, h)
  draw(ctx)
  scene.textures.addCanvas(key, c)
}

function stars(
  ctx: CanvasRenderingContext2D,
  s: number,
  n: number,
  seed: number,
  big: number,
): void {
  const r = seeded(seed)
  for (let i = 0; i < n; i++) {
    const x = r() * s
    const y = r() * s
    const size = r() * big + 0.4
    const hue = r()
    let col = "255,255,255"
    if (hue < 0.2) col = "180,200,255"
    else if (hue < 0.3) col = "255,220,180"
    const a = 0.3 + r() * 0.7
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2.5)
    g.addColorStop(0, `rgba(${col},${a})`)
    g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6)
  }
}

/** Units: one sheet per picture name, frames = max num_frames used by any library entry. */
function buildUnits(scene: Scene, prefix: string, train: boolean): void {
  const units = new Map<string, { w: number; h: number; frames: number }>()
  for (const e of ENEMY_LIB) {
    if (!e.w) continue
    const cur = units.get(e.iname)
    const frames = Math.max(1, e.num_frames, cur?.frames ?? 1)
    units.set(e.iname, { w: e.w, h: e.h, frames })
  }
  for (const [name, u] of units)
    addFrames(scene, `${prefix}${name}`, u.w * SCALE, u.h * SCALE, u.frames, (ctx, f) =>
      drawUnit(ctx, name, u.w * SCALE, u.h * SCALE, f, u.frames, train),
    )
}

/** Sim grid lines every `step` px (tileable at 512). */
function grid(ctx: CanvasRenderingContext2D, step: number, color: string, width: number): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  for (let p = step / 2; p < 512; p += step) {
    ctx.moveTo(p, 0)
    ctx.lineTo(p, 512)
    ctx.moveTo(0, p)
    ctx.lineTo(512, p)
  }
  ctx.stroke()
}

/** Holographic training range: target drones, target pads, grid backdrop. */
export function buildTrainingTextures(scene: Scene): void {
  buildUnits(scene, "ut-", true)
  for (let k = 0; k < STRUCT_KINDS; k++)
    single(scene, `tstruct-${k}`, 96, 96, (ctx) => drawStructure(ctx, k, 96, true))
  for (let k = 0; k < WRECK_KINDS; k++)
    single(scene, `twreck-${k}`, 96, 96, (ctx) => drawWreck(ctx, 96, 11 + k, true))
  single(scene, "sim-floor", 512, 512, (ctx) => {
    ctx.fillStyle = "#04070f"
    ctx.fillRect(0, 0, 512, 512)
    grid(ctx, 32, "rgba(60,160,255,0.10)", 1)
  })
  single(scene, "sim-grid", 512, 512, (ctx) => grid(ctx, 128, "rgba(93,255,200,0.22)", 2))
  single(scene, "sim-dots", 512, 512, (ctx) => {
    const r = seeded(5)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(93,255,200,${0.2 + r() * 0.5})`
      ctx.fillRect(Math.floor(r() * 16) * 32 + 15, Math.floor(r() * 16) * 32 + 15, 3, 3)
    }
  })
}

export function buildTextures(scene: Scene): void {
  buildUnits(scene, "u-", false)

  addFrames(scene, "player", 32 * SCALE, 32 * SCALE, 7, (ctx, f) =>
    drawPlayer(ctx, 32 * SCALE, 32 * SCALE, 3 - f),
  )

  for (const key of Object.keys(PIC_SIZES)) {
    const [w, h] = PIC_SIZES[key] ?? [8, 8]
    single(scene, `shot-${key}`, w * SCALE, h * SCALE, (ctx) => drawShot(ctx, key, w * SCALE))
  }

  for (let t = 0; t < Obj.LAST_OBJECT; t++) {
    single(scene, `pickup-${t}`, 48, 48, (ctx) => drawPickup(ctx, t, 48))
    single(scene, `icon-${t}`, 96, 96, (ctx) => drawIcon(ctx, t, 0, 0, 96))
  }

  for (let k = 0; k < STRUCT_KINDS; k++)
    single(scene, `struct-${k}`, 96, 96, (ctx) => drawStructure(ctx, k, 96))
  for (let k = 0; k < WRECK_KINDS; k++)
    single(scene, `wreck-${k}`, 96, 96, (ctx) => drawWreck(ctx, 96, 11 + k))

  const { w, h } = HUD_BAR
  single(scene, "hudbar-off", w, h, (ctx) => drawHudBar(ctx, null))
  single(scene, "hudbar-shield", w, h, (ctx) => drawHudBar(ctx, ["#ff4050", "#46a0ff", "#46e0ff"]))
  single(scene, "hudbar-energy", w, h, (ctx) => drawHudBar(ctx, ["#ff4050", "#ffd23d", "#2effb4"]))

  single(scene, "dot", 32, 32, (ctx) => drawDot(ctx, 32))
  single(scene, "smoke", 48, 48, (ctx) => drawSmoke(ctx, 48))
  single(scene, "shard", 12, 12, (ctx) => drawShard(ctx, 12))
  single(scene, "hangar-bg", 960, 600, (ctx) => drawHangar(ctx, 960, 600))
  single(scene, "shop-bg", 960, 600, (ctx) => drawShop(ctx, 960, 600))
  for (const s of ["bravo", "train"])
    single(scene, `brief-${s}`, 960, 600, (ctx) => drawBriefing(ctx, 960, 600, s === "train"))
  single(scene, "stars-far", 512, 512, (ctx) => stars(ctx, 512, 260, 1, 0.8))
  single(scene, "stars-near", 512, 512, (ctx) => stars(ctx, 512, 60, 2, 1.8))
  single(scene, "nebula", 512, 1024, (ctx) => {
    const r = seeded(3)
    for (let i = 0; i < 26; i++) {
      const x = r() * 512
      const y = r() * 1024
      const rad = 80 + r() * 200
      const hue = [
        [90, 40, 160],
        [30, 80, 170],
        [150, 30, 110],
        [20, 120, 140],
      ][Math.floor(r() * 4)] as number[]
      // draw wrapped in both directions so the texture tiles
      for (const oy of [-1024, 0, 1024])
        for (const ox of [-512, 0, 512]) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad)
          g.addColorStop(0, `rgba(${hue.join(",")},0.18)`)
          g.addColorStop(1, `rgba(${hue.join(",")},0)`)
          ctx.fillStyle = g
          ctx.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2)
        }
    }
  })
}
