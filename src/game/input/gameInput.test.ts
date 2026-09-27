import { describe, expect, it } from "vitest"
import { Obj } from "../sim/consts"
import { SPECIAL_KEYS } from "./gameInput"

describe("SPECIAL_KEYS", () => {
  it("follows the shop order (by price)", () => {
    expect(SPECIAL_KEYS.map(([, label, t]) => [label, t])).toEqual([
      ["1", Obj.AIR_MISSLE],
      ["2", Obj.BOMB],
      ["3", Obj.GRD_MISSLE],
      ["4", Obj.DUMB_MISSLE],
      ["5", Obj.MISSLE_PODS],
      ["6", Obj.MINI_GUN],
      ["7", Obj.ENERGY_GRAB],
      ["8", Obj.TURRET],
      ["9", Obj.PULSE_CANNON],
      ["0", Obj.DEATH_RAY],
      ["-", Obj.FORWARD_LASER],
    ])
  })
})
