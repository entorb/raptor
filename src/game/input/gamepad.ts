// Gamepad (web addition): the standard mapping is turned into the keyboard events every scene
// already handles, so menus and flight need no gamepad code of their own.
// D-pad / left stick = arrows, A = Enter, B = Esc, X = Space, Start = P, LB = Alt, RB = Shift.

/** standard-mapping button index -> [key, keyCode] */
const BUTTONS: Record<number, [string, number]> = {
  0: ["Enter", 13],
  1: ["Escape", 27],
  2: [" ", 32],
  4: ["Alt", 18],
  5: ["Shift", 16],
  9: ["p", 80],
  12: ["ArrowUp", 38],
  13: ["ArrowDown", 40],
  14: ["ArrowLeft", 37],
  15: ["ArrowRight", 39],
}
const STICK = 0.5

function send(type: "keydown" | "keyup", [key, keyCode]: [string, number]): void {
  const e = new KeyboardEvent(type, { key, bubbles: true })
  // Phaser reads the deprecated keyCode, which KeyboardEventInit can't set
  Object.defineProperty(e, "keyCode", { get: () => keyCode })
  Object.defineProperty(e, "which", { get: () => keyCode })
  globalThis.dispatchEvent(e)
}

/** Pressed keys of one gamepad snapshot (buttons and stick). */
export function padKeys(pad: Pick<Gamepad, "buttons" | "axes">): Set<number> {
  const down = new Set<number>()
  for (const [i, b] of pad.buttons.entries()) if (b.pressed && BUTTONS[i]) down.add(i)
  const [x = 0, y = 0] = pad.axes
  if (y < -STICK) down.add(12)
  if (y > STICK) down.add(13)
  if (x < -STICK) down.add(14)
  if (x > STICK) down.add(15)
  return down
}

/** Poll the connected gamepads every animation frame (only while one is connected). */
export function initGamepad(): void {
  if (typeof navigator.getGamepads !== "function") return
  let held = new Set<number>()
  let running = false
  const poll = () => {
    const now = new Set<number>()
    for (const pad of navigator.getGamepads()) if (pad) for (const k of padKeys(pad)) now.add(k)
    for (const k of now) if (!held.has(k)) send("keydown", BUTTONS[k] as [string, number])
    for (const k of held) if (!now.has(k)) send("keyup", BUTTONS[k] as [string, number])
    held = now
    running = navigator.getGamepads().some((p) => p !== null)
    if (running || held.size) requestAnimationFrame(poll)
  }
  globalThis.addEventListener("gamepadconnected", () => {
    if (!running) requestAnimationFrame(poll)
    running = true
  })
}
