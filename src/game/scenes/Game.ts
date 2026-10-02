// Gameplay: runs the DOS-exact sim at its fixed rate (FRAME_MS) and renders it with the new art,
// interpolating positions between sim frames.
import { type GameObjects, Scene } from "phaser"
import { HUD_BAR } from "../art/fx"
import { buildTrainingTextures } from "../art/textures"
import { getAudio, WAVE_SONGS } from "../audio/audio"
import {
  afterWave,
  isReplay,
  type Loadout,
  levelKey,
  loadout,
  recordFail,
  recordStart,
  refillShield,
  sectorDiff,
  topHeader,
  topRunLine,
  type WaveResult,
  waveMap,
  withLoadout,
} from "../campaign"
import { DEMOS } from "../data/ep1"
import { SCALE } from "../data/playfield"
import { loadPilots, loadSettings, type Sector, savePilot } from "../data/save"
import { t as tr } from "../i18n/i18n"
import { toggleFullscreen } from "../input/fullscreen"
import { GameInput, SPECIAL_KEYS } from "../input/gameInput"
import { Effects } from "../render/effects"
import { TerrainView } from "../render/terrainView"
import { currentPilot, godMode, reloadPilot, setGodMode, setPilot } from "../session"
import {
  DIFF_HARD,
  FRAME_MS,
  MAP_BOTTOM,
  MAP_COLS,
  MAX_SHIELD,
  Obj,
  type ObjType,
} from "../sim/consts"
import { enemyBaseDamage, type Ship } from "../sim/enemy"
import { ES_LASER } from "../sim/eshot"
import { Inventory, OBJ_LIB } from "../sim/objects"
import { type DemoFrame, World } from "../sim/world"
import { bindKeys, changeVolume, glowText, pctLabel, UI } from "../ui/textMenu"
import type { HangarData } from "./Hangar"

export interface GameData {
  wave?: number
  sector?: Sector
  /** index into DEMOS: attract-mode playback */
  demo?: number
}

const D = {
  stars: 0,
  terrain: 10,
  groundAnim: 20,
  groundEnemy: 22,
  airAnim: 30,
  airEnemy: 40,
  shots: 45,
  bonus: 48,
  player: 50,
  high: 60,
  eshots: 65,
  hud: 90,
  overlay: 100,
}

interface Tracked {
  obj: GameObjects.Image
  px: number
  py: number
  x: number
  y: number
  seen: boolean
}

/** Playback loadout for the attract demos (INPUT.C DEMO_MakePlayer, game 0). */
function demoLoadout(): Loadout {
  const plr = { score: 0, sweapon: -1 }
  const inv = new Inventory(plr)
  inv.add(Obj.FORWARD_GUNS)
  for (let i = 0; i < 4; i++) inv.add(Obj.ENERGY)
  inv.add(Obj.DETECT)
  plr.score = 10000
  for (const t of [
    Obj.MICRO_MISSLE,
    Obj.MEGA_BOMB,
    Obj.MINI_GUN,
    Obj.AIR_MISSLE,
    Obj.TURRET,
    Obj.DEATH_RAY,
  ])
    inv.add(t)
  inv.getNext()
  return { plr, inv }
}

export class Game extends Scene {
  private world!: World
  private lo!: Loadout
  private input2!: GameInput
  private terrain!: TerrainView
  private fx!: Effects
  private acc = 0
  private wave = 0
  /** DOS map index of `wave` (seed, terrain, song) */
  private mapWave = 0
  private sector: Sector = "bravo"
  private unitPrefix = "u-"
  private demo = -1
  private startScore = 0
  private prevScroll = 0
  private scroll = 0
  private tracked = new Map<string, Tracked>()
  private beams!: GameObjects.Graphics
  private player!: GameObjects.Image
  private playerGlow!: GameObjects.Image
  private shieldFx!: GameObjects.Image
  private prevPlayer = { x: 0, y: 0 }
  private seenAnims = new Set<number>()
  private hud!: {
    g: GameObjects.Graphics
    /** shield bars: dim frame above, lit segments below the fill level (cropped images) */
    bars: { off: GameObjects.Image; on: GameObjects.Image }[]
    score: GameObjects.Text
    special: GameObjects.Image
    warn: GameObjects.Text
    banner: GameObjects.Text
    weaponName: GameObjects.Text
    novas: GameObjects.Image[]
    killPct: GameObjects.Text
  }
  /** Bottom strip: special weapons on board with their keys (tap to select on touch). */
  private weaponBar: {
    sig: string
    items: { t: ObjType; x: number; objs: GameObjects.GameObject[] }[]
  } = { sig: "", items: [] }
  private lastWeapon = -1
  private novaBtn: GameObjects.Image | null = null
  private touchIcons: GameObjects.Image[] = []
  private stars!: GameObjects.TileSprite[]
  private paused = false
  private pauseLayer: GameObjects.Container | null = null
  private pauseItems: { t: GameObjects.Text; fn: () => void; adjust?: (d: number) => void }[] = []
  private pauseCursor = 0
  /** LEFT/RIGHT in the pause menu: step through the special weapons on board */
  private pauseWeaponStep: ((d: number) => void) | null = null
  private ended = false
  private shakeAmt = 0
  private briefing: GameObjects.Container | null = null
  /** The sim holds until the briefing is confirmed (web change: DOS starts right away). */
  private waiting = false
  /** A start key went down in this scene (the Hangar's Enter must not confirm on its keyup). */
  private startArmed = false
  private shownKills = 0

  constructor() {
    super("Game")
  }

  init(data: GameData): void {
    this.demo = data?.demo ?? -1
    this.wave = data?.wave ?? 0
    this.sector = data?.sector ?? "bravo"
    this.acc = 0
    this.paused = false
    this.pauseLayer = null
    this.ended = false
    this.tracked = new Map()
    this.seenAnims = new Set()
    this.shakeAmt = 0
    this.briefing = null
    this.waiting = false
    this.startArmed = false
    this.shownKills = 0
    this.weaponBar = { sig: "", items: [] }
  }

  create(): void {
    this.novaBtn = null
    this.touchIcons = []
    let diff: number
    let frames: DemoFrame[] | null = null
    if (this.demo >= 0) {
      const rec = DEMOS[this.demo % DEMOS.length] as number[][]
      frames = rec.map((r) => ({
        b: [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 0],
        px: r[4] ?? 0,
        py: r[5] ?? 0,
        pic: r[6] ?? 0,
      }))
      this.wave = frames[0]?.py ?? 0
      this.lo = demoLoadout()
      diff = DIFF_HARD
    } else {
      const p = currentPilot()
      if (!p) {
        this.scene.start("Menu")
        return
      }
      this.lo = loadout(p)
      diff = sectorDiff(p, this.sector)
    }
    this.startScore = this.lo.plr.score
    // demos fly bravo maps; the sector wave may differ from the DOS map (training beginner wave)
    const { index, map } = waveMap(frames ? "bravo" : this.sector, this.wave)
    this.mapWave = index
    this.world = new World(index, this.lo.plr, this.lo.inv, diff, map)
    if (frames) this.world.playDemo(frames)
    else this.world.god = godMode()

    // training: a holographic simulator (target drones, grid deck) instead of a real fight
    const sim = this.sector === "train" && !frames
    if (sim) buildTrainingTextures(this)
    this.unitPrefix = sim ? "ut-" : "u-"
    const bgs = sim ? ["sim-floor", "sim-dots", "sim-grid"] : ["nebula", "stars-far", "stars-near"]
    this.stars = bgs.map((k) => this.add.tileSprite(480, 300, 960, 600, k).setDepth(D.stars))
    this.terrain = new TerrainView(this, index, map?.flats ?? [], D.terrain, sim)
    this.scroll = this.prevScroll = this.scrollY()
    this.terrain.prepare(this.scroll)
    this.fx = new Effects(this, D.groundAnim, D.airAnim, sim)
    this.beams = this.add.graphics().setDepth(D.shots).setBlendMode("ADD")
    this.playerGlow = this.add
      .image(0, 0, "dot")
      .setDepth(D.player - 1)
      .setBlendMode("ADD")
      .setTint(0x39d0ff)
    this.player = this.add.image(0, 0, "player", "3").setDepth(D.player)
    this.shieldFx = this.add
      .image(0, 0, "dot")
      .setDepth(D.high)
      .setBlendMode("ADD")
      .setTint(0x46e0ff)
      .setScale(4)
      .setAlpha(0)
    this.prevPlayer = { x: this.world.player_cx, y: this.world.player_cy }

    this.input2 = new GameInput(this)
    this.input2.onButton = (id) => {
      if (id === "pause") this.togglePause()
      else if (id === "auto") this.input2.toggleAutoFire()
      else if (id.startsWith("w")) this.input2.selectWeapon(Number(id.slice(1)) as ObjType)
    }
    this.createHud()
    const kb = this.input.keyboard
    kb?.on("keydown-ESC", () => (this.demo >= 0 ? this.finishDemo() : this.togglePause()))
    kb?.on("keydown-P", () => this.demo < 0 && this.togglePause())
    bindKeys(this, () => true, {
      up: () => this.pauseMove(-1),
      down: () => this.pauseMove(1),
      left: () => this.pauseLeftRight(-1),
      right: () => this.pauseLeftRight(1),
      confirm: () => this.pauseActivate(),
    })
    kb?.on("keydown-SPACE", () => {
      if (!this.paused && !this.waiting && !this.ended && this.demo < 0)
        this.input2.toggleAutoFire()
    })
    // start on keyup: a held Enter/Space would fire a nova bomb or shots in the first frame
    for (const k of ["ENTER", "SPACE"]) {
      kb?.on(`keydown-${k}`, () => (this.startArmed = this.waiting))
      kb?.on(`keyup-${k}`, () => this.startArmed && this.startMission())
    }
    if (this.demo >= 0) {
      this.input.on("pointerdown", () => this.finishDemo())
      kb?.on("keydown", () => this.finishDemo())
    }
    const songs = WAVE_SONGS[this.demo >= 0 ? "bravo" : this.sector]
    getAudio().playSong(this, songs[this.demo >= 0 ? this.mapWave : this.wave] ?? "bravo1")
    this.game.events.on("blur", this.autoPause, this)
    this.events.once("shutdown", () => {
      this.game.events.off("blur", this.autoPause, this)
      getAudio().stopAll()
      this.terrain.destroy()
    })
  }

  private autoPause(): void {
    if (!this.paused && !this.ended && this.demo < 0) this.togglePause()
  }

  private sectorTitle(): string {
    return tr(this.sector === "train" ? "game.trainSim" : "sector.bravoName")
  }

  private scrollY(): number {
    const t = this.world.tiles
    return (t.tilepos / MAP_COLS) * 32 - t.tileyoff
  }

  update(_time: number, delta: number): void {
    if (!this.world || this.ended) return
    const bg = (this.scroll * SCALE) / 3
    this.stars[0]?.setTilePosition(0, -bg * 0.15)
    this.stars[1]?.setTilePosition(0, -bg * 0.3)
    this.stars[2]?.setTilePosition(0, -bg * 0.6)
    if (this.paused) return
    if (this.waiting) {
      this.render(0)
      return
    }
    this.acc += Math.min(delta, 250)
    while (this.acc >= FRAME_MS && !this.ended) {
      this.acc -= FRAME_MS
      this.simStep()
    }
    this.render(this.acc / FRAME_MS)
  }

  private simStep(): void {
    const w = this.world
    for (const t of this.tracked.values()) {
      t.px = t.x
      t.py = t.y
    }
    this.prevScroll = this.scrollY()
    this.prevPlayer = { x: w.player_cx, y: w.player_cy }
    this.input2.setShip(w.player_cx, w.player_cy)
    const nova = w.shots.find((s) => s.lib.type === Obj.MEGA_BOMB)
    const novaAt = nova && { x: nova.x + nova.lib.hlx, y: nova.y + nova.lib.hly }
    const running = w.step(this.input2.read())
    // startfadeflag (mega bomb detonation) just turned into fadeflag with fadecnt 0
    if (novaAt && w.fadeflag && w.fadecnt === 0) {
      this.fx.nova(novaAt.x * SCALE, novaAt.y * SCALE)
      this.shakeAmt = Math.max(this.shakeAmt, 10)
    }
    const audio = getAudio()
    audio.play(w.sfxEvents, w.player_cx, w.player_cy)
    audio.bossLoop(w.bossLoop)
    for (const k of w.kills) this.fx.wreck(k.x, k.y, k.w, k.h)
    for (const p of w.pickups) this.pickupText(p.type, p.x, p.y)
    for (const a of w.anims) {
      if (this.seenAnims.has(a.id)) continue
      this.seenAnims.add(a.id)
      this.fx.spawn(a, (n) => (this.shakeAmt = Math.max(this.shakeAmt, n)))
    }
    if (this.seenAnims.size > 4000) this.seenAnims = new Set(w.anims.map((a) => a.id))
    if (!running) this.end()
  }

  /** Get or create the image tracked under `key`, updating its sim position. */
  private track(
    key: string,
    tex: string,
    frame: string | number,
    x: number,
    y: number,
    depth: number,
  ): Tracked {
    let t = this.tracked.get(key)
    if (!t) {
      t = {
        obj: this.add.image(0, 0, tex, String(frame)).setDepth(depth),
        px: x,
        py: y,
        x,
        y,
        seen: true,
      }
      this.tracked.set(key, t)
    } else if (t.obj.texture.key !== tex || t.obj.frame.name !== String(frame))
      t.obj.setTexture(tex, String(frame))
    t.x = x
    t.y = y
    t.seen = true
    return t
  }

  private render(alpha: number): void {
    const w = this.world
    const lerp = (a: number, b: number) => (Math.abs(b - a) > 40 ? b : a + (b - a) * alpha)
    this.scroll = lerp(this.prevScroll, this.scrollY())
    this.shakeAmt *= 0.85
    const shake =
      w.shake + (this.shakeAmt > 0.3 ? Math.sin(this.time.now * 0.09) * this.shakeAmt : 0)
    this.cameras.main.setScroll(-shake * SCALE * 0.5, 0)
    this.terrain.update(this.scroll, 0, w.tiles)
    // scroll-relative drift for ground objects (they move 1px per sim frame with the map)
    for (const t of this.tracked.values()) t.seen = false

    this.trackWorld(w)
    for (const [key, t] of this.tracked) {
      if (!t.seen) {
        t.obj.destroy()
        this.tracked.delete(key)
        continue
      }
      t.obj.setPosition(lerp(t.px, t.x) * SCALE, lerp(t.py, t.y) * SCALE)
    }

    this.drawBeams(lerp)

    const px = lerp(this.prevPlayer.x, w.player_cx) * SCALE
    const py = lerp(this.prevPlayer.y, w.player_cy) * SCALE
    this.player.setVisible(w.draw_player).setFrame(String(Math.max(0, Math.min(6, w.playerpic))))
    this.player.setPosition(px, py)
    this.playerGlow
      .setVisible(w.draw_player)
      .setPosition(px, py + 44)
      .setScale(
        1.3 + 0.2 * Math.sin(this.time.now * 0.05),
        2.2 + 0.3 * Math.sin(this.time.now * 0.07),
      )
      .setAlpha(0.8)
    const shieldHit = w.anims.some((a) => a.lib.kind === "SHIPGLOW_BLK")
    this.shieldFx
      .setPosition(px, py)
      .setAlpha(shieldHit ? 0.55 : Math.max(0, this.shieldFx.alpha - 0.05))
    this.updateHud()
  }

  /** Mark every visible sim object as seen (creating/updating its sprite). */
  private trackWorld(w: World): void {
    for (const s of w.enemies.ships) this.trackShip(w, s)
    for (const s of w.shots) {
      if (s.lib.beam === "beam" || s.lib.beam === "line") continue
      const t = this.track(
        `s${s.id}`,
        `shot-${s.lib.key}`,
        "__BASE",
        s.x + s.lib.hlx,
        s.y + s.lib.hly,
        D.shots,
      )
      if (s.lib.type === Obj.MEGA_BOMB) t.obj.setScale(1.8 + 0.2 * Math.sin(w.frame * 0.6))
    }
    for (const e of w.eshots) {
      if (e.type === ES_LASER) continue // laser: drawn as a beam
      const key = `shot-${e.lib.key}`
      this.track(`q${e.id}`, key, "__BASE", e.x + e.lib.xoff, e.y + e.lib.yoff, D.eshots)
    }
    for (const b of w.bonuses) {
      const t = this.track(
        `b${b.id}`,
        `pickup-${b.dflag ? Obj.ITEMBUY6 : b.type}`,
        "__BASE",
        b.bx + 8,
        b.by + 8,
        D.bonus,
      )
      // collected crystal: the sim keeps it 50 frames (BONUS countdown), the art fades in 15
      t.obj.setAlpha(b.dflag ? Math.max(0, (b.countdown - 35) / 15) : 1)
      t.obj.setScale(0.75 + 0.08 * Math.sin(w.frame * 0.4))
    }
  }

  private trackShip(w: World, s: Ship): void {
    const frames = Math.max(1, s.lib.num_frames)
    const t = this.track(
      `e${s.id}`,
      `${this.unitPrefix}${s.lib.iname}`,
      s.curframe % frames,
      s.x + s.width / 2,
      s.y + s.height / 2,
      s.groundflag ? D.groundEnemy : D.airEnemy,
    )
    if (s.hits < s.lib.hits * 0.3 && w.frame % 4 < 2) t.obj.setTint(0xff9090)
    else t.obj.clearTint()
  }

  private drawBeams(lerp: (a: number, b: number) => number): void {
    const w = this.world
    const g = this.beams
    g.clear()
    for (const s of w.shots) {
      if (s.lib.beam !== "beam") continue
      const x = (s.x + s.lib.hlx) * SCALE
      const top = Math.max(0, s.move.y2) * SCALE
      const bottom = s.y * SCALE
      // SHOTS_Display S_BEAM: the picture tiled from move.y2 down to y (laser 4, death ray 8 DOS px
      // wide) plus the muzzle flash (LASERPOW/DETHPOW) at the ship
      const ray = s.lib.type === Obj.DEATH_RAY
      const color = ray ? 0xffe03d : 0xff3dd2
      const half = ray ? 12 : 6
      g.fillStyle(color, 0.4).fillRect(x - half, top, half * 2, bottom - top)
      g.fillStyle(0xffffff, 0.9).fillRect(x - half / 3, top, (half * 2) / 3, bottom - top)
      g.fillStyle(color, 0.8).fillCircle(x, top, half)
      g.fillStyle(color, 0.6).fillCircle(x, bottom, half * 1.6)
    }
    for (const e of w.eshots) {
      if (e.type !== 5) continue
      const x = (e.x + 4) * SCALE
      g.fillStyle(0xff2e2e, 0.4).fillRect(x - 6, e.y * SCALE, 12, (e.move.y2 - e.y) * SCALE)
      g.fillStyle(0xffe0e0, 0.9).fillRect(x - 2, e.y * SCALE, 4, (e.move.y2 - e.y) * SCALE)
    }
    const pcx = lerp(this.prevPlayer.x, w.player_cx) * SCALE
    const pcy = lerp(this.prevPlayer.y, w.player_cy) * SCALE
    for (const b of w.turretBeams) {
      g.lineStyle(9, 0xff3dd2, 0.35).lineBetween(pcx, pcy, b.x * SCALE, b.y * SCALE)
      g.lineStyle(3, 0xffffff, 0.95).lineBetween(pcx, pcy, b.x * SCALE, b.y * SCALE)
    }
  }

  private pickupText(type: ObjType, x: number, y: number): void {
    const money: Partial<Record<number, string>> = {
      [Obj.ITEMBUY6]: "+50 CR",
      [Obj.ENERGY]: tr("game.pickupShield"),
    }
    const label =
      money[type] ?? tr(type >= Obj.ITEMBUY1 ? "game.pickupCredits" : "game.pickupWeapon")
    const t = this.add
      .text(x * SCALE, y * SCALE, label, {
        fontFamily: UI.font,
        fontSize: "20px",
        color: UI.gold,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(D.hud - 1)
    this.tweens.add({
      targets: t,
      y: t.y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy(),
    })
  }

  private createHud(): void {
    const g = this.add.graphics().setDepth(D.hud)
    const bars = (["hudbar-shield", "hudbar-energy"] as const).map((tex, i) => {
      const img = (key: string) =>
        this.add
          .image(i ? 927 : 15, 56, key)
          .setOrigin(0)
          .setDepth(D.hud)
      return { off: img("hudbar-off"), on: img(tex) }
    })
    // x/y are the glyph edge shifted outward by the 15 px glow padding
    const hudNum = (x: number, originX: number) =>
      this.add
        .text(x, 21, "", { fontFamily: UI.mono, fontSize: "26px", color: "#ffffff" })
        .setOrigin(originX, 0)
        .setDepth(D.hud)
        .setShadow(0, 0, UI.accent, 10, true, true)
        .setPadding(15)
    const score = hudNum(57, 0)
    // below the kill counter, right-aligned with it
    const special = this.add.image(868, 96, "pickup-3").setDepth(D.hud).setScale(0.9)
    const warn = this.add
      .text(480, MAP_BOTTOM * SCALE, "", {
        fontFamily: UI.font,
        fontSize: "22px",
        color: UI.warn,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(D.hud)
    const bannerText = `${this.sectorTitle()}\n${tr("wave")} ${this.wave + 1}`
    const banner = glowText(this, 480, 110, bannerText, 40, 20)
      .setAlign("center")
      .setDepth(D.overlay)
    if (this.demo >= 0) banner.setText(tr("game.demo")).setY(250)
    if (this.demo < 0) {
      this.briefing = this.controlsPanel(160).setDepth(D.overlay)
      this.waiting = true
    } else this.tweens.add({ targets: banner, alpha: 0, delay: 5200, duration: 800 })
    this.input2.onAutoFire = (on) =>
      this.toast(tr("game.autoFire", { state: tr(on ? "on" : "off") }))
    this.input2.onGod = () => this.toggleGod()
    const weaponName = glowText(this, 480, 62, "", 24, 12).setDepth(D.hud).setAlpha(0)
    this.lastWeapon = this.world.plr.sweapon
    const novas = Array.from({ length: 5 }, (_, i) =>
      this.add.image(64 + i * 22, 578, "shot-MEGABM_BLK").setDepth(D.hud),
    )
    // mirrors the credits (57, 21): glyphs end at x 888 = 960 - 72
    const killPct = hudNum(903, 1)
    this.hud = { g, bars, score, special, warn, banner, weaponName, novas, killPct }
    if (this.demo < 0) {
      this.input2.buttons = [
        { id: "pause", x: 40, y: 40, r: 44 },
        { id: "mega", x: 890, y: 270, r: 64 }, // right thumb: above the weapon cycle, left thumb steers
        { id: "cycle", x: 890, y: 400, r: 64 },
        { id: "auto", x: 890, y: 530, r: 44 },
      ]
      this.novaBtn = this.add
        .image(890, 270, `icon-${Obj.MEGA_BOMB}`)
        .setScale(0.6)
        .setAlpha(0.85)
        .setDepth(D.hud)
        .setVisible(false)
      this.touchIcons = [
        this.add.image(890, 400, "btn-cycle").setScale(0.6),
        this.add.image(890, 530, "btn-auto").setScale(0.6),
      ]
      for (const i of this.touchIcons) i.setAlpha(0.85).setDepth(D.hud).setVisible(false)
    }
  }

  /** Filled button (panel-relative x 0) with the Enter key hint on desktop. */
  private pillButton(y: number, label: string, onTap: () => void): GameObjects.Text {
    const btn = this.add
      .text(0, y, label, {
        fontFamily: UI.font,
        fontSize: "26px",
        color: "#ffffff",
        backgroundColor: "#1d3a5c",
      })
      .setOrigin(0.5)
      .setPadding(28, 8, 28, 8)
      .setInteractive({ useHandCursor: true })
    btn.on("pointerup", onTap)
    return btn
  }

  /** Special weapons on board, in key order. */
  private specials() {
    return SPECIAL_KEYS.filter(([, , t]) => this.world.inv.isEquip(t))
  }

  private isTouch(): boolean {
    return this.input2.touchMode || window.matchMedia?.("(pointer: coarse)").matches === true
  }

  /** Mission briefing: all controls plus the keys of the special weapons on board. */
  private controlsLines(): string[] {
    const fire = tr(this.input2.autoFire ? "on" : "off")
    const specials = this.specials().map(([, key, t]) => `${key}  ${OBJ_LIB[t]?.name ?? ""}`)
    const lines = this.isTouch()
      ? [
          tr("ctl.touchSteer"),
          tr("ctl.touchFire", { state: fire }),
          ...(specials.length ? [tr("ctl.touchSpecial")] : []),
          tr("ctl.touchNova"),
          tr("ctl.touchPause"),
        ]
      : [
          tr("ctl.move"),
          tr("ctl.special"),
          tr("ctl.nova"),
          tr("ctl.pause"),
          tr("ctl.autoFire", { state: fire }),
        ]
    // OBJS_Think: no recharge on hard
    if (this.world.curplr_diff < DIFF_HARD) lines.push(tr("ctl.recharge"))
    if (specials.length) {
      lines.push("", tr(this.isTouch() ? "ctl.specialsTouch" : "ctl.specialsKeys"), ...specials)
    } else lines.push("", tr("ctl.noSpecials"))
    return lines
  }

  /** Briefing panel with the start button, its top at `top` (below the banner) when it fits. */
  private controlsPanel(top: number): GameObjects.Container {
    const text = this.add
      .text(0, 0, this.controlsLines().join("\n"), {
        fontFamily: UI.mono,
        fontSize: "17px",
        color: UI.text,
        lineSpacing: 5,
      })
      .setOrigin(0.5)
    const btn = this.pillButton(text.height / 2 + 34, `▶ ${tr("game.start")}`, () =>
      this.startMission(),
    )
    text.setY(-30)
    btn.setY(btn.y - 30)
    const h = text.height + 92
    const bg = this.add
      .rectangle(0, 0, text.width + 48, h, 0x05060d, 0.72)
      .setStrokeStyle(1, 0x39d0ff, 0.6)
    return this.add.container(480, Math.min(top + h / 2, 595 - h / 2), [bg, text, btn])
  }

  /** Briefing confirmed: run the sim, fade the briefing and the wave banner. */
  private startMission(): void {
    if (!this.waiting || this.paused || this.ended) return
    this.waiting = false
    this.startArmed = false
    this.acc = 0
    if (this.demo < 0) {
      const p = currentPilot()
      const saved = p && loadPilots().find((q) => q.name === p.name)
      if (saved) savePilot(recordStart(saved, levelKey(this.sector, this.wave)))
    }
    const help = this.briefing
    this.tweens.add({ targets: this.hud.banner, alpha: 0, delay: 600, duration: 800 })
    if (!help) return
    this.tweens.add({
      targets: help,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        help.destroy()
        if (this.briefing === help) this.briefing = null
      },
    })
  }

  /**
   * Hidden god mode (key G, dev builds only): invulnerable (World.god, DOS godmode) and
   * +$10000000 on activation. It stays on for the next missions (session.godMode).
   */
  private toggleGod(): void {
    if (!import.meta.env.DEV || this.demo >= 0 || this.ended) return
    const w = this.world
    w.god = !w.god
    setGodMode(w.god)
    if (w.god) w.plr.score += 10000000
    this.toast(w.god ? "GOD MODE ON  +10000000 CR" : "GOD MODE OFF")
  }

  private toast(msg: string): void {
    const t = this.add
      .text(480, 150, msg, {
        fontFamily: UI.font,
        fontSize: "26px",
        color: UI.gold,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(D.overlay)
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 900,
      duration: 500,
      onComplete: () => t.destroy(),
    })
  }

  /** Segments i with i / segs < value / max are lit; the split runs through the gap above them. */
  private bar(i: number, value: number, max: number): void {
    const b = this.hud.bars[i]
    if (!b) return
    const { w, h, segs, step } = HUD_BAR
    const lit = Math.ceil(Math.max(0, Math.min(1, value / max)) * segs)
    const split = Math.round(h - 4 - lit * step)
    b.off.setCrop(0, 0, w, split)
    b.on.setCrop(0, split, w, h - split)
    // an empty phase-shield bar (i 0) is unexplained clutter: show it once one is on board
    const shown = i !== 0 || value > 0
    b.off.setVisible(shown)
    b.on.setVisible(shown)
  }

  private updateHud(): void {
    const w = this.world
    const inv = w.inv
    const g = this.hud.g
    g.clear()
    this.bar(0, inv.getAmt(Obj.SUPER_SHIELD), MAX_SHIELD)
    this.bar(1, inv.getAmt(Obj.ENERGY), MAX_SHIELD)
    this.hud.score.setText(`${w.plr.score - this.startScore} CR`)
    // refresh on kills only: newly seen enemies would otherwise make the value creep down constantly
    if (w.enemies.killed !== this.shownKills) {
      this.shownKills = w.enemies.killed
      this.hud.killPct.setText(`${tr("game.kills")} ${w.destroyedPct.enemies ?? 0}%`)
    }
    const sw = w.plr.sweapon
    this.hud.special.setVisible(sw >= 0)
    if (sw >= 0) this.hud.special.setTexture(`pickup-${sw}`)
    this.updateWeaponBar(sw)
    // nova bombs + phase shields
    const nova = inv.getAmt(Obj.MEGA_BOMB)
    for (const [i, img] of this.hud.novas.entries()) img.setVisible(i < nova)
    const phase = inv.getTotal(Obj.SUPER_SHIELD)
    for (let i = 0; i < phase; i++) g.lineStyle(3, 0x46e0ff, 0.95).strokeCircle(64 + i * 22, 22, 7)
    // damage scanner (boss integrity)
    if (inv.isEquip(Obj.DETECT)) {
      const dmg = enemyBaseDamage(w)
      if (dmg > 0) {
        g.fillStyle(0x05060d, 0.7).fillRoundedRect(330, 534, 300, 18, 5)
        g.fillStyle(0xff4050, 0.95).fillRoundedRect(333, 537, (294 * dmg) / 100, 12, 4)
      }
    }
    let warn = ""
    if (w.weaponLost) warn = tr("game.weaponLost")
    else if (w.lowShield) warn = tr("game.shieldLow")
    this.hud.warn.setText(warn)
    const touch = this.input2.touchMode && this.demo < 0
    this.novaBtn?.setVisible(touch && nova > 0)
    const canSwap = this.specials().length > 1
    for (const i of this.touchIcons) i.setVisible(touch)
    this.touchIcons[0]?.setVisible(touch && canSwap)
    if (touch) this.drawTouchButtons(g)
  }

  private drawTouchButtons(g: GameObjects.Graphics): void {
    if (this.world.inv.getAmt(Obj.MEGA_BOMB) > 0)
      g.lineStyle(2, 0xffe066, 0.5).strokeCircle(890, 270, 44)
    if (this.specials().length > 1) g.lineStyle(2, 0x39d0ff, 0.5).strokeCircle(890, 400, 44)
    // auto-fire toggle: icon dims when off
    const on = this.input2.autoFire
    g.lineStyle(2, 0x7dff9a, on ? 0.8 : 0.4).strokeCircle(890, 530, 44)
    this.touchIcons[1]?.setAlpha(on ? 0.95 : 0.4)
    g.lineStyle(2, 0xffffff, 0.4).strokeRoundedRect(12, 12, 56, 56, 10)
    g.fillStyle(0xffffff, 0.5).fillRect(29, 26, 7, 28).fillRect(44, 26, 7, 28)
  }

  /** Rebuild the weapon strip when the weapons on board change; flash the name on a switch. */
  private updateWeaponBar(sw: number): void {
    const list = this.specials()
    const sig = list.map(([, , t]) => t).join()
    const bar = this.weaponBar
    if (sig !== bar.sig) this.rebuildWeaponBar(list, sig)
    const g = this.hud.g
    for (const it of bar.items) {
      const on = it.t === sw
      for (const o of it.objs) (o as GameObjects.Image).setAlpha(on ? 1 : 0.5)
      if (on) g.lineStyle(2, 0x39d0ff, 0.9).strokeRoundedRect(it.x - 24, 551, 48, 46, 8)
    }
    if (sw === this.lastWeapon) return
    this.lastWeapon = sw
    const name = this.hud.weaponName
    this.tweens.killTweensOf(name)
    name.setText(sw >= 0 ? (OBJ_LIB[sw]?.name ?? "") : "").setAlpha(1)
    this.tweens.add({ targets: name, alpha: 0, delay: 1200, duration: 500 })
  }

  private rebuildWeaponBar(list: (typeof SPECIAL_KEYS)[number][], sig: string): void {
    const bar = this.weaponBar
    for (const it of bar.items) for (const o of it.objs) o.destroy()
    bar.sig = sig
    bar.items = list.map(([, key, t], i) => {
      const x = 480 + (i - (list.length - 1) / 2) * 52
      const icon = this.add.image(x, 574, `pickup-${t}`).setScale(0.75).setDepth(D.hud)
      const label = this.add
        .text(x + 15, 588, key, {
          fontFamily: UI.mono,
          fontSize: "14px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(D.hud)
        .setStroke("#05060d", 4)
      return { t, x, objs: [icon, label] }
    })
    if (this.demo < 0) {
      const fixed = this.input2.buttons.filter((b) => !b.id.startsWith("w"))
      const slots = bar.items.map((it) => ({ id: `w${it.t}`, x: it.x, y: 574, r: 26 }))
      this.input2.buttons = [...fixed, ...slots]
    }
  }

  private pauseMove(d: number): void {
    const n = this.pauseItems.length
    if (!this.paused || !n) return
    this.pauseCursor = (this.pauseCursor + d + n) % n
    this.pauseHighlight()
  }

  /** LEFT/RIGHT: change the selected volume row, else step the special weapon. */
  private pauseLeftRight(d: number): void {
    if (!this.paused) return
    const adjust = this.pauseItems[this.pauseCursor]?.adjust
    if (adjust) adjust(d)
    else this.pauseWeaponStep?.(d)
  }

  private pauseActivate(): void {
    if (this.paused) this.pauseItems[this.pauseCursor]?.fn()
  }

  private pauseHighlight(): void {
    this.pauseItems.forEach(({ t }, i) => {
      const sel = i === this.pauseCursor
      t.setColor(sel ? UI.gold : UI.text).setScale(sel ? 1.08 : 1)
    })
  }

  private togglePause(): void {
    if (this.ended || this.waiting) return
    this.paused = !this.paused
    this.pauseLayer?.destroy()
    this.pauseLayer = null
    this.pauseItems = []
    this.pauseWeaponStep = null
    if (!this.paused) {
      this.input2.ignoreEnterUntilUp()
      this.sound.resumeAll()
      return
    }
    this.sound.pauseAll()
    if (this.briefing) {
      this.tweens.killTweensOf(this.briefing)
      this.briefing.destroy()
      this.briefing = null
    }
    this.tweens.killTweensOf(this.hud.banner)
    this.hud.banner.setAlpha(0)
    const bg = this.add.rectangle(480, 300, 960, 600, 0x000000, 0.6)
    const title = this.add
      .text(480, 110, tr("game.paused"), {
        fontFamily: UI.font,
        fontSize: "48px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
    const mk = (y: number, label: string, fn: () => void) => {
      const t = this.add
        .text(480, y, label, {
          fontFamily: UI.font,
          fontSize: "26px",
          color: UI.text,
        })
        .setOrigin(0.5)
        .setPadding(24, 8, 24, 8)
        .setInteractive({ useHandCursor: true })
      t.on("pointerup", fn)
      this.pauseItems.push({ t, fn })
      return t
    }
    const items: GameObjects.Text[] = []
    items.push(mk(0, tr("game.resume"), () => this.togglePause()))
    const fireLabel = () =>
      tr("game.autoFireLabel", { state: tr(this.input2.autoFire ? "on" : "off") })
    const fire = mk(0, fireLabel(), () => {
      this.input2.toggleAutoFire()
      fire.setText(fireLabel())
    })
    items.push(fire, this.pauseVolume("music"), this.pauseVolume("sfx"))
    // hidden where the Fullscreen API is missing (iPhone), like the menu entry
    if (this.scale.fullscreen.available) {
      const fsLabel = () =>
        tr("game.fullscreenLabel", { state: tr(this.scale.isFullscreen ? "on" : "off") })
      const fs = mk(0, fsLabel(), () => {
        toggleFullscreen(this)
        this.time.delayedCall(300, () => fs.active && fs.setText(fsLabel()))
      })
      items.push(fs)
    }
    items.push(mk(0, tr("game.abort"), () => this.end("abort")))
    items.forEach((t, i) => {
      t.setY(160 + i * 46)
    })
    this.pauseCursor = 0
    this.pauseHighlight()
    const extras = this.pauseWeapons(160 + items.length * 46)
    const hint = this.add
      .text(480, 575, this.isTouch() ? "" : tr("game.pauseHint"), {
        fontFamily: UI.font,
        fontSize: "16px",
        color: UI.dim,
      })
      .setOrigin(0.5)
    this.pauseLayer = this.add
      .container(0, 0, [bg, title, ...items, ...extras, hint])
      .setDepth(D.overlay + 10)
    this.pauseLayer.setScrollFactor(0)
  }

  /** Pause menu volume row: tap cycles, LEFT/RIGHT step (like the start screen options). */
  private pauseVolume(kind: "music" | "sfx"): GameObjects.Text {
    const label = () =>
      `${tr(kind === "music" ? "menu.music" : "menu.sfx")}: ${pctLabel(loadSettings()[kind])}`
    const set = (d: number) => {
      changeVolume(kind, d)
      t.setText(label())
    }
    const t = this.add
      .text(480, 0, label(), { fontFamily: UI.font, fontSize: "26px", color: UI.text })
      .setOrigin(0.5)
      .setPadding(24, 8, 24, 8)
      .setInteractive({ useHandCursor: true })
    t.on("pointerup", () => set(0))
    this.pauseItems.push({ t, fn: () => set(0), adjust: set })
    return t
  }

  /** Pause menu: tappable icons of the special weapons on board (the current one is framed). */
  private pauseWeapons(y: number): GameObjects.GameObject[] {
    const list = this.specials()
    if (!list.length) return []
    let cur = this.world.plr.sweapon
    const out: GameObjects.GameObject[] = [
      this.add
        .text(480, y, tr("game.specialWeapon"), {
          fontFamily: UI.font,
          fontSize: "16px",
          color: UI.dim,
        })
        .setOrigin(0.5),
    ]
    const frames: [number, GameObjects.Rectangle][] = []
    const name = this.add
      .text(480, y + 84, "", { fontFamily: UI.font, fontSize: "18px", color: UI.gold })
      .setOrigin(0.5)
    const pick = (t: ObjType) => {
      this.input2.selectWeapon(t)
      cur = t
      for (const [ft, fr] of frames) fr.setStrokeStyle(3, 0x39d0ff, ft === cur ? 1 : 0)
      name.setText(OBJ_LIB[t]?.name ?? "")
    }
    this.pauseWeaponStep = (d) => {
      const i = list.findIndex(([, , t]) => t === cur)
      const next = list[(i + d + list.length) % list.length]
      if (next) pick(next[2])
    }
    for (const [i, [, key, t]] of list.entries()) {
      const x = 480 + (i - (list.length - 1) / 2) * 76
      const frame = this.add
        .rectangle(x, y + 46, 68, 68, 0x10182a)
        .setStrokeStyle(3, 0x39d0ff, t === cur ? 1 : 0)
        .setInteractive({ useHandCursor: true })
      frame.on("pointerup", () => pick(t))
      frames.push([t, frame])
      const icon = this.add.image(x, y + 42, `pickup-${t}`)
      const label = this.add
        .text(x, y + 68, key, { fontFamily: UI.mono, fontSize: "14px", color: "#ffffff" })
        .setOrigin(0.5)
      out.push(frame, icon, label)
    }
    name.setText(cur >= 0 ? (OBJ_LIB[cur]?.name ?? "") : "")
    out.push(name)
    return out
  }

  private finishDemo(): void {
    if (this.ended) return
    this.ended = true
    this.scene.start("Menu")
  }

  /** Banner text and scene switch after a wave (also plays the death jingle / stores the pilot). */
  private endTarget(
    { pilot, outcome }: ReturnType<typeof afterWave>,
    result: WaveResult,
    replay: boolean,
    payout: number,
  ): { text: string; next: () => void } {
    const sim = this.sector === "train"
    const cr = payout > 0 ? ` +${payout} CR` : ""
    if (outcome === "death") {
      getAudio().playSong(this, "rap5", false)
      // count the death against the last save (the flight's own score/loadout is discarded,
      // half the credits earned this run are kept)
      const saved = loadPilots().find((q) => q.name === pilot.name)
      if (saved)
        savePilot({
          ...recordFail(saved, levelKey(this.sector, this.wave)),
          score: saved.score + payout,
        })
      reloadPilot()
      return {
        text: tr(sim ? "game.simFailed" : "game.shipDestroyed"),
        next: () =>
          this.scene.start("Hangar", {
            message: `${tr(sim ? "game.simFailedMsg" : "game.shipDestroyedMsg")}${cr}`,
            earned: payout,
          }),
      }
    }
    // web change: an abort also restores the saved loadout (weapons lost in flight come back),
    // but keeps half the credits earned this run
    if (result === "abort") {
      const saved = loadPilots().find((q) => q.name === pilot.name)
      if (saved && payout > 0) savePilot({ ...saved, score: saved.score + payout })
      reloadPilot()
    } else {
      setPilot(pilot)
      getAudio().playSong(this, "fanfare", false)
    }
    if (outcome === "landing") return this.landingTarget(sim, result, replay, payout)
    const training = outcome === "trainingComplete"
    const message = training ? tr("game.trainingCompleteMsg") : tr("game.sectorSecuredMsg")
    return {
      text: training
        ? tr("game.trainingComplete")
        : tr("game.sectorSecured", { sector: tr("sector.bravoName") }),
      next: () => this.scene.start("Hangar", { message, earned: payout }),
    }
  }

  private landingTarget(
    sim: boolean,
    result: WaveResult,
    replay: boolean,
    payout: number,
  ): { text: string; next: () => void } {
    const aborted = result === "abort"
    const payoutStr = payout > 0 ? ` +${payout} CR` : ""
    const doneKey = replay ? "game.waveReplayed" : "game.waveComplete"
    const message = aborted
      ? `${tr("game.aborted")}${payoutStr}`
      : tr(doneKey, { n: this.wave + 1, cr: payout })
    const data: HangarData = { message, earned: payout }
    const completeText = tr(sim ? "game.simComplete" : "game.waveCompleteTitle")
    return {
      text: aborted ? tr("game.missionAborted") : completeText,
      next: () => this.scene.start("Hangar", data),
    }
  }

  private end(forced?: WaveResult): void {
    if (this.ended) return
    this.ended = true
    this.sound.resumeAll()
    getAudio().stopAll()
    if (this.demo >= 0) {
      this.time.delayedCall(800, () => this.scene.start("Menu"))
      return
    }
    const result: WaveResult = forced ?? (this.world.dead ? "dead" : "complete")
    const p = currentPilot()
    if (!p) return
    // web change: a completed wave refills the shield to at least 50%
    if (result === "complete") refillShield(this.lo.inv)
    const earned = this.lo.plr.score - this.startScore
    // web change: a death or abort still keeps half the credits earned in flight
    const payout = result === "complete" ? earned : Math.floor(earned / 2)
    const replay = isReplay(p, this.sector, this.wave)
    const pct = this.world.destroyedPct
    const after = afterWave(
      withLoadout(p, this.lo),
      result,
      this.sector,
      this.wave,
      earned,
      pct.enemies ?? undefined,
    )
    const { text, next } = this.endTarget(after, result, replay, payout)
    if (result === "complete") {
      this.showResults(text, pct, after, earned, next)
      return
    }
    const glow = after.outcome === "death" ? UI.warn : UI.accent
    const t = glowText(this, 480, 280, text, 52, 24, { glow }).setDepth(D.overlay).setAlpha(0)
    this.tweens.add({ targets: t, alpha: 1, duration: 500 })
    this.cameras.main.fadeOut(2600, 0, 0, 0)
    this.time.delayedCall(2800, next)
  }

  /** Completed wave: destroyed percentages and the level's top 10 (this run in gold), then Continue. */
  private showResults(
    title: string,
    pct: World["destroyedPct"],
    { pilot, rank }: ReturnType<typeof afterWave>,
    earned: number,
    next: () => void,
  ): void {
    const fmt = (v: number | null) => (v === null ? "-" : `${v}%`)
    const st = pilot.stats?.[levelKey(this.sector, this.wave)]
    const top = st?.top ?? []
    const txt = (y: number, s: string, size: number, color: string, font = UI.font) =>
      this.add.text(0, y, s, { fontFamily: font, fontSize: `${size}px`, color }).setOrigin(0.5)
    // a new personal best (rank 1) or the place this run took in the top 10
    let rankStr = ""
    if (rank === 1 && top.length > 1) rankStr = `  ·  ${tr("game.newBest")}`
    else if (rank !== null) rankStr = `  ·  ${tr("game.rank", { n: rank })}`
    const items: GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, 640, 500, 0x05060d, 0.82).setStrokeStyle(1, 0x39d0ff, 0.6),
      glowText(this, 0, -200, title, 44, 24),
      txt(-150, `+${earned} CR${rankStr}`, 24, UI.gold),
      txt(-116, tr("game.destroyed", { e: fmt(pct.enemies), b: fmt(pct.buildings) }), 20, UI.text),
      txt(-78, topHeader(st, this.wave), 19, UI.accent, UI.mono),
      ...top.map((r, i) =>
        txt(-52 + i * 21, topRunLine(i, r), 18, rank === i + 1 ? UI.gold : UI.text, UI.mono),
      ),
    ]
    if (rank === null) items.push(txt(-48 + top.length * 21, tr("game.notTop"), 18, UI.warn))
    let done = false
    const go = () => {
      if (done) return
      done = true
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, next)
    }
    items.push(this.pillButton(208, tr("game.continue"), go))
    // continue on keyup of a key pressed now: a key still held from the fight must not skip this
    let armed = false
    for (const k of ["ENTER", "SPACE"]) {
      this.input.keyboard?.on(`keydown-${k}`, () => (armed = true))
      this.input.keyboard?.on(`keyup-${k}`, () => armed && go())
    }
    const panel = this.add.container(480, 300, items).setDepth(D.overlay).setAlpha(0)
    this.tweens.add({ targets: panel, alpha: 1, duration: 500 })
  }
}
