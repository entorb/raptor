// Export a PNG and a text snapshot of every screen, for UI review (desktop + mobile).
//
//   pnpm dev   # then:
//   node scripts/gen_screen_exports.mjs [--url=...] [--screen=shop] [--device=mobile]
//
// Writes tmp/screens/<device>-<NN>-<name>.png + .txt. The .txt lists every visible text
// (design x/y, CSS font px, color) and every enabled pointer target (CSS px size, flagged
// `SMALL` below 44 px on touch). Design coords = the 960x600 game space.
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const URL = arg("url") ?? "http://localhost:5173/raptor/"
const OUT = "tmp/screens"
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: {
    viewport: { width: 800, height: 360 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
}

/** In-page: text + hit targets of all active scenes (recurses containers). */
function snapshot() {
  const g = window.__game
  const k = g.scale.displaySize.width / g.scale.width
  const lines = []
  const walk = (o, scene) => {
    if (!o.visible || o.alpha === 0) return
    if (o.list) for (const c of o.list) walk(c, scene)
    const b = o.getBounds?.()
    if (o.type === "Text" && o.text.trim()) {
      const fs = Number.parseFloat(o.style.fontSize) * (o.scaleY ?? 1)
      const px = (fs * k).toFixed(1)
      lines.push(
        `T ${scene} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}) ${px}px${fs * k < 12 ? " TINY" : ""} ${o.style.color} ${JSON.stringify(o.text)}`,
      )
    }
    if (o.input?.enabled && b) {
      const w = b.width * k
      const h = b.height * k
      const small = Math.min(w, h) < 44 ? " SMALL" : ""
      lines.push(
        `H ${scene} (${Math.round(b.x)},${Math.round(b.y)}) ${Math.round(w)}x${Math.round(h)}css${small}`,
      )
    }
  }
  for (const s of g.scene.getScenes(true)) for (const o of s.children.list) walk(o, s.scene.key)
  return `scale ${k.toFixed(2)} css/design\n${lines.join("\n")}\n`
}

const call = (page, key, fn, ...a) =>
  page.evaluate(
    ([k, f, a]) => {
      const s = window.__game.scene.getScene(k)
      s[f](...a)
    },
    [key, fn, a],
  )

async function seedPilot(page) {
  // module URLs as a string list: in-page imports, not script dependencies (knip)
  const mods = ["data/save", "campaign", "session"].map((m) => `/raptor/game/${m}.ts`)
  await page.evaluate(async (urls) => {
    const [save, camp, sess] = await Promise.all(urls.map((u) => import(u)))
    const p = save.newPilotSave("Maverick", 1)
    sess.setPilot(camp.withLoadout(p, camp.loadout(p)))
  }, mods)
}

const SCREENS = [
  ["menu", async (p) => call(p, "Menu", "show", "main")],
  ["pilots", async (p) => call(p, "Menu", "show", "pilots")],
  ["options", async (p) => call(p, "Menu", "show", "options")],
  ["hangar", async (p) => start(p, "Hangar")],
  ["shop-buy", async (p) => call(p, "Hangar", "show", "shop")],
  [
    "shop-sell",
    async (p) =>
      p.evaluate(() => {
        const h = window.__game.scene.getScene("Hangar")
        h.buying = false
        h.show("shop")
      }),
  ],
  ["launch", async (p) => call(p, "Hangar", "openLaunch", "bravo", 0)],
  ["briefing", async (p) => start(p, "Game", { sector: "bravo", wave: 0 }, 1500)],
  ["play", async (p) => (await call(p, "Game", "startMission"), p.waitForTimeout(4000))],
  ["pause", async (p) => call(p, "Game", "togglePause")],
  [
    "results",
    async (p) => {
      await call(p, "Game", "togglePause")
      await p.evaluate(() => {
        window.__game.scene.getScene("Game").world.startendwave = 45
      })
      await p.waitForTimeout(6000)
    },
  ],
]

async function start(page, key, data, wait = 800) {
  await page.evaluate(
    ([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d),
    [key, data],
  )
  await page.waitForTimeout(wait)
}

const only = arg("screen")
const devices = arg("device") ? [arg("device")] : Object.keys(DEVICES)
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
let failed = false
for (const dev of devices) {
  const ctx = await browser.newContext(DEVICES[dev])
  await ctx.route("**/web-stats-json.php**", (r) => r.fulfill({ json: { accesscounts: 1 } }))
  const page = await ctx.newPage()
  page.on("pageerror", (e) => {
    failed = true
    console.error(`${dev}: ${e}`)
  })
  await page.goto(URL, { waitUntil: "load" })
  await page.waitForFunction(() => window.__game?.scene.isActive("Menu"), undefined, {
    timeout: 20000,
  })
  await page.waitForTimeout(800)
  await seedPilot(page)
  for (const [i, [name, go]] of SCREENS.entries()) {
    await go(page)
    await page.waitForTimeout(500)
    if (only && only !== name) continue
    const file = `${OUT}/${dev}-${String(i + 1).padStart(2, "0")}-${name}`
    await page.screenshot({ path: `${file}.png` })
    writeFileSync(`${file}.txt`, `# ${dev} ${name}\n${await page.evaluate(snapshot)}`)
    console.log(file)
  }
  await ctx.close()
}
await browser.close()
if (failed) process.exit(1)
