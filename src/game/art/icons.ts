// Item icons (shop, HUD weapon strip, pickups): one line-art glyph per object type, drawn in a
// 100x100 design box and scaled. The nova bomb reuses its warhead shot art.
import { Obj } from "../sim/consts"
import { type Ctx, glow, metal, polyPath } from "./draw"
import { drawShotArt } from "./fx"

/** Accent color per object type (pickup badge, icon strokes, shop highlight). */
export const ICON_COLOR: Partial<Record<number, string>> = {
  [Obj.FORWARD_GUNS]: "#39d0ff",
  [Obj.PLASMA_GUNS]: "#6dff6d",
  [Obj.MICRO_MISSLE]: "#ffb347",
  [Obj.DUMB_MISSLE]: "#ff7a2e",
  [Obj.MINI_GUN]: "#ffe03d",
  [Obj.TURRET]: "#ff3dd2",
  [Obj.MISSLE_PODS]: "#ff9a2e",
  [Obj.AIR_MISSLE]: "#9fb7ff",
  [Obj.GRD_MISSLE]: "#9fd6a5",
  [Obj.BOMB]: "#ff5050",
  [Obj.ENERGY_GRAB]: "#8ffcff",
  [Obj.MEGA_BOMB]: "#ffe066",
  [Obj.PULSE_CANNON]: "#a078ff",
  [Obj.FORWARD_LASER]: "#ff3dd2",
  [Obj.DEATH_RAY]: "#ffe03d",
  [Obj.SUPER_SHIELD]: "#46e0ff",
  [Obj.ENERGY]: "#2effb4",
  [Obj.DETECT]: "#ffffff",
}

/** Missile pointing along `a` (0 = up), tip at (x, y). */
function missile(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  w: number,
  color: string,
  a = 0,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  polyPath(ctx, [
    [0, 0],
    [w / 2, w * 0.9],
    [w / 2, len * 0.8],
    [w * 1.1, len],
    [-w * 1.1, len],
    [-w / 2, len * 0.8],
    [-w / 2, w * 0.9],
  ])
  metal(ctx, -w, w, "#2a2f3a", "#8b93a6", "#eef2ff", [color, 2])
  glow(ctx, 0, len + w * 0.6, w * 1.2, color)
  ctx.restore()
}

function line(ctx: Ctx, pts: [number, number][], color: string, width = 5): void {
  ctx.beginPath()
  for (const [i, [x, y]] of pts.entries()) {
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke()
}

function ring(ctx: Ctx, x: number, y: number, r: number, color: string, width = 5): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function beam(ctx: Ctx, x: number, y0: number, y1: number, w: number, color: string): void {
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0)
  g.addColorStop(0, "rgba(0,0,0,0)")
  g.addColorStop(0.3, color)
  g.addColorStop(0.5, "#ffffff")
  g.addColorStop(0.7, color)
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(x - w, y0, w * 2, y1 - y0)
  ctx.restore()
}

/** Gun body with `n` barrels (seen from above, firing up). */
function guns(ctx: Ctx, xs: number[], color: string): void {
  for (const x of xs) {
    ctx.beginPath()
    ctx.roundRect(x - 6, 40, 12, 46, 4)
    metal(ctx, x - 6, x + 6, "#1f2530", "#6c7688", "#dfe6f5", [color, 2])
    glow(ctx, x, 26, 10, color)
    glow(ctx, x, 8, 7, color)
  }
}

/** One icon per type; returns false for types without one (money crystals). */
function drawGlyph(ctx: Ctx, type: number, c: string): boolean {
  switch (type) {
    case Obj.FORWARD_GUNS:
      guns(ctx, [34, 66], c)
      return true
    case Obj.PLASMA_GUNS:
      glow(ctx, 50, 40, 34, c)
      glow(ctx, 50, 78, 14, c)
      ring(ctx, 50, 40, 18, c, 4)
      return true
    case Obj.MICRO_MISSLE:
      missile(ctx, 26, 22, 56, 8, c)
      missile(ctx, 50, 10, 56, 8, c)
      missile(ctx, 74, 22, 56, 8, c)
      return true
    case Obj.DUMB_MISSLE:
      missile(ctx, 50, 8, 70, 13, c)
      line(
        ctx,
        [
          [18, 30],
          [18, 62],
          [10, 52],
        ],
        c,
        4,
      )
      line(
        ctx,
        [
          [18, 62],
          [26, 52],
        ],
        c,
        4,
      )
      return true
    case Obj.MINI_GUN:
      ring(ctx, 50, 50, 34, c, 3)
      line(
        ctx,
        [
          [50, 6],
          [50, 24],
        ],
        c,
        4,
      )
      line(
        ctx,
        [
          [50, 76],
          [50, 94],
        ],
        c,
        4,
      )
      line(
        ctx,
        [
          [6, 50],
          [24, 50],
        ],
        c,
        4,
      )
      line(
        ctx,
        [
          [76, 50],
          [94, 50],
        ],
        c,
        4,
      )
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        glow(ctx, 50 + Math.cos(a) * 13, 50 + Math.sin(a) * 13, 8, c)
      }
      return true
    case Obj.TURRET:
      beam(ctx, 50, 4, 46, 7, c)
      ctx.beginPath()
      ctx.arc(50, 70, 26, Math.PI, 0)
      ctx.closePath()
      metal(ctx, 24, 76, "#1f2530", "#6c7688", "#dfe6f5", [c, 3])
      ctx.fillStyle = "#39414f"
      ctx.fillRect(44, 34, 12, 30)
      line(
        ctx,
        [
          [14, 78],
          [86, 78],
        ],
        c,
        5,
      )
      return true
    case Obj.MISSLE_PODS:
      ctx.beginPath()
      ctx.roundRect(18, 44, 64, 44, 8)
      metal(ctx, 18, 82, "#1f2530", "#5a6474", "#b9c2d4", [c, 3])
      for (const x of [32, 50, 68]) missile(ctx, x, 14, 40, 7, c)
      return true
    case Obj.AIR_MISSLE:
      ring(ctx, 50, 50, 38, c, 3)
      line(
        ctx,
        [
          [50, 4],
          [50, 16],
        ],
        c,
        3,
      )
      line(
        ctx,
        [
          [4, 50],
          [16, 50],
        ],
        c,
        3,
      )
      line(
        ctx,
        [
          [84, 50],
          [96, 50],
        ],
        c,
        3,
      )
      missile(ctx, 50, 18, 64, 11, c)
      return true
    case Obj.GRD_MISSLE:
      missile(ctx, 50, 86, 70, 15, c, Math.PI)
      line(
        ctx,
        [
          [10, 92],
          [90, 92],
        ],
        c,
        5,
      )
      return true
    case Obj.BOMB:
      ctx.beginPath()
      ctx.ellipse(50, 56, 26, 32, 0, 0, Math.PI * 2)
      metal(ctx, 24, 76, "#2a1a1a", "#7a4a4a", "#f0c0c0", [c, 3])
      ctx.fillStyle = c
      ctx.fillRect(24, 50, 52, 7)
      polyPath(ctx, [
        [36, 20],
        [64, 20],
        [56, 30],
        [44, 30],
      ])
      ctx.fillStyle = "#6c7688"
      ctx.fill()
      glow(ctx, 50, 56, 14, c)
      return true
    case Obj.ENERGY_GRAB:
      ring(ctx, 50, 50, 36, c, 4)
      polyPath(ctx, [
        [56, 8],
        [28, 54],
        [48, 54],
        [40, 92],
        [72, 42],
        [52, 42],
      ])
      ctx.fillStyle = "#ffffff"
      ctx.fill()
      glow(ctx, 50, 50, 30, c)
      return true
    case Obj.MEGA_BOMB:
      ctx.save()
      ctx.translate(26, 0)
      drawShotArt(ctx, "MEGABM_BLK", 48, 96)
      ctx.restore()
      return true
    case Obj.PULSE_CANNON:
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(50, 96 - i * 4, 26 + i * 18, Math.PI * 1.2, Math.PI * 1.8)
        ctx.strokeStyle = c
        ctx.globalAlpha = 1 - i * 0.25
        ctx.lineWidth = 7
        ctx.lineCap = "round"
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      glow(ctx, 50, 70, 24, c)
      return true
    case Obj.FORWARD_LASER:
      beam(ctx, 34, 4, 96, 8, c)
      beam(ctx, 66, 4, 96, 8, c)
      return true
    case Obj.DEATH_RAY:
      beam(ctx, 50, 0, 100, 18, c)
      glow(ctx, 50, 84, 30, c)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        line(
          ctx,
          [
            [50 + Math.cos(a) * 20, 84 + Math.sin(a) * 20],
            [50 + Math.cos(a) * 34, 84 + Math.sin(a) * 34],
          ],
          c,
          3,
        )
      }
      return true
    case Obj.SUPER_SHIELD:
      ctx.beginPath()
      ctx.moveTo(50, 8)
      ctx.lineTo(86, 22)
      ctx.quadraticCurveTo(86, 70, 50, 94)
      ctx.quadraticCurveTo(14, 70, 14, 22)
      ctx.closePath()
      ctx.fillStyle = "rgba(70,224,255,0.18)"
      ctx.fill()
      ctx.strokeStyle = c
      ctx.lineWidth = 6
      ctx.stroke()
      glow(ctx, 50, 46, 26, c)
      return true
    case Obj.ENERGY:
      ctx.beginPath()
      ctx.roundRect(26, 16, 48, 78, 8)
      ctx.strokeStyle = c
      ctx.lineWidth = 6
      ctx.stroke()
      ctx.fillStyle = c
      ctx.fillRect(40, 6, 20, 10)
      ctx.globalAlpha = 0.45
      ctx.fillRect(33, 56, 34, 31)
      ctx.globalAlpha = 1
      line(
        ctx,
        [
          [50, 30],
          [50, 62],
        ],
        "#ffffff",
        7,
      )
      line(
        ctx,
        [
          [34, 46],
          [66, 46],
        ],
        "#ffffff",
        7,
      )
      return true
    case Obj.DETECT:
      ring(ctx, 50, 50, 40, "#46e0ff", 4)
      ring(ctx, 50, 50, 22, "rgba(70,224,255,0.5)", 3)
      ctx.beginPath()
      ctx.moveTo(50, 50)
      ctx.arc(50, 50, 40, -Math.PI / 2, -Math.PI / 8)
      ctx.closePath()
      ctx.fillStyle = "rgba(70,224,255,0.35)"
      ctx.fill()
      glow(ctx, 70, 34, 10, "#ff4050")
      return true
    default:
      return false
  }
}

/** Item icon in an `s` x `s` box at (x, y); money types draw nothing and return false. */
export function drawIcon(ctx: Ctx, type: number, x: number, y: number, s: number): boolean {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s / 100, s / 100)
  const ok = drawGlyph(ctx, type, ICON_COLOR[type] ?? "#ffffff")
  ctx.restore()
  return ok
}

/** Hex badge pickup / HUD icon (money types become a golden crystal). */
export function drawPickup(ctx: Ctx, type: number, s: number): void {
  const cx = s / 2
  const cy = s / 2
  const color = ICON_COLOR[type]
  if (!color) {
    // credits / energy crystal
    polyPath(ctx, [
      [cx, s * 0.08],
      [s * 0.8, cy],
      [cx, s * 0.92],
      [s * 0.2, cy],
    ])
    metal(ctx, s * 0.2, s * 0.8, "#6b4a00", "#ffc83d", "#fff6c8", ["rgba(255,255,255,0.6)", 1.5])
    glow(ctx, cx, cy, s * 0.3, "#ffd23d")
    return
  }
  glow(ctx, cx, cy, s * 0.5, color, color)
  const pts: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    pts.push([cx + Math.cos(a) * s * 0.46, cy + Math.sin(a) * s * 0.46])
  }
  polyPath(ctx, pts)
  ctx.fillStyle = "rgba(10,14,24,0.85)"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = color
  ctx.stroke()
  drawIcon(ctx, type, s * 0.22, s * 0.22, s * 0.56)
}

/** Touch button glyphs (100 box): `auto` = twin plasma bolts in a burst, `cycle` = missile in a swap ring. */
export function drawButtonIcon(ctx: Ctx, kind: "auto" | "cycle", s: number): void {
  ctx.save()
  ctx.scale(s / 100, s / 100)
  if (kind === "auto") {
    const c = "#7dff9a"
    for (const [x, y] of [
      [34, 20],
      [66, 20],
      [34, 56],
      [66, 56],
    ] as const) {
      const big = y === 20
      ctx.beginPath()
      ctx.roundRect(x - 6, y, 12, big ? 34 : 24, 6)
      ctx.fillStyle = big ? "#f2fff5" : "rgba(125,255,154,0.55)"
      ctx.fill()
      glow(ctx, x, y + (big ? 17 : 12), big ? 24 : 16, c)
    }
  } else {
    const c = "#39d0ff"
    for (const a0 of [0.25, 1.25]) {
      const a1 = a0 + 0.6
      ctx.beginPath()
      ctx.arc(50, 50, 40, a0 * Math.PI, a1 * Math.PI)
      ctx.strokeStyle = c
      ctx.lineWidth = 6
      ctx.lineCap = "round"
      ctx.stroke()
      const ex = 50 + Math.cos(a1 * Math.PI) * 40
      const ey = 50 + Math.sin(a1 * Math.PI) * 40
      const t = a1 * Math.PI + Math.PI / 2
      polyPath(ctx, [
        [ex + Math.cos(t) * 12, ey + Math.sin(t) * 12],
        [ex + Math.cos(t + 2.4) * 11, ey + Math.sin(t + 2.4) * 11],
        [ex + Math.cos(t - 2.4) * 11, ey + Math.sin(t - 2.4) * 11],
      ])
      ctx.fillStyle = c
      ctx.fill()
    }
    missile(ctx, 50, 24, 42, 9, c)
  }
  ctx.restore()
}
