// Vertical text menu: keyboard (up/down/left/right/enter/space/esc) + pointer (tap = select and activate).
import type { GameObjects, Scene } from "phaser"

export interface MenuItem {
  label: string
  /** right-aligned detail text (price, value) */
  detail?: string
  disabled?: boolean
  /** drawn dimmed but still selectable (e.g. too expensive: the shop explains why) */
  dim?: boolean
  action: () => void
  /** left/right arrow: change the value by one step (-1/+1) */
  adjust?: (dir: number) => void
}

export const UI = {
  font: "'Segoe UI', system-ui, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
  accent: "#39d0ff",
  text: "#e6f2ff",
  dim: "#6d7a90",
  warn: "#ff5a6a",
  gold: "#ffd23d",
}

/** Glyph prefixes for common menu actions, prepended to the label text. */
export const ICON = {
  back: "←",
  play: "▶",
  buy: "+",
  sell: "−",
  add: "+",
  delete: "✕",
  confirm: "✓",
  replay: "↻",
  options: "⚙",
  fullscreen: "⛶",
  install: "⬇",
  share: "↗",
  contact: "✉",
}

export class TextMenu {
  private items: MenuItem[] = []
  private readonly rows: {
    bg: GameObjects.Rectangle
    label: GameObjects.Text
    detail: GameObjects.Text
  }[] = []
  private cursor = 0
  private readonly visible: number
  private scroll = 0
  onBack: (() => void) | null = null
  onMove: ((index: number) => void) | null = null

  constructor(scene: Scene, x: number, y: number, w: number, rowH = 44, visible = 9) {
    this.visible = visible
    const kb = scene.input.keyboard
    kb?.on("keydown-UP", () => this.move(-1))
    kb?.on("keydown-W", () => this.move(-1))
    kb?.on("keydown-DOWN", () => this.move(1))
    kb?.on("keydown-S", () => this.move(1))
    kb?.on("keydown-LEFT", () => this.items[this.cursor]?.adjust?.(-1))
    kb?.on("keydown-A", () => this.items[this.cursor]?.adjust?.(-1))
    kb?.on("keydown-RIGHT", () => this.items[this.cursor]?.adjust?.(1))
    kb?.on("keydown-D", () => this.items[this.cursor]?.adjust?.(1))
    kb?.on("keydown-ENTER", () => this.activate())
    kb?.on("keydown-SPACE", () => this.activate())
    kb?.on("keydown-ESC", () => this.onBack?.())
    kb?.on("keydown-BACKSPACE", () => this.onBack?.())
    for (let i = 0; i < visible; i++) {
      const cy = y + i * rowH
      const bg = scene.add
        .rectangle(x + w / 2, cy + rowH / 2, w, rowH - 6, 0x39d0ff, 0)
        .setStrokeStyle(1, 0x39d0ff, 0)
        .setInteractive({ useHandCursor: true })
      bg.on("pointerover", () => {
        const idx = this.scroll + i
        if (idx < this.items.length && idx !== this.cursor) {
          this.cursor = idx
          this.refresh()
          this.onMove?.(idx)
        }
      })
      bg.on("pointerup", () => {
        const idx = this.scroll + i
        if (idx >= this.items.length) return
        this.cursor = idx
        this.activate()
      })
      const label = scene.add.text(x + 18, cy + rowH / 2, "", {
        fontFamily: UI.font,
        fontSize: `${Math.round(rowH * 0.5)}px`,
        color: UI.text,
      })
      label.setOrigin(0, 0.5)
      const detail = scene.add.text(x + w - 18, cy + rowH / 2, "", {
        fontFamily: UI.mono,
        fontSize: `${Math.round(rowH * 0.42)}px`,
        color: UI.gold,
      })
      detail.setOrigin(1, 0.5)
      this.rows.push({ bg, label, detail })
    }
  }

  get index(): number {
    return this.cursor
  }

  setItems(items: MenuItem[], keepCursor = true): void {
    this.items = items
    if (!keepCursor) this.cursor = 0
    this.cursor = Math.max(0, Math.min(this.cursor, items.length - 1))
    this.refresh()
  }

  private move(d: number): void {
    if (!this.items.length) return
    this.cursor = (this.cursor + d + this.items.length) % this.items.length
    this.refresh()
    this.onMove?.(this.cursor)
  }

  private activate(): void {
    const it = this.items[this.cursor]
    if (!it || it.disabled) return
    it.action()
  }

  private refresh(): void {
    if (this.cursor < this.scroll) this.scroll = this.cursor
    if (this.cursor >= this.scroll + this.visible) this.scroll = this.cursor - this.visible + 1
    this.rows.forEach((r, i) => {
      const it = this.items[this.scroll + i]
      const sel = this.scroll + i === this.cursor
      r.label.setText(it ? it.label : "")
      r.detail.setText(it?.detail ?? "")
      let color = UI.text
      if (it?.disabled || it?.dim) color = UI.dim
      else if (it && sel) color = "#ffffff"
      r.label.setColor(color)
      r.bg.setFillStyle(0x39d0ff, it && sel ? 0.18 : 0)
      r.bg.setStrokeStyle(1, 0x39d0ff, it && sel ? 0.8 : 0)
      if (r.bg.input) r.bg.input.enabled = !!it
    })
  }
}

/** Title + subtitle header used by the menu scenes. */
export function header(scene: Scene, title: string, sub?: string): void {
  scene.add
    .text(480, 54, title, {
      fontFamily: UI.font,
      fontSize: "46px",
      color: UI.text,
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setPadding(30, 20, 30, 20)
    .setShadow(0, 0, UI.accent, 16, true, true)
  if (sub)
    scene.add
      .text(480, 100, sub, { fontFamily: UI.font, fontSize: "20px", color: UI.accent })
      .setOrigin(0.5)
}

/** Shared animated space backdrop for menu scenes. */
export function backdrop(scene: Scene): () => void {
  const neb = scene.add.tileSprite(480, 300, 960, 600, "nebula").setAlpha(0.9)
  const far = scene.add.tileSprite(480, 300, 960, 600, "stars-far")
  const near = scene.add.tileSprite(480, 300, 960, 600, "stars-near")
  return () => {
    neb.tilePositionY -= 0.1
    far.tilePositionY -= 0.3
    near.tilePositionY -= 0.8
  }
}
