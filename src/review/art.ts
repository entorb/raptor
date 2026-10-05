// Dev-only art review page (/raptor/review/art.html): every procedural sprite next to the original
// picture from tmp/ref (if dumped), enemies grouped by the mission (wave) that spawns them.

import { makeCanvas } from "../game/art/draw"
import { drawDot, drawShard, drawShot, drawSmoke, drawStructure, drawWreck } from "../game/art/fx"
import { drawPickup } from "../game/art/icons"
import { drawPlayer, drawUnit } from "../game/art/ships"
import { buildField, CHUNK_ROWS, CHUNK_W, CHUNKS, RES, renderChunk } from "../game/art/terrain"
import { STRUCT_KINDS, WRECK_KINDS } from "../game/art/textures"
import { ENEMY_LIB, MAPS, PIC_SIZES } from "../game/data/ep1"
import { SCALE } from "../game/data/playfield"
import { SPECIAL_KEYS } from "../game/input/gameInput"
import { LAST_WEAPON, Obj } from "../game/sim/consts"
import { OBJ_LIB } from "../game/sim/objects"
import { makeShotLibs } from "../game/sim/shots"
import { initFilter, waveVisible } from "./filter"

const REF = import.meta.glob("../../tmp/ref/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>
const refUrl = (name: string): string | undefined => REF[`../../tmp/ref/${name}.png`]

const main = document.getElementById("main") as HTMLElement
const nav = document.getElementById("nav") as HTMLElement

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const { c, ctx } = makeCanvas(w, h)
  draw(ctx)
  return c
}

/** Labeled picture; `zoom` adds CSS magnification (sizes stay comparable between columns). */
function pic(node: HTMLElement, label: string, zoom = 1): HTMLElement {
  const p = el("div", "pic")
  if (node instanceof HTMLCanvasElement && zoom !== 1) node.style.width = `${node.width * zoom}px`
  if (node instanceof HTMLImageElement && zoom !== 1)
    node.addEventListener("load", () => {
      node.style.width = `${node.naturalWidth * zoom}px`
    })
  p.append(node, el("span", "", label))
  return p
}

/** Original picture from tmp/ref (3x scale like our art), or nothing. */
function refPic(name: string, label = "original", zoom = 1): HTMLElement[] {
  const url = refUrl(name)
  if (!url) return []
  const img = el("img")
  img.src = url
  img.alt = name
  return [pic(img, label, zoom)]
}

function card(name: string, meta: string, tags: string[], pics: HTMLElement[]): HTMLElement {
  const c = el("div", "card")
  const head = el("div")
  for (const t of tags) head.append(el("span", `tag ${t}`, t))
  head.append(el("span", "name", name))
  const row = el("div", "pics")
  row.append(...pics)
  c.append(head)
  if (meta) c.append(el("div", "meta", meta))
  c.append(row)
  return c
}

/** Tags art for the sector filter ("bravo" / "train"). */
function sector<T extends HTMLElement>(e: T, s: "bravo" | "train"): T {
  e.dataset.sector = s
  return e
}

/** `wave` (0-based, "unused" = not spawned) tags the section for the wave filter. */
function section(id: string, title: string, intro = "", wave?: string): HTMLElement {
  const h = el("h2", "", title)
  h.id = id
  const a = el("a", "", title)
  a.href = `#${id}`
  const g = el("div", "grid")
  const parts = [a, h, g]
  if (intro) parts.splice(2, 0, el("p", "", intro))
  if (wave !== undefined) for (const e of parts) e.dataset.wave = wave
  nav.append(a)
  main.append(...parts.slice(1))
  return g
}

// ---- player -----------------------------------------------------------------------------------
{
  const g = section("player", "Player ship")
  const frames = el("div", "frames")
  for (let f = 0; f < 7; f++)
    frames.append(
      pic(
        canvas(96, 96, (ctx) => drawPlayer(ctx, 96, 96, 3 - f)),
        f === 3 ? "level" : `bank ${f - 3}`,
      ),
    )
  g.append(card("Raptor", "playerpic 0..6, 96x96", [], [frames, ...refPic("fx_LPLAYER_PIC")]))
}

// ---- player weapons ---------------------------------------------------------------------------
const ZOOM = 3

function shotCanvas(key: string): HTMLCanvasElement {
  const [w, h] = PIC_SIZES[key] ?? [8, 8]
  return canvas(w * SCALE, h * SCALE, (ctx) => drawShot(ctx, key, w * SCALE))
}

/** Game.drawBeams look for the S_BEAM weapons (laser 4, death ray 8 DOS px wide). */
function beamCanvas(ray: boolean): HTMLCanvasElement {
  return canvas(60, 180, (ctx) => {
    const color = ray ? "255,224,61" : "255,61,210"
    const half = ray ? 12 : 6
    const x = 30
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = `rgba(${color},0.4)`
    ctx.fillRect(x - half, 10, half * 2, 150)
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.fillRect(x - half / 3, 10, (half * 2) / 3, 150)
    ctx.fillStyle = `rgba(${color},0.8)`
    ctx.beginPath()
    ctx.arc(x, 10, half, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(${color},0.6)`
    ctx.beginPath()
    ctx.arc(x, 160, half * 1.6, 0, Math.PI * 2)
    ctx.fill()
  })
}

/** Laser turret: SHOTS_Display S_LINE, three 1 px lines (Game.drawBeams). */
function lineCanvas(): HTMLCanvasElement {
  return canvas(120, 120, (ctx) => {
    ctx.lineCap = "round"
    ctx.strokeStyle = "rgba(255,61,210,0.35)"
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(20, 110)
    ctx.lineTo(100, 10)
    ctx.stroke()
    ctx.strokeStyle = "rgba(255,255,255,0.95)"
    ctx.lineWidth = 3
    ctx.stroke()
  })
}

{
  const g = section(
    "weapons",
    "Player weapons",
    "Shots at game size and zoomed 3x; the original next to it at the same scale.",
  )
  const libs = makeShotLibs()
  const keyOf = new Map(SPECIAL_KEYS.map(([, label, t]) => [t as number, label]))
  for (let t = 0; t <= LAST_WEAPON; t++) {
    const lib = libs[t]
    const name = OBJ_LIB[t]?.name ?? `#${t}`
    const pics: HTMLElement[] = [
      pic(
        canvas(48, 48, (ctx) => drawPickup(ctx, t, 48)),
        "icon",
      ),
    ]
    if (lib?.beam === "beam") {
      pics.push(
        pic(beamCanvas(t === Obj.DEATH_RAY), "beam"),
        pic(shotCanvas(lib.key), "tile x3", ZOOM),
        ...refPic(`fx_${lib.key}`, "orig x3", ZOOM),
      )
    } else if (lib?.beam === "line") pics.push(pic(lineCanvas(), "beam"))
    else if (lib?.key) {
      pics.push(
        pic(shotCanvas(lib.key), "shot"),
        ...refPic(`fx_${lib.key}`),
        pic(shotCanvas(lib.key), "shot x3", ZOOM),
        ...refPic(`fx_${lib.key}`, "orig x3", ZOOM),
      )
    }
    const key = keyOf.get(t)
    const meta = [
      lib?.key && `picture ${lib.key} ${PIC_SIZES[lib.key]?.join("x")}`,
      lib && `hits ${lib.hits}, rate ${lib.shoot_rate}`,
      key && `key ${key}`,
    ]
      .filter(Boolean)
      .join(" · ")
    g.append(card(name, meta, [], pics))
  }
}

// ---- enemy projectiles ------------------------------------------------------------------------
{
  const g = section("eshots", "Enemy projectiles")
  const names: [string, string][] = [
    ["ESHOT_BLK", "Shot"],
    ["EMISLE_BLK", "Missile"],
    ["MINE_BLK", "Mine"],
    ["ELASER_BLK", "Laser (tile, drawn as a beam)"],
    ["EPLASMA_PIC", "Plasma"],
    ["COCONUT_PIC", "Coconut"],
  ]
  for (const [key, name] of names)
    g.append(
      card(
        name,
        `${key} ${PIC_SIZES[key]?.join("x")}`,
        [],
        [
          pic(shotCanvas(key), "shot"),
          ...refPic(`fx_${key}`),
          pic(shotCanvas(key), "shot x3", ZOOM),
          ...refPic(`fx_${key}`, "orig x3", ZOOM),
        ],
      ),
    )
}

// ---- pickups ----------------------------------------------------------------------------------
{
  const g = section("pickups", "Pickups and HUD icons")
  const icons = el("div", "frames")
  for (let t = 0; t < Obj.LAST_OBJECT; t++)
    icons.append(
      pic(
        canvas(48, 48, (ctx) => drawPickup(ctx, t, 48)),
        OBJ_LIB[t]?.name ?? `#${t}`,
      ),
    )
  g.append(card("All object types", "pickup-<type>, 48 px", [], [icons]))
  g.append(card("Original bonus pictures", "", [], refPic("bonus")))
}

// ---- enemies by mission -----------------------------------------------------------------------
/** Frames per picture name, as textures.ts builds them. */
const unitFrames = new Map<string, number>()
for (const e of ENEMY_LIB)
  if (e.w) unitFrames.set(e.iname, Math.max(1, e.num_frames, unitFrames.get(e.iname) ?? 1))

function enemyCard(slib: number, count: number): HTMLElement {
  const e = ENEMY_LIB[slib]
  if (!e) return el("div")
  const frames = unitFrames.get(e.iname) ?? 1
  const w = e.w * SCALE
  const h = e.h * SCALE
  const row = el("div", "frames")
  for (let f = 0; f < frames; f++)
    row.append(
      pic(
        canvas(w, h, (ctx) => drawUnit(ctx, e.iname, w, h, f, frames)),
        `${f}`,
      ),
    )
  const sim = el("div", "frames")
  for (let f = 0; f < frames; f++)
    sim.append(
      pic(
        canvas(w, h, (ctx) => drawUnit(ctx, e.iname, w, h, f, frames, true)),
        `train ${f}`,
      ),
    )
  const tags = [e.bossflag ? "boss" : "", e.ground ? "ground" : "air"].filter(Boolean)
  const meta = `lib #${slib} · ${e.w}x${e.h} · hits ${e.hits} · $${e.money} · ${count}x in the map`
  return card(e.iname.replace(/_PIC$/, ""), meta, tags, [
    sector(row, "bravo"),
    sector(sim, "train"),
    ...refPic(`enemy_${e.iname}`),
  ])
}

function terrain(wave: number, flats: number[]): HTMLElement {
  const d = el("details")
  d.dataset.wave = String(wave)
  d.append(el("summary", "", "Terrain map (bottom = start)"))
  d.addEventListener(
    "toggle",
    () => {
      const box = el("div", "pics")
      box.style.cssText = "max-height:640px;overflow:auto;align-items:flex-start"
      const field = buildField(flats)
      const k = 0.5 // 0.75 px per DOS px
      const chunkH = CHUNK_ROWS * 32 * RES
      const full = canvas(CHUNK_W * RES * k, CHUNKS * chunkH * k, (ctx) => {
        for (let ci = 0; ci < CHUNKS; ci++) {
          const c = renderChunk(field, ci, 17 + wave)
          ctx.drawImage(c, 0, ci * chunkH * k, c.width * k, c.height * k)
        }
      })
      box.append(sector(pic(full, "bravo"), "bravo"))
      const sim = canvas(CHUNK_W * RES * k, CHUNKS * chunkH * k, (ctx) => {
        for (let ci = 0; ci < CHUNKS; ci++) {
          const c = renderChunk(field, ci, 17 + wave, true)
          ctx.drawImage(c, 0, ci * chunkH * k, c.width * k, c.height * k)
        }
      })
      box.append(sector(pic(sim, "training"), "train"))
      const url = refUrl(`map${wave + 1}`)
      if (url) {
        const img = el("img")
        img.src = url
        img.style.width = `${full.width}px`
        box.append(pic(img, "original"))
      }
      d.append(box)
      applyFilter()
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight
      })
    },
    { once: true },
  )
  return d
}

const used = new Set<string>()
MAPS.forEach((map, wave) => {
  // one card per picture (several library entries can share one), in spawn order
  const byName = new Map<string, { slib: number; n: number }>()
  for (const s of map.spawns) {
    const slib = s[1] ?? 0
    const e = ENEMY_LIB[slib]
    if (!e?.w) continue
    const cur = byName.get(e.iname)
    if (cur) cur.n++
    else byName.set(e.iname, { slib, n: 1 })
    used.add(e.iname)
  }
  const g = section(`wave${wave + 1}`, `Mission ${wave + 1}`, "", String(wave))
  for (const { slib, n } of byName.values()) g.append(enemyCard(slib, n))
  main.append(terrain(wave, map.flats))
})

{
  const rest = new Map<string, number>()
  ENEMY_LIB.forEach((e, i) => {
    if (e.w && !used.has(e.iname) && !rest.has(e.iname)) rest.set(e.iname, i)
  })
  if (rest.size) {
    const g = section("unused", "Not spawned in episode 1", "", "unused")
    for (const i of rest.values()) g.append(enemyCard(i, 0))
  }
}

// ---- buildings --------------------------------------------------------------------------------
{
  const g = section(
    "buildings",
    "Buildings",
    "Destructible station modules on the map (struct-<k>) and their wrecks (wreck-<k>).",
  )
  const row = el("div", "frames")
  for (let k = 0; k < STRUCT_KINDS; k++)
    row.append(
      pic(
        canvas(96, 96, (ctx) => drawStructure(ctx, k, 96)),
        `struct-${k}`,
      ),
    )
  for (let k = 0; k < WRECK_KINDS; k++)
    row.append(
      pic(
        canvas(96, 96, (ctx) => drawWreck(ctx, 96, 11 + k)),
        `wreck-${k}`,
      ),
    )
  const sim = el("div", "frames")
  for (let k = 0; k < STRUCT_KINDS; k++)
    sim.append(
      pic(
        canvas(96, 96, (ctx) => drawStructure(ctx, k, 96, true)),
        `tstruct-${k}`,
      ),
    )
  for (let k = 0; k < WRECK_KINDS; k++)
    sim.append(
      pic(
        canvas(96, 96, (ctx) => drawWreck(ctx, 96, 11 + k, true)),
        `twreck-${k}`,
      ),
    )
  g.append(
    card(
      "Station modules",
      "96x96 (one 32x32 DOS tile)",
      [],
      [sector(row, "bravo"), sector(sim, "train")],
    ),
  )
  g.append(card("Original tiles", "", [], refPic("tiles")))
}

// ---- particles --------------------------------------------------------------------------------
{
  const g = section("particles", "Particles", "Explosions are built from these at runtime.")
  g.append(
    card(
      "Particle textures",
      "dot 32, smoke 48, shard 12",
      [],
      [
        pic(
          canvas(32, 32, (ctx) => drawDot(ctx, 32)),
          "dot",
        ),
        pic(
          canvas(48, 48, (ctx) => drawSmoke(ctx, 48)),
          "smoke",
        ),
        pic(
          canvas(12, 12, (ctx) => drawShard(ctx, 12)),
          "shard",
        ),
      ],
    ),
  )
  const orig = [
    "fx_EXPLO2_BLK",
    "fx_GEXPLO_BLK",
    "fx_AIRBOOM_PIC",
    "fx_SMFLAK_BLK",
    "fx_LGFLAK_BLK",
  ]
  g.append(
    card(
      "Original explosions",
      "",
      [],
      orig.flatMap((n) => refPic(n, n.slice(3))),
    ),
  )
}

// ---- sector / wave filter ----------------------------------------------------------------------
const applyFilter = initFilter((f) => {
  for (const e of document.querySelectorAll<HTMLElement>("[data-sector]"))
    e.hidden = f.sector !== "" && e.dataset.sector !== f.sector
  for (const e of document.querySelectorAll<HTMLElement>("[data-wave]")) {
    const w = e.dataset.wave ?? ""
    // "unused" enemies belong to no wave: hidden only by a wave filter
    e.hidden = w === "unused" ? f.wave !== "" : !waveVisible(f, Number(w))
  }
})
