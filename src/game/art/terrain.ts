// Space terrain from the original 9x150 tile map. Every tile has 4x4 material cells (TILE_CELLS,
// 8x8 DOS px each): water became open space (transparent, the starfield shows through), land
// became asteroid rock, grey roads/buildings became station hull and vegetation became glowing
// alien lichen. Chunks blur the cell grid, distort it with noise and light it with a relief map.
// The training sector (`train`) renders the same map as a simulator deck: flat gridded floor
// plates, lit hull panels and hazard stripes instead of lichen.
import { TILE_CELLS } from "../data/ep1"
import { MAP_COLS, MAP_ROWS } from "../sim/consts"
import { makeCanvas } from "./draw"

const FINE = 4 // cells per tile edge (8 DOS px each)
const FW = MAP_COLS * FINE
const FH = MAP_ROWS * FINE
/** Chunk = 8 map rows (256 DOS px); rendered at RES px per DOS px, drawn scaled to 3x. */
export const CHUNK_ROWS = 8
export const RES = 1.5

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 144269)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x: number, y: number, seed: number): number {
  return (
    vnoise(x, y, seed) * 0.5 +
    vnoise(x * 2.1, y * 2.1, seed + 1) * 0.28 +
    vnoise(x * 4.3, y * 4.3, seed + 2) * 0.14 +
    vnoise(x * 8.7, y * 8.7, seed + 3) * 0.08
  )
}

export interface TerrainField {
  solid: Float32Array
  metal: Float32Array
  lichen: Float32Array
}

const KERNEL = [1, 2, 1, 2, 4, 2, 1, 2, 1]

/** 3x3 weighted mean around cell (x, y), edges clamped. */
function blurAt(src: Float32Array, x: number, y: number): number {
  let s = 0
  let n = 0
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(FW - 1, Math.max(0, x + dx))
      const yy = Math.min(FH - 1, Math.max(0, y + dy))
      const wgt = KERNEL[(dy + 1) * 3 + dx + 1] as number
      s += (src[yy * FW + xx] as number) * wgt
      n += wgt
    }
  return s / n
}

function blur(src: Float32Array): Float32Array {
  const out = new Float32Array(FW * FH)
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) out[y * FW + x] = blurAt(src, x, y)
  return out
}

/** Blurred material fields on the cell grid for one map's initial tiles. */
export function buildField(flats: number[]): TerrainField {
  const solid = new Float32Array(FW * FH)
  const metal = new Float32Array(FW * FH)
  const lichen = new Float32Array(FW * FH)
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++) {
      const cells = TILE_CELLS[flats[r * MAP_COLS + c] ?? 0] ?? "0000000000000000"
      for (let k = 0; k < 16; k++) {
        const m = Number(cells[k])
        const i = (r * FINE + (k >> 2)) * FW + c * FINE + (k & 3)
        solid[i] = Math.min(1, m)
        metal[i] = Number(m === 2)
        lichen[i] = Number(m === 3)
      }
    }
  return { solid: blur(solid), metal: blur(metal), lichen: blur(lichen) }
}

function sample(f: Float32Array, x: number, y: number): number {
  const xi = Math.max(0, Math.min(FW - 2, Math.floor(x)))
  const yi = Math.max(0, Math.min(FH - 2, Math.floor(y)))
  const xf = Math.max(0, Math.min(1, x - xi))
  const yf = Math.max(0, Math.min(1, y - yi))
  const i = yi * FW + xi
  const a = f[i] as number
  const b = f[i + 1] as number
  const c = f[i + FW] as number
  const d = f[i + FW + 1] as number
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

const EDGE = 0.45

/**
 * Incremental chunk renderer (map rows ci*8 .. ci*8+7 -> canvas of 288*RES x 256*RES px) so the
 * work can be spread over several frames: call `step(budgetMs)` until it returns true.
 */
export class ChunkJob {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly img: ImageData
  private readonly W = Math.round(288 * RES)
  private readonly H = Math.round(CHUNK_ROWS * 32 * RES)
  private readonly SW: number
  private readonly sol: Float32Array
  private readonly hgt: Float32Array
  private readonly met: Float32Array
  private readonly y0: number
  private readonly rgb = [0, 0, 0]
  /** next row for pass 1 (fields) and pass 2 (pixels) */
  private fy = 0
  private py = 0
  done = false

  constructor(
    private readonly field: TerrainField,
    ci: number,
    private readonly seed: number,
    private readonly train = false,
  ) {
    const { c, ctx } = makeCanvas(this.W, this.H)
    this.canvas = c
    this.ctx = ctx
    this.img = ctx.createImageData(this.W, this.H)
    this.SW = this.W + 1
    const n = this.SW * (this.H + 1)
    this.sol = new Float32Array(n)
    this.hgt = new Float32Array(n)
    this.met = new Float32Array(n)
    this.y0 = ci * CHUNK_ROWS * 32 // DOS y of the chunk top within the map
  }

  /** Solid value (noisy edge), hull amount and relief height for one row. */
  private fieldRow(y: number): void {
    const { field, seed, SW } = this
    const dy = this.y0 + y / RES
    for (let x = 0; x <= this.W; x++) {
      const dx = x / RES
      const i = y * SW + x
      const edgeNoise =
        vnoise(dx / 12, dy / 12, seed) * 0.6 + vnoise(dx / 4, dy / 4, seed + 1) * 0.4
      const s = sample(field.solid, dx / 8 - 0.5, dy / 8 - 0.5) + (edgeNoise - 0.5) * 0.35
      const m = sample(field.metal, dx / 8 - 0.5, dy / 8 - 0.5)
      this.sol[i] = s
      this.met[i] = m
      // rock relief: fbm + crater bowls; hull is flat plating; edges fall off to space
      const bevel = Math.min(1, Math.max(0, (s - EDGE) / 0.25))
      const rock = fbm(dx / 22, dy / 22, seed + 5) * 1.4
      const crater = vnoise(dx / 16, dy / 16, seed + 9)
      const bowl = crater > 0.7 ? -(crater - 0.7) * 2.5 : 0
      const rough = this.train ? 0.15 : 1
      this.hgt[i] = bevel * 2.2 + (1 - Math.min(1, m * 2)) * (rock + bowl) * bevel * rough
    }
  }

  /** Fills `this.rgb` with the lit surface color at map cell `i` (DOS px dx, dy). */
  private surfaceColor(i: number, dx: number, dy: number): void {
    const { seed, SW, rgb } = this
    // light from top-left
    const gx = (this.hgt[i + 1] as number) - (this.hgt[i] as number)
    const gy = (this.hgt[i + SW] as number) - (this.hgt[i] as number)
    const shade = Math.max(0.35, Math.min(1.5, 1 - (gx + gy) * 6))
    const m = this.met[i] as number
    if (this.train) {
      this.simColor(m, shade, dx, dy)
      return
    }
    if (m > 0.5) {
      const plate = 0.8 + hash2(Math.floor(dx / 16), Math.floor(dy / 16), seed + 7) * 0.25
      const seam = dx % 16 < 0.7 || dy % 16 < 0.7 ? 0.55 : 1
      rgb[0] = 72 * plate * seam * shade
      rgb[1] = 84 * plate * seam * shade
      rgb[2] = 102 * plate * seam * shade
      if ((dx + 8) % 32 < 1.4 && dy % 48 < 1.6) rgb.splice(0, 3, 90, 230, 255)
      return
    }
    // rock: dusty warm grey to cool slate
    const tone = vnoise(dx / 60, dy / 60, seed + 11)
    rgb[0] = (88 + tone * 30) * shade
    rgb[1] = (80 + tone * 18) * shade
    rgb[2] = (84 - tone * 6) * shade
    const lic = sample(this.field.lichen, dx / 8 - 0.5, dy / 8 - 0.5)
    if (lic > 0.35) this.tintLichen(lic, dx, dy)
  }

  /** Simulator deck: gridded floor, lit panels (hull) and hazard stripes (lichen). */
  private simColor(m: number, shade: number, dx: number, dy: number): void {
    const { rgb } = this
    const lic = sample(this.field.lichen, dx / 8 - 0.5, dy / 8 - 0.5)
    if (m > 0.5) {
      const seam = dx % 16 < 0.8 || dy % 16 < 0.8
      rgb[0] = (seam ? 60 : 44) * shade
      rgb[1] = (seam ? 230 : 62) * shade
      rgb[2] = (seam ? 190 : 78) * shade
    } else if (lic > 0.45) {
      const stripe = (dx + dy) % 24 < 5
      rgb[0] = (stripe ? 150 : 30) * shade
      rgb[1] = (stripe ? 120 : 36) * shade
      rgb[2] = (stripe ? 30 : 48) * shade
    } else {
      const grid = dx % 32 < 0.8 || dy % 32 < 0.8
      rgb[0] = (grid ? 40 : 20) * shade
      rgb[1] = (grid ? 150 : 30) * shade
      rgb[2] = (grid ? 210 : 44) * shade
    }
  }

  /** Glowing lichen patches (cyan / violet) on top of `this.rgb`. */
  private tintLichen(lic: number, dx: number, dy: number): void {
    const { seed, rgb } = this
    const spot = vnoise(dx / 4, dy / 4, seed + 13) * 0.7 + vnoise(dx / 11, dy / 11, seed + 14) * 0.3
    const t = Math.min(1, Math.max(0, (spot - 0.5) / 0.3))
    const k = Math.min(1, (lic - 0.35) * 2.2) * t * t * (3 - 2 * t)
    const violet = vnoise(dx / 30, dy / 30, seed + 17) > 0.5
    rgb[0] = (rgb[0] as number) + k * (violet ? 120 : 20)
    rgb[1] = (rgb[1] as number) + k * (violet ? 40 : 170)
    rgb[2] = (rgb[2] as number) + k * (violet ? 190 : 160)
    rgb[0] = (rgb[0] as number) * (1 - 0.25 * lic) + 20 * lic
    rgb[2] = (rgb[2] as number) * (1 - 0.1 * lic) + 30 * lic
  }

  private pixelRow(y: number): void {
    const { SW, W, rgb } = this
    const px = this.img.data
    const dy = this.y0 + y / RES
    for (let x = 0; x < W; x++) {
      const i = y * SW + x
      const s = this.sol[i] as number
      const o = (y * W + x) * 4
      if (s < EDGE) {
        px[o + 3] = 0
        continue
      }
      this.surfaceColor(i, x / RES, dy)
      // dark rim where the surface drops into space
      const rim = 0.4 + 0.6 * Math.min(1, (s - EDGE) / 0.12)
      px[o] = Math.min(255, (rgb[0] as number) * rim)
      px[o + 1] = Math.min(255, (rgb[1] as number) * rim)
      px[o + 2] = Math.min(255, (rgb[2] as number) * rim)
      px[o + 3] = Math.round(Math.min(1, (s - EDGE) / 0.05) * 255)
    }
  }

  /** Work for at most `budgetMs` (Infinity = finish now). Returns true when the canvas is ready. */
  step(budgetMs: number): boolean {
    if (this.done) return true
    const t0 = performance.now()
    while (performance.now() - t0 < budgetMs) {
      if (this.fy <= this.H) {
        this.fieldRow(this.fy++)
        continue
      }
      if (this.py < this.H) {
        this.pixelRow(this.py++)
        continue
      }
      this.ctx.putImageData(this.img, 0, 0)
      this.done = true
      return true
    }
    return false
  }
}

/** Render a whole chunk synchronously. */
export function renderChunk(
  field: TerrainField,
  ci: number,
  seed: number,
  train = false,
): HTMLCanvasElement {
  const job = new ChunkJob(field, ci, seed, train)
  job.step(Number.POSITIVE_INFINITY)
  return job.canvas
}

export const CHUNKS = Math.ceil(MAP_ROWS / CHUNK_ROWS)
