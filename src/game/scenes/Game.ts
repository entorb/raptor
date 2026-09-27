// Gameplay: runs the DOS-exact sim at its fixed rate (FRAME_MS) and renders it with the new art,
// interpolating positions between sim frames.
import { type GameObjects, Scene } from "phaser"
import { buildTrainingTextures } from "../art/textures"
import { getAudio, WAVE_SONGS } from "../audio/audio"
import {
  afterWave,
  type Loadout,
  levelKey,
  loadout,
  nextWave,
  SECTOR_NAMES,
  sectorDiff,
  type WaveResult,
  waveMap,
  withLoadout,
} from "../campaign"
import { DEMOS } from "../data/ep1"
import { SCALE } from "../data/playfield"
import type { Sector } from "../data/save"
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
import { Inventory, OBJ_LIB } from "../sim/objects"
import { type DemoFrame, World } from "../sim/world"
import { UI } from "../ui/textMenu"
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
    score: GameObjects.Text
    special: GameObjects.Image
    warn: GameObjects.Text
    banner: GameObjects.Text
    weaponName: GameObjects.Text
    novas: GameObjects.Image[]
  }
  /** Bottom strip: special weapons on board with their keys (tap to select on touch). */
  private weaponBar: {
    sig: string
    items: { t: ObjType; x: number; objs: GameObjects.GameObject[] }[]
  } = { sig: "", items: [] }
  private lastWeapon = -1
  private stars!: GameObjects.TileSprite[]
  private paused = false
  private pauseLayer: GameObjects.Container | null = null
  private pauseItems: { t: GameObjects.Text; fn: () => void }[] = []
  private pauseCursor = 0
  private ended = false
  private shakeAmt = 0
  private briefing: GameObjects.Container | null = null

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
    this.weaponBar = { sig: "", items: [] }
  }

  create(): void {
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
      else if (id.startsWith("w")) this.input2.selectWeapon(Number(id.slice(1)) as ObjType)
    }
    this.createHud()
    const kb = this.input.keyboard
    kb?.on("keydown-ESC", () => (this.demo >= 0 ? this.finishDemo() : this.togglePause()))
    kb?.on("keydown-P", () => this.demo < 0 && this.togglePause())
    kb?.on("keydown-UP", () => this.pauseMove(-1))
    kb?.on("keydown-W", () => this.pauseMove(-1))
    kb?.on("keydown-DOWN", () => this.pauseMove(1))
    kb?.on("keydown-S", () => this.pauseMove(1))
    kb?.on("keydown-ENTER", () => this.pauseActivate())
    kb?.on("keydown-SPACE", () => this.pauseActivate())
    if (this.demo >= 0) {
      this.input.on("pointerdown", () => this.finishDemo())
      kb?.on("keydown", () => this.finishDemo())
    }
    getAudio().playSong(this, WAVE_SONGS[this.mapWave] ?? "rap8")
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
    return this.sector === "train" ? "TRAINING SIMULATION" : SECTOR_NAMES[this.sector]
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
      if (e.type === 5) continue // laser: drawn as a beam
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
      t.obj.setAlpha(b.dflag ? b.countdown / 50 : 1)
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
      [Obj.ENERGY]: "+SHIELD",
    }
    const label = money[type] ?? (type >= Obj.ITEMBUY1 ? "+CREDITS" : "WEAPON")
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
    const score = this.add
      .text(72, 36, "", {
        fontFamily: UI.mono,
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0, 0)
      .setDepth(D.hud)
      .setShadow(0, 0, UI.accent, 10, true, true)
    const special = this.add.image(900, 34, "pickup-3").setDepth(D.hud).setScale(0.9)
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
    const banner = this.add
      .text(480, 110, `${this.sectorTitle()}\nWAVE ${this.wave + 1}`, {
        fontFamily: UI.font,
        fontSize: "40px",
        color: "#ffffff",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(D.overlay)
      .setShadow(0, 0, UI.accent, 20, true, true)
    if (this.demo >= 0) banner.setText("DEMO\ntap or press any key").setY(250)
    this.tweens.add({ targets: banner, alpha: 0, delay: 5200, duration: 800 })
    if (this.demo < 0) {
      const help = this.controlsPanel(300).setDepth(D.overlay)
      this.briefing = help
      this.tweens.add({
        targets: help,
        alpha: 0,
        delay: 6000,
        duration: 800,
        onComplete: () => {
          if (this.briefing !== help) return
          help.destroy()
          this.briefing = null
        },
      })
    }
    this.input2.onAutoFire = (on) => this.toast(`AUTO-FIRE ${on ? "ON" : "OFF"}`)
    this.input2.onGod = () => this.toggleGod()
    const weaponName = this.add
      .text(480, 62, "", {
        fontFamily: UI.font,
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(D.hud)
      .setShadow(0, 0, UI.accent, 12, true, true)
      .setAlpha(0)
    this.lastWeapon = this.world.plr.sweapon
    const novas = Array.from({ length: 5 }, (_, i) =>
      this.add.image(64 + i * 22, 578, "shot-MEGABM_BLK").setDepth(D.hud),
    )
    this.hud = { g, score, special, warn, banner, weaponName, novas }
    if (this.demo < 0) {
      this.input2.buttons = [
        { id: "pause", x: 40, y: 40, r: 44 },
        { id: "mega", x: 70, y: 530, r: 64 },
        { id: "cycle", x: 890, y: 530, r: 64 },
      ]
    }
  }

  private isTouch(): boolean {
    return this.input2.touchMode || window.matchMedia?.("(pointer: coarse)").matches === true
  }

  /** Mission briefing: all controls plus the keys of the special weapons on board. */
  private controlsLines(): string[] {
    const inv = this.world.inv
    const fire = this.input2.autoFire ? "AUTO-FIRE ON" : "AUTO-FIRE OFF"
    const specials = SPECIAL_KEYS.filter(([, , t]) => inv.isEquip(t)).map(
      ([, key, t]) => `${key}  ${OBJ_LIB[t]?.name ?? ""}`,
    )
    const lines = this.isTouch()
      ? [
          "STEER        drag anywhere (also beside the game)",
          `FIRE         ${this.input2.autoFire ? "automatic" : "while touching"}`,
          "SPECIAL      ▶ button: next · tap icon at bottom",
          "NOVA BOMB    ● button",
          "PAUSE        ❚❚ button (also auto-fire on/off)",
        ]
      : [
          "MOVE         Arrows / WASD",
          `FIRE         ${fire} (F toggles) · Space / Ctrl`,
          "SPECIAL      Shift / Alt: next weapon",
          "NOVA BOMB    B / Enter",
          "PAUSE        P / Esc",
        ]
    if (specials.length) {
      lines.push(
        "",
        this.isTouch() ? "SPECIAL WEAPONS ON BOARD" : "SELECT SPECIAL WEAPON",
        ...specials,
      )
    } else lines.push("", "No special weapons on board: buy some in the supply shop.")
    return lines
  }

  private controlsPanel(y: number): GameObjects.Container {
    const text = this.add
      .text(0, 0, this.controlsLines().join("\n"), {
        fontFamily: UI.mono,
        fontSize: "17px",
        color: UI.text,
        lineSpacing: 5,
      })
      .setOrigin(0.5)
    const bg = this.add
      .rectangle(0, 0, text.width + 48, text.height + 32, 0x05060d, 0.72)
      .setStrokeStyle(1, 0x39d0ff, 0.6)
    return this.add.container(480, y, [bg, text])
  }

  /**
   * Hidden god mode (key G): invulnerable (World.god, DOS godmode) and +$10000000 on activation.
   * It stays on for the next missions (session.godMode).
   */
  private toggleGod(): void {
    if (this.demo >= 0 || this.ended) return
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

  private bar(x: number, value: number, max: number, c1: number, c2: number): void {
    const g = this.hud.g
    const top = 60
    const h = 480
    g.fillStyle(0x05060d, 0.6).fillRoundedRect(x - 9, top - 4, 18, h + 8, 6)
    const f = Math.max(0, Math.min(1, value / max))
    const n = 25
    for (let i = 0; i < n; i++) {
      const on = i / n < f
      const y = top + h - ((i + 1) * h) / n + 2
      let c = c1
      if (i / n < 0.25) c = 0xff4050
      else if (i / n < 0.5) c = c2
      g.fillStyle(on ? c : 0x1a2030, on ? 0.95 : 0.8).fillRoundedRect(x - 6, y, 12, h / n - 4, 2)
    }
  }

  private updateHud(): void {
    const w = this.world
    const inv = w.inv
    const g = this.hud.g
    g.clear()
    this.bar(24, inv.getAmt(Obj.SUPER_SHIELD), MAX_SHIELD, 0x46e0ff, 0x46a0ff)
    this.bar(936, inv.getAmt(Obj.ENERGY), MAX_SHIELD, 0x2effb4, 0xffd23d)
    this.hud.score.setText(`${w.plr.score} CR`)
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
    if (w.weaponLost) warn = "WEAPON LOST\nSHIELD LOW"
    else if (w.lowShield) warn = "SHIELD LOW"
    this.hud.warn.setText(warn)
    if (this.input2.touchMode && this.demo < 0) this.drawTouchButtons(g)
  }

  private drawTouchButtons(g: GameObjects.Graphics): void {
    g.lineStyle(2, 0xffe066, 0.5).strokeCircle(70, 530, 44)
    g.lineStyle(2, 0x39d0ff, 0.5).strokeCircle(890, 530, 44)
    g.lineStyle(2, 0xffffff, 0.4).strokeRoundedRect(20, 20, 40, 40, 8)
    g.fillStyle(0xffffff, 0.5).fillRect(33, 30, 5, 20).fillRect(43, 30, 5, 20)
    g.fillStyle(0xffe066, 0.8).fillCircle(70, 530, 12)
    g.fillStyle(0x39d0ff, 0.8).fillTriangle(878, 520, 878, 540, 902, 530)
  }

  /** Rebuild the weapon strip when the weapons on board change; flash the name on a switch. */
  private updateWeaponBar(sw: number): void {
    const inv = this.world.inv
    const list = SPECIAL_KEYS.filter(([, , t]) => inv.isEquip(t))
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

  private pauseActivate(): void {
    if (this.paused) this.pauseItems[this.pauseCursor]?.fn()
  }

  private pauseHighlight(): void {
    this.pauseItems.forEach(({ t }, i) => {
      const sel = i === this.pauseCursor
      t.setColor(sel ? "#ffffff" : UI.text)
      t.setBackgroundColor(sel ? "#1d3a5c" : "#10182a")
    })
  }

  private togglePause(): void {
    if (this.ended) return
    this.paused = !this.paused
    this.pauseLayer?.destroy()
    this.pauseLayer = null
    this.pauseItems = []
    if (!this.paused) {
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
      .text(480, 150, "PAUSED", {
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
          fontSize: "30px",
          color: UI.text,
          backgroundColor: "#10182a",
        })
        .setOrigin(0.5)
        .setPadding(24, 10, 24, 10)
        .setInteractive({ useHandCursor: true })
      t.on("pointerup", fn)
      this.pauseItems.push({ t, fn })
      return t
    }
    const items: GameObjects.Text[] = []
    items.push(mk(0, "Resume", () => this.togglePause()))
    const fireLabel = () => `Auto-Fire: ${this.input2.autoFire ? "ON" : "OFF"}`
    const fire = mk(0, fireLabel(), () => {
      this.input2.toggleAutoFire()
      fire.setText(fireLabel())
    })
    items.push(fire)
    // hidden where the Fullscreen API is missing (iPhone), like the menu entry
    if (this.scale.fullscreen.available) {
      const fsLabel = () => `Fullscreen: ${this.scale.isFullscreen ? "ON" : "OFF"}`
      const fs = mk(0, fsLabel(), () => {
        toggleFullscreen(this)
        this.time.delayedCall(300, () => fs.active && fs.setText(fsLabel()))
      })
      items.push(fs)
    }
    items.push(mk(0, "Abort Mission", () => this.end("abort")))
    items.forEach((t, i) => {
      t.setY(230 + i * 70)
    })
    this.pauseCursor = 0
    this.pauseHighlight()
    const hint = this.add
      .text(480, 230 + items.length * 70, "Arrows + Enter, Esc/P resume", {
        fontFamily: UI.font,
        fontSize: "16px",
        color: UI.dim,
      })
      .setOrigin(0.5)
    this.pauseLayer = this.add.container(0, 0, [bg, title, ...items, hint]).setDepth(D.overlay + 10)
    this.pauseLayer.setScrollFactor(0)
  }

  private finishDemo(): void {
    if (this.ended) return
    this.ended = true
    this.scene.start("Menu")
  }

  /** Banner text and scene switch after a wave (also plays the death jingle / stores the pilot). */
  private endTarget(
    { pilot, outcome, rank }: ReturnType<typeof afterWave>,
    result: WaveResult,
    replay: boolean,
    earned: number,
  ): { text: string; next: () => void } {
    const sim = this.sector === "train"
    if (outcome === "death") {
      getAudio().playSong(this, "rap5", false)
      reloadPilot()
      return {
        text: sim ? "SIMULATION FAILED" : "SHIP DESTROYED",
        next: () =>
          this.scene.start("Hangar", {
            message: `${sim ? "Simulation failed" : "Ship destroyed"}. Last save restored.`,
          }),
      }
    }
    setPilot(pilot)
    if (outcome === "landing") {
      const aborted = result === "abort"
      const verb = replay ? "replayed" : "complete"
      const data: HangarData = {
        message: aborted ? "Mission aborted." : `Wave ${this.wave + 1} ${verb}: +${earned} CR`,
      }
      if (replay && result === "complete")
        data.result = { key: levelKey(this.sector, this.wave), wave: this.wave, earned, rank }
      return {
        text: aborted ? "MISSION ABORTED" : `${sim ? "SIMULATION" : "WAVE"} COMPLETE`,
        next: () => this.scene.start("Hangar", data),
      }
    }
    const training = outcome === "trainingComplete"
    const message = training
      ? "Training complete. Missions can be replayed."
      : "Sector secured! Missions can be replayed."
    return {
      text: training ? "TRAINING COMPLETE" : `${SECTOR_NAMES.bravo} SECURED`,
      next: () => this.scene.start("Hangar", { message }),
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
    if (result === "abort") this.lo.plr.score = this.startScore // Do_Game: plr.score = start_score
    // web change: a completed wave refills the shield to at least 50%
    const shield = this.lo.inv.p_objs[Obj.ENERGY]
    if (result === "complete" && shield) shield.num = Math.max(shield.num, MAX_SHIELD / 2)
    const earned = this.lo.plr.score - this.startScore
    const replay = this.wave !== nextWave(p, this.sector)
    const after = afterWave(withLoadout(p, this.lo), result, this.sector, this.wave, earned)
    const { text, next } = this.endTarget(after, result, replay, earned)
    const t = this.add
      .text(480, 280, text, {
        fontFamily: UI.font,
        fontSize: "52px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(D.overlay)
      .setAlpha(0)
      .setShadow(0, 0, after.outcome === "death" ? UI.warn : UI.accent, 24, true, true)
    this.tweens.add({ targets: t, alpha: 1, duration: 500 })
    this.cameras.main.fadeOut(2600, 0, 0, 0)
    this.time.delayedCall(2800, next)
  }
}
