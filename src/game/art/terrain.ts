// Space terrain from the original 9x150 tile map. Every tile has 4x4 material cells (TILE_CELLS,
// 8x8 DOS px each): water became open space (transparent, the starfield shows through), land
// became asteroid rock, grey roads/buildings became station hull and vegetation became glowing
// alien lichen. Chunks blur the cell grid, distort it with noise and light it with a relief map.
// The surface colors are per sector (`LOOK`): Bravo `s2_bravo.ts bravoSurface`, the training
// simulator deck `s1_sim.ts simSurface`, the hive `s3_bugs.ts hiveSurface`.
import { TILE_CELLS } from "../data/ep1"
import type { Sector } from "../data/save"
import { cellOf, FH, FW, MAP_COLS, MAP_LEFT, MAP_ROWS } from "../sim/consts"
import { fbm, makeCanvas, vnoise } from "./draw"
import { simSurface } from "./s1_sim"
import { bravoSurface } from "./s2_bravo"
import { hiveSurface } from "./s3_bugs"

/** Chunk = 8 map rows (256 DOS px); rendered at RES px per DOS px, drawn scaled to 3x. */
export const CHUNK_ROWS = 8
export const RES = 1.5
/** Chunk width in DOS px: the 288 px map plus the MAP_LEFT side strips, filled by extending the edge tiles. */
export const CHUNK_W = MAP_COLS * 32 + 2 * MAP_LEFT

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
export function buildField(flats: number[], tiles = TILE_CELLS): TerrainField {
  const solid = new Float32Array(FW * FH)
  const metal = new Float32Array(FW * FH)
  const lichen = new Float32Array(FW * FH)
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++) {
      const cells = tiles[flats[r * MAP_COLS + c] ?? 0] ?? "0000000000000000"
      for (let k = 0; k < 16; k++) {
        const m = Number(cells[k])
        const i = cellOf(r * MAP_COLS + c, k)
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

/** What a sector's surface colors see: write the lit color of a terrain point into `rgb`. */
export interface Surface {
  readonly rgb: number[]
  readonly seed: number
}
/** `m` = hull amount, `lic` = lichen amount, `shade` = relief light, (dx, dy) = DOS px. */
type SurfaceColor = (
  s: Surface,
  m: number,
  lic: number,
  shade: number,
  dx: number,
  dy: number,
) => void

/** Terrain per sector look: surface colors and rock relief (the training deck is nearly flat). */
const LOOK: Record<Sector, { color: SurfaceColor; rough: number }> = {
  bravo: { color: bravoSurface, rough: 1 },
  train: { color: simSurface, rough: 0.15 },
  nest: { color: hiveSurface, rough: 1 },
}

/**
 * Incremental chunk renderer (map rows ci*8 .. ci*8+7 -> canvas of CHUNK_W*RES x 256*RES px) so the
 * work can be spread over several frames: call `step(budgetMs)` until it returns true.
 */
export class ChunkJob {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly img: ImageData
  private readonly W = Math.round(CHUNK_W * RES)
  private readonly H = Math.round(CHUNK_ROWS * 32 * RES)
  private readonly SW: number
  private readonly sol: Float32Array
  private readonly hgt: Float32Array
  private readonly met: Float32Array
  private readonly y0: number
  readonly rgb = [0, 0, 0]
  /** next row for pass 1 (fields) and pass 2 (pixels) */
  private fy = 0
  private py = 0
  done = false

  constructor(
    private readonly field: TerrainField,
    ci: number,
    readonly seed: number,
    private readonly look: Sector = "bravo",
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
      const dx = x / RES - MAP_LEFT
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
      const { rough } = LOOK[this.look]
      this.hgt[i] = bevel * 2.2 + (1 - Math.min(1, m * 2)) * (rock + bowl) * bevel * rough
    }
  }

  /** Fills `this.rgb` with the lit surface color at map cell `i` (DOS px dx, dy). */
  private surfaceColor(i: number, dx: number, dy: number): void {
    const { SW } = this
    // light from top-left
    const gx = (this.hgt[i + 1] as number) - (this.hgt[i] as number)
    const gy = (this.hgt[i + SW] as number) - (this.hgt[i] as number)
    const shade = Math.max(0.35, Math.min(1.5, 1 - (gx + gy) * 6))
    const m = this.met[i] as number
    const lic = sample(this.field.lichen, dx / 8 - 0.5, dy / 8 - 0.5)
    LOOK[this.look].color(this, m, lic, shade, dx, dy)
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
      this.surfaceColor(i, x / RES - MAP_LEFT, dy)
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
  look: Sector = "bravo",
): HTMLCanvasElement {
  const job = new ChunkJob(field, ci, seed, look)
  job.step(Number.POSITIVE_INFINITY)
  return job.canvas
}

export const CHUNKS = Math.ceil(MAP_ROWS / CHUNK_ROWS)
