// Canvas2D helpers for the procedural art (modern vector look: gradients, rim light, glow).

export type Ctx = CanvasRenderingContext2D
export type Pt = [number, number]

/** Deterministic PRNG for art variation (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ (s.codePointAt(i) as number), 16777619)
  return h >>> 0
}

/** Polygon from the right half (x >= 0 relative to cx), mirrored to the left. */
export function mirrorPath(ctx: Ctx, cx: number, half: Pt[]): void {
  ctx.beginPath()
  half.forEach(([x, y], i) => {
    if (i) ctx.lineTo(cx + x, y)
    else ctx.moveTo(cx + x, y)
  })
  for (let i = half.length - 1; i >= 0; i--) {
    const p = half[i] as Pt
    ctx.lineTo(cx - p[0], p[1])
  }
  ctx.closePath()
}

export function polyPath(ctx: Ctx, pts: Pt[]): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  })
  ctx.closePath()
}

/** Metallic fill: horizontal cylinder shading + top light, then a thin rim stroke. */
export function metal(
  ctx: Ctx,
  x0: number,
  x1: number,
  dark: string,
  mid: string,
  light: string,
  [rim, rimWidth]: [string, number] = ["rgba(255,255,255,0.35)", 1.5],
): void {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, dark)
  g.addColorStop(0.35, mid)
  g.addColorStop(0.5, light)
  g.addColorStop(0.65, mid)
  g.addColorStop(1, dark)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = rimWidth
  ctx.strokeStyle = rim
  ctx.stroke()
}

export function glow(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  core = "#ffffff",
): void {
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, core)
  g.addColorStop(0.25, color)
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function panelLines(ctx: Ctx, lines: [Pt, Pt][], color = "rgba(0,0,0,0.35)", w = 1): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  for (const [a, b] of lines) {
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
  }
  ctx.stroke()
  ctx.restore()
}

/** Glassy cockpit / sensor dome. */
export function canopy(ctx: Ctx, x: number, y: number, rx: number, ry: number, tint: string): void {
  ctx.save()
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry))
  g.addColorStop(0, "#ffffff")
  g.addColorStop(0.2, tint)
  g.addColorStop(1, "rgba(0,0,0,0.9)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.4)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
}

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const ctx = c.getContext("2d", { willReadFrequently: false })
  if (!ctx) throw new Error("no 2d context")
  return { c, ctx }
}

/** Training target marker: alternating rings with a bright center. */
export function bullseye(ctx: Ctx, x: number, y: number, r: number, ring = "#ffae2e"): void {
  ctx.save()
  for (let i = 3; i > 0; i--) {
    ctx.beginPath()
    ctx.arc(x, y, (r * i) / 3, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 ? ring : "rgba(8,12,20,0.85)"
    ctx.fill()
  }
  ctx.restore()
  glow(ctx, x, y, r * 0.45, ring, "#fff6d0")
}
