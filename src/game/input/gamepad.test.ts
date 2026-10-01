import { expect, it } from "vitest"
import { padKeys } from "./gamepad"

it("maps standard gamepad buttons and the left stick to keys", () => {
  const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 || i === 3 }))
  const keys = padKeys({ buttons, axes: [0.9, -0.2] } as unknown as Gamepad)
  // A (Enter) and stick right; Y (3) is unmapped, small y is the dead zone
  expect([...keys].sort((a, b) => a - b)).toEqual([0, 15])
})
