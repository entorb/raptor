// Hangar + supply shop as plain text menus (WINDOWS.C WIN_Hangar, STORE.C STORE_Enter).
import { type GameObjects, Scene } from "phaser"
import { seeded } from "../art/draw"
import { BAY, PAD, PAD_TILT } from "../art/hangar"
import { getAudio } from "../audio/audio"
import {
  doneWaves,
  type Loadout,
  levelKey,
  nextWave,
  SECTOR_NAMES,
  sectorWaves,
  withLoadout,
} from "../campaign"
import { ENEMY_LIB } from "../data/ep1"
import { type PilotSave, SECTORS, type Sector } from "../data/save"
import { reportMissionStart } from "../data/stats"
import { currentPilot, pilotLoadout, setPilot } from "../session"
import { MAX_SHIELD, Obj, type ObjType } from "../sim/consts"
import { Buy, OBJ_LIB } from "../sim/objects"
import { backdrop, header, ICON, type MenuItem, TextMenu, UI } from "../ui/textMenu"
import { DIFF_NAMES } from "./Menu"

type Mode = "hangar" | "buy" | "sell" | "replay" | "result"

export interface HangarData {
  message?: string
  /** a finished replay: shown against the level's top 10 */
  result?: { key: string; wave: number; earned: number; rank: number | null }
}

/** One-line shop descriptions (space re-theme of the ITEMxx_TXT help). */
const DESC: Partial<Record<ObjType, string>> = {
  [Obj.FORWARD_GUNS]: "Standard twin blasters. Hit air and surface targets.",
  [Obj.PLASMA_GUNS]: "Heavy plasma bolts, air targets only.",
  [Obj.MICRO_MISSLE]: "Wing-mounted micro missiles, air and surface.",
  [Obj.DUMB_MISSLE]: "Special: unguided missiles, dropped then launched.",
  [Obj.MINI_GUN]: "Special: auto-tracking minigun, locks on random targets.",
  [Obj.TURRET]: "Special: auto-tracking laser turret vs. fighters.",
  [Obj.MISSLE_PODS]: "Special: rapid missile pods vs. fighters.",
  [Obj.AIR_MISSLE]: "Special: air-to-air missiles.",
  [Obj.GRD_MISSLE]: "Special: heavy missiles vs. surface targets.",
  [Obj.BOMB]: "Special: hull buster bomb for station modules.",
  [Obj.ENERGY_GRAB]: "Special: siphons enemy energy and jams their guns.",
  [Obj.MEGA_BOMB]: "Nova bomb: damages everything on screen (max 5).",
  [Obj.PULSE_CANNON]: "Special: wide pulse waves.",
  [Obj.FORWARD_LASER]: "Special: twin lasers that cut through fighters.",
  [Obj.DEATH_RAY]: "Special: the death ray.",
  [Obj.SUPER_SHIELD]: "Phase shield: absorbs damage before the hull shield.",
  [Obj.ENERGY]: "Shield energy (25% per unit).",
  [Obj.DETECT]: "Damage scanner: shows the boss hull integrity.",
}

export class Hangar extends Scene {
  private menu!: TextMenu
  private mode: Mode = "hangar"
  private lo!: Loadout
  private status!: GameObjects.Text
  private desc!: GameObjects.Text
  private msg!: GameObjects.Text
  private tick: () => void = () => {}
  private message = ""
  private result: HangarData["result"]
  private sub!: GameObjects.Text
  private panel!: GameObjects.Rectangle
  private table: GameObjects.Text[] = []
  private backBg!: GameObjects.Rectangle
  private backIcon!: GameObjects.Text
  private backFocused = false

  constructor() {
    super("Hangar")
  }

  init(data: HangarData): void {
    this.message = data?.message ?? ""
    this.result = data?.result
  }

  create(): void {
    const p = currentPilot()
    if (!p) {
      this.scene.start("Menu")
      return
    }
    this.lo = pilotLoadout()
    this.tick = backdrop(this)
    this.dogfight()
    this.add.image(480, 300, "hangar-bg")
    this.parkedShip()
    this.panel = this.add
      .rectangle(640, 158, 360, 100, 0x05060d, 0.72)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x39d0ff, 0.35)
    header(this, "HANGAR")
    this.sub = this.add
      .text(480, 100, "", { fontFamily: UI.font, fontSize: "20px", color: UI.accent })
      .setOrigin(0.5)
    this.status = this.add
      .text(480, 578, "", { fontFamily: UI.mono, fontSize: "19px", color: UI.text })
      .setOrigin(0.5)
      .setShadow(0, 0, "#000000", 6, true, true)
    this.desc = this.add
      .text(640, 514, "", {
        fontFamily: UI.font,
        fontSize: "15px",
        color: UI.dim,
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5)
    this.msg = this.add
      .text(480, 136, this.message, { fontFamily: UI.font, fontSize: "18px", color: UI.gold })
      .setOrigin(0.5)
    this.menu = new TextMenu(this, 470, 164, 340, 36, 9)
    this.menu.onBack = () => this.backAction()
    this.menu.onMove = () => this.describe()
    this.menu.onUpFromStart = () => this.setBackFocus(true)
    this.buildBackButton()
    getAudio().playSong(this, "hangar")
    this.show(this.result ? "result" : "hangar")
    this.save()
  }

  update(): void {
    this.tick()
  }

  /** The pilot's ship on the pad, projected onto the floor (squashed after turning to the bay). */
  private parkedShip(): void {
    const key = "hangar-ship"
    if (!this.textures.exists(key)) {
      const f = this.textures.getFrame("player", "3")
      const tex = f && this.textures.createCanvas(key, 320, 200)
      if (!tex) return
      const ctx = tex.context
      const draw = (dx: number, dy: number) => {
        ctx.save()
        ctx.translate(160 + dx, 100 + dy)
        ctx.scale(1, PAD_TILT + 0.12)
        ctx.rotate(0.35) // nose towards the bay door
        const s = 2.2
        ctx.drawImage(
          f.source.image as CanvasImageSource,
          f.cutX,
          f.cutY,
          f.cutWidth,
          f.cutHeight,
          (-f.cutWidth * s) / 2,
          (-f.cutHeight * s) / 2,
          f.cutWidth * s,
          f.cutHeight * s,
        )
        ctx.restore()
      }
      ctx.filter = "brightness(0) blur(6px)"
      ctx.globalAlpha = 0.6
      draw(8, 14)
      ctx.filter = "none"
      ctx.globalAlpha = 1
      draw(0, 0)
      tex.refresh()
    }
    this.add.image(PAD[0], PAD[1] - 12, key)
  }

  /** Fighters and laser bolts crossing the open bay door (behind the hangar frame). */
  private dogfight(): void {
    const fighters = [
      ...new Set(
        ENEMY_LIB.filter((e) => !e.ground && !e.bossflag && e.w && e.w <= 40).map((e) => e.iname),
      ),
    ]
    const r = seeded(Date.now() % 9973)
    const layer = this.add.container()
    const pass = () => {
      const ltr = r() < 0.5
      const [xa, xb] = ltr ? [BAY.x0 - 60, BAY.x1 + 60] : [BAY.x1 + 60, BAY.x0 - 60]
      const y = BAY.y0 + 30 + r() * (BAY.y1 - BAY.y0 - 60)
      const dy = (r() - 0.5) * 120
      const dur = 2600 + r() * 1800
      const name = fighters[Math.floor(r() * fighters.length)] ?? ""
      // enemy art faces down, the player's faces up
      const dir = ltr ? 1 : -1
      const foe = this.add
        .image(xa, y, `u-${name}`, "0")
        .setScale(0.55)
        .setAngle(-90 * dir)
      const hero = this.add
        .image(xa - dir * 70, y + 10, "player", "3")
        .setScale(0.4)
        .setAngle(90 * dir)
      const fly = (o: GameObjects.Image, delay: number) =>
        this.tweens.add({
          targets: o,
          x: xb,
          y: `+=${dy}`,
          duration: dur,
          delay,
          onComplete: () => o.destroy(),
        })
      layer.add([foe, hero])
      fly(foe, 0)
      fly(hero, 250)
      const shoot = this.time.addEvent({
        delay: 280,
        repeat: Math.floor(dur / 280),
        callback: () => {
          if (!hero.active) return
          const bolt = this.add
            .image(hero.x, hero.y, "dot")
            .setTint(0x39d0ff)
            .setScale(0.6, 0.15)
            .setBlendMode("ADD")
          layer.add(bolt)
          this.tweens.add({
            targets: bolt,
            x: hero.x + dir * 220,
            alpha: 0,
            duration: 380,
            onComplete: () => bolt.destroy(),
          })
        },
      })
      this.time.delayedCall(dur + 400, () => shoot.remove())
      this.time.delayedCall(1800 + r() * 2600, pass)
    }
    pass()
  }

  private save(): void {
    const p = currentPilot()
    if (p) setPilot(withLoadout(p, this.lo))
  }

  private exit(): void {
    this.save()
    this.scene.start("Menu")
  }

  /** Exit to hangar (from buy/sell/replay) or to the main menu (from hangar). */
  private backAction(): void {
    if (this.mode === "hangar") this.exit()
    else this.show("hangar")
  }

  /** Top-right back icon: mouse click/hover, or UP off the menu's first row. */
  private buildBackButton(): void {
    this.backBg = this.add
      .rectangle(908, 40, 56, 44, 0x10182a, 0.85)
      .setStrokeStyle(1, 0x39d0ff, 0)
      .setInteractive({ useHandCursor: true })
    this.backIcon = this.add
      .text(908, 40, ICON.back, { fontFamily: UI.font, fontSize: "26px", color: UI.text })
      .setOrigin(0.5)
    this.backBg.on("pointerover", () => this.setBackVisual(true))
    this.backBg.on("pointerout", () => this.setBackVisual(this.backFocused))
    this.backBg.on("pointerup", () => this.backAction())
    const kb = this.input.keyboard
    kb?.on("keydown-DOWN", () => {
      if (this.backFocused) this.setBackFocus(false)
    })
    kb?.on("keydown-S", () => {
      if (this.backFocused) this.setBackFocus(false)
    })
    kb?.on("keydown-ENTER", () => {
      if (this.backFocused) this.backAction()
    })
    kb?.on("keydown-SPACE", () => {
      if (this.backFocused) this.backAction()
    })
  }

  /** Keyboard focus: also disables the list so its own arrow/confirm keys don't fire. */
  private setBackFocus(on: boolean): void {
    this.backFocused = on
    this.menu.enabled = !on
    this.setBackVisual(on)
  }

  private setBackVisual(on: boolean): void {
    this.backBg.setStrokeStyle(1, 0x39d0ff, on ? 0.8 : 0)
    this.backBg.setFillStyle(on ? 0x39d0ff : 0x10182a, on ? 0.18 : 0.85)
    this.backIcon.setColor(on ? "#ffffff" : UI.text)
  }

  private items: (ObjType | null)[] = []

  private describe(): void {
    const t = this.items[this.menu.index]
    if (t === null || t === undefined) {
      this.desc.setText("")
      return
    }
    this.desc.setText(DESC[t] ?? "")
  }

  private updateStatus(): void {
    const p = currentPilot()
    if (!p) return
    const inv = this.lo.inv
    const shield = inv.getAmt(Obj.ENERGY)
    const phase = inv.getAmt(Obj.SUPER_SHIELD)
    this.status.setText(
      `CREDITS ${this.lo.plr.score}   SHIELD ${Math.round((shield / MAX_SHIELD) * 100)}%` +
        (phase ? `   PHASE ${phase}% x${inv.getTotal(Obj.SUPER_SHIELD)}` : "") +
        `   NOVA ${inv.getAmt(Obj.MEGA_BOMB)}`,
    )
  }

  private show(mode: Mode): void {
    this.mode = mode
    const p = currentPilot()
    if (!p) return
    const sector: Sector = p.sector ?? "bravo"
    this.items = []
    this.sub.setText(this.subtitle(p, sector))
    for (const t of this.table) t.destroy()
    this.table = []
    let items: MenuItem[]
    if (mode === "hangar") items = this.hangarItems(p, sector)
    else if (mode === "replay") items = this.replayItems(p, sector)
    else if (mode === "result") items = this.resultItems(p)
    else items = this.shopItems(mode === "buy")
    // panel fits the rows (the shop adds a description line, the result its top-10 table)
    const rows = mode === "result" ? 10 : Math.min(items.length, 9)
    this.panel.setSize(360, rows * 36 + (mode === "buy" || mode === "sell" ? 60 : 16))
    const keep =
      mode === "hangar" ? this.menu.index < items.length : mode === "buy" || mode === "sell"
    this.menu.setItems(items, keep)
    this.updateStatus()
    this.describe()
  }

  private subtitle(p: PilotSave, sector: Sector): string {
    const total = sectorWaves(p, sector)
    const next = nextWave(p, sector)
    let wave = "COMPLETE"
    if (next !== null)
      wave = next === total - 1 ? `FINAL WAVE ${next + 1}` : `WAVE ${next + 1} of ${total}`
    const name =
      sector === "train" ? SECTOR_NAMES.train : `${SECTOR_NAMES.bravo}  ·  ${DIFF_NAMES[p.diff]}`
    return `${name}  ·  ${wave}`
  }

  private hangarItems(p: PilotSave, sector: Sector): MenuItem[] {
    const items: MenuItem[] = []
    const next = nextWave(p, sector)
    if (next !== null)
      items.push({ label: `${ICON.play} Launch Mission`, action: () => this.launch(next) })
    // cycles through SECTORS (enter/right = next, left = previous)
    const cycle = (d = 1) => {
      const i = SECTORS.indexOf(sector)
      const to = SECTORS[(i + d + SECTORS.length) % SECTORS.length] ?? sector
      setPilot({ ...withLoadout(p, this.lo), sector: to })
      this.show("hangar")
    }
    items.push({ label: "Sector", action: () => cycle(), adjust: cycle })
    if (doneWaves(p, sector))
      items.push({ label: `${ICON.replay} Replay Mission`, action: () => this.show("replay") })
    items.push(
      { label: `${ICON.buy} Supply Shop: Buy`, action: () => this.show("buy") },
      { label: `${ICON.sell} Supply Shop: Sell`, action: () => this.show("sell") },
      { label: `${ICON.back} Exit to Main Menu`, action: () => this.exit() },
    )
    this.items = items.map(() => null)
    return items
  }

  private replayItems(p: PilotSave, sector: Sector): MenuItem[] {
    const items: MenuItem[] = []
    for (let w = 0; w < doneWaves(p, sector); w++) {
      const st = p.stats?.[levelKey(sector, w)]
      items.push({
        label: `Wave ${w + 1}`,
        detail: st ? `${st.n}x  best ${st.top[0] ?? 0} CR` : "",
        action: () => this.launch(w),
      })
    }
    items.push({ label: `${ICON.back} Back`, action: () => this.show("hangar") })
    this.items = items.map(() => null)
    return items
  }

  private resultItems(p: PilotSave): MenuItem[] {
    this.showResult(p.stats?.[this.result?.key ?? ""]?.top ?? [])
    this.items = [null]
    return [{ label: `${ICON.play} Continue`, action: () => this.show("hangar") }]
  }

  private shopItems(buy: boolean): MenuItem[] {
    const inv = this.lo.inv
    const items: MenuItem[] = []
    for (const t of buy ? inv.buyList() : inv.sellList()) {
      const lib = OBJ_LIB[t]
      if (!lib) continue
      const label = `${lib.name}${this.owned(t)}`
      if (buy) {
        const cost = inv.getCost(t)
        items.push({
          label,
          detail: `${cost} CR`,
          dim: cost > this.lo.plr.score,
          action: () => this.trade(t, true),
        })
      } else
        items.push({
          label,
          detail: `+${inv.getResale(t)} CR`,
          action: () => this.trade(t, false),
        })
      this.items.push(t)
    }
    items.push({ label: `${ICON.confirm} Done`, action: () => this.show("hangar") })
    this.items.push(null)
    return items
  }

  /** STORE.C "you have": amount for stackables (onlyflag), else number of copies (spares). */
  private owned(t: ObjType): string {
    const inv = this.lo.inv
    const lib = OBJ_LIB[t]
    const n = lib?.onlyflag ? inv.getAmt(t) : inv.getTotal(t)
    if (!n) return ""
    return t === Obj.ENERGY ? `  (${n}%)` : `  (${n})`
  }

  private trade(t: ObjType, buy: boolean): void {
    const inv = this.lo.inv
    const name = OBJ_LIB[t]?.name ?? ""
    if (buy) {
      const r = inv.buy(t)
      let text = "No room on the ship"
      if (r === Buy.GOTIT) text = `Purchased ${name}`
      else if (r === Buy.NOMONEY) text = "Not enough credits"
      this.msg.setText(text)
      this.msg.setColor(r === Buy.GOTIT ? UI.gold : UI.warn)
    } else {
      inv.sell(t)
      this.msg.setText(`Sold ${name}`).setColor(UI.gold)
    }
    this.save()
    this.show(this.mode)
  }

  /** Top-10 earnings of the replayed level, the new run in gold. */
  private showResult(top: number[]): void {
    const r = this.result
    if (!r) return
    const line = (y: number, text: string, color: string, size = 20) =>
      this.table.push(
        this.add
          .text(640, y, text, { fontFamily: UI.mono, fontSize: `${size}px`, color })
          .setOrigin(0.5),
      )
    line(236, `WAVE ${r.wave + 1} REPLAY  ·  TOP 10`, UI.accent, 22)
    top.forEach((v, i) => {
      const me = r.rank === i + 1
      line(
        270 + i * 24,
        `${String(i + 1).padStart(2)}.  ${String(v).padStart(8)} CR`,
        me ? UI.gold : UI.text,
      )
    })
    if (r.rank === null)
      line(270 + top.length * 24 + 6, `+${r.earned} CR: not in the top 10`, UI.warn)
  }

  private launch(wave: number): void {
    this.save()
    reportMissionStart()
    this.scene.start("Game", { wave, sector: currentPilot()?.sector ?? "bravo" })
  }
}
