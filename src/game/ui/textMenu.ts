// Vertical text menu: keyboard (up/down/left/right/enter/space/esc) + pointer (tap = select and activate).
import type { GameObjects, Input, Scene } from "phaser"

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
  home: "⌂",
  source: "</>",
  exit: "⏻",
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
  private readonly moreUp: GameObjects.Text
  private readonly moreDown: GameObjects.Text
  /** true once a pointer drag has scrolled past the tap threshold, to swallow the matching pointerup */
  private dragged = false
  private dragY = 0
  private dragScroll = 0
  onBack: (() => void) | null = null
  onMove: ((index: number) => void) | null = null
  /**
   * Fired instead of wrapping when DOWN/S is pressed on the last item, so the
   * start screen can step down into its link row. Left null, DOWN keeps
   * wrapping to the first item.
   */
  onDownFromEnd: (() => void) | null = null
  /**
   * Fired instead of wrapping when UP/W is pressed on the first item, so a
   * screen can step up into a control above the list (e.g. a back icon).
   * Left null, UP keeps wrapping to the last item.
   */
  onUpFromStart: (() => void) | null = null
  /** Touch: the first tap only selects (shows the description), a tap on the selected row activates. */
  tapToSelect = false
  /** False while another row owns the arrow/confirm keys (the link row does). */
  enabled = true

  constructor(scene: Scene, x: number, y: number, w: number, rowH = 44, visible = 9) {
    this.visible = visible
    const kb = scene.input.keyboard
    if (kb) {
      const bind = (key: string, fn: () => void) =>
        kb.on(key, () => {
          if (this.enabled) fn()
        })
      bind("keydown-UP", () => this.move(-1))
      bind("keydown-W", () => this.move(-1))
      bind("keydown-DOWN", () => this.move(1))
      bind("keydown-S", () => this.move(1))
      bind("keydown-LEFT", () => this.items[this.cursor]?.adjust?.(-1))
      bind("keydown-A", () => this.items[this.cursor]?.adjust?.(-1))
      bind("keydown-RIGHT", () => this.items[this.cursor]?.adjust?.(1))
      bind("keydown-D", () => this.items[this.cursor]?.adjust?.(1))
      bind("keydown-ENTER", () => this.activate())
      bind("keydown-SPACE", () => this.activate())
    }
    kb?.on("keydown-ESC", () => this.onBack?.())
    kb?.on("keydown-BACKSPACE", () => this.onBack?.())
    for (let i = 0; i < visible; i++) {
      const cy = y + i * rowH
      const bg = scene.add
        .rectangle(x + w / 2, cy + rowH / 2, w, rowH - 6, 0x39d0ff, 0)
        .setStrokeStyle(1, 0x39d0ff, 0)
        .setInteractive({ useHandCursor: true })
      bg.on("pointerover", (pointer: Input.Pointer) => {
        // touch "over" fires on touchstart: it would pre-select and make the first tap activate
        if (pointer.wasTouch && this.tapToSelect) return
        const idx = this.scroll + i
        if (idx < this.items.length && idx !== this.cursor) {
          this.cursor = idx
          this.refresh()
          this.onMove?.(idx)
        }
      })
      bg.on("pointerdown", (pointer: Input.Pointer) => {
        this.dragY = pointer.y
        this.dragScroll = this.scroll
        this.dragged = false
      })
      bg.on("pointerup", (pointer: Input.Pointer) => {
        // a swipe that ends on a row never activates it, even when the list can't scroll
        if (this.dragged || pointer.getDistance() > 10) {
          this.dragged = false
          return
        }
        const idx = this.scroll + i
        if (idx >= this.items.length) return
        if (pointer.wasTouch && this.tapToSelect && idx !== this.cursor) {
          this.cursor = idx
          this.refresh()
          this.onMove?.(idx)
          return
        }
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

    // Drag-to-scroll and wheel: rows beyond the visible window have no keyboard
    // affordance on touch (no ESC), so an item past `visible` (e.g. a shop's
    // "Done" row after many weapons) would otherwise be unreachable.
    const top = y
    const bottom = y + visible * rowH
    const inBounds = (py: number) => py >= top && py <= bottom
    scene.input.on("pointermove", (pointer: Input.Pointer) => {
      if (!pointer.isDown || !inBounds(this.dragY)) return
      const deltaRows = (pointer.y - this.dragY) / rowH
      if (Math.abs(pointer.y - this.dragY) > 6) this.dragged = true
      const max = Math.max(0, this.items.length - this.visible)
      const next = Math.round(this.dragScroll - deltaRows)
      const clamped = Math.max(0, Math.min(max, next))
      if (clamped !== this.scroll) {
        this.scroll = clamped
        this.refresh()
      }
    })
    scene.input.on("pointerup", () => {
      this.dragged = false
    })
    scene.input.on("wheel", (pointer: Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (!inBounds(pointer.y) || pointer.x < x || pointer.x > x + w) return
      const max = Math.max(0, this.items.length - this.visible)
      this.scroll = Math.max(0, Math.min(max, this.scroll + Math.sign(dy)))
      this.refresh()
    })

    this.moreUp = scene.add
      .text(x + w / 2, y - 14, "▲", { fontFamily: UI.font, fontSize: "16px", color: UI.dim })
      .setOrigin(0.5)
      .setVisible(false)
    this.moreDown = scene.add
      .text(x + w / 2, bottom + 14, "▼", { fontFamily: UI.font, fontSize: "16px", color: UI.dim })
      .setOrigin(0.5)
      .setVisible(false)
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
    if (d > 0 && this.cursor === this.items.length - 1 && this.onDownFromEnd) {
      this.onDownFromEnd()
      return
    }
    if (d < 0 && this.cursor === 0 && this.onUpFromStart) {
      this.onUpFromStart()
      return
    }
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
    this.moreUp.setVisible(this.scroll > 0)
    this.moreDown.setVisible(this.scroll + this.visible < this.items.length)
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
