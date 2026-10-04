// Promo screenshot: in-game action (attract demo) with the game title on top.
//
//   pnpm dev   # then:
//   node scripts/gen_promo.mjs [--url=...] [--demo=0] [--seconds=40] [--scale=2] [--count=5] [--at=34]
//
// Plays the demo, samples the sim every second and keeps the frame with the most action
// (enemies on screen + shots + explosions). Writes promo/raptor-promo-<n>.jpg (--count=5 alternatives,
// 960x600 x scale). --at=<s> skips sampling and writes promo/raptor-promo.jpg at that second.
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const arg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const URL = arg("url") ?? "http://localhost:5173/raptor/"
const DEMO = Number(arg("demo") ?? 0)
const SECONDS = Number(arg("seconds") ?? 40)
const SCALE = Number(arg("scale") ?? 2)
const COUNT = Number(arg("count") ?? 5)
const AT = arg("at") && Number(arg("at"))
const OUT = "promo"

/** In-page: action score of the current sim frame. */
function score() {
  const w = window.__game.scene.getScene("Game").world
  return w.enemies.onscreen.length * 3 + w.eshots.length + w.shots.length + w.anims.length * 2
}

/** In-page: freeze the game, hide HUD texts, overlay the title. */
function stage() {
  const s = window.__game.scene.getScene("Game")
  s.scene.pause()
  const hide = (o) => {
    if (o.type === "Text") o.setVisible(false)
    if (o.list) for (const c of o.list) hide(c)
  }
  for (const o of s.children.list) hide(o)
  // level flight (bank frame 3 of 0..6), bottom center
  s.player.setFrame("3").setPosition(480, 470)
  s.playerGlow.setPosition(480, 470 + 44)
  s.shieldFx.setPosition(480, 470)
  const c = document.querySelector("canvas")
  const r = c.getBoundingClientRect()
  const div = document.createElement("div")
  div.id = "promo"
  div.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;
    font-family:'Segoe UI',system-ui,sans-serif;color:#fff;text-align:center;
    background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0) 35%,rgba(0,0,0,0) 80%,rgba(0,0,0,.5))`
  div.innerHTML = `<div style="margin-top:${r.height * 0.05}px;font-size:${r.height * 0.16}px;font-weight:900;letter-spacing:.08em;
      text-shadow:0 0 ${r.height * 0.03}px #ff8a00,0 0 ${r.height * 0.06}px #ff3d00">RAPTOR</div>
    <div style="font-size:${r.height * 0.045}px;font-weight:600;letter-spacing:.35em;color:#ffd27a;
      text-shadow:0 0 ${r.height * 0.015}px #000">CALL OF THE VOID</div>
    <div style="position:absolute;bottom:${r.height * 0.04}px;width:100%;font-size:${r.height * 0.035}px;
      letter-spacing:.1em;text-shadow:0 0 6px #000">Free OpenSource game</div>`
  document.body.append(div)
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const ctx = await browser.newContext({
  viewport: { width: 960, height: 600 },
  deviceScaleFactor: SCALE,
})
await ctx.route("**/web-stats-json.php**", (r) => r.fulfill({ json: { accesscounts: 1 } }))
const page = await ctx.newPage()
page.on("pageerror", (e) => console.error(e))
await page.goto(URL, { waitUntil: "load" })
await page.waitForFunction(() => window.__game?.scene.getScene("Menu")?.sys.isActive())
await page.evaluate((demo) => {
  window.__game.scene.getScenes(true)[0].scene.start("Game", { demo })
}, DEMO)
await page.waitForFunction(() => window.__game.scene.getScene("Game")?.world)

// sample once per second; the COUNT best moments (>= 3 s apart) become alternatives
const samples = AT ? [{ t: AT, s: 0 }] : []
const sample = async (t) => {
  await page.waitForTimeout(1000)
  samples.push({ t, s: await page.evaluate(score) })
}
const inOrder = (items, fn) => items.reduce((p, x, i) => p.then(() => fn(x, i)), Promise.resolve())
await inOrder(
  Array.from({ length: AT ? 0 : SECONDS }, (_, i) => i + 1),
  sample,
)
const picks = []
for (const c of samples.toSorted((a, b) => b.s - a.s))
  if (picks.length < COUNT && picks.every((p) => Math.abs(p.t - c.t) >= 3)) picks.push(c)

mkdirSync(OUT, { recursive: true })
const shoot = async ({ t, s }, i) => {
  await page.evaluate((demo) => {
    document.getElementById("promo")?.remove()
    window.__game.scene.getScene("Game").scene.restart({ demo })
  }, DEMO)
  await page.waitForTimeout(t * 1000)
  const clip = await page.evaluate(stage)
  await page.waitForTimeout(200)
  const file = AT ? `${OUT}/raptor-promo.jpg` : `${OUT}/raptor-promo-${i + 1}.jpg`
  writeFileSync(file, await page.screenshot({ clip, type: "jpeg", quality: 80 }))
  console.log(`wrote ${file} (${t}s, score ${s})`)
}
await inOrder(picks, shoot)
await browser.close()
