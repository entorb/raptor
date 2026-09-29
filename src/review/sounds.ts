// Dev-only sound review page (/raptor/review/sounds.html): generated sfx and songs next to the
// archived originals (original_game/audio, if present).
import { FX, pitchRate, SFX_FILES, SONG_FILES, WAVE_SONGS } from "../game/audio/audio"
import { initFilter, waveVisible } from "./filter"

const ORIG = import.meta.glob("../../original_game/audio/**/*.ogg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>
const BASE = import.meta.env.BASE_URL

const main = document.getElementById("main") as HTMLElement
const nav = document.getElementById("nav") as HTMLElement

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (text) e.textContent = text
  return e
}

function player(url: string | undefined): HTMLElement {
  if (!url) return el("span", "–")
  const a = el("audio")
  a.controls = true
  a.preload = "none"
  a.src = url
  return a
}

function table(id: string, title: string, head: string[]): HTMLTableSectionElement {
  const h = el("h2", title)
  h.id = id
  const link = el("a", title)
  link.href = `#${id}`
  nav.append(link)
  const t = el("table")
  const tr = el("tr")
  for (const c of head) tr.append(el("th", c))
  t.append(el("thead"), el("tbody"))
  t.tHead?.append(tr)
  main.append(h, t)
  return t.tBodies[0] as HTMLTableSectionElement
}

function row(body: HTMLTableSectionElement, cells: (string | HTMLElement)[]): HTMLElement {
  const tr = el("tr")
  for (const c of cells) {
    const td = el("td")
    td.append(c)
    tr.append(td)
  }
  body.append(tr)
  return tr
}

/** Play like Audio.play: DMX pitch -> playback rate (pitch shifts), FX volume 0..127. */
function eventButton(file: string, name: string, pitch: number, vol: number): HTMLElement {
  const b = el("button", name)
  b.title = `pitch ${pitch}, volume ${vol}`
  b.style.margin = "2px"
  b.addEventListener("click", () => {
    const a = new Audio(`${BASE}assets/sfx/${file}.ogg`)
    a.preservesPitch = false
    a.playbackRate = pitchRate(pitch)
    a.volume = vol / 127
    void a.play()
  })
  return b
}

{
  const body = table("sfx", "Sound effects", ["Sample", "New", "Original", "Game events"])
  for (const f of SFX_FILES) {
    const events = el("div")
    for (const [name, [file, pitch, vol]] of Object.entries(FX))
      if (file === f) events.append(eventButton(f, name, pitch, vol))
    row(body, [
      f,
      player(`${BASE}assets/sfx/${f}.ogg`),
      player(ORIG[`../../original_game/audio/sfx/${f}.ogg`]),
      events,
    ])
  }
}

const waveRows: [HTMLElement, number[]][] = []

{
  const body = table("music", "Music", ["Song", "Used for", "New", "Original"])
  const use: Record<string, string> = {
    mainmenu: "Main menu",
    hangar: "Hangar / shop",
    rap5: "Ship destroyed (plays once)",
    fanfare: "Mission won (plays once)",
  }
  for (const s of SONG_FILES) {
    const waves = WAVE_SONGS.flatMap((w, i) => (w === s ? [i + 1] : []))
    const used = use[s] ?? (waves.length ? `Wave ${waves.join(", ")}` : "")
    const tr = row(body, [
      s,
      used,
      player(`${BASE}assets/music/${s}.ogg`),
      player(ORIG[`../../original_game/audio/music/${s}.ogg`]),
    ])
    // menu / hangar / death songs play in every sector and wave
    if (!use[s] && waves.length) waveRows.push([tr, waves])
  }
}

// sector / wave filter: wave songs only (sfx are not bound to a wave)
initFilter((f) => {
  for (const [tr, waves] of waveRows) tr.hidden = !waves.some((w) => waveVisible(f, w - 1))
})
