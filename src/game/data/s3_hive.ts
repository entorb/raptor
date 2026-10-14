// Bugger Nest terrain (web-only): a seeded hive tunnel on the 9x150 map's 4x4 material cell grid
// (36x600 cells, the same grid `art/terrain.ts` renders). Flesh walls (1) wind up both sides,
// widen into chambers with resin pillars, carry a chitin comb core (2) and glowing veins (3) at
// their edges. Ground units get solid pads, crawlers a resin bridge; egg-cluster structures go on
// fully solid tiles. Every map spot is its own tile, so the tile table is generated with it.
import { cellOf, FH, FINE, FW, MAP_COLS, MAP_ROWS, MAP_SIZE } from "../sim/consts"
import { Rng } from "../sim/rng"
import type { TileSet } from "./types"

// Bravo structure mix (hit points / bounty per destroyed module)
const HP = [5, 10, 15, 15, 20, 20, 25, 26]
const BOUNTY = [25, 50, 50, 50, 100, 150, 200, 200]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Cell materials of the whole map (row-major, FW x FH). */
function carve(r: Rng): Uint8Array {
  const m = new Uint8Array(FW * FH)
  const depth = new Float32Array(FW * FH)
  const phase = r.random(628) / 100
  let wl = 6
  let wr = 6
  for (let y = 0; y < FH; y++) {
    // chambers (walls pull back) every ~120 cells, constrictions between them
    const open = Math.sin(y / 19 + phase)
    const target = 7 - open * 4
    wl = clamp(wl + (target - wl) * 0.15 + (r.random(5) - 2) * 0.25, 1, 13)
    wr = clamp(wr + (target + Math.sin(y / 7) - wr) * 0.15 + (r.random(5) - 2) * 0.25, 1, 13)
    for (let x = 0; x < FW; x++) depth[y * FW + x] = Math.max(wl - x, x + 1 - (FW - wr))
  }
  pillars(r, depth)
  for (let i = 0; i < FW * FH; i++) {
    const d = depth[i] as number
    if (d <= 0) continue
    if (d >= 4) m[i] = 2
    else if (d < 1.5 && r.random(3) === 0) m[i] = 3
    else m[i] = 1
  }
  return m
}

/** Round resin pillars in the open chambers. */
function pillars(r: Rng, depth: Float32Array): void {
  for (let y0 = 20; y0 < FH - 20; y0 += 30 + r.random(30)) {
    const cx = 12 + r.random(FW - 24)
    const rad = 2 + r.random(4)
    for (let y = y0 - rad; y <= y0 + rad; y++)
      for (let x = cx - rad; x <= cx + rad; x++) {
        const d = rad - Math.hypot(x - cx, (y - y0) * 0.8)
        const i = y * FW + x
        if (d > 0 && d > (depth[i] as number)) depth[i] = d
      }
  }
}

/** The 16 cell materials of a map spot (TILE_CELLS order: row by row). */
function spotCells(m: Uint8Array, spot: number): number[] {
  return Array.from({ length: 16 }, (_, k) => m[cellOf(spot, k)] ?? 0)
}

function fillSpot(m: Uint8Array, spot: number, rows: number[], mat: number): void {
  for (const dy of rows)
    for (let dx = 0; dx < FINE; dx++) {
      const i = cellOf(spot, dy * FINE + dx)
      if (!m[i]) m[i] = mat
    }
}

/**
 * Hive terrain for one wave: `pads` = map spots under ground units (kept solid, no structures),
 * `bridges` = map rows crossed by crawlers, `structs` = destructible egg clusters wanted.
 */
export function hiveTerrain(
  seed: number,
  pads: Set<number>,
  bridges: Set<number>,
  structs: number,
): { flats: number[]; tiles: TileSet } {
  const r = new Rng(seed)
  const m = carve(r)
  for (const spot of pads) fillSpot(m, spot, [0, 1, 2, 3], 1)
  for (const row of bridges)
    for (let c = 0; c < MAP_COLS; c++) fillSpot(m, row * MAP_COLS + c, [1, 2], 1)

  const wreck = MAP_SIZE
  const tiles: TileSet = {
    link: Array.from({ length: MAP_SIZE + 1 }, (_, i) => i),
    hp: new Array(MAP_SIZE + 1).fill(0),
    bounty: new Array(MAP_SIZE + 1).fill(0),
    cells: [],
  }
  for (let spot = 0; spot < MAP_SIZE; spot++) tiles.cells.push(spotCells(m, spot).join(""))
  tiles.cells.push("1".repeat(16))

  // structures: fully solid spots off the pads and bridges, first and last rows kept clear
  const spots = tiles.cells.flatMap((cells, spot) => {
    const row = Math.floor(spot / MAP_COLS)
    const ok =
      spot < MAP_SIZE &&
      !cells.includes("0") &&
      !pads.has(spot) &&
      !bridges.has(row) &&
      row > 3 &&
      row < MAP_ROWS - 3
    return ok ? [spot] : []
  })
  for (let n = 0; n < structs && spots.length; n++) {
    const spot = spots.splice(r.random(spots.length), 1)[0] as number
    tiles.link[spot] = wreck
    tiles.hp[spot] = HP[r.random(HP.length)] as number
    tiles.bounty[spot] = BOUNTY[r.random(BOUNTY.length)] as number
  }
  return { flats: Array.from({ length: MAP_SIZE }, (_, i) => i), tiles }
}
