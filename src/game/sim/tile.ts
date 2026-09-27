// Port of dosraptor/SOURCE/TILE.C: background map scrolling and destructible tiles.
// Tile "items" are FLATS indices; a tile is destructible while eitems != titems.
import { FLATS } from "../data/ep1"
import { Anim, MAP_BLOCKSIZE, MAP_COLS, MAP_LEFT, MAP_ONSCREEN, MAP_ROWS, MAP_SIZE } from "./consts"
import type { World } from "./world"

const MAX_STILES = MAP_ONSCREEN * MAP_COLS
const MAX_TILEDELAY = (MAP_ONSCREEN + 1) * MAP_COLS

export interface TileSpot {
  mapspot: number
  x: number
  y: number
  item: number
}

interface TileDelay {
  /** index into tspots (the DOS code keeps the TILESPOT pointer) */
  ts: number
  mapspot: number
  frames: number
  item: number
}

export class Tiles {
  titems = new Int32Array(MAP_SIZE)
  eitems = new Int32Array(MAP_SIZE)
  hits = new Int32Array(MAP_SIZE)
  money = new Int32Array(MAP_SIZE)
  tdead = new Uint8Array(MAP_SIZE)
  tilepos = 0
  tileyoff = 0
  scroll_flag = true
  last_tile = false
  tspots: TileSpot[] = Array.from({ length: MAX_STILES }, () => ({
    mapspot: 0,
    x: 0,
    y: 0,
    item: 0,
  }))
  delays: TileDelay[] = []
  spark_delay = 0
  flare_delay = 0
  /** web: destructible structures in the map / destroyed so far (mission stats) */
  structs = 0
  destroyed = 0

  /** TILE_CacheLevel */
  load(flats: number[]): void {
    this.tilepos = (MAP_ROWS - MAP_ONSCREEN) * MAP_COLS
    this.tileyoff = 200 - MAP_ONSCREEN * MAP_BLOCKSIZE
    this.scroll_flag = true
    this.last_tile = false
    this.delays = []
    this.tdead.fill(0)
    this.structs = 0
    this.destroyed = 0
    for (let i = 0; i < MAP_SIZE; i++) {
      const f = flats[i] ?? 0
      this.money[i] = FLATS.bounty[f] ?? 0
      this.titems[i] = f
      this.eitems[i] = FLATS.link[f] ?? f
      this.hits[i] = this.eitems[i] !== this.titems[i] ? (FLATS.hp[f] ?? 1) : 1
      if (this.eitems[i] !== this.titems[i]) this.structs++
    }
  }
}

function doDamage(w: World, mapspot: number, damage: number): void {
  const t = w.tiles
  const mlookup = [-1, -MAP_COLS, 1]
  const xlookup = [-1, 0, 1]
  const ix = mapspot % MAP_COLS
  for (let loop = 0; loop < 3; loop++) {
    const spot = mapspot + (mlookup[loop] as number)
    if (spot < 0 || spot >= MAP_SIZE) continue
    if (t.eitems[spot] === t.titems[spot]) continue
    const x = ix + (xlookup[loop] as number)
    if (x < 0 || x >= MAP_COLS) continue
    t.hits[spot] = (t.hits[spot] as number) - damage
  }
}

/** TILE_DamageAll (mega bomb) */
export function tileDamageAll(w: World): void {
  const t = w.tiles
  for (const ts of t.tspots) {
    if (t.eitems[ts.mapspot] !== t.titems[ts.mapspot])
      t.hits[ts.mapspot] = (t.hits[ts.mapspot] as number) - 20
  }
}

function explode(w: World, tsIndex: number, delay: number): void {
  const t = w.tiles
  const ts = t.tspots[tsIndex] as TileSpot
  if (ts.mapspot < t.tilepos) return
  if (delay) {
    if (t.delays.length < MAX_TILEDELAY)
      t.delays.push({
        ts: tsIndex,
        mapspot: ts.mapspot,
        frames: delay,
        item: t.eitems[ts.mapspot] as number,
      })
    t.eitems[ts.mapspot] = t.titems[ts.mapspot] as number
  } else {
    ts.item = t.eitems[ts.mapspot] as number
    t.titems[ts.mapspot] = t.eitems[ts.mapspot] as number
  }
}

/** TILE_Think: refresh the visible tile spots and blow up destroyed structures. */
function thinkSpots(w: World): void {
  const t = w.tiles
  let y = t.tileyoff
  let mapspot = t.tilepos
  let n = 0
  for (let loopy = 0; loopy < MAP_ONSCREEN; loopy++, y += 32) {
    let x = MAP_LEFT
    for (let loopx = 0; loopx < MAP_COLS; loopx++, x += 32, mapspot++, n++) {
      const ts = t.tspots[n] as TileSpot
      ts.mapspot = mapspot
      ts.x = x
      ts.y = y
      ts.item = t.titems[mapspot] as number
      if ((t.hits[mapspot] as number) < 0 && !t.tdead[mapspot]) {
        if (t.titems[mapspot] !== t.eitems[mapspot]) t.destroyed++
        w.sfx3d("GEXPLO", x + 16, y + 16)
        doDamage(w, mapspot, 5)
        w.plr.score += t.money[mapspot] as number
        explode(w, n, 10)
        w.startAnim(Anim.LARGE_GROUND_EXPLO1, x + 16, y + 16)
        t.tdead[mapspot] = 1
      }
    }
  }
}

/** TILE_Think: a burning structure's delayed damage, sparks and final item swap. */
function thinkDelays(w: World): void {
  const t = w.tiles
  for (let i = 0; i < t.delays.length; i++) {
    const td = t.delays[i] as TileDelay
    if (td.mapspot - t.tilepos > MAP_ONSCREEN * MAP_COLS) {
      t.delays.splice(i--, 1)
    } else if (td.frames < 0) {
      finishDelay(w, td)
      t.delays.splice(i--, 1)
    } else td.frames--
  }
}

function finishDelay(w: World, td: TileDelay): void {
  const t = w.tiles
  const src = t.tspots[td.ts] as TileSpot
  const tx = src.x + 8 + w.rng.random(8)
  const ty = src.y + 16 + 10
  doDamage(w, td.mapspot, 20)
  t.spark_delay++
  t.flare_delay++
  if (t.spark_delay > 2) {
    w.startAnim(Anim.GROUND_SPARKLE, tx, ty)
    t.spark_delay = 0
  }
  if (t.flare_delay > 4) {
    w.startAnim(Anim.GROUND_FLARE, tx, ty)
    t.flare_delay = 0
  }
  const ts = t.tspots[td.mapspot - t.tilepos]
  const spot = ts ? ts.mapspot : td.mapspot
  t.titems[spot] = td.item
  t.eitems[spot] = td.item
}

/** TILE_Think */
export function tileThink(w: World): void {
  thinkSpots(w)
  thinkDelays(w)
}

/** Scroll part of TILE_Display (runs after all Think calls, before the next frame). */
export function tileScroll(w: World): void {
  const t = w.tiles
  t.tileyoff++
  if (t.tileyoff > 0) {
    if (t.last_tile && t.tileyoff >= 0) {
      t.tileyoff = 0
      t.scroll_flag = false
    } else {
      t.tileyoff -= MAP_BLOCKSIZE
      t.tilepos -= MAP_COLS
    }
    if (t.tilepos <= 0) {
      t.tilepos = 0
      t.last_tile = true
    }
  }
}

/** TILE_IsHit: note the DOS loop stops before the last spot. */
export function tileIsHit(w: World, damage: number, x: number, y: number): boolean {
  const t = w.tiles
  for (let i = 0; i < t.tspots.length - 1; i++) {
    const ts = t.tspots[i] as TileSpot
    if (x >= ts.x && x < ts.x + 32 && y >= ts.y && y < ts.y + 32) {
      if (t.eitems[ts.mapspot] !== t.titems[ts.mapspot]) {
        t.hits[ts.mapspot] = (t.hits[ts.mapspot] as number) - damage
        w.startGAnim(w.rng.random(2) === 0 ? Anim.BLUE_SPARK : Anim.ORANGE_SPARK, x, y)
        return true
      }
    }
  }
  return false
}

/** TILE_Bomb */
export function tileBomb(w: World, damage: number, x: number, y: number): boolean {
  const t = w.tiles
  for (let i = 0; i < t.tspots.length - 1; i++) {
    const ts = t.tspots[i] as TileSpot
    if (x >= ts.x && x < ts.x + 32 && y >= ts.y && y < ts.y + 32) {
      if (t.eitems[ts.mapspot] !== t.titems[ts.mapspot]) {
        t.hits[ts.mapspot] = (t.hits[ts.mapspot] as number) - damage
        doDamage(w, ts.mapspot, damage)
        if (ts.mapspot > MAP_COLS) doDamage(w, ts.mapspot - MAP_COLS, damage >> 1)
        return true
      }
    }
  }
  return false
}
