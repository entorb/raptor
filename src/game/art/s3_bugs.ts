// Bugger Nest art (web-only sector): Formic insects drawn from chitin parts (segments, veined
// wings that flap over the animation frames, jointed legs, mandibles, glowing eyes), nose down
// like every enemy. Tints follow the threat convention of `ships.ts` (pale fodder ... violet elite).
// Also the hive structures / wrecks, the three organic backdrops and the hive terrain colors.
import { type Ctx, fbm, glow, hash2, polyPath, seeded, softDot, sphere, vnoise } from "./draw"
import type { Draw, Palette, Spec } from "./ships"
import type { Surface } from "./terrain"

const TAU = Math.PI * 2

// ---- palettes (accent = eyes / acid, engine = bio glow, glass = wing membrane) ----------------
const LARVA: Palette = {
  dark: "#231d14",
  mid: "#857558",
  light: "#f2e6c6",
  accent: "#ff5a3c",
  engine: "#ffb03c",
  glass: "#e8f0ff",
}
const AMBER: Palette = {
  dark: "#2a1606",
  mid: "#8a5214",
  light: "#ffc860",
  accent: "#9dff3d",
  engine: "#ffd23d",
  glass: "#fff0c0",
}
const TOXIC: Palette = {
  dark: "#0e1a0a",
  mid: "#4a6a1e",
  light: "#d8f08a",
  accent: "#c8ff40",
  engine: "#9dff3d",
  glass: "#e0ffd0",
}
const JADE: Palette = {
  dark: "#0a1a10",
  mid: "#2f6a3a",
  light: "#a8e8a8",
  accent: "#ffd23d",
  engine: "#ffd23d",
  glass: "#d8ffe8",
}
const COPPER: Palette = {
  dark: "#24100a",
  mid: "#8a3e1a",
  light: "#f0a070",
  accent: "#46e0ff",
  engine: "#ff8a3c",
  glass: "#ffe0c8",
}
const CRIMSON: Palette = {
  dark: "#1c080a",
  mid: "#6a1a22",
  light: "#e07a80",
  accent: "#ffd23d",
  engine: "#ff6a3c",
  glass: "#ffd0d0",
}
const HAZARD: Palette = {
  dark: "#1a1606",
  mid: "#8a7a10",
  light: "#ffec70",
  accent: "#ff2e2e",
  engine: "#ff6a2e",
  glass: "#fff8c0",
}
const OBSIDIAN: Palette = {
  dark: "#07080b",
  mid: "#262a36",
  light: "#9aa2bc",
  accent: "#46e0ff",
  engine: "#46e0ff",
  glass: "#c8f4ff",
}
const ICE: Palette = {
  dark: "#0a1420",
  mid: "#2a5a7a",
  light: "#c8ecff",
  accent: "#9dff3d",
  engine: "#9dff3d",
  glass: "#e8faff",
}
const VIOLET: Palette = {
  dark: "#140a22",
  mid: "#4a2a7a",
  light: "#d0b0f8",
  accent: "#ff4fd8",
  engine: "#c04dff",
  glass: "#f0e0ff",
}
const MOTH: Palette = {
  dark: "#1a2420",
  mid: "#6f8a80",
  light: "#f2fbf6",
  accent: "#2eff8a",
  engine: "#7fffb8",
  glass: "#e8fff2",
}
const HIVE: Palette = {
  dark: "#1a1012",
  mid: "#5a3440",
  light: "#d89aa8",
  accent: "#9dff3d",
  engine: "#c8ff40",
  glass: "#e8ffd0",
}
const ROYAL: Palette = {
  dark: "#10061c",
  mid: "#3e1e6a",
  light: "#c8a0ff",
  accent: "#ff4fd8",
  engine: "#9dff3d",
  glass: "#f4e8ff",
}
const BLOOD: Palette = {
  dark: "#16060a",
  mid: "#5a1424",
  light: "#f08a98",
  accent: "#9dff3d",
  engine: "#ffb03c",
  glass: "#ffe0e8",
}

// ---- parts -------------------------------------------------------------------------------------

/** Wing span over the animation: wide, folded, wide, folded (4 frame flap). */
const flap = (t: number, k = 0.45) => 1 - k + k * Math.abs(Math.cos(t * TAU))

/** Chitin segment: lit ellipse, dark rim and a faint center ridge. */
function seg(ctx: Ctx, x: number, y: number, rx: number, ry: number, p: Palette): void {
  const g = ctx.createRadialGradient(
    x - rx * 0.35,
    y - ry * 0.4,
    Math.min(rx, ry) * 0.1,
    x,
    y,
    Math.max(rx, ry),
  )
  g.addColorStop(0, p.light)
  g.addColorStop(0.45, p.mid)
  g.addColorStop(1, p.dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fill()
  ctx.lineWidth = Math.max(1, rx / 14)
  ctx.strokeStyle = "rgba(0,0,0,0.55)"
  ctx.stroke()
  ctx.strokeStyle = "rgba(255,255,255,0.16)"
  ctx.beginPath()
  ctx.moveTo(x, y - ry * 0.75)
  ctx.lineTo(x, y + ry * 0.75)
  ctx.stroke()
}

/** Segment bands across an abdomen. */
function bands(ctx: Ctx, x: number, y: number, rx: number, ry: number, n: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.clip()
  ctx.strokeStyle = "rgba(0,0,0,0.45)"
  ctx.lineWidth = Math.max(1, ry / 10)
  ctx.beginPath()
  for (let i = 1; i <= n; i++) {
    const yy = y - ry + (2 * ry * i) / (n + 1)
    ctx.moveTo(x - rx, yy - ry * 0.15)
    ctx.quadraticCurveTo(x, yy + ry * 0.2, x + rx, yy - ry * 0.15)
  }
  ctx.stroke()
  ctx.restore()
}

/** A pair of translucent veined wings rooted at (x, y), swept back by `sweep` rad, span x `span`. */
function wings(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  wid: number,
  sweep: number,
  span: number,
  p: Palette,
): void {
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, 1)
    ctx.rotate(-sweep)
    ctx.scale(span, 1)
    ctx.beginPath()
    ctx.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, TAU)
    ctx.globalAlpha = 0.32
    ctx.fillStyle = p.glass
    ctx.fill()
    ctx.globalAlpha = 0.75
    ctx.lineWidth = Math.max(1, wid / 16)
    ctx.strokeStyle = p.light
    ctx.stroke()
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(len * 0.5, i * wid * 0.2, len * 0.95, i * wid * 0.28)
    }
    ctx.stroke()
    ctx.restore()
  }
}

/** `n` pairs of jointed legs from y0 (tail side) to y1 (head side), walking with phase `t`. */
function legs(
  ctx: Ctx,
  cx: number,
  y0: number,
  y1: number,
  n: number,
  reach: number,
  t: number,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, reach / 9)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0.5
    const y = y0 + (y1 - y0) * k
    for (const s of [-1, 1]) {
      const step = Math.sin((t + i / n + (s > 0 ? 0.5 : 0)) * TAU) * reach * 0.15
      ctx.moveTo(cx, y)
      ctx.lineTo(cx + s * reach * 0.6, y - reach * 0.25 + step)
      ctx.lineTo(cx + s * reach, y + reach * (0.6 * k - 0.3) + step)
    }
  }
  ctx.stroke()
  ctx.restore()
}

/** Curved pincers below the head at y; `open` 0..1. */
function mandibles(ctx: Ctx, cx: number, y: number, size: number, open: number, c: string): void {
  ctx.fillStyle = c
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * size * 0.3, y)
    ctx.quadraticCurveTo(
      cx + s * size * (0.75 + open * 0.3),
      y + size * 0.45,
      cx + s * size * (0.12 + open * 0.25),
      y + size,
    )
    ctx.quadraticCurveTo(
      cx + s * size * (0.45 + open * 0.2),
      y + size * 0.4,
      cx + s * size * 0.06,
      y + size * 0.12,
    )
    ctx.closePath()
    ctx.fill()
  }
}

function eyes(ctx: Ctx, cx: number, y: number, dx: number, r: number, c: string): void {
  for (const s of [-1, 1]) glow(ctx, cx + s * dx, y, r, c)
}

function antennae(ctx: Ctx, cx: number, y: number, len: number, c: string): void {
  ctx.save()
  ctx.strokeStyle = c
  ctx.lineWidth = Math.max(1, len / 18)
  ctx.beginPath()
  for (const s of [-1, 1]) {
    ctx.moveTo(cx + s * len * 0.1, y)
    ctx.quadraticCurveTo(cx + s * len * 0.6, y + len * 0.3, cx + s * len * 0.75, y + len)
  }
  ctx.stroke()
  ctx.restore()
}

/** Spikes on an ellipse from angle a0 to a1 (radians, 0 = right, PI/2 = down). */
function spikes(
  ctx: Ctx,
  [cx, cy, rx, ry]: [number, number, number, number],
  n: number,
  len: number,
  [a0, a1]: [number, number],
  c: string,
): void {
  ctx.fillStyle = c
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n
    const da = ((a1 - a0) / n) * 0.35
    const base = (b: number): [number, number] => [cx + Math.cos(b) * rx, cy + Math.sin(b) * ry]
    polyPath(ctx, [
      base(a - da),
      [cx + Math.cos(a) * (rx + len), cy + Math.sin(a) * (ry + len)],
      base(a + da),
    ])
    ctx.fill()
  }
}

/** Glowing acid sac (sphere with a bright core). */
function sac(ctx: Ctx, x: number, y: number, r: number, c: string, pulse = 1): void {
  sphere(ctx, x, y, r, 0.3, 0.05, [
    [0, "#ffffff"],
    [0.3, c],
    [1, "rgba(0,0,0,0.85)"],
  ])
  glow(ctx, x, y, r * 1.3 * pulse, c)
}

// ---- air units ---------------------------------------------------------------------------------

/** Worker drone: banded abdomen, one wing pair, mandibles. */
const drone: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.45, h * 0.62, 3, w * 0.28, t, p.dark)
  seg(ctx, cx, h * 0.24, w * 0.15, h * 0.21, p)
  bands(ctx, cx, h * 0.24, w * 0.15, h * 0.21, 3)
  seg(ctx, cx, h * 0.52, w * 0.12, h * 0.13, p)
  wings(ctx, cx, h * 0.46, w * 0.48, h * 0.26, 0.45, flap(t), p)
  seg(ctx, cx, h * 0.74, w * 0.1, h * 0.1, p)
  mandibles(ctx, cx, h * 0.8, w * 0.11, 0.5 + 0.5 * Math.sin(t * TAU), p.dark)
  eyes(ctx, cx, h * 0.74, w * 0.06, w * 0.05, p.accent)
}

/** Swarmling: round body, two buzzing wing pairs, big eyes. */
const ling: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.6)
  wings(ctx, cx, h * 0.45, w * 0.46, h * 0.22, 0.75, span, p)
  wings(ctx, cx, h * 0.5, w * 0.36, h * 0.16, 0.1, 1.4 - span, p)
  seg(ctx, cx, h * 0.4, w * 0.18, h * 0.22, p)
  seg(ctx, cx, h * 0.7, w * 0.15, h * 0.13, p)
  eyes(ctx, cx, h * 0.72, w * 0.1, w * 0.1, p.accent)
  antennae(ctx, cx, h * 0.8, w * 0.2, p.light)
}

/** Spitter: flat body between two glowing acid sacs. */
const spitter: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  wings(ctx, cx, h * 0.35, w * 0.4, h * 0.3, 0.6, flap(t), p)
  for (const s of [-1, 1]) sac(ctx, cx + s * w * 0.2, h * 0.55, w * 0.1, p.accent, flap(t, 0.2))
  seg(ctx, cx, h * 0.38, w * 0.13, h * 0.3, p)
  bands(ctx, cx, h * 0.38, w * 0.13, h * 0.3, 2)
  seg(ctx, cx, h * 0.76, w * 0.1, h * 0.12, p)
  eyes(ctx, cx, h * 0.78, w * 0.05, w * 0.045, p.engine)
}

/** Mantis: long thorax, folded raptorial forelegs, narrow wings. */
const mantis: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.35, h * 0.5, 2, w * 0.3, t, p.dark)
  wings(ctx, cx, h * 0.4, w * 0.46, h * 0.16, 0.9, flap(t), p)
  seg(ctx, cx, h * 0.2, w * 0.11, h * 0.2, p)
  seg(ctx, cx, h * 0.52, w * 0.07, h * 0.18, p)
  ctx.save()
  ctx.strokeStyle = p.light
  ctx.lineWidth = w * 0.04
  ctx.lineCap = "round"
  ctx.beginPath()
  for (const s of [-1, 1]) {
    ctx.moveTo(cx + s * w * 0.05, h * 0.62)
    ctx.lineTo(cx + s * w * 0.22, h * 0.72)
    ctx.lineTo(cx + s * w * 0.12, h * 0.94)
  }
  ctx.stroke()
  ctx.restore()
  seg(ctx, cx, h * 0.76, w * 0.09, h * 0.08, p)
  eyes(ctx, cx, h * 0.75, w * 0.08, w * 0.05, p.accent)
}

/** Hornet: striped abdomen with two missile glands, stubby wings. */
const hornet: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  wings(ctx, cx, h * 0.42, w * 0.42, h * 0.2, 0.3, flap(t), p)
  seg(ctx, cx, h * 0.3, w * 0.17, h * 0.26, p)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.3, w * 0.17, h * 0.26, 0, 0, TAU)
  ctx.clip()
  ctx.fillStyle = p.engine
  ctx.globalAlpha = 0.6
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - w * 0.2, h * (0.12 + i * 0.12), w * 0.4, h * 0.05)
  ctx.restore()
  for (const s of [-1, 1]) sac(ctx, cx + s * w * 0.27, h * 0.68, w * 0.07, p.engine)
  seg(ctx, cx, h * 0.62, w * 0.12, h * 0.12, p)
  seg(ctx, cx, h * 0.8, w * 0.1, h * 0.08, p)
  mandibles(ctx, cx, h * 0.84, w * 0.1, 0.4, p.dark)
  eyes(ctx, cx, h * 0.79, w * 0.06, w * 0.05, p.accent)
}

/** Stinger: hazard-striped dart with a long forward lance. */
const stinger: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  wings(ctx, cx, h * 0.38, w * 0.5, h * 0.2, 0.75, flap(t, 0.3), p)
  ctx.fillStyle = p.light
  polyPath(ctx, [
    [cx - w * 0.04, h * 0.6],
    [cx, h * 0.99],
    [cx + w * 0.04, h * 0.6],
  ])
  ctx.fill()
  seg(ctx, cx, h * 0.3, w * 0.12, h * 0.26, p)
  bands(ctx, cx, h * 0.3, w * 0.12, h * 0.26, 4)
  seg(ctx, cx, h * 0.6, w * 0.09, h * 0.1, p)
  eyes(ctx, cx, h * 0.6, w * 0.05, w * 0.04, p.accent)
  glow(ctx, cx, h * 0.96, w * 0.08, p.accent)
}

/** Beetle: split elytra shell with a horn. */
const beetle: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.35, h * 0.65, 3, w * 0.42, t, p.dark)
  wings(ctx, cx, h * 0.3, w * 0.42, h * 0.2, 0.9, flap(t, 0.3), p)
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(s < 0 ? 0 : cx, 0, cx, h)
    ctx.clip()
    seg(ctx, cx + s * w * 0.025, h * 0.42, w * 0.3, h * 0.32, p)
    ctx.restore()
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)"
  ctx.lineWidth = w * 0.02
  ctx.beginPath()
  ctx.moveTo(cx, h * 0.12)
  ctx.lineTo(cx, h * 0.74)
  ctx.stroke()
  seg(ctx, cx, h * 0.78, w * 0.14, h * 0.09, p)
  ctx.fillStyle = p.light
  polyPath(ctx, [
    [cx - w * 0.04, h * 0.82],
    [cx, h * 0.98],
    [cx + w * 0.04, h * 0.82],
  ])
  ctx.fill()
  eyes(ctx, cx, h * 0.8, w * 0.09, w * 0.04, p.accent)
}

/** Wasp: slender with a pinched waist and a long abdomen. */
const wasp: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.48, h * 0.6, 2, w * 0.36, t, p.dark)
  seg(ctx, cx, h * 0.24, w * 0.16, h * 0.22, p)
  bands(ctx, cx, h * 0.24, w * 0.16, h * 0.22, 3)
  wings(ctx, cx, h * 0.5, w * 0.48, h * 0.14, 0.8, flap(t), p)
  seg(ctx, cx, h * 0.55, w * 0.11, h * 0.1, p)
  seg(ctx, cx, h * 0.74, w * 0.12, h * 0.08, p)
  antennae(ctx, cx, h * 0.8, w * 0.3, p.mid)
  eyes(ctx, cx, h * 0.74, w * 0.08, w * 0.06, p.accent)
}

/** Spore pod: spiked puffball with pulsing pores (homing mine). */
const spore: Draw = (ctx, w, h, t, r, p) => {
  const cx = w / 2
  const cy = h / 2
  const R = w * 0.3 * (0.94 + 0.06 * Math.sin(t * TAU))
  spikes(ctx, [cx, cy, R, R], 12, w * 0.1, [0, TAU], p.mid)
  seg(ctx, cx, cy, R, R, p)
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU
    const d = r() * R * 0.7
    glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, w * 0.05 * flap(t, 0.5), p.accent)
  }
}

/** Dragonfly: long tail, four long wings, big compound eyes. */
const dragonfly: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.5)
  wings(ctx, cx, h * 0.5, w * 0.5, h * 0.13, 0.25, span, p)
  wings(ctx, cx, h * 0.58, w * 0.46, h * 0.12, -0.05, 1.5 - span, p)
  seg(ctx, cx, h * 0.26, w * 0.06, h * 0.25, p)
  bands(ctx, cx, h * 0.26, w * 0.06, h * 0.25, 5)
  seg(ctx, cx, h * 0.58, w * 0.1, h * 0.1, p)
  for (const s of [-1, 1])
    sphere(ctx, cx + s * w * 0.08, h * 0.74, w * 0.09, 0.3, 0.1, [
      [0, "#ffffff"],
      [0.3, p.accent],
      [1, p.dark],
    ])
}

/** Warden: crested armored escort with shoulder spikes and gun glands. */
const warden: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.4, h * 0.62, 3, w * 0.36, t, p.dark)
  wings(ctx, cx, h * 0.36, w * 0.4, h * 0.2, 0.6, flap(t, 0.25), p)
  spikes(
    ctx,
    [cx, h * 0.42, w * 0.26, h * 0.26],
    6,
    w * 0.1,
    [Math.PI * 0.95, Math.PI * 2.05],
    p.mid,
  )
  seg(ctx, cx, h * 0.42, w * 0.26, h * 0.26, p)
  for (const s of [-1, 1]) sac(ctx, cx + s * w * 0.32, h * 0.42, w * 0.06, p.engine)
  seg(ctx, cx, h * 0.76, w * 0.13, h * 0.11, p)
  mandibles(ctx, cx, h * 0.82, w * 0.12, 0.6, p.dark)
  eyes(ctx, cx, h * 0.75, w * 0.07, w * 0.05, p.accent)
}

/** Lancer: slim icy body, a glowing plasma lance at the head. */
const lancer: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  wings(ctx, cx, h * 0.45, w * 0.48, h * 0.18, 0.55, flap(t), p)
  seg(ctx, cx, h * 0.28, w * 0.1, h * 0.22, p)
  seg(ctx, cx, h * 0.6, w * 0.09, h * 0.12, p)
  ctx.fillStyle = p.light
  polyPath(ctx, [
    [cx - w * 0.05, h * 0.68],
    [cx, h * 0.92],
    [cx + w * 0.05, h * 0.68],
  ])
  ctx.fill()
  glow(ctx, cx, h * 0.86, w * 0.14 * flap(t, 0.3), p.accent)
  eyes(ctx, cx, h * 0.6, w * 0.06, w * 0.05, p.engine)
}

/** Brood carrier: broad segmented gunship hauling glowing egg sacs. */
const brood: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.3)
  wings(ctx, cx, h * 0.3, w * 0.48, h * 0.24, 0.5, span, p)
  wings(ctx, cx, h * 0.45, w * 0.44, h * 0.2, 0.1, 1.3 - span, p)
  for (let i = 0; i < 3; i++) seg(ctx, cx, h * (0.2 + i * 0.18), w * (0.2 - i * 0.02), h * 0.14, p)
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++)
      sac(ctx, cx + s * w * (0.12 + i * 0.07), h * (0.5 + i * 0.07), w * 0.035, p.engine)
  seg(ctx, cx, h * 0.8, w * 0.1, h * 0.1, p)
  mandibles(ctx, cx, h * 0.86, w * 0.08, 0.5, p.dark)
  eyes(ctx, cx, h * 0.79, w * 0.05, w * 0.03, p.accent)
}

/** Bonus carrier moth: wide eye-spotted wings, a glowing pod under the body. */
const moth: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.35)
  for (const [y, len, wid, sw] of [
    [0.35, 0.5, 0.36, 0.5],
    [0.5, 0.42, 0.28, -0.3],
  ] as const) {
    wings(ctx, cx, h * y, w * len, h * wid, sw, span, p)
    for (const s of [-1, 1])
      glow(ctx, cx + s * w * len * 0.55 * span, h * (y - sw * 0.12), w * 0.06, p.accent)
  }
  seg(ctx, cx, h * 0.42, w * 0.1, h * 0.26, p)
  bands(ctx, cx, h * 0.42, w * 0.1, h * 0.26, 4)
  sac(ctx, cx, h * 0.78, w * 0.13, p.engine)
  antennae(ctx, cx, h * 0.66, w * 0.24, p.light)
}

// ---- ground units ------------------------------------------------------------------------------

/** Fleshy mound with radial lobes. */
function mound(ctx: Ctx, cx: number, cy: number, R: number, lobes: number, p: Palette): void {
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * TAU
    seg(ctx, cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45, R * 0.48, R * 0.48, p)
  }
  seg(ctx, cx, cy, R * 0.62, R * 0.62, p)
}

/** Egg pod turret: lobed mound with an acid orifice. */
const pod: Draw = (ctx, w, h, _t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  mound(ctx, cx, cy, w * 0.38, 5, p)
  ctx.fillStyle = "rgba(0,0,0,0.8)"
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.13, h * 0.11, 0, 0, TAU)
  ctx.fill()
  glow(ctx, cx, cy, w * 0.16, p.accent)
}

/** Acid spire: petals open over the frames before it fires. */
const spire: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const open = Math.min(1, t / 0.8)
  mound(ctx, cx, cy, w * 0.3, 6, p)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2
    const len = w * (0.12 + 0.24 * open)
    ctx.fillStyle = p.light
    polyPath(ctx, [
      [cx + Math.cos(a - 0.35) * w * 0.08, cy + Math.sin(a - 0.35) * w * 0.08],
      [cx + Math.cos(a) * len, cy + Math.sin(a) * len],
      [cx + Math.cos(a + 0.35) * w * 0.08, cy + Math.sin(a + 0.35) * w * 0.08],
    ])
    ctx.fill()
  }
  sac(ctx, cx, cy, w * (0.06 + 0.06 * open), p.accent)
}

/** Maw: ring of fangs around a glowing throat. */
const maw: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  mound(ctx, cx, cy, w * 0.4, 7, p)
  ctx.fillStyle = "#050204"
  ctx.beginPath()
  ctx.arc(cx, cy, w * 0.2, 0, TAU)
  ctx.fill()
  glow(ctx, cx, cy, w * 0.16 * (0.8 + 0.2 * Math.sin(t * TAU)), p.accent)
  ctx.fillStyle = p.light
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU
    polyPath(ctx, [
      [cx + Math.cos(a - 0.2) * w * 0.2, cy + Math.sin(a - 0.2) * w * 0.2],
      [cx + Math.cos(a) * w * 0.1, cy + Math.sin(a) * w * 0.1],
      [cx + Math.cos(a + 0.2) * w * 0.2, cy + Math.sin(a + 0.2) * w * 0.2],
    ])
    ctx.fill()
  }
}

/** Crawler: segmented tick walking sideways on six legs. */
const crawler: Draw = (ctx, w, h, t, _r, p) => {
  const cy = h / 2
  ctx.save()
  ctx.translate(w / 2, cy)
  ctx.rotate(Math.PI / 2)
  legs(ctx, 0, -w * 0.25, w * 0.25, 3, h * 0.48, t, p.dark)
  ctx.restore()
  for (let i = 0; i < 3; i++) seg(ctx, w * (0.3 + i * 0.2), cy, w * 0.13, h * 0.32, p)
  for (const s of [-1, 1]) glow(ctx, w / 2 + s * w * 0.38, cy, h * 0.12, p.accent)
}

/** Egg cache (bonus): a membrane with glowing eggs. */
const eggs: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  seg(ctx, cx, cy, w * 0.42, h * 0.38, p)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3
    sac(
      ctx,
      cx + Math.cos(a) * w * 0.2,
      cy + Math.sin(a) * h * 0.18,
      w * 0.09,
      p.engine,
      flap(t, 0.2),
    )
  }
  sac(ctx, cx, cy, w * 0.11, p.accent)
}

// ---- bosses ------------------------------------------------------------------------------------

/** Guardian: wide armored carapace, huge claws, four eyes. */
const guardian: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  legs(ctx, cx, h * 0.3, h * 0.6, 3, w * 0.42, t, p.dark)
  for (const s of [-1, 1]) {
    seg(ctx, cx + s * w * 0.3, h * 0.72, w * 0.08, h * 0.16, p)
    mandibles(ctx, cx + s * w * 0.3, h * 0.78, w * 0.1, 0.7, p.light)
  }
  spikes(ctx, [cx, h * 0.42, w * 0.34, h * 0.34], 9, w * 0.05, [Math.PI, TAU], p.mid)
  seg(ctx, cx, h * 0.42, w * 0.34, h * 0.34, p)
  bands(ctx, cx, h * 0.42, w * 0.34, h * 0.34, 3)
  seg(ctx, cx, h * 0.76, w * 0.12, h * 0.16, p)
  mandibles(ctx, cx, h * 0.84, w * 0.08, 0.5, p.dark)
  eyes(ctx, cx, h * 0.74, w * 0.04, w * 0.025, p.accent)
  eyes(ctx, cx, h * 0.82, w * 0.07, w * 0.02, p.accent)
  for (const s of [-1, 1]) sac(ctx, cx + s * w * 0.16, h * 0.55, w * 0.035, p.engine)
}

/** Broodmother: swollen egg-laden abdomen, two wing pairs. */
const broodmother: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.25)
  legs(ctx, cx, h * 0.5, h * 0.72, 3, w * 0.36, t, p.dark)
  wings(ctx, cx, h * 0.5, w * 0.5, h * 0.22, 0.6, span, p)
  seg(ctx, cx, h * 0.28, w * 0.26, h * 0.27, p)
  bands(ctx, cx, h * 0.28, w * 0.26, h * 0.27, 4)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI + Math.PI
    sac(ctx, cx + Math.cos(a) * w * 0.16, h * 0.3 + Math.sin(a) * h * 0.14, w * 0.03, p.engine)
  }
  wings(ctx, cx, h * 0.58, w * 0.44, h * 0.18, -0.1, 1.25 - span, p)
  seg(ctx, cx, h * 0.62, w * 0.14, h * 0.12, p)
  seg(ctx, cx, h * 0.8, w * 0.11, h * 0.09, p)
  mandibles(ctx, cx, h * 0.85, w * 0.09, 0.4 + 0.3 * Math.sin(t * TAU), p.dark)
  eyes(ctx, cx, h * 0.79, w * 0.06, w * 0.03, p.accent)
}

/** Hive lord: glowing brain dome in a ring of spiked armor plates, crowned. */
const hivelord: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h * 0.46
  legs(ctx, cx, h * 0.25, h * 0.7, 4, w * 0.46, t, p.dark)
  spikes(ctx, [cx, cy, w * 0.36, h * 0.38], 14, w * 0.05, [0, TAU], p.mid)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    seg(ctx, cx + Math.cos(a) * w * 0.24, cy + Math.sin(a) * h * 0.26, w * 0.11, h * 0.12, p)
  }
  sphere(ctx, cx, cy, w * 0.2, 0.35, 0.05, [
    [0, "#ffffff"],
    [0.35, p.light],
    [1, p.dark],
  ])
  ctx.save()
  ctx.strokeStyle = p.engine
  ctx.globalAlpha = 0.6
  ctx.lineWidth = w * 0.008
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t
    ctx.moveTo(cx, cy)
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.5) * w * 0.1,
      cy + Math.sin(a + 0.5) * w * 0.1,
      cx + Math.cos(a) * w * 0.19,
      cy + Math.sin(a) * w * 0.19,
    )
  }
  ctx.stroke()
  ctx.restore()
  glow(ctx, cx, cy, w * 0.12 * flap(t, 0.25), p.engine)
  seg(ctx, cx, h * 0.86, w * 0.1, h * 0.08, p)
  mandibles(ctx, cx, h * 0.89, w * 0.07, 0.5, p.dark)
  eyes(ctx, cx, h * 0.85, w * 0.05, w * 0.025, p.accent)
}

/** Burrower: mandible ring that bursts out of the hive floor (frames = emergence). */
const burrower: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const cy = h / 2
  const grow = Math.min(1, t * 1.25)
  const R = Math.min(w, h) * 0.46
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  ctx.beginPath()
  ctx.ellipse(cx, cy, R, R * 0.95, 0, 0, TAU)
  ctx.fill()
  if (grow <= 0.05) return
  const rr = R * grow
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    seg(ctx, cx + Math.cos(a) * rr * 0.62, cy + Math.sin(a) * rr * 0.62, rr * 0.3, rr * 0.3, p)
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26
    ctx.save()
    ctx.translate(cx + Math.cos(a) * rr * 0.4, cy + Math.sin(a) * rr * 0.4)
    ctx.rotate(a - Math.PI / 2)
    mandibles(ctx, 0, 0, rr * 0.35, 0.3, p.light)
    ctx.restore()
  }
  ctx.fillStyle = "#050204"
  ctx.beginPath()
  ctx.arc(cx, cy, rr * 0.3, 0, TAU)
  ctx.fill()
  glow(ctx, cx, cy, rr * 0.35, p.accent)
}

/** Hive queen: crowned head, long abdomen, two great wing pairs, pulsing glow. */
const queen: Draw = (ctx, w, h, t, _r, p) => {
  const cx = w / 2
  const span = flap(t, 0.2)
  legs(ctx, cx, h * 0.5, h * 0.7, 3, w * 0.34, t, p.dark)
  wings(ctx, cx, h * 0.48, w * 0.5, h * 0.3, 0.55, span, p)
  wings(ctx, cx, h * 0.55, w * 0.46, h * 0.22, -0.15, 1.2 - span, p)
  seg(ctx, cx, h * 0.24, w * 0.17, h * 0.24, p)
  bands(ctx, cx, h * 0.24, w * 0.17, h * 0.24, 5)
  glow(ctx, cx, h * 0.2, w * 0.1 * (0.85 + 0.15 * Math.sin(t * TAU)), p.engine)
  seg(ctx, cx, h * 0.55, w * 0.13, h * 0.12, p)
  spikes(
    ctx,
    [cx, h * 0.76, w * 0.12, h * 0.1],
    7,
    w * 0.05,
    [Math.PI * 1.05, Math.PI * 1.95],
    p.light,
  )
  seg(ctx, cx, h * 0.76, w * 0.12, h * 0.1, p)
  mandibles(ctx, cx, h * 0.83, w * 0.1, 0.35 + 0.25 * Math.sin(t * TAU), p.dark)
  eyes(ctx, cx, h * 0.75, w * 0.05, w * 0.035, p.accent)
}

/** Picture name -> nest art (`ships.ts specFor` falls back to it). */
export const BUG_SPECS: Record<string, Spec> = {
  BUG_DRONE: { draw: drone, pal: LARVA },
  BUG_LING: { draw: ling, pal: AMBER },
  BUG_SPITTER: { draw: spitter, pal: TOXIC },
  BUG_MANTIS: { draw: mantis, pal: JADE },
  BUG_HORNET: { draw: hornet, pal: OBSIDIAN },
  BUG_STINGER: { draw: stinger, pal: HAZARD },
  BUG_BEETLE: { draw: beetle, pal: CRIMSON },
  BUG_WASP: { draw: wasp, pal: COPPER },
  BUG_SPORE: { draw: spore, pal: HAZARD },
  BUG_DRAGONFLY: { draw: dragonfly, pal: OBSIDIAN },
  BUG_WARDEN: { draw: warden, pal: VIOLET },
  BUG_LANCER: { draw: lancer, pal: ICE },
  BUG_BROOD: { draw: brood, pal: ROYAL },
  BUG_MOTH: { draw: moth, pal: MOTH },
  BUG_POD: { draw: pod, pal: HIVE },
  BUG_SPIRE: { draw: spire, pal: HIVE },
  BUG_MAW: { draw: maw, pal: BLOOD },
  BUG_CRAWLER: { draw: crawler, pal: CRIMSON },
  BUG_CACHE: { draw: eggs, pal: MOTH },
  BUG_GUARDIAN: { draw: guardian, pal: CRIMSON },
  BUG_BROODMOTHER: { draw: broodmother, pal: BLOOD },
  BUG_HIVELORD: { draw: hivelord, pal: ROYAL },
  BUG_BURROWER: { draw: burrower, pal: HIVE },
  BUG_QUEEN: { draw: queen, pal: VIOLET },
}

// ---- hive structures, wrecks, backdrops --------------------------------------------------------

/** Destructible hive structure on a 96x96 cell: egg cluster, spore sac, brood comb, nerve node. */
export function drawHiveStructure(ctx: Ctx, kind: number, s: number): void {
  const c = s / 2
  const r = seeded(31 + kind)
  if (kind === 0) {
    eggs(ctx, s, s, 0, r, HIVE)
    return
  }
  if (kind === 1) {
    mound(ctx, c, c, s * 0.34, 5, HIVE)
    sac(ctx, c, c, s * 0.18, TOXIC.accent)
    return
  }
  if (kind === 2) {
    hexComb(ctx, c, s)
    return
  }
  mound(ctx, c, c, s * 0.3, 4, ROYAL)
  ctx.strokeStyle = ROYAL.engine
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r()
    ctx.moveTo(c, c)
    ctx.quadraticCurveTo(
      c + Math.cos(a + 0.6) * s * 0.2,
      c + Math.sin(a + 0.6) * s * 0.2,
      c + Math.cos(a) * s * 0.42,
      c + Math.sin(a) * s * 0.42,
    )
  }
  ctx.stroke()
  glow(ctx, c, c, s * 0.16, ROYAL.engine)
}

/** Brood comb: hexagon cells with larvae glowing inside. */
function hexComb(ctx: Ctx, c: number, s: number): void {
  const R = s * 0.12
  const cells: [number, number][] = [[0, 0]]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6
    cells.push([Math.cos(a) * R * 1.75, Math.sin(a) * R * 1.75])
  }
  for (const [x, y] of cells) {
    const pts: [number, number][] = []
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU
      pts.push([c + x + Math.cos(a) * R, c + y + Math.sin(a) * R])
    }
    polyPath(ctx, pts)
    ctx.fillStyle = AMBER.mid
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = AMBER.dark
    ctx.stroke()
    glow(ctx, c + x, c + y, R * 0.7, AMBER.engine)
  }
}

/** Burst membrane and an ichor pool left by a destroyed hive structure. */
export function drawHiveWreck(ctx: Ctx, s: number, seed: number): void {
  const r = seeded(seed)
  softDot(ctx, s / 2, s / 2, s * 0.46, "20,40,8", 0.85)
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU
    softDot(
      ctx,
      s / 2 + Math.cos(a) * s * 0.2,
      s / 2 + Math.sin(a) * s * 0.2,
      s * 0.14,
      "140,220,40",
      0.35,
    )
  }
  ctx.fillStyle = HIVE.mid
  for (let i = 0; i < 6; i++) {
    const x = s * (0.25 + r() * 0.5)
    const y = s * (0.25 + r() * 0.5)
    polyPath(ctx, [
      [x, y],
      [x + s * 0.09 * r(), y + s * 0.04],
      [x + s * 0.02, y + s * 0.09 * r()],
    ])
    ctx.fill()
  }
}

/** Deep hive backdrop: dark organic murk with soft violet / amber / green blobs (tileable). */
export function hiveDeep(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = "#07050a"
  ctx.fillRect(0, 0, w, h)
  const r = seeded(41)
  const hues = ["70,30,110", "110,60,20", "40,90,30", "90,20,60"]
  for (let i = 0; i < 24; i++) {
    const x = r() * w
    const y = r() * h
    const rad = 70 + r() * 180
    const hue = hues[Math.floor(r() * hues.length)] as string
    for (const oy of [-h, 0, h])
      for (const ox of [-w, 0, w]) softDot(ctx, x + ox, y + oy, rad, hue, 0.2)
  }
}

/** Floating spores (the hive's starfield, tileable). */
export function hiveSpores(ctx: Ctx, s: number): void {
  const r = seeded(43)
  for (let i = 0; i < 90; i++) {
    const rad = 1 + r() * 2.5
    softDot(
      ctx,
      r() * s,
      r() * s,
      rad * 2,
      r() > 0.5 ? "190,255,90" : "255,190,90",
      0.4 + r() * 0.5,
    )
  }
}

/** Faint glowing veins (near parallax layer, tileable: every curve is drawn wrapped). */
export function hiveVeins(ctx: Ctx, s: number): void {
  const r = seeded(47)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "rgba(160,255,80,0.12)"
  for (let i = 0; i < 7; i++) {
    const pts = Array.from({ length: 4 }, () => [r() * s, r() * s] as const)
    for (const oy of [-s, 0, s])
      for (const ox of [-s, 0, s]) {
        const [a, b, c, d] = pts as [
          readonly [number, number],
          readonly [number, number],
          readonly [number, number],
          readonly [number, number],
        ]
        ctx.beginPath()
        ctx.moveTo(a[0] + ox, a[1] + oy)
        ctx.bezierCurveTo(b[0] + ox, b[1] + oy, c[0] + ox, c[1] + oy, d[0] + ox, d[1] + oy)
        ctx.stroke()
      }
  }
}

// ---- terrain ---------------------------------------------------------------------------------

/** Hive: chitin comb (hull), glowing acid veins (lichen), wet flesh (rock). */
export function hiveSurface(
  s: Surface,
  m: number,
  lic: number,
  shade: number,
  dx: number,
  dy: number,
): void {
  if (m > 0.5) {
    hiveComb(s, shade, dx, dy)
  } else {
    hiveFlesh(s, shade, dx, dy)
  }
  if (lic > 0.3) hiveVein(s, lic, dx, dy)
}

/** Dark amber honeycomb: hex cells (nearest of two offset lattices), a few larvae glowing. */
function hiveComb(s: Surface, shade: number, dx: number, dy: number): void {
  const a = 12
  const b = a * Math.sqrt(3)
  let best = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  let id = 0
  for (const [ox, oy] of [
    [0, 0],
    [a / 2, b / 2],
  ] as const) {
    const ix = Math.round((dx - ox) / a)
    const iy = Math.round((dy - oy) / b)
    const d = Math.hypot(dx - ox - ix * a, dy - oy - iy * b)
    if (d < (best[0] as number)) {
      best = [d, best[0] as number]
      id = ix * 7 + iy * 13 + (ox ? 5 : 0)
    } else if (d < (best[1] as number)) best[1] = d
  }
  const edge = (best[1] as number) - (best[0] as number)
  const seam = edge < 1.2 ? 0.35 : 1
  const cell = hash2(id, 3, s.seed + 19)
  const glow = cell > 0.93 ? Math.max(0, 1 - (best[0] as number) / 6) * 140 : 0
  const dome = 1 - ((best[0] as number) / a) * 0.5
  s.rgb[0] = (70 + cell * 20) * seam * dome * shade + glow
  s.rgb[1] = (42 + cell * 10) * seam * dome * shade + glow * 0.7
  s.rgb[2] = 22 * seam * dome * shade + glow * 0.15
}

/** Wet purple-brown flesh with a resin sheen on the lit slopes. */
function hiveFlesh(s: Surface, shade: number, dx: number, dy: number): void {
  const tone = fbm(dx / 40, dy / 40, s.seed + 23)
  const sheen = shade > 1.15 ? (shade - 1.15) * 120 : 0
  s.rgb[0] = (64 + tone * 40) * shade + sheen
  s.rgb[1] = (34 + tone * 14) * shade + sheen
  s.rgb[2] = (50 + tone * 26) * shade + sheen
}

/** Acid-green veins pulsing through the hive walls. */
function hiveVein(s: Surface, lic: number, dx: number, dy: number): void {
  const { seed, rgb } = s
  const v = Math.abs(vnoise(dx / 9, dy / 9, seed + 29) - 0.5)
  const k = Math.min(1, (lic - 0.3) * 2) * Math.max(0, 1 - v / 0.08)
  rgb[0] = (rgb[0] as number) + k * 90
  rgb[1] = (rgb[1] as number) + k * 210
  rgb[2] = (rgb[2] as number) + k * 40
}
