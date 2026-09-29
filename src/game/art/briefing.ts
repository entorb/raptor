// Mission briefing backdrops (Hangar launch screen), one per sector: a tactical war room with the
// sector's boss on a scan table and intel cards of its enemy types. Bravo = hostile red/orange
// with the real enemy art, Training = cyan simulator with the hologram target drones.
import { type Ctx, glow, polyPath, roundRect, seeded } from "./draw"
import { drawUnit } from "./ships"

const BOSS = "SHIP10G1_PIC"
const INTEL = ["SHIP01G1_PIC", "SHIP03G1_PIC", "SHIP19G1_PIC", "SHIP02G1_PIC"]
/** Training: one per drone role, so no two cards look alike. */
const INTEL_TRAIN = ["SHIP01G1_PIC", "SHIP04G1_PIC", "SHIP19G1_PIC", "TARGT1G1_PIC"]

/** Unit art centered at (x, y) in an s x s box. */
function unit(ctx: Ctx, name: string, x: number, y: number, s: number, train: boolean): void {
  ctx.save()
  ctx.translate(x - s / 2, y - s / 2)
  drawUnit(ctx, name, s, s, 0, 1, train)
  ctx.restore()
}

/** Corner brackets around a box (scan target marker). */
function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, len: number): void {
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ] as const) {
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
  }
  ctx.stroke()
}

export function drawBriefing(ctx: Ctx, w: number, h: number, train: boolean): void {
  const r = seeded(train ? 21 : 22)
  const [rgb, bg0, bg1] = train
    ? ["93,255,200", "#03101a", "#020608"]
    : ["255,110,60", "#1a0808", "#070304"]
  const c = (a: number) => `rgba(${rgb},${a})`
  // room
  const wall = ctx.createLinearGradient(0, 0, 0, h)
  wall.addColorStop(0, bg1)
  wall.addColorStop(0.55, bg0)
  wall.addColorStop(1, bg1)
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, w, h)
  // wall grid (training) / hazard scan lines (bravo)
  ctx.strokeStyle = c(0.06)
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= w; x += train ? 40 : 120) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = 0; y <= h; y += train ? 40 : 6) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
  // scan table: perspective disc with range rings under the boss
  const tx = 230
  const ty = 330
  ctx.save()
  ctx.translate(tx, ty)
  ctx.scale(1, 0.38)
  const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, 200)
  disc.addColorStop(0, c(0.25))
  disc.addColorStop(1, c(0))
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(0, 0, 200, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = c(0.35)
  ctx.lineWidth = 2
  for (const rad of [60, 120, 180]) {
    ctx.beginPath()
    ctx.arc(0, 0, rad, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30)
    ctx.lineTo(Math.cos(a) * 190, Math.sin(a) * 190)
  }
  ctx.stroke()
  // contacts on the disc
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2
    const d = 50 + r() * 140
    glow(ctx, Math.cos(a) * d, Math.sin(a) * d, 10, c(0.8), c(1))
  }
  ctx.restore()
  // projector beam + boss hologram
  const beam = ctx.createLinearGradient(0, 120, 0, ty)
  beam.addColorStop(0, c(0))
  beam.addColorStop(1, c(0.16))
  ctx.fillStyle = beam
  polyPath(ctx, [
    [tx - 120, 120],
    [tx + 120, 120],
    [tx + 40, ty],
    [tx - 40, ty],
  ])
  ctx.fill()
  ctx.globalAlpha = 0.75
  unit(ctx, BOSS, tx, 220, 190, train)
  ctx.globalAlpha = 1
  ctx.strokeStyle = c(0.8)
  ctx.lineWidth = 2
  brackets(ctx, tx - 105, 120, 210, 200, 22)
  ctx.fillStyle = c(0.9)
  ctx.font = "bold 13px monospace"
  ctx.fillText(train ? "SIM TARGET // CORE" : "PRIORITY TARGET", tx - 100, 114)
  // intel cards: the sector's enemy types
  const intel = train ? INTEL_TRAIN : INTEL
  intel.forEach((name, i) => {
    const x = 26 + i * 104
    const y = 430
    roundRect(ctx, x, y, 96, 112, 6)
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fill()
    ctx.strokeStyle = c(0.4)
    ctx.lineWidth = 1.5
    ctx.stroke()
    unit(ctx, name, x + 48, y + 48, 70, train)
    ctx.fillStyle = c(0.25)
    ctx.fillRect(x + 8, y + 92, 80, 4)
    ctx.fillStyle = c(0.8)
    ctx.fillRect(x + 8, y + 92, 20 + r() * 60, 4)
    ctx.fillRect(x + 8, y + 100, 12 + r() * 40, 2)
  })
  // right edge: signal bars
  for (let i = 0; i < 18; i++) {
    const y = 150 + i * 22
    const len = 20 + r() * 80
    ctx.fillStyle = c(0.12)
    ctx.fillRect(w - 116, y, 100, 8)
    ctx.fillStyle = c(0.5)
    ctx.fillRect(w - 116, y, len, 8)
  }
  // ceiling light
  glow(ctx, w / 2, 0, 300, c(0.3), c(0.35))
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, w * 0.7)
  v.addColorStop(0, "rgba(0,0,0,0)")
  v.addColorStop(1, "rgba(0,0,0,0.6)")
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}
