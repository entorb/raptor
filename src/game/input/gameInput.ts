// In-game controls -> sim FrameInput.
// - Keyboard: arrows/WASD move (DOS keyboard acceleration), Space toggles auto-fire, Shift/Alt next/previous
//   special weapon, Enter nova bomb, 1..0,- pick a special, P/Esc pause.
// - 2P co-op (desktop): player 1 = arrows, Shift/Alt, Enter, 1..0,-; player 2 = WASD, E/Q next/previous
//   special, Tab nova. Space toggles auto-fire for both.
// - Touch: drag anywhere (also the letterbox strips) moves a virtual cursor relative to the ship
//   so the finger never covers it; on-screen buttons from `buttons`.
// - Auto-fire (Settings.autoFire, default on) fires continuously; when off, fire = a finger on
//   the screen (touch only; no single-shot key on desktop).
import type { Input, Scene } from "phaser"
import { SCALE } from "../data/playfield"
import { loadSettings, saveSettings } from "../data/save"
import type { ObjType } from "../sim/consts"
import { WEAPON_ORDER } from "../sim/objects"
import type { FrameInput } from "../sim/world"

export interface TouchButton {
  id: string
  /** game coords (960x600) */
  x: number
  y: number
  r: number
}

const KEYS = [
  ["ONE", "1"],
  ["TWO", "2"],
  ["THREE", "3"],
  ["FOUR", "4"],
  ["FIVE", "5"],
  ["SIX", "6"],
  ["SEVEN", "7"],
  ["EIGHT", "8"],
  ["NINE", "9"],
  ["ZERO", "0"],
  ["MINUS", "-"],
] as const

/**
 * Special weapon keys: Phaser key name, label, weapon, in shop order (`objects.ts WEAPON_ORDER`) —
 * also the order the cycle (Shift/Alt) button and the HUD strip walk.
 */
export const SPECIAL_KEYS: [string, string, ObjType][] = WEAPON_ORDER.map((t, i) => [
  ...(KEYS[i] ?? ["", ""]),
  t,
])

/** Touch drag sensitivity (game px per screen px). */
const DRAG_GAIN = 1.4

export class GameInput {
  touchMode = false
  autoFire = loadSettings().autoFire
  buttons: TouchButton[] = []
  onButton: (id: string) => void = () => {}
  private readonly keys: Record<string, Input.Keyboard.Key> = {}
  private pointer: { x: number; y: number } | null = null
  private drag: { id: number; lastX: number; lastY: number } | null = null
  private tapButtons = new Set<string>()
  private selected: ObjType | null = null
  private readonly scene: Scene
  private shipCenter = { x: 160, y: 176 }
  /** 2P co-op: `read` returns one input per ship */
  private readonly twoPlayer: boolean

  constructor(scene: Scene, twoPlayer = false) {
    this.scene = scene
    this.twoPlayer = twoPlayer
    const kb = scene.input.keyboard
    if (kb) {
      const names = [
        "UP",
        "DOWN",
        "LEFT",
        "RIGHT",
        "W",
        "A",
        "S",
        "D",
        "SHIFT",
        "ALT",
        "ENTER",
        "Q",
        "E",
        "TAB",
        "G",
        ...SPECIAL_KEYS.map(([k]) => k),
      ]
      for (const n of names) {
        const key = kb.addKey(n, true)
        this.keys[n] = key
      }
      for (const [k, , t] of SPECIAL_KEYS) this.keys[k]?.on("down", () => (this.selected = t))
      // hidden cheat (like the DOS godmode): not listed in the briefing
      this.keys.G?.on("down", () => this.onGod())
      kb.on("keydown", () => {
        if (!this.drag) this.pointer = null
      })
    }
    window.addEventListener("pointerdown", this.down)
    window.addEventListener("pointermove", this.move)
    window.addEventListener("pointerup", this.up)
    window.addEventListener("pointercancel", this.up)
    scene.events.once("shutdown", () => this.destroy())
  }

  destroy(): void {
    window.removeEventListener("pointerdown", this.down)
    window.removeEventListener("pointermove", this.move)
    window.removeEventListener("pointerup", this.up)
    window.removeEventListener("pointercancel", this.up)
  }

  toggleAutoFire(): void {
    this.autoFire = !this.autoFire
    const s = loadSettings()
    s.autoFire = this.autoFire
    saveSettings(s)
    this.onAutoFire(this.autoFire)
  }

  /** Pick a special weapon (like the number keys), e.g. from a tapped HUD icon. */
  selectWeapon(t: ObjType): void {
    this.selected = t
  }

  onAutoFire: (on: boolean) => void = () => {}
  onGod: () => void = () => {}

  /** Ship center (DOS coords) so a new touch drag starts at the ship. */
  setShip(cx: number, cy: number): void {
    this.shipCenter = { x: cx, y: cy }
  }

  private isDown(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown)
  }

  private toGame(e: PointerEvent): { x: number; y: number } {
    const s = this.scene.scale
    return { x: s.transformX(e.pageX), y: s.transformY(e.pageY) }
  }

  private readonly down = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("#rotate")) return
    const p = this.toGame(e)
    if (e.pointerType === "mouse") return
    this.touchMode = true
    for (const b of this.buttons) {
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= b.r ** 2) {
        this.tapButtons.add(b.id)
        this.onButton(b.id)
        return
      }
    }
    if (this.drag) return
    this.drag = { id: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    this.pointer ??= { ...this.shipCenter }
  }

  private readonly move = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || e.pointerId !== this.drag?.id || !this.pointer) return
    const ds = this.scene.scale.displayScale
    this.pointer.x += ((e.clientX - this.drag.lastX) * ds.x * DRAG_GAIN) / SCALE
    this.pointer.y += ((e.clientY - this.drag.lastY) * ds.y * DRAG_GAIN) / SCALE
    this.pointer.x = Math.max(0, Math.min(319, this.pointer.x))
    this.pointer.y = Math.max(0, Math.min(199, this.pointer.y))
    this.drag.lastX = e.clientX
    this.drag.lastY = e.clientY
  }

  private readonly up = (e: PointerEvent) => {
    if (e.pointerId === this.drag?.id) this.drag = null
  }

  private enterHeld = false

  /** Ignore ENTER (nova) until it is released, e.g. after it closed the pause menu. */
  ignoreEnterUntilUp(): void {
    this.enterHeld = true
  }

  /** Called once per sim frame. */
  read(): FrameInput | FrameInput[] {
    if (!this.isDown("ENTER")) this.enterHeld = false
    const sel = this.selected
    this.selected = null
    const taps = this.tapButtons
    this.tapButtons = new Set()
    if (this.twoPlayer) return this.readTwo(sel)
    return {
      left: this.isDown("LEFT", "A"),
      right: this.isDown("RIGHT", "D"),
      up: this.isDown("UP", "W"),
      down: this.isDown("DOWN", "S"),
      pointer: this.pointer,
      fire: this.autoFire,
      cycle: taps.has("cycle") || this.isDown("SHIFT"),
      cyclePrev: this.isDown("ALT"),
      mega: taps.has("mega") || (!this.enterHeld && this.isDown("ENTER")),
      select: sel,
    }
  }

  /** 2P co-op: player 1 on the arrows, player 2 on WASD (keyboard only). */
  private readTwo(sel: ObjType | null): FrameInput[] {
    const p1: FrameInput = {
      left: this.isDown("LEFT"),
      right: this.isDown("RIGHT"),
      up: this.isDown("UP"),
      down: this.isDown("DOWN"),
      pointer: null,
      fire: this.autoFire,
      cycle: this.isDown("SHIFT"),
      cyclePrev: this.isDown("ALT"),
      mega: !this.enterHeld && this.isDown("ENTER"),
      select: sel,
    }
    const p2: FrameInput = {
      left: this.isDown("A"),
      right: this.isDown("D"),
      up: this.isDown("W"),
      down: this.isDown("S"),
      pointer: null,
      fire: this.autoFire,
      cycle: this.isDown("E"),
      cyclePrev: this.isDown("Q"),
      mega: this.isDown("TAB"),
      select: null,
    }
    return [p1, p2]
  }
}
