// Hangar + supply shop as plain text menus (WINDOWS.C WIN_Hangar, STORE.C STORE_Enter).
import { type GameObjects, Scene } from "phaser"
import { seeded } from "../art/draw"
import { BAY, PAD, PAD_TILT } from "../art/hangar"
import { getAudio } from "../audio/audio"
import {
  defaultWave,
  type Loadout,
  levelKey,
  nextWave,
  playable,
  SECTOR_NAMES,
  sectorWaves,
  topRunLine,
  withLoadout,
} from "../campaign"
import { ENEMY_LIB } from "../data/ep1"
import { type PilotSave, SECTORS, type Sector } from "../data/save"
import { reportMissionStart } from "../data/stats"
import { currentPilot, pilotLoadout, setPilot } from "../session"
import { MAX_SHIELD, Obj, type ObjType } from "../sim/consts"
import { Buy, OBJ_LIB } from "../sim/objects"
import { backdrop, header, ICON, type MenuItem, TextMenu, UI } from "../ui/textMenu"
import { pilotTitle } from "./Menu"

type Mode = "hangar" | "shop" | "launch"

export interface HangarData {
  message?: string
}

/** A tappable box of the launch screen. */
interface Box {
  bg: GameObjects.Rectangle
  label: GameObjects.Text
}

/** Launch screen rows (keyboard focus): sector boxes, wave boxes, launch button. */
const ROW_SECTOR = 0
const ROW_WAVE = 1
const ROW_LAUNCH = 2
const WAVE_STEP = 38

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
  private sub!: GameObjects.Text
  private panel!: GameObjects.Rectangle
  private table: GameObjects.Text[] = []
  private backBg!: GameObjects.Rectangle
  private backIcon!: GameObjects.Text
  private backFocused = false
  private buying = true
  private selSector: Sector = "bravo"
  private selWave = 0
  private focusRow = ROW_LAUNCH
  private launchObjs: (GameObjects.Rectangle | GameObjects.Text)[] = []
  private sectorBoxes: Box[] = []
  private waveBoxes: Box[] = []
  private launchBox!: Box

  constructor() {
    super("Hangar")
  }

  init(data: HangarData): void {
    this.message = data?.message ?? ""
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
    this.add
      .text(480, 96, pilotTitle(p), { fontFamily: UI.font, fontSize: "22px", color: UI.text })
      .setOrigin(0.5)
    this.sub = this.add
      .text(480, 122, "", { fontFamily: UI.font, fontSize: "18px", color: UI.accent })
      .setOrigin(0.5)
    this.status = this.add
      .text(480, 578, "", { fontFamily: UI.mono, fontSize: "19px", color: UI.text })
      .setOrigin(0.5)
      .setShadow(0, 0, "#000000", 6, true, true)
    this.desc = this.add
      .text(640, 514, "", {
        fontFamily: UI.font,
        fontSize: "15px",
        color: UI.text,
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5)
    this.msg = this.add
      .text(480, 146, this.message, { fontFamily: UI.font, fontSize: "18px", color: UI.gold })
      .setOrigin(0.5)
    this.buildLaunch(p)
    // launch keys before the menu's and the back icon's: a key that switches modes (menu Launch,
    // back icon DOWN) must not also act on the launch screen within the same keypress
    this.bindLaunchKeys()
    this.menu = new TextMenu(this, 470, 164, 340, 36, 9)
    this.menu.onBack = () => this.backAction()
    this.menu.onMove = () => this.describe()
    this.menu.onUpFromStart = () => {
      if (this.mode !== "hangar") this.setBackFocus(true)
    }
    this.buildBackButton()
    getAudio().playSong(this, "hangar")
    this.show("hangar")
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

  /** Exit to hangar (from shop/launch) or to the main menu (from hangar). */
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
    this.menu.enabled = !on && this.mode !== "launch"
    this.setBackVisual(on)
    if (this.mode === "launch") this.refreshLaunch()
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
    const hint = this.menu.tapToSelect && this.sys.game.device.input.touch
    const again = hint ? `\nTap again to ${this.buying ? "buy" : "sell"}` : ""
    this.desc.setText((DESC[t] ?? "") + again)
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
    const keep = this.mode === mode
    this.mode = mode
    const p = currentPilot()
    if (!p) return
    this.items = []
    this.clearTable()
    const launch = mode === "launch"
    // the hangar menu has its own Exit row: the back icon is for the shop and launch screens
    const back = mode !== "hangar"
    if (!back && this.backFocused) this.setBackFocus(false)
    this.backBg.setVisible(back)
    if (this.backBg.input) this.backBg.input.enabled = back
    this.backIcon.setVisible(back)
    for (const o of this.launchObjs) {
      o.setVisible(launch)
      if (o.input) o.input.enabled = launch
    }
    this.menu.enabled = !launch && !this.backFocused
    this.menu.tapToSelect = mode === "shop"
    let items: MenuItem[] = []
    if (mode === "hangar") items = this.hangarItems()
    else if (mode === "shop") items = this.shopItems()
    else this.refreshLaunch()
    this.sub.setText(this.subtitle(p, launch ? this.selSector : (p.sector ?? "bravo")))
    // panel fits the rows (the shop adds a description line, launch its boxes and top-10 table)
    const h = Math.min(items.length, 9) * 36 + (mode === "shop" ? 60 : 16)
    this.panel.setSize(360, launch ? 404 : h)
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
    return `${SECTOR_NAMES[sector]}  ·  ${wave}`
  }

  private hangarItems(): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: `${ICON.play} Launch`,
        action: () => {
          const s = currentPilot()?.sector ?? "bravo"
          this.openLaunch(s, this.defaultWave(s))
        },
      },
      {
        label: `${ICON.buy} Shop`,
        action: () => {
          this.buying = true
          this.show("shop")
        },
      },
      { label: `${ICON.back} Exit to Main Menu`, action: () => this.exit() },
    ]
    this.items = items.map(() => null)
    return items
  }

  private defaultWave(sector: Sector): number {
    const p = currentPilot()
    return p ? defaultWave(p, sector) : 0
  }

  /** Launch screen: 2 sector boxes, the sector's wave boxes, the level's top 10, Launch. */
  private buildLaunch(p: PilotSave): void {
    // the scene instance is reused: drop the objects of the previous visit
    this.launchObjs = []
    this.waveBoxes = []
    this.table = []
    const box = (x: number, y: number, w: number, h: number, size: number, tap: () => void) => {
      const bg = this.add.rectangle(x, y, w, h, 0x39d0ff, 0).setInteractive({ useHandCursor: true })
      const label = this.add
        .text(x, y, "", { fontFamily: UI.font, fontSize: `${size}px`, color: UI.text })
        .setOrigin(0.5)
      bg.on("pointerup", tap)
      this.launchObjs.push(bg, label)
      return { bg, label }
    }
    this.sectorBoxes = SECTORS.map((s, i) =>
      box(551 + i * 178, 184, 174, 40, 17, () => {
        this.focusRow = ROW_SECTOR
        this.selectSector(s)
      }),
    )
    const waves = Math.max(...SECTORS.map((s) => sectorWaves(p, s)))
    for (let w = 0; w < waves; w++)
      this.waveBoxes.push(
        box(0, 232, WAVE_STEP - 4, 36, 18, () => {
          this.focusRow = ROW_WAVE
          this.selWave = w
          this.refreshLaunch()
        }),
      )
    this.launchBox = box(640, 536, 356, 40, 19, () => this.launch())
  }

  private openLaunch(sector: Sector, wave: number): void {
    this.selSector = sector
    this.selWave = wave
    this.focusRow = ROW_LAUNCH
    this.show("launch")
  }

  /** Select a sector (remembered as the pilot's last sector) and its default wave. */
  private selectSector(s: Sector): void {
    const p = currentPilot()
    if (!p) return
    setPilot({ ...withLoadout(p, this.lo), sector: s })
    this.selSector = s
    this.selWave = defaultWave(p, s)
    this.show("launch")
  }

  private bindLaunchKeys(): void {
    const kb = this.input.keyboard
    const on = (keys: string[], fn: () => void) => {
      for (const k of keys)
        kb?.on(`keydown-${k}`, () => {
          if (this.mode === "launch" && !this.backFocused) fn()
        })
    }
    const focus = (row: number) => {
      this.focusRow = row
      this.refreshLaunch()
    }
    on(["UP", "W"], () => {
      if (this.focusRow === ROW_SECTOR) this.setBackFocus(true)
      else focus(this.focusRow - 1)
    })
    on(["DOWN", "S"], () => focus(Math.min(ROW_LAUNCH, this.focusRow + 1)))
    on(["LEFT", "A"], () => this.stepLaunch(-1))
    on(["RIGHT", "D"], () => this.stepLaunch(1))
    on(["ENTER", "SPACE"], () => {
      if (this.focusRow === ROW_LAUNCH) this.launch()
      else focus(ROW_LAUNCH)
    })
  }

  /** LEFT/RIGHT on the launch screen: cycle sectors, or move to the next playable wave. */
  private stepLaunch(d: number): void {
    const p = currentPilot()
    if (!p) return
    if (this.focusRow === ROW_SECTOR) {
      const i = SECTORS.indexOf(this.selSector)
      this.selectSector(SECTORS[(i + d + SECTORS.length) % SECTORS.length] ?? this.selSector)
    } else if (this.focusRow === ROW_WAVE) {
      const n = sectorWaves(p, this.selSector)
      for (let w = this.selWave + d; w >= 0 && w < n; w += d)
        if (playable(p, this.selSector, w)) {
          this.selWave = w
          this.refreshLaunch()
          return
        }
    }
  }

  private paint(b: Box, sel: boolean, focus: boolean, dim = false): void {
    b.bg.setFillStyle(0x39d0ff, sel ? 0.22 : 0.05)
    let alpha = 0.35
    if (focus) alpha = 0.9
    else if (sel) alpha = 0.8
    else if (dim) alpha = 0.12
    b.bg.setStrokeStyle(focus ? 2 : 1, focus ? 0xffffff : 0x39d0ff, alpha)
    let color = UI.text
    if (dim) color = UI.dim
    else if (sel || focus) color = "#ffffff"
    b.label.setColor(color)
  }

  private refreshLaunch(): void {
    const p = currentPilot()
    if (!p) return
    const s = this.selSector
    const row = this.backFocused ? -1 : this.focusRow
    SECTORS.forEach((sec, i) => {
      const b = this.sectorBoxes[i]
      if (!b) return
      b.label.setText(sec === "train" ? "TRAINING" : "BRAVO")
      this.paint(b, sec === s, row === ROW_SECTOR && sec === s)
    })
    const n = sectorWaves(p, s)
    const next = nextWave(p, s)
    this.waveBoxes.forEach((b, w) => {
      const shown = w < n
      const ok = shown && playable(p, s, w)
      const x = 640 + (w - (n - 1) / 2) * WAVE_STEP
      b.bg.setVisible(shown).setX(x)
      b.label
        .setVisible(shown)
        .setX(x)
        .setText(String(w + 1))
      if (b.bg.input) b.bg.input.enabled = ok
      const sel = w === this.selWave
      this.paint(b, sel, row === ROW_WAVE && sel, !ok)
      // the next campaign wave in gold
      if (ok && !sel && w === next) b.label.setColor(UI.gold)
    })
    const replay = this.selWave !== next
    this.launchBox.label.setText(
      `${replay ? ICON.replay : ICON.play} ${replay ? "REPLAY" : "LAUNCH"}  ·  WAVE ${this.selWave + 1}`,
    )
    this.paint(this.launchBox, row === ROW_LAUNCH, row === ROW_LAUNCH)
    this.showTop(p)
  }

  private shopItems(): MenuItem[] {
    const buy = this.buying
    const inv = this.lo.inv
    const flip = () => {
      this.buying = !this.buying
      this.show("shop")
    }
    const items: MenuItem[] = [
      {
        label: `${buy ? ICON.buy : ICON.sell} ${buy ? "Buy" : "Sell"}`,
        detail: buy ? "[BUY]  sell" : "buy  [SELL]",
        action: flip,
        adjust: flip,
      },
    ]
    this.items.push(null)
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

  private clearTable(): void {
    for (const t of this.table) t.destroy()
    this.table = []
  }

  /** Top-10 runs of the selected level. */
  private showTop(p: PilotSave): void {
    this.clearTable()
    const key = levelKey(this.selSector, this.selWave)
    const st = p.stats?.[key]
    const top = st?.top ?? []
    const line = (y: number, text: string, color: string, size = 18) =>
      this.table.push(
        this.add
          .text(640, y, text, { fontFamily: UI.mono, fontSize: `${size}px`, color })
          .setOrigin(0.5),
      )
    line(
      272,
      `WAVE ${this.selWave + 1}  ·  TOP 10  ·  ${st?.s ?? st?.n ?? 0}x started  ·  ${st?.n ?? 0}x won`,
      UI.accent,
      19,
    )
    if (!top.length) line(300, "No runs yet", UI.dim)
    top.forEach((v, i) => {
      line(296 + i * 21, topRunLine(i, v), UI.text)
    })
  }

  private launch(): void {
    this.save()
    reportMissionStart()
    this.scene.start("Game", { wave: this.selWave, sector: this.selSector })
  }
}
