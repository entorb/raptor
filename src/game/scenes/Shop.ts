// Supply shop (STORE.C STORE_Enter): BUY/SELL tabs, item list with icons, detail card with the
// buy/sell button. Rules live in sim/objects.ts (Inventory).
import { type GameObjects, Scene } from "phaser"
import { ICON_COLOR } from "../art/icons"
import { getAudio } from "../audio/audio"
import { type Loadout, statusLine } from "../campaign"
import { t } from "../i18n/i18n"
import type { StringKey } from "../i18n/strings"
import { currentPilot, pilotLoadout, saveLoadout } from "../session"
import { Obj, type ObjType } from "../sim/consts"
import { Buy, MAX_OBJS, MAX_PHASE, OBJ_LIB } from "../sim/objects"
import {
  backButton,
  bindKeys,
  header,
  type MenuItem,
  rollCredits,
  statusText,
  TextMenu,
  TOUCH,
  UI,
} from "../ui/textMenu"

/** One-line shop descriptions (space re-theme of the ITEMxx_TXT help). */
const DESC: Partial<Record<ObjType, StringKey>> = {
  [Obj.FORWARD_GUNS]: "desc.forwardGuns",
  [Obj.PLASMA_GUNS]: "desc.plasmaGuns",
  [Obj.MICRO_MISSLE]: "desc.microMissle",
  [Obj.DUMB_MISSLE]: "desc.dumbMissle",
  [Obj.MINI_GUN]: "desc.miniGun",
  [Obj.TURRET]: "desc.turret",
  [Obj.MISSLE_PODS]: "desc.misslePods",
  [Obj.AIR_MISSLE]: "desc.airMissle",
  [Obj.GRD_MISSLE]: "desc.grdMissle",
  [Obj.BOMB]: "desc.bomb",
  [Obj.ENERGY_GRAB]: "desc.energyGrab",
  [Obj.MEGA_BOMB]: "desc.megaBomb",
  [Obj.PULSE_CANNON]: "desc.pulseCannon",
  [Obj.FORWARD_LASER]: "desc.forwardLaser",
  [Obj.DEATH_RAY]: "desc.deathRay",
  [Obj.SUPER_SHIELD]: "desc.superShield",
  [Obj.ENERGY]: "desc.energy",
  [Obj.DETECT]: "desc.detect",
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
  private credits: (cr: number) => void = () => {}
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
    header(this, "SUPPLY SHOP", undefined, 44, 40)
    this.back = backButton(this, "HANGAR", () => this.leave())
    this.tabs = [t("shop.buy"), t("shop.sell")].map((name, i) => {
      const x = 480 + (i - 0.5) * 170
      const bg = this.add
        .rectangle(x, 106, 164, TOUCH ? 64 : 42, 0x10182a, 0.9)
        .setInteractive({ useHandCursor: true })
      bg.on("pointerup", () => this.setTab(i === 0))
      const label = this.add
        .text(x, 106, name, { fontFamily: UI.font, fontSize: "22px", fontStyle: "bold" })
        .setOrigin(0.5)
      return { bg, label }
    })
    this.add
      .rectangle(LIST.x - 10, LIST.y - 12, LIST.w + 20, CARD.h + 8, 0x05060d, 0.78)
      .setOrigin(0)
      .setStrokeStyle(1, 0x39d0ff, 0.35)
    this.buildCard()
    this.status = statusText(this, TOUCH ? 22 : 19)
    this.credits = rollCredits(this, this.lo.plr.score, (cr) => this.renderStatus(cr))
    const rowH = TOUCH ? 58 : 40
    this.menu = new TextMenu(this, LIST.x, LIST.y, LIST.w, rowH, Math.floor(376 / rowH))
    this.menu.tapToSelect = true
    this.menu.onBack = () => this.leave()
    // no wrap from the last item back to the first
    this.menu.onDownFromEnd = () => {}
    this.menu.onMove = () => {
      this.msg.setText("")
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
    const guard = () => {
      if (!this.skipKey) return this.focus !== "list"
      this.skipKey = false
      return false
    }
    const tab = () => {
      if (this.focus === "tabs") this.setTab(!this.buying)
    }
    bindKeys(this, guard, {
      up: () => this.setFocus("back"),
      down: () => this.setFocus(this.focus === "back" ? "tabs" : "list"),
      left: tab,
      right: tab,
      confirm: () => {
        if (this.focus === "back") this.leave()
        else this.setFocus("list")
      },
    })
  }

  private setFocus(f: "list" | "tabs" | "back"): void {
    if (f === "list" && !this.items.length) return
    this.focus = f
    this.menu.enabled = f === "list"
    this.back.focus(f === "back")
    this.refresh(true)
  }

  private leave(): void {
    this.save()
    this.scene.start("Hangar")
  }

  private save(): void {
    saveLoadout(this.lo)
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
    return this.items.map((it) => {
      const cost = inv.getCost(it)
      const count = this.owned(it)
      const countStr = count ? ` (${count})` : ""
      const full = this.buying && inv.full(it)
      let detail = `+${inv.getResale(it)} CR`
      if (this.buying) detail = full ? "MAX" : `${cost} CR`
      return {
        icon: `icon-${it}`,
        label: `${OBJ_LIB[it]?.name ?? ""}${countStr}`,
        detail,
        dim: this.buying && (full || cost > this.lo.plr.score),
        action: () => this.trade(it),
        adjust: flip,
      }
    })
  }

  /** STORE.C "you have": amount for stackables (onlyflag), else number of copies (spares). */
  private owned(it: ObjType): string {
    const inv = this.lo.inv
    const n = OBJ_LIB[it]?.onlyflag ? inv.getAmt(it) : inv.getTotal(it)
    if (!n) return ""
    return it === Obj.ENERGY ? `${n}%` : String(n)
  }

  /** Most of an item the ship can hold (stack limit or phase shield count), null = cargo only. */
  private maxOf(it: ObjType): string | null {
    const lib = OBJ_LIB[it]
    if (it === Obj.SUPER_SHIELD) return String(MAX_PHASE)
    if (!lib?.onlyflag) return null
    return it === Obj.ENERGY ? `${lib.max_cnt}%` : String(lib.max_cnt)
  }

  private describe(): void {
    const c = this.card
    const it = this.items[this.menu.index]
    const has = it !== undefined
    for (const o of [c.icon, c.name, c.owned, c.btn, c.btnLabel]) o.setVisible(has)
    if (c.btn.input) c.btn.input.enabled = has
    if (!has) {
      c.desc.setText(t(this.buying ? "shop.nothingBuy" : "shop.nothingSell"))
      return
    }
    const inv = this.lo.inv
    const own = this.owned(it)
    c.icon.setTexture(`icon-${it}`)
    c.name.setText(OBJ_LIB[it]?.name ?? "").setColor(ICON_COLOR[it] ?? "#ffffff")
    const max = this.maxOf(it)
    const ownStr = own ? t("shop.onBoard", { n: own }) : t("shop.notOnBoard")
    const maxStr = max ? `  ·  ${t("shop.max", { n: max })}` : ""
    c.owned.setText(`${ownStr}${maxStr}`)
    const dk = DESC[it]
    c.desc.setText(dk ? t(dk) : "")
    const cost = inv.getCost(it)
    const poor = this.buying && (inv.full(it) || cost > this.lo.plr.score)
    c.btn.setFillStyle(this.buying ? 0x1d5c3a : 0x5c1d2a, poor ? 0.4 : 1)
    c.btn.setStrokeStyle(2, this.buying ? 0x2effb4 : 0xff5a6a, poor ? 0.3 : 0.9)
    c.btnLabel.setText(this.tradeLabel(it)).setAlpha(poor ? 0.5 : 1)
  }

  private tradeLabel(it: ObjType): string {
    const inv = this.lo.inv
    if (this.buying) return `${t("shop.buy")} · ${inv.getCost(it)} CR`
    return `${t("shop.sell")} · +${inv.getResale(it)} CR`
  }

  private tradeSelected(): void {
    const it = this.items[this.menu.index]
    if (it !== undefined) this.trade(it)
  }

  private trade(it: ObjType): void {
    const inv = this.lo.inv
    const name = OBJ_LIB[it]?.name ?? ""
    if (this.buying) {
      const r = inv.buy(it)
      let text = t("shop.noRoom")
      if (r === Buy.GOTIT) text = t("shop.purchased", { name })
      else if (r === Buy.NOMONEY) text = t("shop.noMoney")
      this.msg.setText(text).setColor(r === Buy.GOTIT ? UI.gold : UI.warn)
    } else {
      inv.sell(it)
      this.msg.setText(t("shop.sold", { name })).setColor(UI.gold)
    }
    this.save()
    this.refresh(true)
  }

  private updateStatus(): void {
    this.credits(this.lo.plr.score)
  }

  private renderStatus(cr: number): void {
    const inv = this.lo.inv
    this.status.setText(
      `${statusLine(inv, cr)}   ${t("shop.cargo")} ${inv.objs.length}/${MAX_OBJS}`,
    )
  }
}
