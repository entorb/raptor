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
  sphere,
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
  sphere(ctx, cx, cy, R, 0.35, 0.1, [
    [0, p.light],
    [0.5, p.mid],
    [1, p.dark],
  ])
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
  sphere(ctx, cx, cy, R, 0.4, 0.05, [
    [0, p.light],
    [0.45, p.mid],
    [1, p.dark],
  ])
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

/**
 * Ground turret on an armored base plate: `sides` = base polygon (0 = round), `guns` parallel
 * barrels of length `len` (x min size), fixed `aim` (radians, 0 = down) or turning with the frames.
 */
function turretOf(sides: number, guns: number, len: number, aim?: number): Draw {
  return (ctx, w, h, t, r, p) => {
    const cx = w / 2
    const cy = h / 2
    const s = Math.min(w, h)
    if (sides) regularPoly(ctx, cx, cy, w * 0.48, h * 0.48, sides, Math.PI / 2 + Math.PI / sides)
    else {
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2)
    }
    metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
    const n = sides || 6
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / n
      glow(ctx, cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36, s * 0.045, p.accent)
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(aim ?? Math.PI * (r() * 0.3 - 0.15) + t * Math.PI * 2)
    const bw = s * (guns > 2 ? 0.06 : 0.08)
    for (let g = 0; g < guns; g++) {
      const x = (g - (guns - 1) / 2) * bw * 1.5
      roundRect(ctx, x - bw / 2, 0, bw, s * len, 2)
      metal(ctx, x - bw / 2, x + bw / 2, p.dark, p.mid, p.light)
    }
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2)
    metal(ctx, -s * 0.22, s * 0.22, p.dark, p.mid, p.light)
    ctx.restore()
    canopy(ctx, cx, cy, s * 0.08, s * 0.08, p.glass)
  }
}

/** Radar site (TARGT6): round pad with a turning dish (animated). */
const radarSite: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const s = Math.min(w, h)
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2)
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(0,0,0,0.4)"
  ctx.setLineDash([4, 4])
  ctx.stroke()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI * 2)
  ctx.beginPath()
  ctx.ellipse(0, s * 0.08, s * 0.38, s * 0.13, 0, 0, Math.PI)
  ctx.closePath()
  metal(ctx, -s * 0.38, s * 0.38, p.dark, p.light, "#ffffff")
  panelLines(ctx, [
    [
      [0, 0],
      [0, s * 0.3],
    ],
  ])
  glow(ctx, 0, s * 0.3, s * 0.07, p.accent)
  ctx.restore()
  canopy(ctx, cx, cy, s * 0.1, s * 0.1, p.glass)
}

/** Missile launcher (TARGT7): square pad, turning box with four tubes (animated). */
const launcher: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const s = Math.min(w, h)
  roundRect(ctx, 2, 2, w - 4, h - 4, s * 0.08)
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
  ctx.beginPath()
  ctx.rect(2, 2, w - 4, h - 4)
  stripes(ctx, w, h, s * 0.18, "rgba(255,210,61,0.35)")
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2)
  ctx.fillStyle = p.dark
  ctx.fill()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI * 2)
  roundRect(ctx, -s * 0.24, -s * 0.2, s * 0.48, s * 0.48, 3)
  metal(ctx, -s * 0.24, s * 0.24, p.dark, p.mid, p.light)
  for (const [x, y] of [
    [-0.1, 0.02],
    [0.1, 0.02],
    [-0.1, 0.18],
    [0.1, 0.18],
  ] as Pt[]) {
    ctx.beginPath()
    ctx.arc(x * s, y * s, s * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = "#08080a"
    ctx.fill()
    glow(ctx, x * s, y * s, s * 0.06, p.accent)
  }
  ctx.restore()
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
  wake(ctx, w, h, t)
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
    sphere(ctx, x, y, rr, 0.3, 0, [
      [0, p.light],
      [1, p.dark],
    ])
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

/** Missile slung under a wing, warhead (`tip` color) pointing down. */
function missile(ctx: Ctx, x: number, y: number, len: number, wid: number, tip: string): void {
  roundRect(ctx, x - wid / 2, y, wid, len, wid / 2)
  metal(ctx, x - wid / 2, x + wid / 2, "#2a2c33", "#9aa0ab", "#f4f6fa", ["rgba(0,0,0,0.5)", 1])
  ctx.beginPath()
  ctx.arc(x, y + len - wid / 2, wid / 2, 0, Math.PI)
  ctx.fillStyle = tip
  ctx.fill()
}

/** Diagonal hazard stripes clipped to the current path. */
function stripes(ctx: Ctx, w: number, h: number, step: number, color = "rgba(10,10,10,0.75)") {
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = step / 2
  ctx.beginPath()
  for (let x = -h; x < w; x += step) {
    ctx.moveTo(x, h)
    ctx.lineTo(x + h, 0)
  }
  ctx.stroke()
  ctx.restore()
}

/** Light scout: straight wing, slim fuselage, T-tail (fodder). */
const scout: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  roundRect(ctx, w * 0.22, h * 0.04, w * 0.56, h * 0.12, h * 0.06)
  metal(ctx, w * 0.22, w * 0.78, p.dark, p.mid, p.light)
  roundRect(ctx, w * 0.03, h * 0.4, w * 0.94, h * 0.18, h * 0.09)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  mirrorPath(ctx, cx, [
    [w * 0.03, h * 0.02],
    [w * 0.09, h * 0.3],
    [w * 0.08, h * 0.8],
    [w * 0.02, h * 0.98],
  ])
  metal(ctx, cx - w * 0.09, cx + w * 0.09, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.68, w * 0.05, h * 0.12, p.glass)
  glow(ctx, w * 0.06, h * 0.49, w * 0.06, p.accent)
  glow(ctx, w * 0.94, h * 0.49, w * 0.06, p.accent)
  engines(ctx, [cx], h * 0.05, w * 0.12, p.engine)
}

/** Twin-boom catamaran: two fuselages joined by a wing, gun pod in the middle. */
const twinBoom: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  polyPath(ctx, [
    [w * 0.05, h * 0.36],
    [w * 0.95, h * 0.36],
    [w * 0.88, h * 0.58],
    [w * 0.12, h * 0.58],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  for (const x of [w * 0.2, w * 0.8]) {
    roundRect(ctx, x - w * 0.08, h * 0.04, w * 0.16, h * 0.9, w * 0.08)
    metal(ctx, x - w * 0.08, x + w * 0.08, p.dark, p.mid, p.light)
    canopy(ctx, x, h * 0.76, w * 0.045, h * 0.09, p.glass)
  }
  mirrorPath(ctx, cx, [
    [w * 0.05, h * 0.3],
    [w * 0.1, h * 0.45],
    [w * 0.05, h * 0.84],
  ])
  metal(ctx, cx - w * 0.1, cx + w * 0.1, p.dark, p.mid, p.light)
  glow(ctx, cx, h * 0.8, w * 0.06, p.accent)
  engines(ctx, [w * 0.2, w * 0.8], h * 0.06, w * 0.11, p.engine)
}

/** Armored heavy: thick hexagonal hull, bolted plates, twin exhausts. */
const brick: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.3, h * 0.03],
    [w * 0.48, h * 0.22],
    [w * 0.48, h * 0.7],
    [w * 0.3, h * 0.97],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.35)", 2.5])
  for (const [x, y, pw, ph] of [
    [0.1, 0.24, 0.32, 0.42],
    [0.58, 0.24, 0.32, 0.42],
    [0.3, 0.7, 0.4, 0.14],
  ] as const) {
    roundRect(ctx, w * x, h * y, w * pw, h * ph, 3)
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth = 1
    ctx.stroke()
    for (const [dx, dy] of [
      [0.04, 0.05],
      [pw - 0.04, 0.05],
      [0.04, ph - 0.05],
      [pw - 0.04, ph - 0.05],
    ] as Pt[])
      glow(ctx, w * (x + dx), h * (y + dy), w * 0.025, p.light)
  }
  roundRect(ctx, cx - w * 0.16, h * 0.88, w * 0.32, h * 0.04, 2)
  ctx.fillStyle = p.glass
  ctx.fill()
  engines(ctx, [cx - w * 0.18, cx + w * 0.18], h * 0.06, w * 0.12, p.engine)
}

/** Missile bomber: delta wing with four missiles slung under it. */
const bomber: Draw = (ctx, w, h, t, r, p) => {
  delta(ctx, w, h, t, r, p)
  for (const s of [-1, 1])
    for (const k of [0.2, 0.31])
      missile(ctx, w / 2 + s * w * k, h * 0.2, h * 0.3, w * 0.06, p.accent)
}

/** Four-gun X-wing: wings splayed in an X, a cannon on each tip. */
const xWing: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as Pt[]) {
    const y0 = h * 0.5 + sy * h * 0.05
    const tx = cx + sx * w * 0.44
    const ty = h * 0.5 + sy * h * 0.36
    polyPath(ctx, [
      [cx, y0 - h * 0.07],
      [tx, ty - h * 0.03],
      [tx - sx * w * 0.04, ty + h * 0.05],
      [cx, y0 + h * 0.07],
    ])
    metal(ctx, 0, w, p.dark, p.mid, p.light)
    roundRect(ctx, tx - w * 0.02, ty - h * 0.06, w * 0.04, h * 0.16, 1)
    metal(ctx, tx - w * 0.02, tx + w * 0.02, p.dark, p.mid, p.light)
    glow(ctx, tx, ty + h * 0.1, w * 0.05, p.accent)
  }
  mirrorPath(ctx, cx, [
    [w * 0.04, h * 0.02],
    [w * 0.09, h * 0.3],
    [w * 0.08, h * 0.75],
    [w * 0.03, h * 0.98],
  ])
  metal(ctx, cx - w * 0.09, cx + w * 0.09, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.7, w * 0.05, h * 0.1, p.glass)
  engines(ctx, [cx], h * 0.05, w * 0.12, p.engine)
}

/** Minelayer: wide saucer with a hazard-striped mine bay at the rear. */
const minelayer: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.55, w * 0.47, h * 0.42, 0, 0, Math.PI * 2)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.32, w * 0.3, h * 0.16, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#ffd23d"
  ctx.fill()
  stripes(ctx, w, h, w * 0.1)
  for (const x of [-0.13, 0, 0.13]) {
    ctx.beginPath()
    ctx.arc(cx + x * w, h * 0.32, w * 0.045, 0, Math.PI * 2)
    ctx.fillStyle = "#101014"
    ctx.fill()
    glow(ctx, cx + x * w, h * 0.32, w * 0.035, p.accent)
  }
  canopy(ctx, cx, h * 0.74, w * 0.1, h * 0.1, p.glass)
  glow(ctx, w * 0.08, h * 0.55, w * 0.05, p.accent)
  glow(ctx, w * 0.92, h * 0.55, w * 0.05, p.accent)
}

/** Crescent batwing: horns sweep forward, a gun in each horn. */
const batwing: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  ctx.beginPath()
  ctx.moveTo(w * 0.03, h * 0.96)
  ctx.quadraticCurveTo(w * 0.02, h * 0.06, cx, h * 0.04)
  ctx.quadraticCurveTo(w * 0.98, h * 0.06, w * 0.97, h * 0.96)
  ctx.quadraticCurveTo(w * 0.78, h * 0.5, cx, h * 0.6)
  ctx.quadraticCurveTo(w * 0.22, h * 0.5, w * 0.03, h * 0.96)
  ctx.closePath()
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.38, w * 0.07, h * 0.1, p.glass)
  glow(ctx, w * 0.06, h * 0.88, w * 0.07, p.accent)
  glow(ctx, w * 0.94, h * 0.88, w * 0.07, p.accent)
  engines(ctx, [cx - w * 0.14, cx + w * 0.14], h * 0.1, w * 0.09, p.engine)
}

/** Scanner saucer: domed disc with a light chasing around the rim (animated). */
const scanner: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.48, h * 0.44, 0, 0, Math.PI * 2)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.3, h * 0.27, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.fill()
  canopy(ctx, cx, cy, w * 0.15, h * 0.2, p.glass)
  const on = Math.floor(t * 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const hot = i === on
    glow(
      ctx,
      cx + Math.cos(a) * w * 0.39,
      cy + Math.sin(a) * h * 0.36,
      w * (hot ? 0.1 : 0.035),
      hot ? p.accent : p.engine,
    )
  }
}

/** Unarmed supply transport (carries a bonus): white capsule with green cross markings. */
const transport: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  polyPath(ctx, [
    [w * 0.02, h * 0.42],
    [w * 0.98, h * 0.42],
    [w * 0.9, h * 0.58],
    [w * 0.1, h * 0.58],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  roundRect(ctx, cx - w * 0.28, h * 0.03, w * 0.56, h * 0.94, w * 0.28)
  metal(ctx, cx - w * 0.28, cx + w * 0.28, p.dark, p.mid, p.light)
  ctx.fillStyle = p.accent
  ctx.fillRect(cx - w * 0.06, h * 0.36, w * 0.12, h * 0.28)
  ctx.fillRect(cx - w * 0.18, h * 0.45, w * 0.36, h * 0.1)
  canopy(ctx, cx, h * 0.86, w * 0.14, h * 0.05, p.glass)
  engines(ctx, [cx - w * 0.12, cx + w * 0.12], h * 0.05, w * 0.14, p.engine)
}

/** Kamikaze missile-drone: hazard-striped body, warhead first, cross fins. */
const kami: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.06, h * 0.06],
    [w * 0.42, h * 0.02],
    [w * 0.42, h * 0.2],
    [w * 0.08, h * 0.42],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  mirrorPath(ctx, cx, [
    [w * 0.08, h * 0.52],
    [w * 0.26, h * 0.6],
    [w * 0.08, h * 0.72],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  roundRect(ctx, cx - w * 0.12, h * 0.04, w * 0.24, h * 0.76, w * 0.12)
  metal(ctx, cx - w * 0.12, cx + w * 0.12, p.dark, p.mid, p.light)
  stripes(ctx, w, h, w * 0.12)
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.12, h * 0.7)
  ctx.quadraticCurveTo(cx - w * 0.12, h * 0.98, cx, h * 0.99)
  ctx.quadraticCurveTo(cx + w * 0.12, h * 0.98, cx + w * 0.12, h * 0.7)
  ctx.closePath()
  ctx.fillStyle = p.accent
  ctx.fill()
  glow(ctx, cx, h * 0.86, w * 0.12, p.accent)
  engines(ctx, [cx], h * 0.04, w * 0.18, p.engine)
}

/** Kamikaze spike mine: armored ball covered in spikes, pulsing core (animated). */
const spikeMine: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.3
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    polyPath(ctx, [
      [cx + Math.cos(a - 0.25) * R * 0.9, cy + Math.sin(a - 0.25) * R * 0.9],
      [cx + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 1.6],
      [cx + Math.cos(a + 0.25) * R * 0.9, cy + Math.sin(a + 0.25) * R * 0.9],
    ])
    metal(ctx, cx - R * 1.6, cx + R * 1.6, p.dark, p.mid, p.light, ["rgba(0,0,0,0.4)", 1])
  }
  sphere(ctx, cx, cy, R, 0.35, 0.1, [
    [0, p.light],
    [0.5, p.mid],
    [1, p.dark],
  ])
  stripes(ctx, w, h, R * 0.6)
  const pulse = 0.5 + 0.5 * Math.cos(t * Math.PI * 2)
  glow(ctx, cx, cy, R * (0.55 + 0.45 * pulse), p.accent, "#ffe0d0")
}

/** Plasma gunner: ring hull around a crackling plasma core, three emitter prongs. */
const plasma: Draw = (ctx, w, h, _t, r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.36
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3
    const [c, s] = [Math.cos(a), Math.sin(a)]
    polyPath(ctx, [
      [cx + c * R * 0.7 - s * R * 0.25, cy + s * R * 0.7 + c * R * 0.25],
      [cx + c * R * 1.35 - s * R * 0.12, cy + s * R * 1.35 + c * R * 0.12],
      [cx + c * R * 1.35 + s * R * 0.12, cy + s * R * 1.35 - c * R * 0.12],
      [cx + c * R * 0.7 + s * R * 0.25, cy + s * R * 0.7 - c * R * 0.25],
    ])
    metal(ctx, cx - R * 1.4, cx + R * 1.4, p.dark, p.mid, p.light)
    glow(ctx, cx + c * R * 1.3, cy + s * R * 1.3, R * 0.25, p.accent)
  }
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2, true)
  metal(ctx, cx - R, cx + R, p.dark, p.mid, p.light)
  glow(ctx, cx, cy, R * 0.8, p.accent, "#f4ffe0")
  ctx.save()
  ctx.strokeStyle = "rgba(240,255,220,0.9)"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a + 0.4) * R * 0.3, cy + Math.sin(a + 0.4) * R * 0.3)
    ctx.lineTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6)
  }
  ctx.stroke()
  ctx.restore()
}

/** Missile carrier: forward-swept wing with a missile under each side. */
const rackWing: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.06, h * 0.04],
    [w * 0.12, h * 0.26],
    [w * 0.48, h * 0.6],
    [w * 0.46, h * 0.76],
    [w * 0.12, h * 0.58],
    [w * 0.06, h * 0.98],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  for (const s of [-1, 1]) missile(ctx, cx + s * w * 0.27, h * 0.36, h * 0.38, w * 0.08, p.accent)
  canopy(ctx, cx, h * 0.76, w * 0.05, h * 0.1, p.glass)
  engines(ctx, [cx], h * 0.06, w * 0.14, p.engine)
}

/** Armored rammer: heavy wedge with a ram spike and armor chevrons (no guns). */
const rammer: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.38, h * 0.03],
    [w * 0.47, h * 0.3],
    [w * 0.22, h * 0.8],
    [w * 0.05, h * 0.84],
    [w * 0.01, h * 0.99],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.35)", 2.5])
  const lines: [Pt, Pt][] = []
  for (const y of [0.25, 0.42, 0.59])
    lines.push(
      [
        [cx - w * 0.36, h * y],
        [cx, h * (y + 0.16)],
      ],
      [
        [cx + w * 0.36, h * y],
        [cx, h * (y + 0.16)],
      ],
    )
  panelLines(ctx, lines, "rgba(0,0,0,0.45)", 2)
  glow(ctx, cx, h * 0.93, w * 0.08, p.accent)
  engines(ctx, [cx - w * 0.24, cx, cx + w * 0.24], h * 0.05, w * 0.1, p.engine)
}

/** Tri-wing drone: three thin arms around a small hub, one pointing forward (no guns). */
const triWing: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.48
  for (let i = 0; i < 3; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i * Math.PI * 2) / 3)
    polyPath(ctx, [
      [-R * 0.1, 0],
      [R * 0.1, 0],
      [R * 0.05, R],
      [-R * 0.05, R],
    ])
    metal(ctx, -R * 0.1, R * 0.1, p.dark, p.mid, p.light)
    glow(ctx, 0, R * 0.92, R * 0.14, p.accent)
    ctx.restore()
  }
  sphere(ctx, cx, cy, R * 0.3, 0.35, 0.1, [
    [0, p.light],
    [0.5, p.mid],
    [1, p.dark],
  ])
  canopy(ctx, cx, cy + R * 0.05, R * 0.12, R * 0.12, p.glass)
}

/** Radar picket: diamond hull, turning dish on top, missile pods on the flanks (animated). */
const radar: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.5
  for (const s of [-1, 1])
    missile(ctx, cx + s * w * 0.3, cy - h * 0.18, h * 0.4, w * 0.09, p.accent)
  polyPath(ctx, [
    [cx, h * 0.02],
    [w * 0.84, cy],
    [cx, h * 0.98],
    [w * 0.16, cy],
  ])
  metal(ctx, w * 0.16, w * 0.84, p.dark, p.mid, p.light)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI * 2)
  ctx.beginPath()
  ctx.ellipse(0, 0, R * 0.55, R * 0.16, 0, 0, Math.PI * 2)
  metal(ctx, -R * 0.55, R * 0.55, p.dark, p.light, "#ffffff")
  ctx.restore()
  glow(ctx, cx, cy, R * 0.16, p.accent)
}

/** Trident: three forward prongs, the outer ones fire at an angle. */
const trident: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  for (const s of [-1, 1]) {
    polyPath(ctx, [
      [cx + s * w * 0.18, h * 0.2],
      [cx + s * w * 0.34, h * 0.2],
      [cx + s * w * 0.47, h * 0.86],
      [cx + s * w * 0.38, h * 0.9],
    ])
    metal(ctx, 0, w, p.dark, p.mid, p.light)
    glow(ctx, cx + s * w * 0.43, h * 0.9, w * 0.09, p.accent)
  }
  roundRect(ctx, cx - w * 0.08, h * 0.1, w * 0.16, h * 0.88, w * 0.08)
  metal(ctx, cx - w * 0.08, cx + w * 0.08, p.dark, p.mid, p.light)
  roundRect(ctx, cx - w * 0.38, h * 0.08, w * 0.76, h * 0.22, h * 0.08)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.6, w * 0.06, h * 0.08, p.glass)
  engines(ctx, [cx - w * 0.22, cx + w * 0.22], h * 0.08, w * 0.12, p.engine)
}

/** Gun platform: W-shaped flying wing with four cannon barrels. */
const quadGun: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  for (const x of [-0.34, -0.13, 0.13, 0.34]) {
    roundRect(ctx, cx + x * w - w * 0.03, h * 0.45, w * 0.06, h * 0.44, 2)
    metal(ctx, cx + x * w - w * 0.03, cx + x * w + w * 0.03, p.dark, p.mid, p.light)
    glow(ctx, cx + x * w, h * 0.9, w * 0.05, p.accent)
  }
  mirrorPath(ctx, cx, [
    [w * 0.06, h * 0.16],
    [w * 0.3, h * 0.06],
    [w * 0.48, h * 0.24],
    [w * 0.46, h * 0.56],
    [w * 0.3, h * 0.62],
    [w * 0.2, h * 0.48],
    [w * 0.06, h * 0.66],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.42, w * 0.06, h * 0.1, p.glass)
  engines(ctx, [cx - w * 0.3, cx + w * 0.3], h * 0.12, w * 0.11, p.engine)
}

/** Armored eye pod: thick hexagon with a single gun eye that blinks (animated). */
const pod: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.47
  regularPoly(ctx, cx, cy, R, R, 6, 0)
  metal(ctx, cx - R, cx + R, p.dark, p.mid, p.light, ["rgba(255,255,255,0.35)", 2.5])
  regularPoly(ctx, cx, cy, R * 0.62, R * 0.62, 6, 0)
  ctx.fillStyle = "rgba(0,0,0,0.4)"
  ctx.fill()
  canopy(ctx, cx, cy, R * 0.34, R * (t ? 0.14 : 0.34), p.glass)
  glow(ctx, cx, cy, R * 0.4, p.accent)
}

/** Orbiter: thin ring with four balls circling a core (animated). */
const orbiter: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.36
  ctx.save()
  ctx.strokeStyle = p.mid
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  for (let i = 0; i < 4; i++) {
    const a = (t * Math.PI) / 2 + (i * Math.PI) / 2
    sphere(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.3, 0.35, 0.1, [
      [0, p.light],
      [0.5, p.mid],
      [1, p.dark],
    ])
  }
  sphere(ctx, cx, cy, R * 0.42, 0.35, 0.1, [
    [0, p.light],
    [0.5, p.mid],
    [1, p.dark],
  ])
  glow(ctx, cx, cy, R * 0.4, p.accent)
}

/** Dart: slim notched arrowhead (fodder, no guns). */
const dart: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [0, h * 0.98],
    [w * 0.44, h * 0.2],
    [w * 0.36, h * 0.03],
    [w * 0.05, h * 0.36],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  canopy(ctx, cx, h * 0.62, w * 0.06, h * 0.12, p.glass)
  engines(ctx, [cx - w * 0.38, cx + w * 0.38], h * 0.1, w * 0.1, p.engine)
}

/** Beetle: round two-shell bug with mandible guns. */
const beetle: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  ctx.save()
  ctx.strokeStyle = p.light
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * w * 0.14, h * 0.72)
    ctx.quadraticCurveTo(cx + s * w * 0.32, h * 0.97, cx + s * w * 0.07, h * 0.96)
    ctx.stroke()
  }
  ctx.restore()
  for (const s of [-1, 1]) {
    const a = Math.PI / 2
    ctx.beginPath()
    ctx.ellipse(
      cx + s * w * 0.02,
      h * 0.46,
      w * 0.4,
      h * 0.42,
      0,
      s < 0 ? a : -a,
      s < 0 ? 3 * a : a,
    )
    ctx.closePath()
    metal(ctx, cx - w * 0.42, cx + w * 0.42, p.dark, p.mid, p.light)
    glow(ctx, cx + s * w * 0.2, h * 0.4, w * 0.06, p.accent)
  }
  canopy(ctx, cx, h * 0.82, w * 0.12, h * 0.08, p.glass)
}

/** Shared hover wake behind a ground barge (moves sideways, stern on the left). */
function wake(ctx: Ctx, w: number, h: number, t: number): void {
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  const g = ctx.createLinearGradient(0, 0, w * 0.35, 0)
  g.addColorStop(0, "rgba(0,0,0,0)")
  g.addColorStop(1, "rgba(80,220,255,0.35)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(
    w * 0.25,
    h / 2,
    w * 0.25,
    h * (0.25 + 0.05 * Math.sin(t * Math.PI * 2)),
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.restore()
}

/** Missile half-track: turning wheels (animated), cab and a launcher box. */
const apc: Draw = (ctx, w, h, t, _r, p) => {
  for (let i = 0; i < 4; i++) {
    const x = w * (0.16 + i * 0.22)
    for (const y of [h * 0.14, h * 0.86]) {
      ctx.beginPath()
      ctx.arc(x, y, h * 0.13, 0, Math.PI * 2)
      ctx.fillStyle = "#121212"
      ctx.fill()
      const a = t * Math.PI
      panelLines(
        ctx,
        [
          [
            [x - Math.cos(a) * h * 0.1, y - Math.sin(a) * h * 0.1],
            [x + Math.cos(a) * h * 0.1, y + Math.sin(a) * h * 0.1],
          ],
        ],
        "rgba(255,255,255,0.35)",
        2,
      )
    }
  }
  roundRect(ctx, w * 0.04, h * 0.2, w * 0.92, h * 0.6, 4)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  roundRect(ctx, w * 0.7, h * 0.26, w * 0.24, h * 0.48, 4)
  metal(ctx, w * 0.7, w * 0.94, p.dark, p.mid, p.light)
  canopy(ctx, w * 0.88, h * 0.5, w * 0.03, h * 0.14, p.glass)
  roundRect(ctx, w * 0.1, h * 0.27, w * 0.52, h * 0.46, 2)
  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.fill()
  for (let i = 0; i < 3; i++)
    for (const y of [h * 0.39, h * 0.61]) glow(ctx, w * (0.2 + i * 0.16), y, h * 0.1, p.accent)
}

/** Hover tanker: long hull carrying three round fuel tanks. */
const tanker: Draw = (ctx, w, h, t, _r, p) => {
  const cy = h / 2
  wake(ctx, w, h, t)
  roundRect(ctx, w * 0.12, cy - h * 0.4, w * 0.86, h * 0.8, h * 0.4)
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  panelLines(
    ctx,
    [
      [
        [w * 0.2, cy],
        [w * 0.8, cy],
      ],
    ],
    "rgba(255,255,255,0.4)",
    3,
  )
  for (const x of [0.3, 0.5, 0.7])
    sphere(ctx, w * x, cy, h * 0.32, 0.35, 0.05, [
      [0, "#ffffff"],
      [0.4, p.light],
      [1, p.dark],
    ])
  canopy(ctx, w * 0.9, cy, h * 0.1, h * 0.16, p.glass)
  glow(ctx, w * 0.14, cy, h * 0.2, p.engine)
}

/** Hover deck barge: flat landing pad with blinking edge lights, bridge at the bow. */
const deck: Draw = (ctx, w, h, t, _r, p) => {
  const cy = h / 2
  wake(ctx, w, h, t)
  polyPath(ctx, [
    [w * 0.12, h * 0.06],
    [w * 0.86, h * 0.06],
    [w * 0.98, h * 0.3],
    [w * 0.98, h * 0.7],
    [w * 0.86, h * 0.94],
    [w * 0.12, h * 0.94],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  roundRect(ctx, w * 0.18, h * 0.14, w * 0.56, h * 0.72, 3)
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.fill()
  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,0.7)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(w * 0.46, cy, h * 0.26, 0, Math.PI * 2)
  ctx.moveTo(w * 0.43, cy - h * 0.14)
  ctx.lineTo(w * 0.43, cy + h * 0.14)
  ctx.moveTo(w * 0.49, cy - h * 0.14)
  ctx.lineTo(w * 0.49, cy + h * 0.14)
  ctx.moveTo(w * 0.43, cy)
  ctx.lineTo(w * 0.49, cy)
  ctx.stroke()
  ctx.restore()
  for (let i = 0; i < 6; i++) {
    const x = w * (0.2 + i * 0.1)
    const lit = (i + Math.round(t * 2)) % 2 === 0
    for (const y of [h * 0.16, h * 0.84]) glow(ctx, x, y, h * (lit ? 0.08 : 0.04), p.accent)
  }
  roundRect(ctx, w * 0.78, h * 0.3, w * 0.12, h * 0.4, 3)
  metal(ctx, w * 0.78, w * 0.9, p.dark, p.mid, p.light)
  canopy(ctx, w * 0.86, cy, w * 0.02, h * 0.12, p.glass)
  glow(ctx, w * 0.14, h * 0.25, h * 0.14, p.engine)
  glow(ctx, w * 0.14, h * 0.75, h * 0.14, p.engine)
}

/** Missile silo: armored block with four launch hatches (open on the second frame). */
const silo: Draw = (ctx, w, h, t, _r, p) => {
  roundRect(ctx, 2, 2, w - 4, h - 4, 8)
  metal(ctx, 0, w, p.dark, p.mid, p.light, ["rgba(255,255,255,0.2)", 1.5])
  stripes(ctx, w, h, h * 0.3, "rgba(255,210,61,0.25)")
  const r = Math.min(w, h) * 0.15
  for (const x of [0.3, 0.7])
    for (const y of [0.3, 0.7]) {
      ctx.beginPath()
      ctx.arc(w * x, h * y, r, 0, Math.PI * 2)
      if (t) {
        ctx.fillStyle = "#08080a"
        ctx.fill()
        missile(ctx, w * x, h * y - r * 0.8, r * 1.6, r, p.accent)
      } else metal(ctx, w * x - r, w * x + r, p.dark, p.light, "#ffffff")
    }
  glow(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.08, p.accent)
}

/** Carrier boss: broad flight deck with a runway, an island tower and launch bays. */
const carrier: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.3, h * 0.02],
    [w * 0.48, h * 0.12],
    [w * 0.48, h * 0.8],
    [w * 0.34, h * 0.98],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  roundRect(ctx, cx - w * 0.3, h * 0.08, w * 0.5, h * 0.84, 4)
  ctx.fillStyle = "rgba(0,0,0,0.4)"
  ctx.fill()
  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,0.5)"
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.05, h * 0.1)
  ctx.lineTo(cx - w * 0.05, h * 0.9)
  ctx.stroke()
  ctx.restore()
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  for (const x of [-0.22, -0.05, 0.12])
    glow(ctx, cx + x * w, h * 0.9, w * (0.03 + 0.015 * pulse), p.accent, "#fff2e0")
  roundRect(ctx, cx + w * 0.26, h * 0.3, w * 0.16, h * 0.36, 4)
  metal(ctx, cx + w * 0.26, cx + w * 0.42, p.dark, p.mid, p.light)
  canopy(ctx, cx + w * 0.34, h * 0.58, w * 0.04, h * 0.05, p.glass)
  for (const y of [0.3, 0.5, 0.7]) canopy(ctx, cx - w * 0.4, h * y, w * 0.04, w * 0.04, p.glass)
  engines(
    ctx,
    [cx - w * 0.3, cx - w * 0.1, cx + w * 0.1, cx + w * 0.3],
    h * 0.04,
    w * 0.07,
    p.engine,
  )
}

/** Dreadnought boss: arrowhead hull with three heavy turrets on the spine. */
const dreadnought: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  mirrorPath(ctx, cx, [
    [w * 0.2, h * 0.02],
    [w * 0.48, h * 0.16],
    [w * 0.44, h * 0.5],
    [w * 0.1, h * 0.98],
  ])
  metal(ctx, 0, w, p.dark, p.mid, p.light)
  mirrorPath(ctx, cx, [
    [w * 0.08, h * 0.05],
    [w * 0.13, h * 0.5],
    [w * 0.04, h * 0.92],
  ])
  metal(ctx, cx - w * 0.13, cx + w * 0.13, p.dark, p.light, "#ffffff")
  for (const y of [0.24, 0.46, 0.68]) {
    for (const s of [-1, 1]) {
      roundRect(ctx, cx + s * w * 0.025 - w * 0.012, h * y, w * 0.024, h * 0.16, 1)
      ctx.fillStyle = p.dark
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, h * y, w * 0.06, 0, Math.PI * 2)
    metal(ctx, cx - w * 0.06, cx + w * 0.06, p.dark, p.mid, p.light)
    glow(ctx, cx, h * y, w * 0.03, p.accent)
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1])
      glow(
        ctx,
        cx + s * w * (0.4 - i * 0.07),
        h * (0.25 + i * 0.13),
        w * (0.025 + 0.01 * pulse),
        p.accent,
      )
  engines(
    ctx,
    [cx - w * 0.3, cx - w * 0.12, cx + w * 0.12, cx + w * 0.3],
    h * 0.04,
    w * 0.07,
    p.engine,
  )
}

interface Spec {
  draw: Draw
  pal: Palette
}

const E = ENEMY_PAL
const G = GROUND_PAL
const X = ELITE_PAL
// hull tints by threat: pale = fodder, steel = line fighters, copper = light gunships,
// crimson = armored, hazard = kamikaze, gunmetal = specialists, violet = elite
const PALE: Palette = { ...E, dark: "#1c222c", mid: "#6a7486", light: "#eef3fb", accent: "#ff6a3c" }
const COPPER: Palette = {
  ...E,
  dark: "#1e120a",
  mid: "#7a4a26",
  light: "#f0b27a",
  glass: "#ff8a3c",
}
const CRIMSON: Palette = {
  ...E,
  dark: "#1c080a",
  mid: "#7a1f26",
  light: "#e88a8e",
  accent: "#ffb02e",
  glass: "#ffcf5a",
}
const HAZARD: Palette = {
  ...E,
  dark: "#1a1606",
  mid: "#8a6d10",
  light: "#ffe066",
  accent: "#ff2e2e",
}
const GUNMETAL: Palette = {
  ...E,
  dark: "#0a0c10",
  mid: "#2c323c",
  light: "#8a94a6",
  accent: "#ffd23d",
  glass: "#ffd23d",
}
const MEDIC: Palette = {
  ...E,
  dark: "#1a2420",
  mid: "#6f8a80",
  light: "#f2fbf6",
  accent: "#2eff8a",
  glass: "#7fffb8",
}
const PLASMA: Palette = { ...X, accent: "#9dff3d" }
const G2: Palette = { ...G, mid: "#4c5a3a", light: "#b9cc8e" }
const G_STEEL: Palette = { ...G, mid: "#46505e", light: "#bcc6d4", glass: "#ffd23d" }
const G_RUST: Palette = { ...G, mid: "#6a3a2a", light: "#e0a07e", glass: "#ff6a4a" }
const G_DARK: Palette = {
  ...G,
  dark: "#12141a",
  mid: "#3a3f4c",
  light: "#9aa3b5",
  glass: "#ff3d4a",
}
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
  SHIP03G1_PIC: { draw: bomber, pal: E },
  SHIP04G1_PIC: { draw: xWing, pal: X },
  SHIP05G1_PIC: { draw: twinBoom, pal: COPPER },
  SHIP06G1_PIC: { draw: brick, pal: CRIMSON },
  SHIP07G1_PIC: { draw: crawler, pal: G },
  SHIP08G1_PIC: { draw: apc, pal: G2 },
  SHIP09G1_PIC: { draw: barge, pal: G },
  SHIP10G1_PIC: { draw: capital, pal: BOSS_PAL },
  SHIP11G1_PIC: { draw: dreadnought, pal: BOSS_PAL },
  SHIP12G1_PIC: { draw: carrier, pal: BOSS_PAL },
  SHIP13G1_PIC: { draw: minelayer, pal: GUNMETAL },
  SHIP14G1_PIC: { draw: batwing, pal: E },
  SHIP15G1_PIC: { draw: tanker, pal: G },
  SHIP16G1_PIC: { draw: capital, pal: { ...BOSS_PAL, accent: "#ffae2e" } },
  SHIP17G1_PIC: { draw: carrier, pal: { ...BOSS_PAL, accent: "#c04dff" } },
  SHIP18G1_PIC: { draw: dreadnought, pal: { ...BOSS_PAL, accent: "#ff2e7a" } },
  SHIP19G1_PIC: { draw: drone, pal: E },
  SHIP20G1_PIC: { draw: deck, pal: G },
  SHIP21G1_PIC: { draw: silo, pal: G },
  SHIP22G1_PIC: { draw: station, pal: BOSS_PAL },
  SHIP23G1_PIC: { draw: scanner, pal: X },
  SHIP24G1_PIC: { draw: transport, pal: MEDIC },
  SHIP25G1_PIC: { draw: kami, pal: HAZARD },
  SHIP26G1_PIC: { draw: plasma, pal: PLASMA },
  SHIP27G1_PIC: { draw: scout, pal: PALE },
  SHIP28G1_PIC: { draw: rackWing, pal: COPPER },
  SHIP29G1_PIC: { draw: rammer, pal: CRIMSON },
  SHIP30G1_PIC: { draw: triWing, pal: PALE },
  SHIP31G1_PIC: { draw: orb, pal: E },
  SHIP32G1_PIC: { draw: cruiser, pal: BOSS_PAL },
  SHIP33G1_PIC: { draw: radar, pal: GUNMETAL },
  SHIP34G1_PIC: { draw: spikeMine, pal: HAZARD },
  SHIP35G1_PIC: { draw: trident, pal: E },
  SHIP36G1_PIC: { draw: quadGun, pal: GUNMETAL },
  SHIP37G1_PIC: { draw: pod, pal: CRIMSON },
  SHIP38G1_PIC: { draw: orbiter, pal: PALE },
  SHIP39G1_PIC: { draw: dart, pal: PALE },
  SHIP40G1_PIC: { draw: beetle, pal: COPPER },
  TARG10G1_PIC: { draw: turretOf(6, 1, 0.46, Math.PI / 4), pal: G },
  TARGT9G1_PIC: { draw: turretOf(6, 1, 0.46, -Math.PI / 4), pal: G },
  TARGT1G1_PIC: { draw: turretOf(8, 1, 0.5), pal: G2 },
  TARGT2G1_PIC: { draw: turretOf(0, 2, 0.44), pal: G_STEEL },
  TARGT3G1_PIC: { draw: turretOf(4, 3, 0.42), pal: G },
  TARGT4G1_PIC: { draw: turretOf(6, 4, 0.32), pal: G_RUST },
  TARGT5G1_PIC: { draw: turretOf(5, 1, 0.56), pal: G },
  TARGT6G1_PIC: { draw: radarSite, pal: G },
  TARGT7G1_PIC: { draw: launcher, pal: G },
  TARGT8G1_PIC: { draw: turretOf(8, 2, 0.5), pal: G_DARK },
  BONUS1G1_PIC: { draw: capsule, pal: G },
  COW_PIC: { draw: jelly, pal: CRITTER },
  DINO_PIC: { draw: worm, pal: CRITTER },
  APE_PIC: { draw: alien, pal: CRITTER },
  MOLE_PIC: { draw: hive, pal: CRITTER },
}

function specFor(name: string, w: number, h: number): Spec {
  const s = SPECS[name]
  if (s) return s
  if (name.startsWith("TARG")) return { draw: turretOf(8, 1, 0.46), pal: G }
  if (w * h >= 80 * 40) return { draw: capital, pal: BOSS_PAL }
  return { draw: w > h ? gunship : interceptor, pal: E }
}

// ---- training sector: holographic target drones (same hitbox, own shape + color per unit) ------

/** Translucent hologram fill tinted `line`, scanlines, then a glowing outline (current path). */
function holo(ctx: Ctx, h: number, line: string): void {
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = line
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.save()
  ctx.clip()
  ctx.fillStyle = "rgba(220,255,250,0.10)"
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

/** Stroke the current path in `c` (inner hologram detail). */
function trace(ctx: Ctx, c: string, alpha = 0.8, width = 1.5): void {
  ctx.save()
  ctx.strokeStyle = c
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.stroke()
  ctx.restore()
}

type Holo = (ctx: Ctx, w: number, h: number, t: number, c: string) => void

/** Path from unit points (0..1 of the box), then hologram + target mark at (mx, my). */
function shape(pts: Pt[], mx = 0.5, my = 0.5, mr = 0.16): Holo {
  return (ctx, w, h, _t, c) => {
    polyPath(
      ctx,
      pts.map(([x, y]) => [x * w, y * h]),
    )
    holo(ctx, h, c)
    bullseye(ctx, mx * w, my * h, Math.min(w, h) * mr, c)
  }
}

/** Mirrored half outline (x 0..0.5 from the center) like `shape`. */
function mirrored(half: Pt[], my = 0.5, mr = 0.14): Holo {
  return (ctx, w, h, _t, c) => {
    mirrorPath(
      ctx,
      w / 2,
      half.map(([x, y]) => [x * w, y * h]),
    )
    holo(ctx, h, c)
    bullseye(ctx, w / 2, my * h, Math.min(w, h) * mr, c)
  }
}

/** n-pointed star spinning with the frames (kamikaze drones). */
function star(n: number, inner: number): Holo {
  return (ctx, w, h, t, c) => {
    const pts: Pt[] = []
    for (let i = 0; i < n * 2; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / n + (t * Math.PI * 2) / n
      const k = i % 2 ? inner : 0.48
      pts.push([w / 2 + Math.cos(a) * w * k, h / 2 + Math.sin(a) * h * k])
    }
    polyPath(ctx, pts)
    holo(ctx, h, c)
    bullseye(ctx, w / 2, h / 2, Math.min(w, h) * 0.13, c)
  }
}

/** Regular n-gon with a counter-turning inner n-gon and corner lights (bosses, heavies). */
function core(n: number): Holo {
  return (ctx, w, h, t, c) => {
    const cx = w / 2
    const cy = h / 2
    regularPoly(ctx, cx, cy, w * 0.48, h * 0.48, n, -Math.PI / 2)
    holo(ctx, h, c)
    regularPoly(ctx, cx, cy, w * 0.3, h * 0.3, n, (t * Math.PI * 2) / n)
    trace(ctx, c, 0.6)
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n
      glow(ctx, cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.4, Math.min(w, h) * 0.06, c)
    }
    bullseye(ctx, cx, cy, Math.min(w, h) * 0.18, c)
  }
}

/** Disc with turning arc segments (gunships). */
const hRing: Holo = (ctx, w, h, t, c) => {
  const cx = w / 2
  const cy = h / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.44, h * 0.44, 0, 0, Math.PI * 2)
  holo(ctx, h, c)
  for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, w * 0.34, h * 0.34, 0, a, a + 0.8)
    trace(ctx, c, 1, 2)
  }
  bullseye(ctx, cx, cy, Math.min(w, h) * 0.2, c)
}

/** Three turning blades around a hub (rotor drone). */
const hRotor: Holo = (ctx, w, h, t, c) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.48
  for (let i = 0; i < 3; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI * 2) / 3
    const [co, si] = [Math.cos(a), Math.sin(a)]
    polyPath(ctx, [
      [cx - si * R * 0.12, cy + co * R * 0.12],
      [cx + co * R - si * R * 0.2, cy + si * R + co * R * 0.2],
      [cx + co * R + si * R * 0.05, cy + si * R - co * R * 0.05],
      [cx + si * R * 0.12, cy - co * R * 0.12],
    ])
    holo(ctx, h, c)
  }
  bullseye(ctx, cx, cy, R * 0.3, c)
}

/** Four small discs circling a ring (orbiter). */
const hOrbit: Holo = (ctx, w, h, t, c) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.34
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  trace(ctx, c, 0.7, 2)
  for (let i = 0; i < 4; i++) {
    const a = (t * Math.PI) / 2 + (i * Math.PI) / 2
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.36, 0, Math.PI * 2)
    holo(ctx, h, c)
  }
  bullseye(ctx, cx, cy, R * 0.45, c)
}

/** Crescent, horns forward. */
const hCrescent: Holo = (ctx, w, h, _t, c) => {
  ctx.beginPath()
  ctx.moveTo(w * 0.03, h * 0.96)
  ctx.quadraticCurveTo(w * 0.02, h * 0.04, w / 2, h * 0.04)
  ctx.quadraticCurveTo(w * 0.98, h * 0.04, w * 0.97, h * 0.96)
  ctx.quadraticCurveTo(w * 0.78, h * 0.45, w / 2, h * 0.55)
  ctx.quadraticCurveTo(w * 0.22, h * 0.45, w * 0.03, h * 0.96)
  ctx.closePath()
  holo(ctx, h, c)
  bullseye(ctx, w / 2, h * 0.3, Math.min(w, h) * 0.16, c)
}

/** Circle with crosshair ticks. */
const hDisc: Holo = (ctx, w, h, _t, c) => {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.4
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  holo(ctx, h, c)
  ctx.beginPath()
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as Pt[]) {
    ctx.moveTo(cx + dx * R * 0.7, cy + dy * R * 0.7)
    ctx.lineTo(cx + dx * R * 1.2, cy + dy * R * 1.2)
  }
  trace(ctx, c, 1, 2)
  bullseye(ctx, cx, cy, R * 0.4, c)
}

/** Ground vehicle hull (moves sideways): rounded slab with a `kind` specific inner pattern. */
function vehicle(kind: "treads" | "wheels" | "boxes" | "tanks" | "pad" | "hatches"): Holo {
  return (ctx, w, h, _t, c) => {
    const cy = h / 2
    roundRect(ctx, w * 0.03, h * 0.08, w * 0.94, h * 0.84, Math.min(w, h) * 0.3)
    holo(ctx, h, c)
    ctx.beginPath()
    if (kind === "treads")
      for (let x = w * 0.12; x < w * 0.9; x += w * 0.08) {
        ctx.moveTo(x, h * 0.12)
        ctx.lineTo(x, h * 0.28)
        ctx.moveTo(x, h * 0.72)
        ctx.lineTo(x, h * 0.88)
      }
    else if (kind === "wheels")
      for (const x of [0.18, 0.4, 0.62, 0.84]) {
        ctx.moveTo(w * x + h * 0.1, h * 0.2)
        ctx.arc(w * x, h * 0.2, h * 0.1, 0, Math.PI * 2)
        ctx.moveTo(w * x + h * 0.1, h * 0.8)
        ctx.arc(w * x, h * 0.8, h * 0.1, 0, Math.PI * 2)
      }
    else if (kind === "boxes")
      for (const x of [0.2, 0.4, 0.6]) ctx.rect(w * x, h * 0.25, w * 0.14, h * 0.5)
    else if (kind === "tanks")
      for (const x of [0.25, 0.5, 0.75]) {
        ctx.moveTo(w * x + h * 0.28, cy)
        ctx.arc(w * x, cy, h * 0.28, 0, Math.PI * 2)
      }
    else if (kind === "pad") {
      ctx.moveTo(w * 0.42, h * 0.25)
      ctx.lineTo(w * 0.42, h * 0.75)
      ctx.moveTo(w * 0.58, h * 0.25)
      ctx.lineTo(w * 0.58, h * 0.75)
      ctx.moveTo(w * 0.42, cy)
      ctx.lineTo(w * 0.58, cy)
    } else
      for (const x of [0.3, 0.7])
        for (const y of [0.3, 0.7]) {
          ctx.moveTo(w * x + h * 0.12, h * y)
          ctx.arc(w * x, h * y, h * 0.12, 0, Math.PI * 2)
        }
    trace(ctx, c, 0.8)
    bullseye(ctx, w / 2, cy, Math.min(w, h) * 0.16, c)
  }
}

/** Armed emplacement (fires back): `sides`-gon base (0 = round) with `guns` barrels, fixed `aim`
 *  or turning with the frames; never square like the passive target pads (fx.ts). */
function emplacement(sides: number, guns: number, aim?: number): Holo {
  return (ctx, w, h, t, c) => {
    const cx = w / 2
    const cy = h / 2
    const m = Math.min(w, h)
    if (sides) regularPoly(ctx, cx, cy, w * 0.46, h * 0.46, sides, -Math.PI / 2 + Math.PI / sides)
    else {
      ctx.beginPath()
      ctx.arc(cx, cy, m * 0.46, 0, Math.PI * 2)
    }
    holo(ctx, h, c)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(aim ?? t * Math.PI * 2)
    const bw = m * 0.08
    for (let g = 0; g < guns; g++) {
      const x = (g - (guns - 1) / 2) * bw * 1.5
      roundRect(ctx, x - bw / 2, 0, bw, m * 0.46, 2)
      holo(ctx, h, c)
    }
    ctx.restore()
    bullseye(ctx, cx, cy, m * 0.18, c)
  }
}

/** Turning wireframe cube (critters, training dummies). */
const hCube: Holo = (ctx, w, h, t, c) => {
  const cx = w / 2
  const cy = h / 2
  const s = Math.min(w, h) * 0.28
  const spin = t * Math.PI * 2
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
  holo(ctx, h, c)
  roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 1)
  holo(ctx, h, c)
  bullseye(ctx, cx, cy, s * 0.6, c)
}

const MINT = "#5dffc8"
const CYAN = "#4dd8ff"
const BLUE = "#7a96ff"
const VIOLET = "#b48cff"
const PINK = "#ff7ad8"
const YELLOW = "#ffd24a"
const ORANGE = "#ff9a3d"
const RED = "#ff5a4a"
const LIME = "#b6ff4a"
const WHITE = "#e8f4ff"

const hChevron = mirrored([
  [0, 0.97],
  [0.44, 0.3],
  [0.37, 0.08],
  [0.1, 0.3],
  [0, 0.18],
])
const hNeedle = mirrored([
  [0, 0.98],
  [0.16, 0.6],
  [0.14, 0.16],
  [0.4, 0.04],
  [0.06, 0.04],
])
const hTri = shape(
  [
    [0.04, 0.04],
    [0.96, 0.04],
    [0.5, 0.97],
  ],
  0.5,
  0.36,
)
const hDiamond = shape([
  [0.5, 0.02],
  [0.96, 0.5],
  [0.5, 0.98],
  [0.04, 0.5],
])
const hPlus = shape([
  [0.36, 0.04],
  [0.64, 0.04],
  [0.64, 0.36],
  [0.96, 0.36],
  [0.96, 0.64],
  [0.64, 0.64],
  [0.64, 0.96],
  [0.36, 0.96],
  [0.36, 0.64],
  [0.04, 0.64],
  [0.04, 0.36],
  [0.36, 0.36],
])
const hX = shape([
  [0.04, 0.16],
  [0.16, 0.04],
  [0.5, 0.38],
  [0.84, 0.04],
  [0.96, 0.16],
  [0.62, 0.5],
  [0.96, 0.84],
  [0.84, 0.96],
  [0.5, 0.62],
  [0.16, 0.96],
  [0.04, 0.84],
  [0.38, 0.5],
])
const hShield = shape(
  [
    [0.08, 0.04],
    [0.92, 0.04],
    [0.98, 0.55],
    [0.5, 0.98],
    [0.02, 0.55],
  ],
  0.5,
  0.42,
)
const hTrident = shape(
  [
    [0.04, 0.06],
    [0.96, 0.06],
    [0.96, 0.96],
    [0.8, 0.96],
    [0.78, 0.4],
    [0.6, 0.4],
    [0.6, 0.98],
    [0.4, 0.98],
    [0.4, 0.4],
    [0.22, 0.4],
    [0.2, 0.96],
    [0.04, 0.96],
  ],
  0.5,
  0.24,
  0.14,
)
const hY = shape(
  [
    [0.42, 0.98],
    [0.42, 0.56],
    [0.06, 0.2],
    [0.18, 0.08],
    [0.5, 0.4],
    [0.82, 0.08],
    [0.94, 0.2],
    [0.58, 0.56],
    [0.58, 0.98],
  ],
  0.5,
  0.5,
  0.13,
)

/** Picture name -> training hologram for every unit the training waves spawn (no two alike in a wave). */
const TRAIN_LOOK: Record<string, [Holo, string]> = {
  SHIP01G1_PIC: [hChevron, MINT],
  SHIP02G1_PIC: [hRing, CYAN],
  SHIP05G1_PIC: [hCrescent, PINK],
  SHIP06G1_PIC: [core(6), ORANGE],
  SHIP07G1_PIC: [vehicle("treads"), ORANGE],
  SHIP08G1_PIC: [vehicle("wheels"), YELLOW],
  SHIP09G1_PIC: [vehicle("boxes"), PINK],
  SHIP10G1_PIC: [core(6), YELLOW],
  SHIP11G1_PIC: [core(8), ORANGE],
  SHIP12G1_PIC: [core(4), WHITE],
  SHIP14G1_PIC: [hCrescent, LIME],
  SHIP15G1_PIC: [vehicle("tanks"), VIOLET],
  SHIP18G1_PIC: [core(5), WHITE],
  SHIP19G1_PIC: [hRotor, YELLOW],
  SHIP20G1_PIC: [vehicle("pad"), BLUE],
  SHIP21G1_PIC: [vehicle("hatches"), RED],
  SHIP24G1_PIC: [hPlus, WHITE],
  SHIP25G1_PIC: [star(4, 0.18), PINK],
  SHIP27G1_PIC: [hTri, WHITE],
  SHIP28G1_PIC: [hShield, VIOLET],
  SHIP29G1_PIC: [core(6), RED],
  SHIP30G1_PIC: [hY, CYAN],
  SHIP31G1_PIC: [hDisc, ORANGE],
  SHIP34G1_PIC: [star(6, 0.24), RED],
  SHIP35G1_PIC: [hTrident, YELLOW],
  SHIP36G1_PIC: [hX, BLUE],
  SHIP38G1_PIC: [hOrbit, CYAN],
  SHIP39G1_PIC: [hNeedle, LIME],
  SHIP40G1_PIC: [hDiamond, BLUE],
  TARG10G1_PIC: [emplacement(6, 1, Math.PI / 4), RED],
  TARGT9G1_PIC: [emplacement(6, 1, -Math.PI / 4), ORANGE],
  TARGT2G1_PIC: [emplacement(0, 2), ORANGE],
  TARGT3G1_PIC: [emplacement(5, 3), PINK],
  TARGT4G1_PIC: [emplacement(6, 4), YELLOW],
  TARGT5G1_PIC: [emplacement(3, 1), RED],
  BONUS1G1_PIC: [vehicle("boxes"), MINT],
  DINO_PIC: [hCube, VIOLET],
  APE_PIC: [hCube, VIOLET],
}

function drawTrainingUnit(ctx: Ctx, name: string, w: number, h: number, t: number) {
  const [look, color] = TRAIN_LOOK[name] ?? [hCube, MINT]
  look(ctx, w, h, t, color)
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
  const spec = specFor(name, w, h)
  spec.draw(ctx, w, h, t, seeded(hashString(name)), spec.pal)
}

/**
 * Player ship, nose up; bank -3..3 (DOS playerpic 0..6, 3 = level). The bank is drawn as a roll:
 * the lowered wing (left for bank < 0) shrinks and darkens, the raised one stays wide and lit,
 * the hull shows its side on the lowered side.
 */
export function drawPlayer(ctx: Ctx, w: number, h: number, bank: number): void {
  const p = PLAYER_PAL
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
