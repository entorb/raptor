import { type GameObjects, Scene } from "phaser"
import { getAudio } from "../audio/audio"
import { loadout, withLoadout } from "../campaign"
import {
  deletePilot,
  loadPilots,
  loadSettings,
  MAX_NAME,
  newPilotSave,
  type PilotSave,
  pilotNameTaken,
  saveSettings,
} from "../data/save"
import { readGlobalMissions } from "../data/stats"
import { toggleFullscreen } from "../input/fullscreen"
import { hasInstallPrompt, promptInstall } from "../pwa"
import { setPilot } from "../session"
import { DIFF_EASY, DIFF_HARD, DIFF_NORMAL } from "../sim/consts"
import { backdrop, ICON, type MenuItem, TextMenu, UI } from "../ui/textMenu"

export const DIFF_NAMES = ["Training", "Rookie", "Veteran", "Elite"]

type Mode = "main" | "pilots" | "pilot" | "delete" | "name" | "new" | "options" | "install"

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
  private nameInput: GameObjects.DOMElement | null = null
  /** pilot picked in the "pilots" list, name typed in "name" mode */
  private picked: PilotSave | null = null
  private newName = ""

  constructor() {
    super("Menu")
  }

  create(): void {
    this.mode = "main"
    this.tick = backdrop(this)
    const title = this.add
      .text(480, 92, "RAPTOR", {
        fontFamily: UI.font,
        fontSize: "96px",
        fontStyle: "900",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setPadding(40, 30, 40, 30)
      .setShadow(0, 0, UI.accent, 28, true, true)
    this.tweens.add({ targets: title, alpha: 0.85, yoyo: true, repeat: -1, duration: 1800 })
    this.add
      .text(480, 158, "CALL OF THE VOID", {
        fontFamily: UI.font,
        fontSize: "24px",
        color: UI.accent,
        letterSpacing: 10,
      })
      .setOrigin(0.5)
    this.add
      .text(480, 188, "by Torben", { fontFamily: UI.font, fontSize: "16px", color: UI.dim })
      .setOrigin(0.5)
    this.stats = this.add
      .text(480, 540, "", { fontFamily: UI.font, fontSize: "16px", color: UI.dim })
      .setOrigin(0.5)
    void readGlobalMissions().then((n) => {
      this.globalGames = n
      if (this.stats.active && this.mode === "main") this.stats.setText(this.statsLabel())
    })
    this.info = this.add
      .text(480, 566, "", { fontFamily: UI.font, fontSize: "15px", color: UI.dim, align: "center" })
      .setOrigin(0.5)
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
      .text(480, 588, "A remake of Raptor: Call of the Shadows (1994, Cygnus Studios / Apogee)", {
        fontFamily: UI.font,
        fontSize: "13px",
        color: UI.dim,
      })
      .setOrigin(0.5)
    this.actions = this.actionRow(480, 506)
    this.menu = new TextMenu(this, 280, 214, 400, 46, 6)
    this.menu.onBack = () => {
      if (this.mode === "new") this.show("name")
      else if (["pilot", "delete", "name"].includes(this.mode)) this.show("pilots")
      else if (this.mode !== "main") this.show("main")
    }
    // The link row is its own row: DOWN off the last menu item enters it,
    // UP leaves, LEFT/RIGHT pick a link, ENTER/SPACE opens it.
    this.menu.onDownFromEnd = () => this.setActionFocus(true)
    const kb = this.input.keyboard
    kb?.on("keydown-UP", () => this.setActionFocus(false))
    kb?.on("keydown-W", () => this.setActionFocus(false))
    kb?.on("keydown-LEFT", () => this.moveAction(-1))
    kb?.on("keydown-A", () => this.moveAction(-1))
    kb?.on("keydown-RIGHT", () => this.moveAction(1))
    kb?.on("keydown-D", () => this.moveAction(1))
    kb?.on("keydown-ENTER", () => this.activateAction())
    kb?.on("keydown-SPACE", () => this.activateAction())
    getAudio().playSong(this, "mainmenu")
    this.show("main")
  }

  update(): void {
    this.tick()
  }

  private statsLabel(): string {
    return `Total Missions Globally: ${this.globalGames ?? "—"}`
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
      case "name":
        items = this.nameItems()
        break
      case "new":
        items = this.newItems()
        break
      case "install":
        items = this.installItems()
        break
      default:
        items = this.optionsItems()
    }
    this.menu.setItems(items, mode === "options")
  }

  private mainItems(): MenuItem[] {
    const items: MenuItem[] = [
      { label: `${ICON.play} Play`, action: () => this.show("pilots") },
      { label: `${ICON.options} Options`, action: () => this.show("options") },
    ]
    if (this.scale.fullscreen.available)
      items.push({
        label: `${ICON.fullscreen} ${this.scale.isFullscreen ? "Exit Fullscreen" : "Fullscreen"}`,
        action: () => {
          toggleFullscreen(this)
          this.time.delayedCall(300, () => this.show("main"))
        },
      })
    return items
  }

  private pilotsItems(): MenuItem[] {
    // most recently played first (savePilot keeps the list in that order)
    const items: MenuItem[] = loadPilots().map((p) => ({
      label: `${DIFF_NAMES[p.diff]} ${p.name}`,
      action: () => {
        this.picked = p
        this.show("pilot")
      },
    }))
    items.push(
      { label: `${ICON.add} New Pilot`, action: () => this.show("name") },
      { label: `${ICON.back} Back`, action: () => this.show("main") },
    )
    return items
  }

  private pilotItems(p: PilotSave, mode: "pilot" | "delete"): MenuItem[] {
    const items: MenuItem[] = []
    if (mode === "pilot") {
      this.info.setText(`${DIFF_NAMES[p.diff]} ${p.name}: ${p.score} CR`)
      items.push(
        {
          label: `${ICON.play} Fly`,
          action: () => {
            setPilot(p, false)
            this.scene.start("Hangar")
          },
        },
        { label: `${ICON.delete} Delete Pilot`, action: () => this.show("delete") },
      )
    } else {
      this.info.setText(`Delete pilot ${p.name}? This cannot be undone.`)
      items.push({
        label: `${ICON.delete} Yes, delete`,
        action: () => {
          deletePilot(p.name)
          this.show("pilots")
        },
      })
    }
    items.push({ label: `${ICON.back} Back`, action: () => this.show("pilots") })
    return items
  }

  private nameItems(): MenuItem[] {
    const input = this.openNameInput()
    // row 0 lies under the <input>: activating it (keyboard) focuses the field
    return [
      { label: "", action: () => input.focus() },
      { label: `${ICON.confirm} OK`, action: () => this.submitName() },
      { label: `${ICON.back} Back`, action: () => this.show("pilots") },
    ]
  }

  private newItems(): MenuItem[] {
    this.info.setText(`New pilot: ${this.newName}`)
    const start = (d: number) => () => {
      const p = newPilotSave(this.newName, d)
      setPilot(withLoadout(p, loadout(p)))
      this.scene.start("Hangar")
    }
    return [
      { label: "Rookie", detail: "easy", action: start(DIFF_EASY) },
      { label: "Veteran", detail: "normal", action: start(DIFF_NORMAL) },
      { label: "Elite", detail: "hard", action: start(DIFF_HARD) },
      { label: `${ICON.back} Back`, action: () => this.show("name") },
    ]
  }

  private installItems(): MenuItem[] {
    this.body.setText(
      'Android: menu (3 dots) → "Add to Home screen"\niPhone: Share icon → "Add to Home Screen"',
    )
    return [{ label: `${ICON.back} Back`, action: () => this.show("main") }]
  }

  private optionsItems(): MenuItem[] {
    this.info.setText("Shield only recharges while not firing: Auto-Fire blocks regen")
    const s = loadSettings()
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const step = (v: number, d = 1) => Math.max(0, Math.min(1, Math.round((v + d * 0.2) * 5) / 5))
    const cycle = (v: number) => (v >= 0.99 ? 0 : step(v))
    const setMusic = (v: number) => {
      s.music = v
      saveSettings(s)
      getAudio().setMusicVolume(v)
      this.show("options")
    }
    const setSfx = (v: number) => {
      s.sfx = v
      saveSettings(s)
      getAudio().sfxVolume = v
      this.show("options")
    }
    const setAutoFire = (v: boolean) => {
      s.autoFire = v
      saveSettings(s)
      this.show("options")
    }
    return [
      {
        label: "Music",
        detail: pct(s.music),
        action: () => setMusic(cycle(s.music)),
        adjust: (d) => setMusic(step(s.music, d)),
      },
      {
        label: "Sound Effects",
        detail: pct(s.sfx),
        action: () => setSfx(cycle(s.sfx)),
        adjust: (d) => setSfx(step(s.sfx, d)),
      },
      {
        label: "Auto-Fire",
        detail: s.autoFire ? "ON" : "OFF",
        action: () => setAutoFire(!s.autoFire),
        adjust: () => setAutoFire(!s.autoFire),
      },
      { label: `${ICON.back} Back`, action: () => this.show("main") },
    ]
  }

  /** Phaser DOM <input> (opens the on-screen keyboard); the menu keys are off while typing. */
  private openNameInput(): HTMLInputElement {
    const el = document.createElement("input")
    el.type = "text"
    el.maxLength = MAX_NAME
    el.placeholder = "Pilot name"
    el.value = this.newName
    el.autocomplete = "off"
    el.style.cssText =
      "width:380px;font:24px system-ui,sans-serif;padding:8px 14px;color:#e6f2ff;" +
      "background:#0b1426;border:1px solid #39d0ff;border-radius:6px;outline:none;text-align:center"
    el.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Enter") this.submitName()
      else if (e.key === "Escape") this.show("pilots")
    })
    el.addEventListener("focus", () => this.setMenuKeys(false))
    el.addEventListener("blur", () => this.setMenuKeys(true))
    this.nameInput = this.add.dom(480, 237, el)
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
    if (!name) err = "Enter a name"
    else if (pilotNameTaken(name)) err = "Name already taken"
    if (err) {
      this.info.setText(err)
      return
    }
    this.closeNameInput()
    this.newName = name
    this.show("new")
  }

  /**
   * Install / Share / Contact / Home / Source row under the main menu (like
   * ../last-eichhof). Keyboard-reachable via DOWN off the last menu item, then
   * LEFT/RIGHT; the focused link is gold on a tinted pill.
   */
  private actionRow(x: number, y: number): GameObjects.Container {
    const style = { fontFamily: UI.font, fontSize: "18px", color: UI.accent }
    const defs: [string, (t: GameObjects.Text) => void][] = [
      ...(isInstalled()
        ? []
        : [[`${ICON.install} Install App`, () => this.install()] as [string, () => void]]),
      [`${ICON.share} Share`, (t) => this.share(t)],
      [`${ICON.contact} Contact`, () => this.open(CONTACT_URL)],
      [`${ICON.home} Home`, () => this.open(HOME_URL)],
      [`${ICON.source} Source`, () => this.open(SOURCE_URL)],
    ]
    this.actionActs = defs.map(([, act]) => act)
    this.actionTexts = defs.map(([label, act], i) => {
      const t = this.add.text(0, 0, label, style).setOrigin(0, 0.5).setPadding(8, 6, 8, 6)
      t.setInteractive({ useHandCursor: true })
      t.on("pointerover", () => this.hoverAction(i, true))
      t.on("pointerout", () => this.hoverAction(i, false))
      t.on("pointerup", () => act(t))
      return t
    })
    const texts = this.actionTexts
    const gap = 28
    const total = texts.reduce((w, t) => w + t.width, 0) + gap * (texts.length - 1)
    let cx = -total / 2
    for (const t of texts) {
      t.x = cx
      cx += t.width + gap
    }
    // Pills go in first so the labels draw on top of them.
    this.actionPills = texts.map((t) =>
      this.add
        .rectangle(t.x + t.width / 2, 0, t.width, t.height, GOLD, 0)
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
    this.actionTexts.forEach((t, i) => {
      const focused = this.actionFocused && i === this.actionIndex
      this.actionPills[i]?.setFillStyle(GOLD, focused ? 0.18 : 0)
      this.actionPills[i]?.setStrokeStyle(1, GOLD, focused ? 0.8 : 0)
      let color = UI.accent
      if (focused) color = UI.gold
      else if (this.actionHover === i) color = "#ffffff"
      t.setColor(color)
    })
  }

  private open(url: string): void {
    window.open(url, "_blank", "noopener")
  }

  private install(): void {
    if (hasInstallPrompt()) void promptInstall()
    else this.show("install")
  }

  private share(t: GameObjects.Text): void {
    const url = window.location.href
    if (typeof navigator.share === "function") {
      void navigator.share({ title: "Raptor: Call of the Void", url }).catch(() => {})
      return
    }
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        t.setText("Link copied")
        this.time.delayedCall(1500, () => {
          if (t.active) t.setText(`${ICON.share} Share`)
        })
      })
      .catch(() => {})
  }
}
