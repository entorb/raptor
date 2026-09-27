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
import { backdrop, type MenuItem, TextMenu, UI } from "../ui/textMenu"

export const DIFF_NAMES = ["Training", "Rookie", "Veteran", "Elite"]

type Mode = "main" | "pilots" | "pilot" | "delete" | "name" | "new" | "options" | "install"

const CONTACT_URL = "https://entorb.net/contact.php?origin=raptor"

function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia("(display-mode: standalone)").matches || standalone
}

export class Menu extends Scene {
  private menu!: TextMenu
  private mode: Mode = "main"
  private tick: () => void = () => {}
  private info!: GameObjects.Text
  private stats!: GameObjects.Text
  private globalGames: number | null = null
  private actions!: GameObjects.Container
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
    const items: MenuItem[] = []
    const pilots = loadPilots()
    this.stats.setText(mode === "main" ? this.statsLabel() : "")
    this.actions.setVisible(mode === "main")
    this.closeNameInput()
    this.info.setText("")
    const fly = (p: PilotSave) => () => {
      setPilot(p, false)
      this.scene.start("Hangar")
    }
    if (mode === "main") {
      items.push({ label: "Play", action: () => this.show("pilots") })
      items.push({ label: "Options", action: () => this.show("options") })
      if (this.scale.fullscreen.available)
        items.push({
          label: this.scale.isFullscreen ? "Exit Fullscreen" : "Fullscreen",
          action: () => {
            toggleFullscreen(this)
            this.time.delayedCall(300, () => this.show("main"))
          },
        })
    } else if (mode === "pilots") {
      // most recently played first (savePilot keeps the list in that order)
      for (const p of pilots)
        items.push({
          label: `${DIFF_NAMES[p.diff]} ${p.name}`,
          action: () => {
            this.picked = p
            this.show("pilot")
          },
        })
      items.push({ label: "New Pilot", action: () => this.show("name") })
      items.push({ label: "Back", action: () => this.show("main") })
    } else if (mode === "pilot" || mode === "delete") {
      const p = this.picked
      if (!p) {
        this.show("pilots")
        return
      }
      if (mode === "pilot") {
        this.info.setText(`${DIFF_NAMES[p.diff]} ${p.name}: ${p.score} CR`)
        items.push({ label: "Fly", action: fly(p) })
        items.push({ label: "Delete Pilot", action: () => this.show("delete") })
      } else {
        this.info.setText(`Delete pilot ${p.name}? This cannot be undone.`)
        items.push({
          label: "Yes, delete",
          action: () => {
            deletePilot(p.name)
            this.show("pilots")
          },
        })
      }
      items.push({ label: "Back", action: () => this.show("pilots") })
    } else if (mode === "name") {
      const input = this.openNameInput()
      // row 0 lies under the <input>: activating it (keyboard) focuses the field
      items.push({ label: "", action: () => input.focus() })
      items.push({ label: "OK", action: () => this.submitName() })
      items.push({ label: "Back", action: () => this.show("pilots") })
    } else if (mode === "new") {
      this.info.setText(`New pilot: ${this.newName}`)
      const start = (d: number) => () => {
        const p = newPilotSave(this.newName, d)
        setPilot(withLoadout(p, loadout(p)))
        this.scene.start("Hangar")
      }
      items.push({ label: "Rookie", detail: "easy", action: start(DIFF_EASY) })
      items.push({ label: "Veteran", detail: "normal", action: start(DIFF_NORMAL) })
      items.push({ label: "Elite", detail: "hard", action: start(DIFF_HARD) })
      items.push({ label: "Back", action: () => this.show("name") })
    } else if (mode === "install") {
      this.info.setText(
        'Android: menu (3 dots) → "Add to Home screen"\niPhone: Share icon → "Add to Home Screen"',
      )
      items.push({ label: "Back", action: () => this.show("main") })
    } else {
      const s = loadSettings()
      const pct = (v: number) => `${Math.round(v * 100)}%`
      const step = (v: number, d = 1) => Math.max(0, Math.min(1, Math.round((v + d * 0.2) * 5) / 5))
      const cycle = (v: number) => (v >= 0.99 ? 0 : step(v))
      this.info.setText("")
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
      items.push({
        label: "Music",
        detail: pct(s.music),
        action: () => setMusic(cycle(s.music)),
        adjust: (d) => setMusic(step(s.music, d)),
      })
      items.push({
        label: "Sound Effects",
        detail: pct(s.sfx),
        action: () => setSfx(cycle(s.sfx)),
        adjust: (d) => setSfx(step(s.sfx, d)),
      })
      items.push({
        label: "Auto-Fire",
        detail: s.autoFire ? "ON" : "OFF",
        action: () => setAutoFire(!s.autoFire),
        adjust: () => setAutoFire(!s.autoFire),
      })
      items.push({ label: "Back", action: () => this.show("main") })
    }
    this.menu.setItems(items, mode === "options")
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
    const err = !name ? "Enter a name" : pilotNameTaken(name) ? "Name already taken" : ""
    if (err) {
      this.info.setText(err)
      return
    }
    this.closeNameInput()
    this.newName = name
    this.show("new")
  }

  /** Install / Share / Contact row under the main menu (like ../last-eichhof). */
  private actionRow(x: number, y: number): GameObjects.Container {
    const style = { fontFamily: UI.font, fontSize: "18px", color: UI.accent }
    const defs: [string, (t: GameObjects.Text) => void][] = [
      ...(isInstalled() ? [] : [["Install App", () => this.install()] as [string, () => void]]),
      ["Share", (t) => this.share(t)],
      ["Contact", () => window.open(CONTACT_URL, "_blank", "noopener")],
    ]
    const texts = defs.map(([label, act]) => {
      const t = this.add.text(0, 0, label, style).setOrigin(0, 0.5).setPadding(8, 6, 8, 6)
      t.setInteractive({ useHandCursor: true })
      t.on("pointerover", () => t.setColor("#ffffff"))
      t.on("pointerout", () => t.setColor(UI.accent))
      t.on("pointerup", () => act(t))
      return t
    })
    const gap = 28
    const total = texts.reduce((w, t) => w + t.width, 0) + gap * (texts.length - 1)
    let cx = -total / 2
    for (const t of texts) {
      t.x = cx
      cx += t.width + gap
    }
    return this.add.container(x, y, texts)
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
          if (t.active) t.setText("Share")
        })
      })
      .catch(() => {})
  }
}
