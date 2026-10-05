// Mission briefing backdrops (Hangar launch screen): a tactical war room per sector (`drawBriefing`,
// boss scan table + empty intel cards) and a per-wave overlay (`drawBriefingUnits`) with the wave's
// boss on the table and four signature enemies on the cards. Bravo = hostile red/orange with the
// real enemy art, Training = cyan simulator with the hologram target drones.
import { waveMap } from "../campaign"
import { ENEMY_LIB } from "../data/ep1"
import type { Sector } from "../data/save"
import { type Ctx, glow, polyPath, roundRect, seeded } from "./draw"
import { drawUnit } from "./ships"

const TABLE: [number, number] = [230, 220]
const CARD = { x: 26, y: 430, step: 104 }

/**
 * Unit art centered at (x, y), aspect kept, fitted into an s x s box. `last` draws the last
 * animation frame (bosses: the hive has fully emerged), else the first.
 */
function unit(
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  s: number,
  train: boolean,
  last = false,
) {
  const e = ENEMY_LIB.find((l) => l.iname === name)
  const [pw, ph] = [e?.w || 1, e?.h || 1]
  const frames = Math.max(1, e?.num_frames ?? 1)
  const k = s / Math.max(pw, ph)
  ctx.save()
  ctx.translate(x - (pw * k) / 2, y - (ph * k) / 2)
  drawUnit(ctx, name, pw * k, ph * k, last ? frames - 1 : 0, frames, train)
  ctx.restore()
}

/** Pictures spawned by a sector wave (spawn order), library entries without art skipped. */
function wavePics(sector: Sector, wave: number): string[] {
  const names = new Set<string>()
  for (const s of waveMap(sector, wave).map?.spawns ?? []) {
    const e = ENEMY_LIB[s[1] ?? 0]
    if (e?.w) names.add(e.iname)
  }
  return [...names]
}

/**
 * Briefing units of a sector wave: the toughest boss, and 4 signature enemies (real enemies only,
 * no bonus carriers or critters): first the types new to this wave, then the most frequent.
 */
export function briefingUnits(sector: Sector, wave: number): { boss?: string; intel: string[] } {
  const lib = (n: string) => ENEMY_LIB.find((e) => e.iname === n)
  const count = new Map<string, number>()
  for (const s of waveMap(sector, wave).map?.spawns ?? []) {
    const n = ENEMY_LIB[s[1] ?? 0]?.iname ?? ""
    count.set(n, (count.get(n) ?? 0) + 1)
  }
  const pics = wavePics(sector, wave)
  const boss = pics
    .filter((n) => lib(n)?.bossflag)
    .sort((a, b) => (lib(b)?.hits ?? 0) - (lib(a)?.hits ?? 0))[0]
  const seen = new Set<string>()
  for (let w = 0; w < wave; w++) for (const n of wavePics(sector, w)) seen.add(n)
  const intel = pics
    .filter((n) => /^(SHIP|TARG)/.test(n) && !lib(n)?.bossflag && (lib(n)?.bonus ?? -1) < 0)
    .sort(
      (a, b) =>
        Number(seen.has(a)) - Number(seen.has(b)) || (count.get(b) ?? 0) - (count.get(a) ?? 0),
    )
    .slice(0, 4)
  return { boss, intel }
}

/** Per-wave overlay for `drawBriefing`: the boss hologram and the intel card units. */
export function drawBriefingUnits(ctx: Ctx, sector: Sector, wave: number): void {
  const train = sector === "train"
  const { boss, intel } = briefingUnits(sector, wave)
  if (boss) {
    ctx.globalAlpha = 0.8
    unit(ctx, boss, TABLE[0], TABLE[1], 190, train, true)
    ctx.globalAlpha = 1
  }
  intel.forEach((name, i) => {
    unit(ctx, name, CARD.x + i * CARD.step + 48, CARD.y + 46, 70, train)
  })
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
  const [tx] = TABLE
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
  ctx.strokeStyle = c(0.8)
  ctx.lineWidth = 2
  brackets(ctx, tx - 105, 120, 210, 200, 22)
  ctx.fillStyle = c(0.9)
  ctx.font = "bold 13px monospace"
  ctx.fillText(train ? "SIM TARGET // CORE" : "PRIORITY TARGET", tx - 100, 114)
  // intel cards (the wave's units: drawBriefingUnits)
  for (let i = 0; i < 4; i++) {
    const x = CARD.x + i * CARD.step
    const y = CARD.y
    roundRect(ctx, x, y, 96, 112, 6)
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fill()
    ctx.strokeStyle = c(0.4)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = c(0.25)
    ctx.fillRect(x + 8, y + 92, 80, 4)
    ctx.fillStyle = c(0.8)
    ctx.fillRect(x + 8, y + 92, 20 + r() * 60, 4)
    ctx.fillRect(x + 8, y + 100, 12 + r() * 40, 2)
  }
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
