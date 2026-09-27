// Scrolling terrain chunks + destructible station modules for one wave.
import type { GameObjects, Scene } from "phaser"
import {
  buildField,
  CHUNK_ROWS,
  CHUNKS,
  ChunkJob,
  RES,
  renderChunk,
  type TerrainField,
} from "../art/terrain"
import { STRUCT_KINDS, WRECK_KINDS } from "../art/textures"
import { FLATS } from "../data/ep1"
import { SCALE } from "../data/playfield"
import { MAP_COLS, MAP_LEFT } from "../sim/consts"
import type { Tiles } from "../sim/tile"

const CHUNK_PX = CHUNK_ROWS * 32 // DOS px

export class TerrainView {
  private readonly scene: Scene
  private readonly field: TerrainField
  private readonly wave: number
  private readonly chunks = new Map<number, GameObjects.Image>()
  private readonly structs = new Map<number, GameObjects.Image>()
  private readonly destructible: boolean[]
  private readonly depth: number
  /** background job for the next chunk(s) above the screen */
  private job: { ci: number; job: ChunkJob } | null = null
  private readonly ready = new Map<number, HTMLCanvasElement>()

  constructor(scene: Scene, wave: number, flats: number[], depth: number) {
    this.scene = scene
    this.wave = wave
    this.depth = depth
    this.field = buildField(flats)
    this.destructible = flats.map((f) => (FLATS.link[f] ?? f) !== f)
  }

  private key(ci: number): string {
    return `terrain-${this.wave}-${ci}`
  }

  private ensure(ci: number): void {
    if (ci < 0 || ci >= CHUNKS || this.chunks.has(ci)) return
    const key = this.key(ci)
    if (!this.scene.textures.exists(key)) {
      let canvas = this.ready.get(ci)
      if (!canvas && this.job?.ci === ci) {
        this.job.job.step(Number.POSITIVE_INFINITY)
        canvas = this.job.job.canvas
        this.job = null
      }
      this.ready.delete(ci)
      this.scene.textures.addCanvas(key, canvas ?? renderChunk(this.field, ci, 17 + this.wave))
    }
    const img = this.scene.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setScale(SCALE / RES)
      .setDepth(this.depth)
    this.chunks.set(ci, img)
  }

  /** Warm the first chunks before the wave starts (they are visible immediately). */
  prepare(scrollY: number): void {
    const c0 = Math.floor(scrollY / CHUNK_PX)
    for (let ci = c0 - 1; ci <= c0 + 1; ci++) this.ensure(ci)
  }

  /** scrollY = DOS map y at the top of the screen (fractional while interpolating). */
  update(scrollY: number, shake: number, tiles: Tiles): void {
    const first = Math.floor(scrollY / CHUNK_PX)
    const last = Math.floor((scrollY + 200) / CHUNK_PX)
    for (let ci = first; ci <= last; ci++) this.ensure(ci)
    this.background(first)
    for (const [ci, img] of this.chunks) {
      if (ci > last + 1 || ci < first - 2) {
        img.destroy()
        this.chunks.delete(ci)
        this.scene.textures.remove(this.key(ci))
        continue
      }
      img.setPosition((MAP_LEFT + shake) * SCALE, (ci * CHUNK_PX - scrollY) * SCALE)
    }

    // structures on visible rows
    const r0 = Math.max(0, Math.floor(scrollY / 32) - 1)
    const r1 = Math.floor((scrollY + 200) / 32) + 1
    const seen = new Set<number>()
    for (let r = r0; r <= r1; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const spot = r * MAP_COLS + c
        if (!this.destructible[spot]) continue
        seen.add(spot)
        const alive = tiles.eitems[spot] !== tiles.titems[spot]
        const tex = alive ? `struct-${spot % STRUCT_KINDS}` : `wreck-${spot % WRECK_KINDS}`
        let img = this.structs.get(spot)
        if (!img) {
          img = this.scene.add.image(0, 0, tex).setDepth(this.depth + 1)
          this.structs.set(spot, img)
        } else if (img.texture.key !== tex) img.setTexture(tex)
        img.setPosition((MAP_LEFT + shake + c * 32 + 16) * SCALE, (r * 32 + 16 - scrollY) * SCALE)
      }
    }
    for (const [spot, img] of this.structs)
      if (!seen.has(spot)) {
        img.destroy()
        this.structs.delete(spot)
      }
  }

  /** Build the two chunks above the screen in small time slices (no frame hitches). */
  private background(first: number): void {
    if (!this.job) {
      for (const ci of [first - 1, first - 2]) {
        if (ci < 0 || this.chunks.has(ci) || this.ready.has(ci)) continue
        this.job = { ci, job: new ChunkJob(this.field, ci, 17 + this.wave) }
        break
      }
    }
    if (this.job?.job.step(3)) {
      this.ready.set(this.job.ci, this.job.job.canvas)
      this.job = null
    }
  }

  destroy(): void {
    for (const [ci, img] of this.chunks) {
      img.destroy()
      this.scene.textures.remove(this.key(ci))
    }
    this.chunks.clear()
    this.ready.clear()
    this.job = null
    for (const img of this.structs.values()) img.destroy()
    this.structs.clear()
  }
}
