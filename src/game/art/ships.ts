// Procedural ship / unit art. Every original SPRITE1_ITM picture name maps to an archetype that
// is drawn at 3x its original size (same hitbox), nose pointing down (enemies fly towards the
// player). Animated originals get `frames` variants (rotation, light pulses, treads).
import {
  bullseye,
  type Ctx,
  canopy,
  glow,
  hashString,
  metal,
  mirrorPath,
  type Pt,
  panelLines,
  polyPath,
  roundRect,
  seeded,
} from "./draw"

export interface Palette {
  dark: string
  mid: string
  light: string
  accent: string
  engine: string
  glass: string
}

export const ENEMY_PAL: Palette = {
  dark: "#161a22",
  mid: "#465062",
  light: "#b9c3d6",
  accent: "#ff3d4a",
  engine: "#ff7a2e",
  glass: "#ff5a3c",
}
const ELITE_PAL: Palette = {
  ...ENEMY_PAL,
  mid: "#4b3f66",
  light: "#c9b8ea",
  accent: "#c04dff",
  glass: "#d77bff",
}
const BOSS_PAL: Palette = { ...ENEMY_PAL, dark: "#12141a", mid: "#3a3f4c", light: "#9aa3b5" }
const GROUND_PAL: Palette = {
  dark: "#1e1c18",
  mid: "#5b5242",
  light: "#cdbb92",
  accent: "#2effb4",
  engine: "#2effb4",
  glass: "#46e0ff",
}
export const PLAYER_PAL: Palette = {
  dark: "#0f1c33",
  mid: "#3f6fb8",
  light: "#eaf4ff",
  accent: "#39d0ff",
  engine: "#39d0ff",
  glass: "#7fe7ff",
}

type Draw = (ctx: Ctx, w: number, h: number, t: number, r: () => number, p: Palette) => void

function engines(ctx: Ctx, xs: number[], y: number, r: number, color: string): void {
  for (const x of xs) glow(ctx, x, y, r, color)
}

/** Slim interceptor with swept wings. */
const interceptor: Draw = (ctx, w, h, _t, r, p) => {
  const cx = w / 2
  const span = w * (0.42 + r() * 0.06)
  const sweep = r() * 0.3
  mirrorPath(ctx, cx, [
    [w * 0.05, h * 0.02],
    [w * 0.09, h * 0.35],
    [span, h * (0.45 + sweep)],
    [span * 0.95, h * (0.62 + sweep * 0.5)],
    [w * 0.12, h * 0.62],
    [w * 0.06, h * 0.98],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  mirrorPath(ctx, cx, [
    [w * 0.09, h * 0.1],
    [w * 0.12, h * 0.55],
    [w * 0.04, h * 0.85],
  ])
  ctx.fillStyle = "rgba(0,0,0,0.25)"
  ctx.fill()
  panelLines(ctx, [
    [
      [cx - span * 0.8, h * (0.5 + sweep)],
      [cx - w * 0.1, h * 0.45],
    ],
    [
      [cx + span * 0.8, h * (0.5 + sweep)],
      [cx + w * 0.1, h * 0.45],
    ],
  ])
  canopy(ctx, cx, h * 0.7, w * 0.05, h * 0.1, p.glass)
  glow(ctx, cx - span * 0.9, h * (0.52 + sweep), w * 0.05, p.accent)
  glow(ctx, cx + span * 0.9, h * (0.52 + sweep), w * 0.05, p.accent)
  engines(ctx, [cx], h * 0.08, w * 0.14, p.engine)
}

/** Delta-wing fighter. */
const delta: Draw = (ctx, w, h, _t, r, p) => {
  const cx = w / 2
  const notch = 0.1 + r() * 0.15
  mirrorPath(ctx, cx, [
    [w * 0.12, h * 0.02],
    [w * 0.48, h * (0.18 + notch)],
    [w * 0.46, h * 0.36],
    [w * 0.18, h * 0.5],
    [w * 0.07, h * 0.98],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  mirrorPath(ctx, cx, [
    [w * 0.3, h * (0.2 + notch)],
    [w * 0.36, h * 0.3],
    [w * 0.2, h * 0.36],
  ])
  ctx.fillStyle = p.accent
  ctx.globalAlpha = 0.7
  ctx.fill()
  ctx.globalAlpha = 1
  canopy(ctx, cx, h * 0.62, w * 0.07, h * 0.14, p.glass)
  engines(ctx, [cx - w * 0.12, cx + w * 0.12], h * 0.08, w * 0.12, p.engine)
}

/** Boxy gunship with side pods. */
const gunship: Draw = (ctx, w, h, t, r, p) => {
  const cx = w / 2
  const podW = w * (0.16 + r() * 0.06)
  const pods = [podW / 2, w - podW / 2]
  for (const x of pods) {
    roundRect(ctx, x - podW / 2 + 1, h * 0.1, podW - 2, h * 0.8, podW / 2)
    metal(ctx, x - podW / 2, x + podW / 2, p.dark, p.mid, p.light)
  }
  mirrorPath(ctx, cx, [
    [w * 0.18, h * 0.05],
    [w * 0.3, h * 0.25],
    [w * 0.3, h * 0.75],
    [w * 0.14, h * 0.97],
  ])
  metal(ctx, cx - w * 0.3, cx + w * 0.3, p.dark, p.mid, p.light)
  panelLines(ctx, [
    [
      [cx - w * 0.25, h * 0.4],
      [cx + w * 0.25, h * 0.4],
    ],
    [
      [cx - w * 0.25, h * 0.6],
      [cx + w * 0.25, h * 0.6],
    ],
    [
      [cx, h * 0.1],
      [cx, h * 0.4],
    ],
  ])
  canopy(ctx, cx, h * 0.8, w * 0.08, h * 0.08, p.glass)
  const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 2)
  for (const x of pods) glow(ctx, x, h * 0.85, w * 0.06 * (0.8 + pulse * 0.4), p.accent)
  engines(ctx, [...pods, cx], h * 0.08, w * 0.1, p.engine)
}

/** Spinning drone: core + rotating blades (animated). */
const drone: Draw = (ctx, w, h, t, r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.48
  const blades = 3 + Math.floor(r() * 2)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI * 2)
  for (let i = 0; i < blades; i++) {
    ctx.rotate((Math.PI * 2) / blades)
    polyPath(ctx, [
      [-R * 0.12, 0],
      [R * 0.12, 0],
      [R * 0.3, R],
      [-R * 0.05, R * 0.95],
    ])
    metal(ctx, -R * 0.3, R * 0.3, p.dark, p.mid, p.light)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2)
  metal(ctx, cx - R * 0.45, cx + R * 0.45, p.dark, p.mid, p.light)
  glow(ctx, cx, cy, R * 0.45, p.accent)
}

/** Armored orb with a glowing eye. */
const orb: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.47
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R)
  g.addColorStop(0, p.light)
  g.addColorStop(0.5, p.mid)
  g.addColorStop(1, p.dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.3)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  panelLines(ctx, [
    [
      [cx - R, cy],
      [cx + R, cy],
    ],
    [
      [cx, cy - R],
      [cx, cy + R],
    ],
  ])
  const open = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  ctx.fillStyle = "#050507"
  ctx.beginPath()
  ctx.ellipse(cx, cy + R * 0.25, R * 0.35, R * 0.1 + R * 0.18 * open, 0, 0, Math.PI * 2)
  ctx.fill()
  glow(ctx, cx, cy + R * 0.25, R * (0.25 + 0.2 * open), p.accent)
}

/** Heavy cruiser (long hull with modules). */
const cruiser: Draw = (ctx, w, h, _t, r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.14, h * 0.0],
    [w * 0.22, h * 0.12],
    [w * 0.48, h * 0.3],
    [w * 0.48, h * 0.48],
    [w * 0.24, h * 0.56],
    [w * 0.2, h * 0.9],
    [w * 0.08, h * 1.0],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  for (let i = 0; i < 4; i++) {
    const y = h * (0.15 + i * 0.18)
    roundRect(ctx, cx - w * 0.12, y, w * 0.24, h * 0.12, 3)
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.fill()
    glow(ctx, cx, y + h * 0.06, w * 0.03, i % 2 ? p.accent : p.engine)
  }
  for (const s of [-1, 1]) {
    canopy(ctx, cx + s * w * 0.38, h * 0.4, w * 0.05, w * 0.05, p.glass)
    glow(ctx, cx + s * w * 0.46, h * 0.39, w * 0.03 + r() * 2, p.accent)
  }
  engines(ctx, [cx - w * 0.14, cx, cx + w * 0.14], h * 0.03, w * 0.08, p.engine)
}

/** Capital ship boss: wide hull, twin nacelles, turret domes, reactor lights. */
const capital: Draw = (ctx, w, h, t, r, p) => {
  const cx = w / 2
  const nac = w * (0.14 + r() * 0.05)
  for (const s of [-1, 1]) {
    const x = cx + s * (w / 2 - nac / 2) - nac / 2
    roundRect(ctx, x, h * 0.02, nac, h * 0.92, nac * 0.45)
    metal(ctx, x, x + nac, p.dark, p.mid, p.light)
    for (let i = 0; i < 3; i++)
      glow(ctx, x + nac / 2, h * (0.2 + i * 0.25), nac * 0.2, p.accent, "#ffd0c0")
  }
  mirrorPath(ctx, cx, [
    [w * 0.2, h * 0.04],
    [w * 0.36, h * 0.18],
    [w * 0.36, h * 0.7],
    [w * 0.22, h * 0.96],
    [w * 0.08, h * 1.0],
  ])
  metal(ctx, cx - w * 0.36, cx + w * 0.36, p.dark, p.mid, p.light)
  const lines: [Pt, Pt][] = []
  for (let i = 1; i < 6; i++)
    lines.push([
      [cx - w * 0.34, h * (i / 6)],
      [cx + w * 0.34, h * (i / 6)],
    ])
  lines.push(
    [
      [cx - w * 0.12, h * 0.1],
      [cx - w * 0.12, h * 0.9],
    ],
    [
      [cx + w * 0.12, h * 0.1],
      [cx + w * 0.12, h * 0.9],
    ],
  )
  panelLines(ctx, lines)
  const domes = 2 + Math.floor(r() * 3)
  for (let i = 0; i < domes; i++) {
    const y = h * (0.2 + (0.6 * i) / Math.max(1, domes - 1))
    for (const s of [-1, 1]) canopy(ctx, cx + s * w * 0.24, y, w * 0.045, w * 0.045, p.glass)
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  ctx.beginPath()
  ctx.arc(cx, h * 0.5, Math.min(w, h) * 0.13, 0, Math.PI * 2)
  ctx.fillStyle = "#0a0a0f"
  ctx.fill()
  glow(ctx, cx, h * 0.5, Math.min(w, h) * (0.16 + 0.06 * pulse), p.accent, "#fff2e0")
  engines(ctx, [cx - w * 0.2, cx, cx + w * 0.2], h * 0.04, w * 0.07, p.engine)
}

/** Battle station sphere (SHIP22 boss): rotating ring + opening core. */
const station: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.48
  const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.05, cx, cy, R)
  g.addColorStop(0, p.light)
  g.addColorStop(0.45, p.mid)
  g.addColorStop(1, p.dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  const lines: [Pt, Pt][] = []
  for (let i = -3; i <= 3; i++) {
    lines.push(
      [
        [cx - R, cy + (i * R) / 4],
        [cx + R, cy + (i * R) / 4],
      ],
      [
        [cx + (i * R) / 4, cy - R],
        [cx + (i * R) / 4, cy + R],
      ],
    )
  }
  panelLines(ctx, lines, "rgba(0,0,0,0.25)")
  ctx.restore()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI)
  ctx.strokeStyle = p.accent
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(0, 0, R * 0.95, R * 0.35, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  const open = Math.sin(t * Math.PI)
  ctx.fillStyle = "#050507"
  ctx.beginPath()
  ctx.arc(cx, cy + R * 0.35, R * (0.12 + 0.15 * open), 0, Math.PI * 2)
  ctx.fill()
  glow(ctx, cx, cy + R * 0.35, R * (0.2 + 0.25 * open), p.accent, "#fff0e0")
  for (const [a, b] of [
    [-0.55, -0.45],
    [0.55, -0.45],
  ] as Pt[])
    canopy(ctx, cx + a * R, cy + b * R, R * 0.1, R * 0.1, p.glass)
}

/** Ground turret on an armored base plate (barrel rotates with frames). */
const turret: Draw = (ctx, w, h, t, r, p) => {
  const cx = w / 2
  const cy = h / 2
  const s = Math.min(w, h)
  const k = s * 0.14
  polyPath(ctx, [
    [k, 2],
    [w - k, 2],
    [w - 2, k],
    [w - 2, h - k],
    [w - k, h - 2],
    [k, h - 2],
    [2, h - k],
    [2, k],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
  for (const [x, y] of [
    [k * 1.1, k * 1.1],
    [w - k * 1.1, k * 1.1],
    [k * 1.1, h - k * 1.1],
    [w - k * 1.1, h - k * 1.1],
  ] as Pt[])
    glow(ctx, x, y, s * 0.05, p.accent)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI * (r() * 0.3 - 0.15) + t * Math.PI * 2)
  roundRect(ctx, -s * 0.06, 0, s * 0.12, s * 0.46, 2)
  metal(ctx, -s * 0.06, s * 0.06, p.dark, p.mid, p.light)
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.24, 0, Math.PI * 2)
  metal(ctx, -s * 0.24, s * 0.24, p.dark, p.mid, p.light)
  ctx.restore()
  canopy(ctx, cx, cy, s * 0.08, s * 0.08, p.glass)
}

/** Bunker / hangar block. */
const bunker: Draw = (ctx, w, h, t, _r, p) => {
  roundRect(ctx, 2, 2, w - 4, h - 4, 6)
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
  const doors = 3
  for (let i = 0; i < doors; i++) {
    const x = w * (0.12 + (i * 0.76) / doors)
    roundRect(ctx, x, h * 0.25, (w * 0.7) / doors - 3, h * 0.5, 3)
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fill()
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  glow(ctx, w * 0.5, h * 0.82, w * (0.06 + 0.03 * pulse), p.accent)
}

/** Tracked crawler (treads animate). */
const crawler: Draw = (ctx, w, h, t, _r, p) => {
  const tread = h * 0.28
  for (const y of [1, h - tread - 1]) {
    roundRect(ctx, 1, y, w - 2, tread, tread / 2)
    ctx.fillStyle = "#101010"
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = "rgba(255,255,255,0.15)"
    ctx.lineWidth = 2
    for (let x = -8 + ((t * 8) % 8); x < w; x += 8) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + tread)
      ctx.stroke()
    }
    ctx.restore()
  }
  roundRect(ctx, w * 0.08, h * 0.2, w * 0.84, h * 0.6, 5)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.5, h * 0.24, 0, Math.PI * 2)
  metal(ctx, w * 0.3, w * 0.7, p.dark, p.mid, p.light)
  roundRect(ctx, w * 0.5, h * 0.44, w * 0.42, h * 0.12, 2)
  metal(ctx, w * 0.5, w * 0.92, p.dark, p.mid, p.light)
  glow(ctx, w * 0.5, h * 0.5, h * 0.12, p.accent)
}

/** Hover freighter / barge (formerly boats) with an ion wake. */
const barge: Draw = (ctx, w, h, t, r, p) => {
  const cy = h / 2
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  const wake = ctx.createLinearGradient(0, 0, w * 0.35, 0)
  wake.addColorStop(0, "rgba(0,0,0,0)")
  wake.addColorStop(1, "rgba(80,220,255,0.35)")
  ctx.fillStyle = wake
  ctx.beginPath()
  ctx.ellipse(
    w * 0.25,
    cy,
    w * 0.25,
    h * (0.25 + 0.05 * Math.sin(t * Math.PI * 2)),
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.restore()
  polyPath(ctx, [
    [w * 0.15, cy - h * 0.34],
    [w * 0.8, cy - h * 0.34],
    [w * 0.98, cy],
    [w * 0.8, cy + h * 0.34],
    [w * 0.15, cy + h * 0.34],
  ])
  const g = ctx.createLinearGradient(0, cy - h * 0.34, 0, cy + h * 0.34)
  g.addColorStop(0, p.dark)
  g.addColorStop(0.4, p.light)
  g.addColorStop(1, p.dark)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.3)"
  ctx.stroke()
  const boxes = 2 + Math.floor(r() * 3)
  for (let i = 0; i < boxes; i++) {
    roundRect(ctx, w * (0.22 + (i * 0.5) / boxes), cy - h * 0.2, (w * 0.4) / boxes, h * 0.4, 2)
    ctx.fillStyle = i % 2 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.12)"
    ctx.fill()
  }
  canopy(ctx, w * 0.82, cy, h * 0.1, h * 0.12, p.glass)
  glow(ctx, w * 0.14, cy - h * 0.2, h * 0.14, p.engine)
  glow(ctx, w * 0.14, cy + h * 0.2, h * 0.14, p.engine)
}

/** Supply capsule (bonus container). */
const capsule: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  roundRect(ctx, w * 0.12, h * 0.25, w * 0.76, h * 0.5, h * 0.25)
  metal(ctx, 0, w, "#2a3038", "#8793a6", "#f2f6ff")
  ctx.fillStyle = p.accent
  ctx.fillRect(cx - w * 0.05, h * 0.25, w * 0.1, h * 0.5)
  glow(ctx, cx, cy, w * (0.2 + 0.05 * Math.sin(t * Math.PI * 2)), p.accent)
}

/** Alien critters (the original easter egg animals): tentacled void jelly. */
const jelly: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const R = w * 0.42
  ctx.save()
  ctx.globalAlpha = 0.85
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * R * 0.35
    ctx.strokeStyle = p.glass
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, R)
    for (let y = R; y < h; y += 4) ctx.lineTo(x + Math.sin(y * 0.3 + t * 6.28 + i) * 3, y)
    ctx.stroke()
  }
  const g = ctx.createRadialGradient(cx, R * 0.8, 1, cx, R, R)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(0.3, p.glass)
  g.addColorStop(1, "rgba(40,80,160,0.1)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, R, R, R * (0.9 + 0.1 * Math.sin(t * 6.28)), 0, Math.PI, 0)
  ctx.lineTo(cx + R, R * 1.1)
  ctx.lineTo(cx - R, R * 1.1)
  ctx.fill()
  ctx.restore()
}

const worm: Draw = (ctx, w, h, t, _r, p) => {
  const segs = 8
  for (let i = segs - 1; i >= 0; i--) {
    const x = w * (0.08 + (i * 0.84) / (segs - 1))
    const y = h / 2 + Math.sin(t * 6.28 + i * 0.9) * h * 0.2
    const rr = h * (i === segs - 1 ? 0.5 : 0.38)
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr)
    g.addColorStop(0, p.light)
    g.addColorStop(1, p.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  glow(ctx, w * 0.92, h / 2, h * 0.3, p.accent)
}

const alien: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.sin(t * 6.28) * 0.3
    ctx.strokeStyle = p.mid
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * w * 0.45, cy + Math.sin(a) * h * 0.45)
    ctx.stroke()
  }
  const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, w * 0.3)
  g.addColorStop(0, p.light)
  g.addColorStop(1, p.dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, w * 0.28, 0, Math.PI * 2)
  ctx.fill()
  glow(ctx, cx, cy + 2, w * 0.14, p.accent)
}

/** Hive boss emerging from the rock (MOLE: frames = emergence). */
const hive: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const grow = Math.min(1, t * 1.25)
  const R = Math.min(w, h) * 0.48
  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.beginPath()
  ctx.ellipse(cx, cy, R, R * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  if (grow <= 0.05) return
  const rr = R * grow
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const g = ctx.createRadialGradient(
      cx,
      cy,
      rr * 0.1,
      cx + Math.cos(a) * rr * 0.6,
      cy + Math.sin(a) * rr * 0.6,
      rr * 0.5,
    )
    g.addColorStop(0, p.light)
    g.addColorStop(1, p.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55, rr * 0.38, 0, Math.PI * 2)
    ctx.fill()
  }
  glow(ctx, cx, cy, rr * 0.6, p.accent, "#fff6d0")
}

interface Spec {
  draw: Draw
  pal: Palette
}

const E = ENEMY_PAL
const G = GROUND_PAL
const X = ELITE_PAL
const CRITTER: Palette = {
  ...GROUND_PAL,
  mid: "#7a4bd8",
  light: "#e6d7ff",
  dark: "#1a1030",
  accent: "#ff4fd8",
  glass: "#7fd3ff",
}

/** Original picture name -> new art. Unlisted names fall back by size. */
const SPECS: Record<string, Spec> = {
  SHIP01G1_PIC: { draw: interceptor, pal: E },
  SHIP02G1_PIC: { draw: gunship, pal: E },
  SHIP03G1_PIC: { draw: delta, pal: E },
  SHIP04G1_PIC: { draw: interceptor, pal: X },
  SHIP05G1_PIC: { draw: gunship, pal: E },
  SHIP06G1_PIC: { draw: gunship, pal: X },
  SHIP07G1_PIC: { draw: crawler, pal: G },
  SHIP08G1_PIC: { draw: crawler, pal: G },
  SHIP09G1_PIC: { draw: barge, pal: G },
  SHIP10G1_PIC: { draw: capital, pal: BOSS_PAL },
  SHIP11G1_PIC: { draw: capital, pal: BOSS_PAL },
  SHIP12G1_PIC: { draw: capital, pal: BOSS_PAL },
  SHIP13G1_PIC: { draw: delta, pal: X },
  SHIP14G1_PIC: { draw: delta, pal: E },
  SHIP15G1_PIC: { draw: barge, pal: G },
  SHIP16G1_PIC: { draw: capital, pal: { ...BOSS_PAL, accent: "#ffae2e" } },
  SHIP17G1_PIC: { draw: capital, pal: { ...BOSS_PAL, accent: "#c04dff" } },
  SHIP18G1_PIC: { draw: capital, pal: { ...BOSS_PAL, accent: "#ff2e7a" } },
  SHIP19G1_PIC: { draw: drone, pal: E },
  SHIP20G1_PIC: { draw: barge, pal: G },
  SHIP21G1_PIC: { draw: bunker, pal: G },
  SHIP22G1_PIC: { draw: station, pal: BOSS_PAL },
  SHIP23G1_PIC: { draw: drone, pal: X },
  SHIP24G1_PIC: { draw: interceptor, pal: E },
  SHIP25G1_PIC: { draw: delta, pal: { ...E, accent: "#ffcf2e" } },
  SHIP26G1_PIC: { draw: interceptor, pal: X },
  SHIP27G1_PIC: { draw: interceptor, pal: E },
  SHIP28G1_PIC: { draw: gunship, pal: E },
  SHIP29G1_PIC: { draw: gunship, pal: X },
  SHIP30G1_PIC: { draw: delta, pal: E },
  SHIP31G1_PIC: { draw: orb, pal: E },
  SHIP32G1_PIC: { draw: cruiser, pal: BOSS_PAL },
  SHIP33G1_PIC: { draw: drone, pal: E },
  SHIP34G1_PIC: { draw: orb, pal: X },
  SHIP35G1_PIC: { draw: interceptor, pal: E },
  SHIP36G1_PIC: { draw: gunship, pal: E },
  SHIP37G1_PIC: { draw: delta, pal: X },
  SHIP38G1_PIC: { draw: drone, pal: E },
  SHIP39G1_PIC: { draw: interceptor, pal: { ...E, accent: "#ffcf2e" } },
  SHIP40G1_PIC: { draw: delta, pal: E },
  BONUS1G1_PIC: { draw: capsule, pal: G },
  COW_PIC: { draw: jelly, pal: CRITTER },
  DINO_PIC: { draw: worm, pal: CRITTER },
  APE_PIC: { draw: alien, pal: CRITTER },
  MOLE_PIC: { draw: hive, pal: CRITTER },
}

function specFor(name: string, w: number, h: number): Spec {
  const s = SPECS[name]
  if (s) return s
  if (name.startsWith("TARG")) return { draw: turret, pal: G }
  if (w * h >= 80 * 40) return { draw: capital, pal: BOSS_PAL }
  return { draw: w > h ? gunship : interceptor, pal: E }
}

// ---- training sector: holographic target drones (same hitbox, one shape per unit role) ----------

type Role = "dart" | "ring" | "core" | "board" | "cube"

function roleOf(spec: Spec): Role {
  if (spec.pal === CRITTER) return "cube"
  if (spec.pal === G || spec.draw === turret) return "board"
  if ([capital, cruiser, station].includes(spec.draw)) return "core"
  if ([gunship, drone, orb].includes(spec.draw)) return "ring"
  return "dart"
}

/** Translucent hologram fill with scanlines, then a glowing outline (uses the current path). */
function holo(ctx: Ctx, h: number, line: string): void {
  ctx.save()
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "rgba(40,255,200,0.10)")
  g.addColorStop(1, "rgba(40,180,255,0.28)")
  ctx.fillStyle = g
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = "rgba(200,255,240,0.10)"
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, 4096, 1)
  ctx.restore()
  ctx.shadowColor = line
  ctx.shadowBlur = 6
  ctx.strokeStyle = line
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

function regularPoly(ctx: Ctx, x: number, y: number, rx: number, ry: number, n: number, a0 = 0) {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = a0 + (i * Math.PI * 2) / n
    pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry])
  }
  polyPath(ctx, pts)
}

const HOLO_LINE: Record<Role, string> = {
  dart: "#5dffc8",
  ring: "#5dffc8",
  core: "#ffd24a",
  board: "#ff6a4a",
  cube: "#c9a0ff",
}

function drawTrainingUnit(ctx: Ctx, spec: Spec, w: number, h: number, t: number, r: () => number) {
  const role = roleOf(spec)
  const line = spec.pal === X ? "#ff7ad8" : HOLO_LINE[role]
  const cx = w / 2
  const cy = h / 2
  const m = Math.min(w, h)
  const spin = t * Math.PI * 2
  switch (role) {
    case "dart": {
      // arrowhead drone, nose down
      const span = w * (0.4 + r() * 0.08)
      if (spec.pal === X) {
        // elite: swept diamond with a split tail
        mirrorPath(ctx, cx, [
          [0, h * 0.97],
          [span, h * 0.45],
          [w * 0.14, h * 0.04],
          [0, h * 0.2],
        ])
        holo(ctx, h, line)
        bullseye(ctx, cx, h * 0.48, m * 0.14)
        break
      }
      mirrorPath(ctx, cx, [
        [0, h * 0.97],
        [span, h * 0.3],
        [span * 0.85, h * 0.08],
        [w * 0.1, h * 0.3],
        [0, h * 0.18],
      ])
      holo(ctx, h, line)
      bullseye(ctx, cx, h * 0.45, m * 0.14)
      engines(ctx, [cx - span * 0.8, cx + span * 0.8], h * 0.1, w * 0.07, line)
      break
    }
    case "ring": {
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.44, h * 0.44, 0, 0, Math.PI * 2)
      holo(ctx, h, line)
      ctx.save()
      ctx.strokeStyle = line
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, w * 0.34, h * 0.34, 0, a, a + 0.8)
        ctx.stroke()
      }
      ctx.restore()
      bullseye(ctx, cx, cy, m * 0.22)
      break
    }
    case "core": {
      regularPoly(ctx, cx, cy, w * 0.48, h * 0.48, 6, Math.PI / 6)
      holo(ctx, h, line)
      regularPoly(ctx, cx, cy, w * 0.3, h * 0.3, 6, spin / 6)
      ctx.save()
      ctx.strokeStyle = line
      ctx.globalAlpha = 0.6
      ctx.stroke()
      ctx.restore()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3
        glow(ctx, cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.4, m * 0.06, line)
      }
      bullseye(ctx, cx, cy, m * 0.18)
      break
    }
    case "board": {
      // armed emplacement (fires back): octagon with a turning gun, unlike the square
      // passive target pads (fx.ts drawTrainingStructure)
      regularPoly(ctx, cx, cy, w * 0.46, h * 0.46, 8, Math.PI / 8)
      holo(ctx, h, line)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(spin)
      roundRect(ctx, -m * 0.06, 0, m * 0.12, m * 0.46, 2)
      holo(ctx, h, line)
      ctx.restore()
      bullseye(ctx, cx, cy, m * 0.18)
      break
    }
    default: {
      // rotating wireframe cube (training dummy)
      const s = m * 0.28
      const ox = Math.cos(spin) * s * 0.5
      const oy = Math.sin(spin) * s * 0.3 - s * 0.3
      polyPath(ctx, [
        [cx - s, cy - s],
        [cx - s + ox, cy - s + oy],
        [cx + s + ox, cy - s + oy],
        [cx + s + ox, cy + s + oy],
        [cx + s, cy + s],
        [cx - s, cy + s],
      ])
      holo(ctx, h, line)
      roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 1)
      holo(ctx, h, line)
      bullseye(ctx, cx, cy, s * 0.6)
    }
  }
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
  const spec = specFor(name, w, h)
  const r = seeded(hashString(name))
  const t = frames > 1 ? frame / frames : 0
  if (train) drawTrainingUnit(ctx, spec, w, h, t, r)
  else spec.draw(ctx, w, h, t, r, spec.pal)
}

/** Player ship, nose up; bank -3..3 (DOS playerpic 0..6, 3 = level). */
export function drawPlayer(ctx: Ctx, w: number, h: number, bank: number): void {
  const p = PLAYER_PAL
  const cx = w / 2
  const k = bank / 3 // -1..1
  const lw = 1 - Math.max(0, k) * 0.35
  const rw = 1 + Math.min(0, k) * 0.35
  ctx.save()
  const wing = (s: number, sc: number) => {
    const pts: Pt[] = [
      [cx + s * w * 0.08, h * 0.35],
      [cx + s * w * 0.48 * sc, h * 0.7],
      [cx + s * w * 0.46 * sc, h * 0.82],
      [cx + s * w * 0.1, h * 0.78],
    ]
    polyPath(ctx, pts)
    metal(ctx, cx - w / 2, cx + w / 2, p.dark, p.mid, p.light)
    glow(ctx, cx + s * w * 0.45 * sc, h * 0.74, w * 0.05, s < 0 ? "#ff4050" : "#40ff90")
  }
  wing(-1, lw)
  wing(1, rw)
  mirrorPath(ctx, cx, [
    [w * 0.02, h * 0.0],
    [w * 0.08, h * 0.18],
    [w * 0.12, h * 0.6],
    [w * 0.16, h * 0.9],
    [w * 0.1, h * 0.98],
  ])
  metal(ctx, cx - w * 0.16, cx + w * 0.16, p.dark, p.mid, p.light)
  panelLines(ctx, [
    [
      [cx, h * 0.45],
      [cx, h * 0.9],
    ],
  ])
  canopy(ctx, cx, h * 0.34, w * 0.055, h * 0.1, p.glass)
  ctx.restore()
}
