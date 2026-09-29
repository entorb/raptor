// Supply shop backdrop: armory wall with weapon racks, a porthole on space, holo glow and a
// gridded floor (all procedural).
import { type Ctx, glow, metal, polyPath, roundRect, seeded } from "./draw"
import { drawIcon } from "./icons"

/** Rack of missiles hanging on the wall at (x, y). */
function rack(ctx: Ctx, x: number, y: number, n: number, len: number, tint: string): void {
  roundRect(ctx, x - 10, y - 8, n * 34 + 4, 10, 3)
  ctx.fillStyle = "#2a3446"
  ctx.fill()
  for (let i = 0; i < n; i++) {
    const mx = x + 7 + i * 34
    polyPath(ctx, [
      [mx, y + len + 18],
      [mx + 7, y + len],
      [mx + 7, y + 6],
      [mx - 7, y + 6],
      [mx - 7, y + len],
    ])
    metal(ctx, mx - 7, mx + 7, "#1b2230", "#4c586c", "#a8b4c8", ["rgba(0,0,0,0.5)", 1])
    ctx.fillStyle = tint
    ctx.fillRect(mx - 7, y + len * 0.3, 14, 4)
  }
}

export function drawShop(ctx: Ctx, w: number, h: number): void {
  const r = seeded(11)
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, h)
  wall.addColorStop(0, "#0a101c")
  wall.addColorStop(0.7, "#141d2e")
  wall.addColorStop(1, "#070a12")
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, w, h)
  // wall panels
  ctx.strokeStyle = "rgba(120,160,220,0.08)"
  ctx.lineWidth = 2
  for (let x = 0; x < w; x += 120) ctx.strokeRect(x + 4, 4, 112, h * 0.72)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgba(160,190,230,0.12)"
    ctx.fillRect(
      Math.floor(r() * 8) * 120 + 10 + Math.floor(r() * 2) * 96,
      10 + r() * h * 0.68,
      3,
      3,
    )
  }
  // porthole on space (top center, behind the title)
  const g = ctx.createRadialGradient(w / 2, 70, 0, w / 2, 70, 180)
  g.addColorStop(0, "#1b2c56")
  g.addColorStop(1, "#05060d")
  ctx.beginPath()
  ctx.ellipse(w / 2, 70, 190, 60, 0, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`
    ctx.fillRect(w / 2 + Math.cos(a) * d * 180, 70 + Math.sin(a) * d * 54, 1.5, 1.5)
  }
  ctx.strokeStyle = "#39465e"
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.strokeStyle = "rgba(57,208,255,0.35)"
  ctx.lineWidth = 2
  ctx.stroke()
  // weapon racks on the side walls
  rack(ctx, 22, 150, 3, 90, "#ff7a2e")
  rack(ctx, 22, 300, 3, 70, "#ffe066")
  rack(ctx, 845, 150, 3, 90, "#9fb7ff")
  rack(ctx, 845, 300, 3, 70, "#ff5050")
  // holo display cases with item icons along the back wall
  const cases: [number, number][] = [
    [120, 470],
    [300, 480],
    [660, 480],
    [840, 470],
  ]
  const shown = [1, 12, 14, 15]
  cases.forEach(([x, y], i) => {
    polyPath(ctx, [
      [x - 60, y],
      [x + 60, y],
      [x + 48, y + 26],
      [x - 48, y + 26],
    ])
    metal(ctx, x - 60, x + 60, "#121826", "#2c3648", "#56657e", ["rgba(57,208,255,0.5)", 1.5])
    const beamG = ctx.createLinearGradient(0, y - 110, 0, y)
    beamG.addColorStop(0, "rgba(57,208,255,0)")
    beamG.addColorStop(1, "rgba(57,208,255,0.22)")
    ctx.fillStyle = beamG
    polyPath(ctx, [
      [x - 40, y - 110],
      [x + 40, y - 110],
      [x + 52, y],
      [x - 52, y],
    ])
    ctx.fill()
    ctx.globalAlpha = 0.55
    drawIcon(ctx, shown[i] ?? 0, x - 30, y - 90, 60)
    ctx.globalAlpha = 1
  })
  // floor with grid
  const fy = h * 0.8
  const floor = ctx.createLinearGradient(0, fy, 0, h)
  floor.addColorStop(0, "#0d1422")
  floor.addColorStop(1, "#04060b")
  ctx.fillStyle = floor
  ctx.fillRect(0, fy + 20, w, h - fy)
  ctx.strokeStyle = "rgba(57,208,255,0.12)"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = -12; i <= 12; i++) {
    ctx.moveTo(w / 2 + i * 40, fy + 20)
    ctx.lineTo(w / 2 + i * 140, h)
  }
  for (let y = fy + 30; y < h; y += (y - fy) * 0.35 + 6) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
  // ceiling light strip
  glow(ctx, w / 2, 0, 260, "rgba(57,208,255,0.35)", "rgba(200,240,255,0.4)")
}
