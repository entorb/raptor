import { expect, it } from "vitest"
import { runGlbSelfCheck } from "./glb.mjs"

it("GLB cipher round-trips", () => {
  expect(() => runGlbSelfCheck()).not.toThrow()
})
