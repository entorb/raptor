// Builds every procedural texture once (Boot). Keys:
//   u-<PICNAME>      enemy/unit frames "0".."n-1" (3x original size)
//   player           frames "0".."6" (DOS playerpic, 3 = level)
//   shot-<PICNAME>   shots (3x original size)
//   pickup-<type>    bonus icons (48 px), hud-<type> for the HUD
//   struct-<k>, wreck-<k>  destructible map structures (96 px)
//   dot, smoke, shard, stars-far, stars-near, nebula, hangar-bg (960x600)
import type { Scene } from "phaser"
import { ENEMY_LIB, PIC_SIZES } from "../data/ep1"
import { SCALE } from "../data/playfield"
import { Obj } from "../sim/consts"
import { makeCanvas, seeded } from "./draw"
import { drawDot, drawPickup, drawShard, drawShot, drawSmoke, drawStructure, drawWreck } from "./fx"
import { drawHangar } from "./hangar"
import { drawPlayer, drawUnit } from "./ships"

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

export function buildTextures(scene: Scene): void {
  // units: one sheet per picture name, frames = max num_frames used by any library entry
  const units = new Map<string, { w: number; h: number; frames: number }>()
  for (const e of ENEMY_LIB) {
    if (!e.w) continue
    const cur = units.get(e.iname)
    const frames = Math.max(1, e.num_frames, cur?.frames ?? 1)
    units.set(e.iname, { w: e.w, h: e.h, frames })
  }
  for (const [name, u] of units)
    addFrames(scene, `u-${name}`, u.w * SCALE, u.h * SCALE, u.frames, (ctx, f) =>
      drawUnit(ctx, name, u.w * SCALE, u.h * SCALE, f, u.frames),
    )

  addFrames(scene, "player", 32 * SCALE, 32 * SCALE, 7, (ctx, f) =>
    drawPlayer(ctx, 32 * SCALE, 32 * SCALE, 3 - f),
  )

  for (const key of Object.keys(PIC_SIZES)) {
    const [w, h] = PIC_SIZES[key] ?? [8, 8]
    single(scene, `shot-${key}`, w * SCALE, h * SCALE, (ctx) => drawShot(ctx, key, w * SCALE))
  }

  for (let t = 0; t < Obj.LAST_OBJECT; t++) {
    single(scene, `pickup-${t}`, 48, 48, (ctx) => drawPickup(ctx, t, 48))
  }

  for (let k = 0; k < STRUCT_KINDS; k++)
    single(scene, `struct-${k}`, 96, 96, (ctx) => drawStructure(ctx, k, 96))
  for (let k = 0; k < WRECK_KINDS; k++)
    single(scene, `wreck-${k}`, 96, 96, (ctx) => drawWreck(ctx, 96, 11 + k))

  single(scene, "dot", 32, 32, (ctx) => drawDot(ctx, 32))
  single(scene, "smoke", 48, 48, (ctx) => drawSmoke(ctx, 48))
  single(scene, "shard", 12, 12, (ctx) => drawShard(ctx, 12))
  single(scene, "hangar-bg", 960, 600, (ctx) => drawHangar(ctx, 960, 600))
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
