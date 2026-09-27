// Hangar bay backdrop: one-point perspective hall whose back wall is an open bay door
// (transparent, the animated star layers and the dogfight show through it).
import { glow, type Pt, panelLines, polyPath, seeded } from "./draw"

type Ctx = CanvasRenderingContext2D

/** Bay door (back wall) in canvas pixels; the dogfight flies inside it. */
export const BAY = { x0: 180, y0: 40, x1: 780, y1: 320 }
/** Landing pad center; the pad and the parked ship are squashed by PAD_TILT (floor perspective). */
export const PAD: Pt = [180, 480]
export const PAD_TILT = 0.38

function fillPoly(ctx: Ctx, pts: Pt[], fill: string | CanvasGradient): void {
  polyPath(ctx, pts)
  ctx.fillStyle = fill
  ctx.fill()
}

export function drawHangar(ctx: Ctx, w: number, h: number): void {
  const { x0, y0, x1, y1 } = BAY
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

  const vert = (y: number, top: string, bottom: string) => {
    const g = ctx.createLinearGradient(0, 0, 0, y)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    return g
  }
  // ceiling, floor, side walls
  fillPoly(
    ctx,
    [
      [0, 0],
      [w, 0],
      [x1, y0],
      [x0, y0],
    ],
    vert(y0, "#0c1422", "#1b2638"),
  )
  const floor = ctx.createLinearGradient(0, y1, 0, h)
  floor.addColorStop(0, "#1a2233")
  floor.addColorStop(1, "#0a0f18")
  fillPoly(
    ctx,
    [
      [x0, y1],
      [x1, y1],
      [w, h],
      [0, h],
    ],
    floor,
  )
  const side = (x: number, xin: number) => {
    const g = ctx.createLinearGradient(x, 0, xin, 0)
    g.addColorStop(0, "#0b111c")
    g.addColorStop(1, "#1f2a3d")
    return g
  }
  fillPoly(
    ctx,
    [
      [0, 0],
      [x0, y0],
      [x0, y1],
      [0, h],
    ],
    side(0, x0),
  )
  fillPoly(
    ctx,
    [
      [w, 0],
      [x1, y0],
      [x1, y1],
      [w, h],
    ],
    side(w, x1),
  )

  // floor grid converging to the vanishing point, cross lines spaced in depth
  const lines: [Pt, Pt][] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    lines.push([lerp([x0, y1], [x1, y1], t), lerp([0, h], [w, h], t)])
  }
  for (let i = 1; i < 8; i++) {
    const t = (i / 8) ** 1.8
    lines.push([lerp([x0, y1], [0, h], t), lerp([x1, y1], [w, h], t)])
  }
  panelLines(ctx, lines, "rgba(120,170,230,0.12)", 1)

  // wall ribs and ceiling beams
  const ribs: [Pt, Pt][] = []
  for (let i = 1; i < 6; i++) {
    const t = (i / 6) ** 1.6
    const l0 = lerp([x0, y0], [0, 0], t)
    const l1 = lerp([x0, y1], [0, h], t)
    const r0 = lerp([x1, y0], [w, 0], t)
    const r1 = lerp([x1, y1], [w, h], t)
    ribs.push([l0, l1], [r0, r1], [l0, r0])
  }
  panelLines(ctx, ribs, "rgba(0,0,0,0.55)", 5)
  panelLines(ctx, ribs, "rgba(150,190,240,0.10)", 1)

  // light strips along the floor edges and ceiling lamps
  const strip = (a: Pt, b: Pt) => panelLines(ctx, [[a, b]], "rgba(57,208,255,0.55)", 2)
  strip([x0, y1 - 4], [0, h - 20])
  strip([x1, y1 - 4], [w, h - 20])
  for (let i = 1; i < 6; i++) {
    const t = (i / 6) ** 1.6
    const [lx, ly] = lerp([x0 + 60, y0], [220, 0], t)
    const [rx, ry] = lerp([x1 - 60, y0], [w - 220, 0], t)
    glow(ctx, lx, ly + 4, 10 + t * 26, "rgba(160,220,255,0.35)")
    glow(ctx, rx, ry + 4, 10 + t * 26, "rgba(160,220,255,0.35)")
  }

  // status lights on the side walls; t = depth (0 at the bay door, 1 at the screen edge)
  const r = seeded(7)
  for (let i = 0; i < 28; i++) {
    const t = 0.1 + r() * 0.75
    const top = y0 * (1 - t)
    const bottom = y1 + (h - y1) * t
    const y = top + (bottom - top) * (0.25 + r() * 0.5)
    const x = i % 2 ? w - x0 * (1 - t) : x0 * (1 - t)
    const col = r() < 0.7 ? "rgba(57,208,255,0.8)" : "rgba(255,90,106,0.8)"
    glow(ctx, x, y, 3 + t * 5, col)
  }

  // bay door frame with hazard stripes and a faint force field
  ctx.save()
  ctx.strokeStyle = "#2c3a52"
  ctx.lineWidth = 12
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
  ctx.beginPath()
  ctx.rect(x0 - 6, y1 - 2, x1 - x0 + 12, 10)
  ctx.clip()
  for (let x = x0 - 20; x < x1 + 20; x += 24) {
    fillPoly(
      ctx,
      [
        [x, y1 + 8],
        [x + 12, y1 + 8],
        [x + 24, y1 - 2],
        [x + 12, y1 - 2],
      ],
      "#e0b020",
    )
  }
  ctx.restore()
  panelLines(
    ctx,
    [
      [
        [x0, y0],
        [x1, y0],
      ],
    ],
    "rgba(57,208,255,0.6)",
    2,
  )
  const field = ctx.createLinearGradient(0, y0, 0, y1)
  field.addColorStop(0, "rgba(57,208,255,0.05)")
  field.addColorStop(1, "rgba(57,208,255,0.14)")
  ctx.fillStyle = field
  ctx.fillRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12)

  // landing pad (the pilot's ship parks there)
  {
    const [px, py] = PAD
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(1, PAD_TILT)
    ctx.beginPath()
    ctx.arc(0, 0, 110, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(10,16,26,0.8)"
    ctx.fill()
    ctx.lineWidth = 6
    ctx.setLineDash([22, 14])
    ctx.strokeStyle = "rgba(224,176,32,0.75)"
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(57,208,255,0.6)"
    ctx.beginPath()
    ctx.arc(0, 0, 80, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}
