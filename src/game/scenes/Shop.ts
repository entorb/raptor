// Supply shop (STORE.C STORE_Enter): BUY/SELL tabs, item list with icons, detail card with the
// buy/sell button. Rules live in sim/objects.ts (Inventory).
import { type GameObjects, Scene } from "phaser"
import { ICON_COLOR } from "../art/icons"
import { getAudio } from "../audio/audio"
import { type Loadout, withLoadout } from "../campaign"
import { currentPilot, pilotLoadout, setPilot } from "../session"
import { MAX_SHIELD, Obj, type ObjType } from "../sim/consts"
import { Buy, OBJ_LIB } from "../sim/objects"
import { backButton, type MenuItem, TextMenu, TOUCH, UI } from "../ui/textMenu"

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

const LIST = { x: 30, y: 150, w: 480 }
const CARD = { x: 735, y: 146, w: 400, h: 400 }

interface Tab {
  bg: GameObjects.Rectangle
  label: GameObjects.Text
}

export class Shop extends Scene {
  private menu!: TextMenu
  private lo!: Loadout
  private buying = true
  /** Keyboard focus: UP off the first row goes to the tabs, UP again to the back button. */
  private focus: "list" | "tabs" | "back" = "list"
  /** The menu's own UP just moved the focus to the tabs: the scene handler skips that keypress. */
  private skipKey = false
  private back!: ReturnType<typeof backButton>
  private items: ObjType[] = []
  private tabs: Tab[] = []
  private status!: GameObjects.Text
  private msg!: GameObjects.Text
  private card!: {
    icon: GameObjects.Image
    name: GameObjects.Text
    owned: GameObjects.Text
    desc: GameObjects.Text
    btn: GameObjects.Rectangle
    btnLabel: GameObjects.Text
  }

  constructor() {
    super("Shop")
  }

  create(): void {
    if (!currentPilot()) {
      this.scene.start("Menu")
      return
    }
    this.lo = pilotLoadout()
    this.buying = true
    this.add.image(480, 300, "shop-bg")
    this.add
      .text(480, 44, "SUPPLY SHOP", {
        fontFamily: UI.font,
        fontSize: "40px",
        color: UI.text,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 0, UI.accent, 16, true, true)
      .setPadding(24)
    this.back = backButton(this, "HANGAR", () => this.leave())
    this.tabs = ["BUY", "SELL"].map((t, i) => {
      const x = 480 + (i - 0.5) * 170
      const bg = this.add
        .rectangle(x, 106, 164, TOUCH ? 64 : 42, 0x10182a, 0.9)
        .setInteractive({ useHandCursor: true })
      bg.on("pointerup", () => this.setTab(i === 0))
      const label = this.add
        .text(x, 106, t, { fontFamily: UI.font, fontSize: "22px", fontStyle: "bold" })
        .setOrigin(0.5)
      return { bg, label }
    })
    this.add
      .rectangle(LIST.x - 10, LIST.y - 12, LIST.w + 20, CARD.h + 8, 0x05060d, 0.78)
      .setOrigin(0)
      .setStrokeStyle(1, 0x39d0ff, 0.35)
    this.buildCard()
    this.status = this.add
      .text(480, 578, "", {
        fontFamily: UI.mono,
        fontSize: TOUCH ? "22px" : "19px",
        color: UI.text,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#000000", 6, true, true)
      .setPadding(9)
    if (!TOUCH)
      this.add
        .text(480, 146 + CARD.h + 14, "↑↓ select   ←→ buy/sell   Enter confirm   Esc hangar", {
          fontFamily: UI.font,
          fontSize: "15px",
          color: UI.dim,
        })
        .setOrigin(0.5)
    const rowH = TOUCH ? 58 : 40
    this.menu = new TextMenu(this, LIST.x, LIST.y, LIST.w, rowH, Math.floor(376 / rowH))
    this.menu.tapToSelect = true
    this.menu.onBack = () => this.leave()
    this.menu.onMove = () => {
      if (this.focus !== "list") this.setFocus("list")
      this.describe()
    }
    this.menu.onUpFromStart = () => {
      this.skipKey = true
      this.setFocus("tabs")
    }
    this.focus = "list"
    this.bindFocusKeys()
    getAudio().playSong(this, "hangar")
    this.refresh(false)
  }

  private buildCard(): void {
    const { x, y, w, h } = CARD
    this.add.rectangle(x, y + h / 2 - 8, w, h + 8, 0x05060d, 0.78).setStrokeStyle(1, 0x39d0ff, 0.35)
    const icon = this.add.image(x, y + 64, "icon-0").setScale(1.15)
    const name = this.add
      .text(x, y + 142, "", { fontFamily: UI.font, fontSize: "26px", fontStyle: "bold" })
      .setOrigin(0.5)
    const owned = this.add
      .text(x, y + 174, "", {
        fontFamily: UI.font,
        fontSize: TOUCH ? "22px" : "18px",
        color: UI.accent,
      })
      .setOrigin(0.5)
    const desc = this.add
      .text(x, y + 200, "", {
        fontFamily: UI.font,
        fontSize: TOUCH ? "20px" : "18px",
        color: UI.text,
        align: "center",
        wordWrap: { width: w - 40 },
      })
      .setOrigin(0.5, 0)
    this.msg = this.add
      .text(x, y + 290, "", { fontFamily: UI.font, fontSize: "18px", color: UI.gold })
      .setOrigin(0.5)
    const btn = this.add
      .rectangle(x, y + 340, w - 60, TOUCH ? 76 : 52, 0x1d5c3a)
      .setInteractive({ useHandCursor: true })
    btn.on("pointerup", () => this.tradeSelected())
    const btnLabel = this.add
      .text(x, y + 340, "", {
        fontFamily: UI.font,
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
    this.card = { icon, name, owned, desc, btn, btnLabel }
  }

  /** Tabs and back button keys (bound after the menu: its handlers run first). */
  private bindFocusKeys(): void {
    const kb = this.input.keyboard
    const on = (keys: string[], fn: () => void) => {
      for (const k of keys)
        kb?.on(`keydown-${k}`, () => {
          if (this.skipKey) this.skipKey = false
          else if (this.focus !== "list") fn()
        })
    }
    on(["UP", "W"], () => this.setFocus("back"))
    on(["DOWN", "S"], () => this.setFocus(this.focus === "back" ? "tabs" : "list"))
    on(["LEFT", "A", "RIGHT", "D"], () => {
      if (this.focus === "tabs") this.setTab(!this.buying)
    })
    on(["ENTER", "SPACE"], () => {
      if (this.focus === "back") this.leave()
      else this.setFocus("list")
    })
  }

  private setFocus(f: "list" | "tabs" | "back"): void {
    if (f === "list" && !this.items.length) return
    this.focus = f
    this.menu.enabled = f === "list"
    this.back.focused = f === "back"
    this.back.look(f === "back")
    this.refresh(true)
  }

  private leave(): void {
    this.save()
    this.scene.start("Hangar")
  }

  private save(): void {
    const p = currentPilot()
    if (p) setPilot(withLoadout(p, this.lo))
  }

  private setTab(buy: boolean): void {
    if (buy === this.buying) return
    this.buying = buy
    this.msg.setText("")
    this.refresh(false)
    // an empty list can't be left with the arrows: park the focus on the tabs
    if (this.focus === "list" && !this.items.length) this.setFocus("tabs")
  }

  private refresh(keep: boolean): void {
    const tabFocus = this.focus === "tabs"
    this.tabs.forEach(({ bg, label }, i) => {
      const on = (i === 0) === this.buying
      bg.setFillStyle(on ? 0x1d3a5c : 0x10182a, 0.9)
      if (on && tabFocus) bg.setStrokeStyle(3, 0xffffff, 1)
      else bg.setStrokeStyle(2, on ? 0x39d0ff : 0x39465e, on ? 1 : 0.8)
      label.setColor(on ? "#ffffff" : UI.dim)
    })
    this.menu.setItems(this.listItems(), keep)
    this.updateStatus()
    this.describe()
  }

  private listItems(): MenuItem[] {
    const inv = this.lo.inv
    const flip = () => this.setTab(!this.buying)
    this.items = this.buying ? inv.buyList() : inv.sellList()
    return this.items.map((t) => {
      const cost = inv.getCost(t)
      return {
        icon: `icon-${t}`,
        label: `${OBJ_LIB[t]?.name ?? ""}${this.owned(t) ? ` (${this.owned(t)})` : ""}`,
        detail: this.buying ? `${cost} CR` : `+${inv.getResale(t)} CR`,
        dim: this.buying && cost > this.lo.plr.score,
        action: () => this.trade(t),
        adjust: flip,
      }
    })
  }

  /** STORE.C "you have": amount for stackables (onlyflag), else number of copies (spares). */
  private owned(t: ObjType): string {
    const inv = this.lo.inv
    const n = OBJ_LIB[t]?.onlyflag ? inv.getAmt(t) : inv.getTotal(t)
    if (!n) return ""
    return t === Obj.ENERGY ? `${n}%` : String(n)
  }

  private describe(): void {
    const c = this.card
    const t = this.items[this.menu.index]
    const has = t !== undefined
    for (const o of [c.icon, c.name, c.owned, c.btn, c.btnLabel]) o.setVisible(has)
    if (c.btn.input) c.btn.input.enabled = has
    if (!has) {
      c.desc.setText(this.buying ? "Nothing for sale." : "Nothing to sell.")
      return
    }
    const inv = this.lo.inv
    const own = this.owned(t)
    c.icon.setTexture(`icon-${t}`)
    c.name.setText(OBJ_LIB[t]?.name ?? "").setColor(ICON_COLOR[t] ?? "#ffffff")
    c.owned.setText(own ? `On board: ${own}` : "Not on board")
    c.desc.setText(DESC[t] ?? "")
    const cost = inv.getCost(t)
    const poor = this.buying && cost > this.lo.plr.score
    c.btn.setFillStyle(this.buying ? 0x1d5c3a : 0x5c1d2a, poor ? 0.4 : 1)
    c.btn.setStrokeStyle(2, this.buying ? 0x2effb4 : 0xff5a6a, poor ? 0.3 : 0.9)
    c.btnLabel
      .setText(this.buying ? `BUY · ${cost} CR` : `SELL · +${inv.getResale(t)} CR`)
      .setAlpha(poor ? 0.5 : 1)
  }

  private tradeSelected(): void {
    const t = this.items[this.menu.index]
    if (t !== undefined) this.trade(t)
  }

  private trade(t: ObjType): void {
    const inv = this.lo.inv
    const name = OBJ_LIB[t]?.name ?? ""
    if (this.buying) {
      const r = inv.buy(t)
      let text = "No room on the ship"
      if (r === Buy.GOTIT) text = `Purchased ${name}`
      else if (r === Buy.NOMONEY) text = "Not enough credits"
      this.msg.setText(text).setColor(r === Buy.GOTIT ? UI.gold : UI.warn)
    } else {
      inv.sell(t)
      this.msg.setText(`Sold ${name}`).setColor(UI.gold)
    }
    this.save()
    this.refresh(true)
  }

  private updateStatus(): void {
    const inv = this.lo.inv
    const shield = inv.getAmt(Obj.ENERGY)
    const phase = inv.getAmt(Obj.SUPER_SHIELD)
    this.status.setText(
      `CREDITS ${this.lo.plr.score}   SHIELD ${Math.round((shield / MAX_SHIELD) * 100)}%` +
        (phase ? `   PHASE ${phase}% x${inv.getTotal(Obj.SUPER_SHIELD)}` : "") +
        `   NOVA ${inv.getAmt(Obj.MEGA_BOMB)}`,
    )
  }
}
