import { type GameObjects, Scene } from "phaser"
import { getAudio } from "../audio/audio"
import { doneWaves, loadout, sectorWaves, withLoadout } from "../campaign"
import {
  deletePilot,
  loadPilots,
  loadSettings,
  MAX_NAME,
  newPilotSave,
  type PilotSave,
  pilotNameTaken,
} from "../data/save"
import { readGlobalMissions } from "../data/stats"
import { getLang, setLang, t } from "../i18n/i18n"
import type { StringKey } from "../i18n/strings"
import { toggleFullscreen } from "../input/fullscreen"
import { applyUpdate, checkForUpdate, hasInstallPrompt, promptInstall } from "../pwa"
import { setPilot } from "../session"
import { DIFF_EASY, DIFF_HARD, DIFF_NORMAL } from "../sim/consts"
import {
  backdrop,
  bindKeys,
  changeVolume,
  glowText,
  ICON,
  type MenuItem,
  pctLabel,
  TextMenu,
  TOUCH,
  UI,
} from "../ui/textMenu"

/** Pilot titles by difficulty, from DIFF_EASY (training is a sector, not a difficulty). */
const DIFF_NAMES: StringKey[] = ["diff.rookie", "diff.veteran", "diff.elite"]

const diffName = (diff: number) => {
  const key = DIFF_NAMES[diff - DIFF_EASY]
  return key ? t(key) : ""
}

/** "Veteran Name": the pilot's title (difficulty) and name. */
export const pilotTitle = (p: PilotSave) => `${diffName(p.diff)} ${p.name}`

type Mode =
  | "main"
  | "pilots"
  | "pilot"
  | "delete"
  | "players"
  | "new"
  | "name"
  | "options"
  | "install"
  | "update"

const CONTACT_URL = "https://entorb.net/contact.php?origin=raptor"
const SOURCE_URL = "https://github.com/entorb/raptor"
const HOME_URL = "https://entorb.net/games/"
/** UI.gold as a number, for the Rectangle pill behind the focused link. */
const GOLD = 0xffd23d

function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia("(display-mode: standalone)").matches || standalone
}

export class Menu extends Scene {
  private menu!: TextMenu
  private mode: Mode = "main"
  private tick: () => void = () => {}
  private info!: GameObjects.Text
  private body!: GameObjects.Text
  private stats!: GameObjects.Text
  private globalGames: number | null = null
  private actions!: GameObjects.Container
  private actionTexts: GameObjects.Text[] = []
  private actionPills: GameObjects.Rectangle[] = []
  private actionActs: ((t: GameObjects.Text) => void)[] = []
  private actionIndex = 0
  private actionFocused = false
  private actionHover: number | null = null
  /** The menu's own DOWN just entered the link row: the scene handler skips that keypress. */
  private skipKey = false
  private nameInput: GameObjects.DOMElement | null = null
  /** pilot picked in the "pilots" list, name typed in "name" mode */
  private picked: PilotSave | null = null
  private newName = ""
  /** new pilot: picked in "players" (2P co-op team) and "new" (difficulty), before the name */
  private newCoop = false
  private newDiff = DIFF_NORMAL
  /** newer service worker waiting for the player's OK (asked on every visit to the start screen) */
  private waitingSw: ServiceWorker | null = null

  constructor() {
    super("Menu")
  }

  create(): void {
    this.mode = "main"
    this.tick = backdrop(this)
    const title = glowText(this, 480, 78, "RAPTOR", 96, 28).setFontStyle("900")
    this.tweens.add({ targets: title, alpha: 0.85, yoyo: true, repeat: -1, duration: 1800 })
    this.add
      .text(480, 140, "CALL OF THE VOID", {
        fontFamily: UI.font,
        fontSize: "24px",
        color: UI.accent,
        letterSpacing: 10,
      })
      .setOrigin(0.5)
    this.add
      .text(480, TOUCH ? 170 : 168, "by Torben", {
        fontFamily: UI.font,
        fontSize: TOUCH ? "20px" : "16px",
        color: TOUCH ? "#9aa8c0" : UI.dim,
      })
      .setOrigin(0.5)
    this.stats = this.add
      .text(480, TOUCH ? 556 : 542, "", {
        fontFamily: UI.font,
        fontSize: TOUCH ? "22px" : "16px",
        color: TOUCH ? UI.text : UI.dim,
      })
      .setOrigin(0.5)
    void readGlobalMissions().then((n) => {
      this.globalGames = n
      if (this.stats.active && this.mode === "main") this.stats.setText(this.statsLabel())
    })
    this.info = this.add
      .text(480, 576, "", { fontFamily: UI.font, fontSize: "15px", color: UI.dim, align: "center" })
      .setOrigin(0.5, 1)
    // body text for content that belongs above the menu items, not the footer (e.g. install help)
    this.body = this.add
      .text(480, 352, "", {
        fontFamily: UI.font,
        fontSize: "18px",
        color: UI.text,
        align: "center",
        wordWrap: { width: 480 },
        lineSpacing: 10,
      })
      .setOrigin(0.5)
    this.add
      .text(480, TOUCH ? 586 : 588, t("menu.credit"), {
        fontFamily: UI.font,
        fontSize: TOUCH ? "19px" : "13px",
        color: TOUCH ? "#9aa8c0" : UI.dim,
      })
      .setOrigin(0.5)
    this.actions = this.actionRow(480, TOUCH ? 522 : 506)
    this.menu = new TextMenu(this, 280, 194, 400, TOUCH ? 60 : 52, TOUCH ? 5 : 6)
    this.menu.onBack = () => {
      if (this.mode === "name") this.show("new")
      else if (this.mode === "new") this.newPilotStart()
      else if (["pilot", "delete", "players"].includes(this.mode)) this.show("pilots")
      else if (this.mode !== "main") this.show("main")
    }
    // The link row: DOWN off the last menu item enters it, UP/DOWN and LEFT/RIGHT step through
    // the links (DOWN past the last wraps to the first menu item, UP off the first returns to
    // the menu), ENTER/SPACE opens one. Bound after the menu: its handlers run first.
    bindKeys(this, () => true, {
      up: () => this.stepAction(-1),
      down: () => this.stepAction(1),
      left: () => this.moveAction(-1),
      right: () => this.moveAction(1),
      confirm: () => this.activateAction(),
    })
    getAudio().playSong(this, "mainmenu")
    this.show("main")
    void checkForUpdate().then((sw) => {
      this.waitingSw = sw
      if (sw && this.scene.isActive() && this.mode === "main") this.show("update")
    })
  }

  update(): void {
    this.tick()
  }

  private statsLabel(): string {
    return t("menu.globalMissions", { n: this.globalGames ?? "—" })
  }

  private show(mode: Mode): void {
    this.mode = mode
    this.stats.setText(mode === "main" ? this.statsLabel() : "")
    this.actions.setVisible(mode === "main")
    this.setActionFocus(false)
    this.closeNameInput()
    this.info.setText("")
    this.body.setText("")
    let items: MenuItem[]
    switch (mode) {
      case "main":
        items = this.mainItems()
        break
      case "pilots":
        items = this.pilotsItems()
        break
      case "pilot":
      case "delete":
        if (!this.picked) {
          this.show("pilots")
          return
        }
        items = this.pilotItems(this.picked, mode)
        break
      case "players":
        items = this.playersItems()
        break
      case "new":
        items = this.newItems()
        break
      case "name":
        items = this.nameItems()
        break
      case "install":
        items = this.installItems()
        break
      case "update":
        items = this.updateItems()
        break
      default:
        items = this.optionsItems()
    }
    this.menu.onDownFromEnd = mode === "main" ? () => this.enterActions() : null
    this.menu.onMove = mode === "new" ? (i) => this.diffInfo(i) : null
    this.menu.setItems(items, mode === "options")
    if (mode === "new") this.diffInfo(0)
  }

  private mainItems(): MenuItem[] {
    const items: MenuItem[] = [
      { label: `${ICON.play} ${t("menu.play")}`, action: () => this.show("pilots") },
    ]
    if (this.scale.fullscreen.available)
      items.push({
        label: `${ICON.fullscreen} ${t(this.scale.isFullscreen ? "menu.exitFullscreen" : "menu.fullscreen")}`,
        action: () => {
          toggleFullscreen(this)
          this.time.delayedCall(300, () => this.show("main"))
        },
      })
    items.push(
      { label: `${ICON.language} ${t("lang.current")}`, action: () => this.toggleLang() },
      { label: `${ICON.options} ${t("menu.options")}`, action: () => this.show("options") },
      { label: `${ICON.exit} ${t("menu.exit")}`, action: () => this.exit() },
    )
    return items
  }

  // window.close() is ignored for pages not opened by script (PWA, fullscreen): leave to home
  private exit(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen()
    window.close()
    window.setTimeout(() => window.location.assign(HOME_URL), 100)
  }

  private pilotsItems(): MenuItem[] {
    // most recently played first (savePilot keeps the list in that order)
    const items: MenuItem[] = loadPilots().map((p) => ({
      label: pilotTitle(p),
      ...(p.coop ? { detail: "2P", dim: TOUCH } : {}),
      action: () => {
        this.picked = p
        this.show("pilot")
      },
    }))
    items.push(
      { label: `${ICON.add} ${t("menu.newPilot")}`, action: () => this.newPilotStart(true) },
      { label: `${ICON.back} ${t("back")}`, action: () => this.show("main") },
    )
    return items
  }

  private pilotItems(p: PilotSave, mode: "pilot" | "delete"): MenuItem[] {
    const items: MenuItem[] = []
    if (mode === "pilot") {
      // 2P co-op teams fly on one keyboard: not on touch devices
      const blocked = p.coop === true && TOUCH
      this.info.setText(blocked ? t("menu.needsKeyboard") : `${pilotTitle(p)}: ${p.score} CR`)
      items.push(
        {
          label: `${ICON.play} ${t("menu.fly")}`,
          disabled: blocked,
          action: () => {
            setPilot(p, false)
            this.scene.start("Hangar")
          },
        },
        { label: `${ICON.delete} ${t("menu.deletePilot")}`, action: () => this.show("delete") },
      )
    } else {
      const stats = t("menu.pilotStats", {
        cr: p.score,
        done: doneWaves(p, "bravo"),
        total: sectorWaves(p, "bravo"),
        train: doneWaves(p, "train"),
        trainTotal: sectorWaves(p, "train"),
      })
      this.info.setText(`${t("menu.deleteConfirm", { name: p.name })}\n${stats}`)
      items.push({
        label: `${ICON.delete} ${t("menu.yesDelete")}`,
        action: () => {
          deletePilot(p.name)
          this.show("pilots")
        },
      })
    }
    items.push({ label: `${ICON.back} ${t("back")}`, action: () => this.show("pilots") })
    return items
  }

  private nameItems(): MenuItem[] {
    const input = this.openNameInput()
    // row 0 lies under the <input>: activating it (keyboard) focuses the field
    return [
      { label: "", action: () => input.focus() },
      { label: `${ICON.confirm} ${t("ok")}`, action: () => this.submitName() },
      { label: `${ICON.back} ${t("back")}`, action: () => this.show("new") },
    ]
  }

  /**
   * New pilot, step 1: one or two players (desktop only; touch starts at the difficulty).
   * `fresh` clears the name typed by an earlier attempt.
   */
  private newPilotStart(fresh = false): void {
    if (fresh) this.newName = ""
    if (TOUCH) {
      this.newCoop = false
      this.show("new")
    } else this.show("players")
  }

  private playersItems(): MenuItem[] {
    this.info.setText(t("menu.playersInfo"))
    const pick = (coop: boolean) => () => {
      this.newCoop = coop
      this.show("new")
    }
    return [
      { label: t("menu.onePlayer"), action: pick(false) },
      { label: t("menu.twoPlayers"), action: pick(true) },
      { label: `${ICON.back} ${t("back")}`, action: () => this.show("pilots") },
    ]
  }

  /** New pilot footer: what the difficulty under the cursor means. */
  private diffInfo(index: number): void {
    const key = (["diff.rookieInfo", "diff.veteranInfo", "diff.eliteInfo"] as const)[index]
    this.info.setText(key ? t(key) : "")
  }

  /** New pilot, step 2: difficulty, then the name. */
  private newItems(): MenuItem[] {
    const pick = (d: number) => () => {
      this.newDiff = d
      this.show("name")
    }
    return [
      { label: t("diff.rookie"), detail: t("diff.easy"), action: pick(DIFF_EASY) },
      { label: t("diff.veteran"), detail: t("diff.normal"), action: pick(DIFF_NORMAL) },
      { label: t("diff.elite"), detail: t("diff.hard"), action: pick(DIFF_HARD) },
      { label: `${ICON.back} ${t("back")}`, action: () => this.newPilotStart() },
    ]
  }

  private installItems(): MenuItem[] {
    this.body.setText(t("menu.installHelp"))
    return [{ label: `${ICON.back} ${t("back")}`, action: () => this.show("main") }]
  }

  private updateItems(): MenuItem[] {
    this.body.setText(t("menu.updateAvailable"))
    const sw = this.waitingSw
    return [
      {
        label: `${ICON.install} ${t("menu.update")}`,
        action: () => {
          this.body.setText(t("menu.updating"))
          if (sw) applyUpdate(sw)
        },
      },
      { label: `${ICON.back} ${t("menu.skip")}`, action: () => this.show("main") },
    ]
  }

  private optionsItems(): MenuItem[] {
    this.info.setText(t("menu.shieldInfo"))
    const s = loadSettings()
    const set = (kind: "music" | "sfx", d: number) => {
      changeVolume(kind, d)
      this.show("options")
    }
    return [
      {
        label: t("menu.music"),
        detail: pctLabel(s.music),
        action: () => set("music", 0),
        adjust: (d) => set("music", d),
      },
      {
        label: t("menu.sfx"),
        detail: pctLabel(s.sfx),
        action: () => set("sfx", 0),
        adjust: (d) => set("sfx", d),
      },
      { label: `${ICON.back} ${t("back")}`, action: () => this.show("main") },
    ]
  }

  /** Phaser DOM <input> (opens the on-screen keyboard); the menu keys are off while typing. */
  private openNameInput(): HTMLInputElement {
    const el = document.createElement("input")
    el.type = "text"
    el.maxLength = MAX_NAME
    el.placeholder = t(this.newCoop ? "menu.teamName" : "menu.pilotName")
    el.value = this.newName
    el.autocomplete = "off"
    el.style.cssText =
      "width:380px;font:24px system-ui,sans-serif;padding:8px 14px;color:#e6f2ff;" +
      "background:#0b1426;border:1px solid #39d0ff;border-radius:6px;outline:none;text-align:center"
    el.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Enter") this.submitName()
      else if (e.key === "Escape") this.show("new")
    })
    el.addEventListener("focus", () => this.setMenuKeys(false))
    el.addEventListener("blur", () => this.setMenuKeys(true))
    this.nameInput = this.add.dom(480, TOUCH ? 224 : 220, el)
    this.time.delayedCall(0, () => el.focus())
    return el
  }

  private closeNameInput(): void {
    if (!this.nameInput) return
    this.newName = (this.nameInput.node as HTMLInputElement).value
    this.nameInput.destroy()
    this.nameInput = null
    this.setMenuKeys(true)
  }

  private setMenuKeys(on: boolean): void {
    if (this.input.keyboard) this.input.keyboard.enabled = on
  }

  private submitName(): void {
    const name = ((this.nameInput?.node as HTMLInputElement | undefined)?.value ?? "").trim()
    let err = ""
    if (!name) err = t("menu.enterName")
    else if (pilotNameTaken(name)) err = t("menu.nameTaken")
    if (err) {
      this.info.setText(err)
      return
    }
    this.closeNameInput()
    this.newName = name
    // New pilot, step 3: the name (2P: the team name) creates the pilot
    const p = newPilotSave(name, this.newDiff, this.newCoop)
    setPilot(withLoadout(p, loadout(p)))
    this.scene.start("Hangar")
  }

  /**
   * Install / Share / Contact / Home / Source row under the main menu (like
   * ../last-eichhof). Keyboard-reachable via DOWN off the last menu item, then
   * LEFT/RIGHT; the focused link is gold on a tinted pill.
   */
  private actionRow(x: number, y: number): GameObjects.Container {
    const style = { fontFamily: UI.font, fontSize: TOUCH ? "22px" : "18px", color: UI.accent }
    const defs: [string, (tx: GameObjects.Text) => void][] = [
      ...(isInstalled()
        ? []
        : [
            [`${ICON.install} ${t("menu.installApp")}`, () => this.install()] as [
              string,
              () => void,
            ],
          ]),
      [`${ICON.share} ${t("menu.share")}`, (tx) => this.share(tx)],
      [`${ICON.contact} ${t("menu.contact")}`, () => this.open(CONTACT_URL)],
      [`${ICON.home} ${t("menu.home")}`, () => this.open(HOME_URL)],
      [`${ICON.source} ${t("menu.source")}`, () => this.open(SOURCE_URL)],
    ]
    this.actionActs = defs.map(([, act]) => act)
    this.actionTexts = defs.map(([label, act], i) => {
      const tx = this.add
        .text(0, 0, label, style)
        .setOrigin(0, 0.5)
        .setPadding(8, TOUCH ? 22 : 6, 8, TOUCH ? 22 : 6)
      tx.setInteractive({ useHandCursor: true })
      tx.on("pointerover", () => this.hoverAction(i, true))
      tx.on("pointerout", () => this.hoverAction(i, false))
      tx.on("pointerup", () => act(tx))
      return tx
    })
    const texts = this.actionTexts
    const gap = TOUCH ? 12 : 28
    const total = texts.reduce((w, tx) => w + tx.width, 0) + gap * (texts.length - 1)
    let cx = -total / 2
    for (const tx of texts) {
      tx.x = cx
      cx += tx.width + gap
    }
    // Pills go in first so the labels draw on top of them.
    this.actionPills = texts.map((tx) =>
      this.add
        .rectangle(tx.x + tx.width / 2, 0, tx.width, tx.height, GOLD, 0)
        .setOrigin(0.5)
        .setStrokeStyle(1, GOLD, 0),
    )
    return this.add.container(x, y, [...this.actionPills, ...texts])
  }

  /** Move keyboard focus between the vertical menu and the link row below it. */
  private setActionFocus(on: boolean): void {
    if (on === this.actionFocused) return
    if (on && this.mode !== "main") return
    this.actionFocused = on
    this.menu.enabled = !on
    this.refreshActions()
  }

  private enterActions(): void {
    this.skipKey = true
    this.actionIndex = 0
    this.setActionFocus(true)
  }

  /** UP/DOWN while the link row has focus. */
  private stepAction(dir: number): void {
    if (this.skipKey) {
      this.skipKey = false
      return
    }
    if (!this.actionFocused) return
    const next = this.actionIndex + dir
    if (next >= 0 && next < this.actionTexts.length) {
      this.moveAction(dir)
      return
    }
    this.setActionFocus(false)
    if (dir > 0) this.menu.select(0)
  }

  private moveAction(dir: number): void {
    if (!this.actionFocused) return
    const last = this.actionTexts.length - 1
    if (last < 0) return
    this.actionIndex = Math.max(0, Math.min(last, this.actionIndex + dir))
    this.refreshActions()
  }

  private activateAction(): void {
    if (!this.actionFocused) return
    const act = this.actionActs[this.actionIndex]
    const text = this.actionTexts[this.actionIndex]
    if (act && text) act(text)
  }

  private hoverAction(index: number, on: boolean): void {
    this.actionHover = on ? index : null
    this.refreshActions()
  }

  /** Focused link: gold text on a tinted pill. Hovered: white. Rest: cyan. */
  private refreshActions(): void {
    this.actionTexts.forEach((tx, i) => {
      const focused = this.actionFocused && i === this.actionIndex
      this.actionPills[i]?.setFillStyle(GOLD, focused ? 0.18 : 0)
      this.actionPills[i]?.setStrokeStyle(1, GOLD, focused ? 0.8 : 0)
      let color = UI.accent
      if (focused) color = UI.gold
      else if (this.actionHover === i) color = "#ffffff"
      tx.setColor(color)
    })
  }

  private open(url: string): void {
    window.open(url, "_blank", "noopener")
  }

  private install(): void {
    if (hasInstallPrompt()) void promptInstall()
    else this.show("install")
  }

  private toggleLang(): void {
    setLang(getLang() === "en" ? "de" : "en")
    this.scene.restart()
  }

  private share(tx: GameObjects.Text): void {
    const url = window.location.href
    if (typeof navigator.share === "function") {
      void navigator.share({ title: "Raptor: Call of the Void", url }).catch(() => {})
      return
    }
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        tx.setText(t("menu.linkCopied"))
        this.time.delayedCall(1500, () => {
          if (tx.active) tx.setText(`${ICON.share} ${t("menu.share")}`)
        })
      })
      .catch(() => {})
  }
}
