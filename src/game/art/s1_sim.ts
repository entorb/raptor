// Training sector art: the holographic simulator. Target drones per original picture name
// (`TRAIN_LOOK`: own shape + color, same hitbox), target pads and their derezzed wrecks, the sim
// backdrops and the simulator deck terrain colors (`simSurface`).
import {
  bullseye,
  type Ctx,
  glow,
  mirrorPath,
  mod,
  type Pt,
  polyPath,
  regularPoly,
  roundRect,
  seeded,
} from "./draw"
import type { Surface } from "./terrain"

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

type VehicleKind = "treads" | "wheels" | "boxes" | "tanks" | "pad" | "hatches"

const VEHICLE_PATTERN: Record<
  VehicleKind,
  (ctx: CanvasRenderingContext2D, w: number, h: number) => void
> = {
  treads(ctx, w, h) {
    for (let x = w * 0.12; x < w * 0.9; x += w * 0.08) {
      ctx.moveTo(x, h * 0.12)
      ctx.lineTo(x, h * 0.28)
      ctx.moveTo(x, h * 0.72)
      ctx.lineTo(x, h * 0.88)
    }
  },
  wheels(ctx, w, h) {
    for (const x of [0.18, 0.4, 0.62, 0.84]) {
      ctx.moveTo(w * x + h * 0.1, h * 0.2)
      ctx.arc(w * x, h * 0.2, h * 0.1, 0, Math.PI * 2)
      ctx.moveTo(w * x + h * 0.1, h * 0.8)
      ctx.arc(w * x, h * 0.8, h * 0.1, 0, Math.PI * 2)
    }
  },
  boxes(ctx, w, h) {
    for (const x of [0.2, 0.4, 0.6]) ctx.rect(w * x, h * 0.25, w * 0.14, h * 0.5)
  },
  tanks(ctx, w, h) {
    for (const x of [0.25, 0.5, 0.75]) {
      ctx.moveTo(w * x + h * 0.28, h / 2)
      ctx.arc(w * x, h / 2, h * 0.28, 0, Math.PI * 2)
    }
  },
  pad(ctx, w, h) {
    ctx.moveTo(w * 0.42, h * 0.25)
    ctx.lineTo(w * 0.42, h * 0.75)
    ctx.moveTo(w * 0.58, h * 0.25)
    ctx.lineTo(w * 0.58, h * 0.75)
    ctx.moveTo(w * 0.42, h / 2)
    ctx.lineTo(w * 0.58, h / 2)
  },
  hatches(ctx, w, h) {
    for (const x of [0.3, 0.7])
      for (const y of [0.3, 0.7]) {
        ctx.moveTo(w * x + h * 0.12, h * y)
        ctx.arc(w * x, h * y, h * 0.12, 0, Math.PI * 2)
      }
  },
}

/** Ground vehicle hull (moves sideways): rounded slab with a `kind` specific inner pattern. */
function vehicle(kind: VehicleKind): Holo {
  return (ctx, w, h, _t, c) => {
    const cy = h / 2
    roundRect(ctx, w * 0.03, h * 0.08, w * 0.94, h * 0.84, Math.min(w, h) * 0.3)
    holo(ctx, h, c)
    ctx.beginPath()
    VEHICLE_PATTERN[kind](ctx, w, h)
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

/** Training hologram of an original picture name. */
export function drawTrainingUnit(ctx: Ctx, name: string, w: number, h: number, t: number) {
  const [look, color] = TRAIN_LOOK[name] ?? [hCube, MINT]
  look(ctx, w, h, t, color)
}

// ---- target pads ---------------------------------------------------------------------------------

/** Training range pad: dark plate with a sim grid, glowing edge and `kind` specific targets. */
export function drawTrainingStructure(ctx: Ctx, kind: number, s: number): void {
  const line = ["#5dffc8", "#ffd24a", "#7fd3ff", "#ff7ad8"][kind % 4] as string
  roundRect(ctx, s * 0.08, s * 0.08, s * 0.84, s * 0.84, 6)
  ctx.fillStyle = "rgba(10,24,36,0.9)"
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = "rgba(93,255,200,0.18)"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < 6; i++) {
    ctx.moveTo((s * i) / 6, 0)
    ctx.lineTo((s * i) / 6, s)
    ctx.moveTo(0, (s * i) / 6)
    ctx.lineTo(s, (s * i) / 6)
  }
  ctx.stroke()
  ctx.restore()
  roundRect(ctx, s * 0.08, s * 0.08, s * 0.84, s * 0.84, 6)
  ctx.save()
  ctx.shadowColor = line
  ctx.shadowBlur = 8
  ctx.strokeStyle = line
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
  const c = s / 2
  switch (kind % 4) {
    case 0:
      bullseye(ctx, c, c, s * 0.3)
      break
    case 1:
      for (const [x, y] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.3, 0.7],
        [0.7, 0.7],
      ])
        bullseye(ctx, s * (x as number), s * (y as number), s * 0.14, line)
      break
    case 2:
      // sensor pylon
      for (let i = 3; i > 0; i--) {
        ctx.beginPath()
        ctx.arc(c, c, s * 0.1 * i, 0, Math.PI * 2)
        ctx.strokeStyle = line
        ctx.globalAlpha = 0.3 * i
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      glow(ctx, c, c, s * 0.14, line)
      break
    default:
      // hazard-striped practice crate
      ctx.save()
      roundRect(ctx, s * 0.22, s * 0.22, s * 0.56, s * 0.56, 3)
      ctx.clip()
      for (let i = -4; i < 8; i++) {
        polyPath(ctx, [
          [s * (i * 0.14), s],
          [s * (i * 0.14 + 0.07), s],
          [s * (i * 0.14 + 0.07 + 1), 0],
          [s * (i * 0.14 + 1), 0],
        ])
        ctx.fillStyle = "#ffd24a"
        ctx.fill()
      }
      ctx.restore()
      bullseye(ctx, c, c, s * 0.12, line)
  }
}

/** Wireframe outline left by a "destroyed" training structure. */
export function drawTrainingWreck(ctx: Ctx, s: number, seed: number): void {
  const r = seeded(seed)
  roundRect(ctx, s * 0.08, s * 0.08, s * 0.84, s * 0.84, 6)
  ctx.fillStyle = "rgba(10,24,36,0.6)"
  ctx.fill()
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = "rgba(93,255,200,0.45)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
  // derezzed pixel blocks
  for (let i = 0; i < 14; i++) {
    const b = s * (0.03 + r() * 0.05)
    ctx.fillStyle = `rgba(93,255,200,${0.15 + r() * 0.35})`
    ctx.fillRect(s * (0.15 + r() * 0.65), s * (0.15 + r() * 0.65), b, b)
  }
}

// ---- backdrops ---------------------------------------------------------------------------------

/** Sim grid lines every `step` px (tileable at 512). */
function grid(ctx: Ctx, step: number, color: string, width: number): void {
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

/** Dark sim floor with a fine grid (tileable 512). */
export function simFloor(ctx: Ctx): void {
  ctx.fillStyle = "#04070f"
  ctx.fillRect(0, 0, 512, 512)
  grid(ctx, 32, "rgba(60,160,255,0.10)", 1)
}

/** Coarse glowing sim grid (near parallax layer). */
export function simGrid(ctx: Ctx): void {
  grid(ctx, 128, "rgba(93,255,200,0.22)", 2)
}

/** Scattered sim marker dots (mid parallax layer). */
export function simDots(ctx: Ctx): void {
  const r = seeded(5)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(93,255,200,${0.2 + r() * 0.5})`
    ctx.fillRect(Math.floor(r() * 16) * 32 + 15, Math.floor(r() * 16) * 32 + 15, 3, 3)
  }
}

// ---- terrain -----------------------------------------------------------------------------------

/** Simulator deck: gridded floor, lit panels (hull) and hazard stripes (lichen). */
export function simSurface(
  s: Surface,
  m: number,
  lic: number,
  shade: number,
  dx: number,
  dy: number,
): void {
  if (m > 0.5) {
    simPanel(s, shade, dx, dy)
  } else if (lic > 0.45) {
    simStripe(s, shade, dx, dy)
  } else {
    simDeck(s, shade, dx, dy)
  }
}

function simPanel(s: Surface, shade: number, dx: number, dy: number): void {
  const seam = mod(dx, 16) < 0.8 || dy % 16 < 0.8
  s.rgb[0] = (seam ? 60 : 44) * shade
  s.rgb[1] = (seam ? 230 : 62) * shade
  s.rgb[2] = (seam ? 190 : 78) * shade
}

function simStripe(s: Surface, shade: number, dx: number, dy: number): void {
  const stripe = mod(dx + dy, 24) < 5
  s.rgb[0] = (stripe ? 150 : 30) * shade
  s.rgb[1] = (stripe ? 120 : 36) * shade
  s.rgb[2] = (stripe ? 30 : 48) * shade
}

function simDeck(s: Surface, shade: number, dx: number, dy: number): void {
  const grid = mod(dx, 32) < 0.8 || dy % 32 < 0.8
  s.rgb[0] = (grid ? 40 : 20) * shade
  s.rgb[1] = (grid ? 150 : 30) * shade
  s.rgb[2] = (grid ? 210 : 44) * shade
}
