// Generate all game audio from code (no original samples or songs: license-clean).
//   node scripts/gen-audio.mjs            sfx + music
//   node scripts/gen-audio.mjs sfx        only public/assets/sfx/*.ogg
//   node scripts/gen-audio.mjs music      only public/assets/music/*.ogg
//   node scripts/gen-audio.mjs music rap2 one song
// File names keep the original sample/song keys (audio.ts SFX_FILES / SONG_FILES), so the FX table
// (pitch, volume) still applies. Output is deterministic (seeded).
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { toOgg } from "./lib/ogg.mjs"
import {
  adsr,
  Biquad,
  delay,
  fadeEdges,
  mixInto,
  mtof,
  normalize,
  Osc,
  render,
  reverb,
  rng,
  SR,
  secs,
  softClip,
  wav16,
} from "./lib/synth.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const [what = "all", only] = process.argv.slice(2)

/** Exponential glide a -> b over `len` seconds. */
const glide = (a, b, t, len) => a * (b / a) ** Math.min(1, t / len)

function noiseSrc(seed) {
  const r = rng(seed)
  return () => r() * 2 - 1
}

// ---- sound effects -----------------------------------------------------------------------------
function boom(len, { seed, lpFrom, lpTo, sub, subTo, decay, subDecay, crackle = 0 }) {
  const n = noiseSrc(seed)
  const r = rng(seed + 1)
  const lp = new Biquad("lp", lpFrom, 0.9)
  const lp2 = new Biquad("lp", lpFrom, 0.9)
  const o = new Osc("sine")
  return render(len, (t) => {
    const cut = glide(lpFrom, lpTo, t, len * 0.8)
    lp.set(cut)
    lp2.set(cut)
    const body = lp2.run(lp.run(n())) * Math.exp(-t * decay) * Math.min(1, t / 0.004)
    const thump = o.next(glide(sub, subTo, t, 0.25)) * Math.exp(-t * subDecay)
    const crack = crackle && r() < crackle * Math.exp(-t * 5) ? (r() * 2 - 1) * 0.8 : 0
    return body * 1.4 + thump * 0.9 + crack
  })
}

const SFX = {
  // air explosion
  explo: () =>
    boom(0.9, {
      seed: 1,
      lpFrom: 5000,
      lpTo: 250,
      sub: 110,
      subTo: 38,
      decay: 4.5,
      subDecay: 9,
      crackle: 0.02,
    }),
  // big explosion (boss / large ships): two blasts
  explo2: () => {
    const a = boom(1.6, {
      seed: 2,
      lpFrom: 3500,
      lpTo: 120,
      sub: 80,
      subTo: 28,
      decay: 2.6,
      subDecay: 4,
      crackle: 0.03,
    })
    const b = boom(1.3, {
      seed: 3,
      lpFrom: 2500,
      lpTo: 150,
      sub: 60,
      subTo: 30,
      decay: 3.5,
      subDecay: 6,
    })
    mixInto(a, b, secs(0.14), 0.8)
    return a
  },
  // ground target destroyed: heavy thud + debris
  gexplo: () =>
    boom(0.8, {
      seed: 4,
      lpFrom: 1800,
      lpTo: 200,
      sub: 140,
      subTo: 35,
      decay: 6,
      subDecay: 6,
      crackle: 0.05,
    }),
  // player ship destroyed: blast + metallic ring-out
  crash: () => {
    const b = boom(1.8, {
      seed: 5,
      lpFrom: 3000,
      lpTo: 90,
      sub: 90,
      subTo: 25,
      decay: 2.2,
      subDecay: 3,
      crackle: 0.04,
    })
    const partials = [
      [317, 2.2],
      [523, 3],
      [811, 4],
      [1210, 5.5],
      [1687, 7],
    ]
    const ring = render(1.8, (t) =>
      partials.reduce(
        (s, [f, d]) => s + Math.sin(2 * Math.PI * f * t * (1 - 0.02 * t)) * Math.exp(-t * d),
        0,
      ),
    )
    mixInto(b, ring, 0, 0.18)
    return b
  },
  // enemy passing by: filtered whoosh + engine hum with doppler
  flyby: () => {
    const n = noiseSrc(6)
    const bp = new Biquad("bp", 500, 1.6)
    const eng = new Osc("saw")
    const lp = new Biquad("lp", 600)
    const len = 1.3
    return render(len, (t) => {
      const x = t / len
      const amp = Math.exp(-(((x - 0.45) / 0.2) ** 2))
      bp.set(400 + 2600 * amp)
      const f = x < 0.45 ? 150 : 150 * (1 - (x - 0.45) * 0.5)
      return bp.run(n()) * amp * 1.6 + lp.run(eng.next(f)) * amp * 0.35
    })
  },
  // energy grab beam: rising shimmer with tremolo
  egrab: () => {
    const os = [new Osc("sine"), new Osc("sine"), new Osc("tri")]
    return render(0.7, (t) => {
      const f = glide(300, 1300, t, 0.6)
      const trem = 0.6 + 0.4 * Math.sin(2 * Math.PI * 18 * t)
      const s = os[0].next(f) + os[1].next(f * 1.503) * 0.5 + os[2].next(f * 2.01) * 0.3
      return s * trem * adsr(t, 0.55, 0.03, 1, 1, 0.15)
    })
  },
  // player blaster: short downward zap
  gun: () => {
    const sq = new Osc("square")
    const lp = new Biquad("lp", 5000)
    const n = noiseSrc(7)
    return render(0.14, (t) => {
      const v = lp.run(sq.next(glide(1500, 280, t, 0.1), 0.3))
      return v * Math.exp(-t * 28) + (t < 0.004 ? n() * 0.6 : 0)
    })
  },
  // laser: bright FM sweep
  laser: () => {
    const car = new Osc("saw")
    const mod = new Osc("sine")
    const bp = new Biquad("bp", 2000, 1.2)
    return render(0.45, (t) => {
      const f = glide(2400, 380, t, 0.35)
      const v = car.next(f * (1 + 0.4 * mod.next(f * 0.51)))
      bp.set(f * 1.4)
      return bp.run(v) * 2 * Math.exp(-t * 8) * Math.min(1, t / 0.003)
    })
  },
  // missile launch: hiss + rising rocket tone
  missle: () => {
    const n = noiseSrc(8)
    const bp = new Biquad("bp", 800, 0.9)
    const o = new Osc("saw")
    const lp = new Biquad("lp", 900)
    return render(0.65, (t) => {
      bp.set(glide(700, 3200, t, 0.5))
      const env = Math.min(1, t / 0.015) * Math.exp(-t * 4.5)
      return bp.run(n()) * env * 1.6 + lp.run(o.next(glide(90, 220, t, 0.5))) * env * 0.35
    })
  },
  // special weapon switch: two quick blips
  swep: () =>
    render(0.16, (t) => {
      const f = t < 0.06 ? 900 : 1350
      const tt = t < 0.06 ? t : t - 0.06
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-tt * 45) * Math.min(1, tt / 0.002)
    }),
  // laser turret: electric crackle zap
  turret: () => {
    const o = new Osc("saw")
    const n = noiseSrc(9)
    const bp = new Biquad("bp", 2200, 1.5)
    const r = rng(10)
    let jitter = 0
    return render(0.32, (t, i) => {
      if (i % 90 === 0) jitter = r() * 0.5 - 0.25
      const v = o.next(glide(1100, 700, t, 0.3) * (1 + jitter)) + n() * 0.4
      return bp.run(v) * 2.2 * Math.exp(-t * 11)
    })
  },
  // shield low / warning: two alarm tones
  warn: () => {
    const o = new Osc("square")
    const lp = new Biquad("lp", 2500)
    return render(0.9, (t) => {
      // two 0.2 s beeps, 0.4 s apart (880 Hz, then 660 Hz)
      const tt = t % 0.4
      const env = t < 0.8 && tt < 0.2 ? Math.min(1, tt / 0.01, (0.2 - tt) / 0.02) : 0
      return lp.run(o.next(t < 0.4 ? 880 : 660)) * env * 0.8
    })
  },
  // boss alarm drone (re-triggered while the boss lives)
  boss: () => {
    const os = [new Osc("saw"), new Osc("saw"), new Osc("square")]
    const lp = new Biquad("lp", 400, 1.4)
    const len = 1.8
    const b = render(len, (t) => {
      lp.set(300 + 500 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.1 * t)))
      const v = os[0].next(55) + os[1].next(55.6) + os[2].next(27.5) * 0.7
      const pulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.3 * t)
      return lp.run(v) * pulse * adsr(t, len - 0.25, 0.08, 1, 1, 0.25)
    })
    return b
  },
  // shield hit: metallic ping + noise tick
  hit: () => {
    const n = noiseSrc(11)
    const bp = new Biquad("bp", 3200, 2)
    return render(0.26, (t) => {
      const ring = Math.sin(2 * Math.PI * 1850 * t) * 0.5 + Math.sin(2 * Math.PI * 2790 * t) * 0.35
      return bp.run(n()) * 1.5 * Math.exp(-t * 45) + ring * Math.exp(-t * 16)
    })
  },
  // enemy shot: soft descending pew
  eshot: () => {
    const o = new Osc("tri")
    return render(
      0.22,
      (t) => o.next(glide(950, 220, t, 0.18)) * Math.exp(-t * 16) * Math.min(1, t / 0.003),
    )
  },
  // alien creature chatter (DOS FX_MONKEY)
  mon1: () => {
    const car = new Osc("sine")
    const mod = new Osc("sine")
    return render(0.7, (t) => {
      const f = glide(500, 900, t, 0.5) * (1 + 0.25 * Math.sin(2 * Math.PI * 13 * t))
      const v = car.next(f * (1 + 0.6 * mod.next(f * 1.5)))
      const chop = 0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * 9 * t))
      return v * chop * adsr(t, 0.55, 0.01, 1, 1, 0.15)
    })
  },
  // pickup: rising bell arpeggio
  bonus: () => {
    const out = new Float32Array(secs(0.55))
    ;[84, 88, 91, 96].forEach((m, k) => {
      const f = mtof(m)
      const note = render(0.4, (t) => {
        const v = Math.sin(
          2 * Math.PI * f * t + 1.5 * Math.exp(-t * 6) * Math.sin(2 * Math.PI * f * 3.5 * t),
        )
        return v * Math.exp(-t * 9) * Math.min(1, t / 0.002)
      })
      mixInto(out, note, secs(k * 0.05), 0.6)
    })
    return out
  },
}

/** Steady tones sound much louder than noise bursts at the same peak. */
const SFX_GAIN = { warn: 0.55, mon1: 0.6, swep: 0.7, egrab: 0.75, boss: 0.8 }

function genSfx() {
  const dir = join(ROOT, "public/assets/sfx")
  mkdirSync(dir, { recursive: true })
  for (const [name, fn] of Object.entries(SFX)) {
    if (only && only !== name) continue
    const b = fn()
    normalize([b], 0.92 * (SFX_GAIN[name] ?? 1))
    fadeEdges(b)
    toOgg(wav16([b]), join(dir, `${name}.ogg`), "4")
    process.stdout.write(`${name} `)
  }
  console.log(`\nwrote sfx to ${dir}`)
}

// ---- music -------------------------------------------------------------------------------------
const MODES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
}

/** Scale degree (any integer) -> semitones above the root. */
function degree(mode, d) {
  const n = mode.length
  const o = Math.floor(d / n)
  return mode[((d % n) + n) % n] + 12 * o
}

// instruments: (freq, dur, vel) -> Float32Array (mono)
const INST = {
  pad: (f, dur, vel, seed) => {
    const r = rng(seed)
    const os = [0, 1, 2].map(() => new Osc("saw", r()))
    const det = [1, 1.0045, 0.9962]
    const lp = new Biquad("lp", 1400, 0.8)
    return render(dur + 1.2, (t) => {
      lp.set(900 + 500 * Math.sin(2 * Math.PI * 0.25 * t))
      const v = os.reduce((s, o, k) => s + o.next(f * det[k]), 0) / 3
      return lp.run(v) * vel * adsr(t, dur, 0.5, 1, 1, 1.2)
    })
  },
  bass: (f, dur, vel) => {
    const a = new Osc("saw")
    const b = new Osc("square")
    const lp = new Biquad("lp", 400, 1.1)
    return render(dur + 0.08, (t) => {
      lp.set(180 + 1600 * Math.exp(-t * 14) * vel)
      return lp.run(a.next(f) + b.next(f / 2) * 0.6) * vel * adsr(t, dur, 0.004, 0.25, 0.75, 0.06)
    })
  },
  pluck: (f, dur, vel) => {
    const o = new Osc("square")
    const lp = new Biquad("lp", 3000, 1.3)
    return render(Math.min(dur, 0.3) + 0.25, (t) => {
      lp.set(350 + 3800 * Math.exp(-t * 18))
      return lp.run(o.next(f, 0.3)) * vel * Math.exp(-t * 7) * Math.min(1, t / 0.002)
    })
  },
  lead: (f, dur, vel) => {
    const a = new Osc("saw")
    const b = new Osc("saw", 0.3)
    const lp = new Biquad("lp", 2600, 1)
    return render(dur + 0.3, (t) => {
      const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.4)
      return (
        lp.run(a.next(f * vib * 1.003) + b.next(f * vib * 0.997)) *
        0.5 *
        vel *
        adsr(t, dur, 0.02, 0.4, 0.7, 0.25)
      )
    })
  },
  // bugle / trumpet: pitch scoop into the note, filter opens with the breath
  brass: (f, dur, vel) => {
    const a = new Osc("saw")
    const b = new Osc("saw", 0.5)
    const lp = new Biquad("lp", 1000, 1.2)
    return render(dur + 0.25, (t) => {
      const scoop = 1 - 0.02 * Math.exp(-t * 40)
      const vib = 1 + 0.005 * Math.sin(2 * Math.PI * 5 * t) * Math.min(1, Math.max(0, t - 0.3))
      lp.set(700 + 3300 * Math.min(1, t / 0.05) * (0.75 + 0.25 * Math.exp(-t * 6)))
      return (
        lp.run(a.next(f * scoop * vib) + b.next(f * scoop * vib * 1.004)) *
        0.5 *
        vel *
        adsr(t, dur, 0.015, 0.2, 0.8, 0.15)
      )
    })
  },
  bell: (f, dur, vel) =>
    render(Math.max(dur, 0.6) + 1, (t) => {
      const v = Math.sin(
        2 * Math.PI * f * t + 1.8 * Math.exp(-t * 3) * Math.sin(2 * Math.PI * f * 3.5 * t),
      )
      return v * vel * Math.exp(-t * 2.2) * Math.min(1, t / 0.003)
    }),
  kick: (_f, _d, vel) => {
    const o = new Osc("sine")
    return render(
      0.45,
      (t) => Math.tanh(o.next(glide(160, 42, t, 0.12)) * 1.6) * vel * Math.exp(-t * 7),
    )
  },
  snare: (_f, _d, vel, seed) => {
    const n = noiseSrc(seed)
    const bp = new Biquad("hp", 900)
    const o = new Osc("tri")
    return render(
      0.3,
      (t) =>
        (bp.run(n()) * Math.exp(-t * 18) +
          o.next(glide(240, 170, t, 0.05)) * Math.exp(-t * 25) * 0.6) *
        vel,
    )
  },
  hat: (_f, dur, vel, seed) => {
    const n = noiseSrc(seed)
    const hp = new Biquad("hp", 7500)
    const d = dur > 0.1 ? 9 : 45
    return render(dur > 0.1 ? 0.35 : 0.08, (t) => hp.run(n()) * vel * Math.exp(-t * d))
  },
  crash: (_f, _d, vel, seed) => {
    const n = noiseSrc(seed)
    const hp = new Biquad("hp", 4500)
    return render(2.2, (t) => hp.run(n()) * vel * Math.exp(-t * 2.2))
  },
}

/** Mixer settings per instrument: gain, pan (-1..1), reverb send, delay send, kick ducking. */
const BUS = {
  pad: { gain: 0.32, pan: 0, rev: 0.45, dly: 0, duck: 0.5, wide: true },
  bass: { gain: 0.5, pan: 0, rev: 0, dly: 0, duck: 0.45 },
  pluck: { gain: 0.2, pan: 0.25, rev: 0.25, dly: 0.35, duck: 0.3 },
  lead: { gain: 0.26, pan: -0.08, rev: 0.35, dly: 0.25, duck: 0 },
  brass: { gain: 0.3, pan: 0, rev: 0.4, dly: 0, duck: 0 },
  bell: { gain: 0.24, pan: -0.2, rev: 0.45, dly: 0.3, duck: 0 },
  kick: { gain: 0.75, pan: 0, rev: 0, dly: 0, duck: 0 },
  snare: { gain: 0.4, pan: 0.05, rev: 0.25, dly: 0, duck: 0 },
  hat: { gain: 0.14, pan: 0.3, rev: 0.05, dly: 0, duck: 0 },
  crash: { gain: 0.16, pan: -0.25, rev: 0.2, dly: 0, duck: 0 },
}

// 16th-step patterns per bar
const DRUMS = {
  four: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], open: true },
  break: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  half: { kick: [0, 11], snare: [8], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  drive: {
    kick: [0, 3, 8, 11],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  march: { kick: [0, 8], snare: [4, 7, 12, 14, 15], hat: [] },
}
const BASS = {
  eighth: [0, 2, 4, 6, 8, 10, 12, 14],
  offbeat: [2, 6, 10, 14],
  syncop: [0, 3, 6, 8, 11, 14],
  gallop: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  long: [0],
}
// lead rhythms over 2 bars (32 steps): [step, length]
const RHYTHMS = [
  [
    [0, 6],
    [6, 2],
    [8, 4],
    [12, 4],
    [16, 6],
    [22, 2],
    [24, 8],
  ],
  [
    [0, 3],
    [3, 3],
    [6, 2],
    [8, 8],
    [16, 4],
    [20, 4],
    [24, 4],
    [28, 4],
  ],
  [
    [0, 8],
    [8, 4],
    [12, 2],
    [14, 2],
    [16, 12],
    [28, 2],
    [30, 2],
  ],
  [
    [2, 2],
    [4, 4],
    [8, 2],
    [10, 6],
    [16, 2],
    [18, 2],
    [20, 4],
    [24, 8],
  ],
]

/** Lead motif: rhythm + scale-degree contour (re-fitted to each chord when played). */
function makeMotif(r) {
  const rh = RHYTHMS[Math.floor(r() * RHYTHMS.length)]
  let d = Math.floor(r() * 3) * 2
  return rh.map(([s, l], k) => {
    if (k) d += [-2, -1, -1, 1, 1, 2, 3, -3][Math.floor(r() * 8)]
    d = Math.max(-2, Math.min(9, d))
    return [s, l, d]
  })
}

function padPart(c, ch, bar, left) {
  const len = Math.min(2, left) * 16
  for (const n of ch) c.add("pad", bar, 0, len, c.spec.root + 12 + n, 0.7)
}

function bassPart(c, ch, bar) {
  const { spec } = c
  BASS[spec.bass].forEach((s, k, a) => {
    const len = (a[k + 1] ?? 16) - s
    const oct = spec.bass === "eighth" && k % 4 === 3 ? 12 : 0
    c.add(
      "bass",
      bar,
      s,
      Math.max(1, len - 0.3),
      spec.root - 12 + ch[0] + oct,
      s % 4 === 0 ? 1 : 0.8,
    )
  })
}

function arpPart(c, ch, bar) {
  const { spec, r } = c
  const pool = [...ch.map((n) => n + 24), ...ch.map((n) => n + 36)]
  for (let s = 0; s < 16; s++) {
    let n
    if (spec.arp === "random") n = pool[Math.floor(r() * pool.length)]
    else if (spec.arp === "updown") n = pool[[0, 1, 2, 3, 4, 5, 4, 3, 2, 1][(bar * 16 + s) % 10]]
    else n = pool[s % pool.length]
    c.add("pluck", bar, s, 1, spec.root + n - 12, s % 4 === 0 ? 0.9 : 0.6)
  }
}

/** Lead phrase (8 bars: A A B A) over the next `left` (max 2) bars. */
function leadPart(c, cd, bar, left) {
  const { spec, mode } = c
  const m = c.motifs[Math.floor((bar % 8) / 2) === 2 ? 1 : 0]
  for (const [s, l, d] of m) {
    const b2 = bar + Math.floor(s / 16)
    if (b2 >= bar + Math.min(2, left)) continue
    // snap strong steps to a chord tone of that bar
    const cdb = c.chordAt(b2)
    let dd = cd + d
    if (s % 8 === 0) {
      const opts = [cdb, cdb + 2, cdb + 4, cdb + 7, cdb + 9]
      dd = opts.reduce((best, o) => (Math.abs(o - dd) < Math.abs(best - dd) ? o : best), opts[0])
    }
    c.add(
      spec.leadInst,
      b2,
      s % 16,
      l,
      spec.root + 12 * spec.leadOct + degree(mode, dd),
      s % 8 === 0 ? 1 : 0.85,
    )
  }
}

function drumsPart(c, bar, fill) {
  const p = DRUMS[c.spec.drums]
  for (const s of p.kick) c.add("kick", bar, s, 1, 0, 1)
  for (const s of p.snare) if (!(fill && s >= 12)) c.add("snare", bar, s, 1, 0, 0.9)
  if (fill) for (let s = 12; s < 16; s++) c.add("snare", bar, s, 1, 0, 0.4 + (s - 12) * 0.15)
  for (const s of p.hat)
    c.add("hat", bar, s, p.open && s % 4 === 2 ? 2 : 1, 0, s % 4 === 2 ? 0.8 : 0.5)
}

/** Bar `b` (of `bars`) of section `si`; `has(part)` tells which parts the section plays. */
function composeBar(c, has, si, bars, b, bar) {
  const { spec } = c
  const cd = c.chordAt(bar)
  const ch = [0, 2, 4].map((k) => degree(c.mode, cd + k))
  if (has("pad") && b % 2 === 0) padPart(c, ch, bar, bars - b)
  if (has("bass")) bassPart(c, ch, bar)
  if (has("arp") && spec.arp) arpPart(c, ch, bar)
  if ((has("lead") || has(spec.leadInst)) && b % 2 === 0) leadPart(c, cd, bar, bars - b)
  if (has("drums")) drumsPart(c, bar, b === bars - 1 && si < spec.sections.length - 1)
  else if (has("hats")) for (const s of [2, 6, 10, 14]) c.add("hat", bar, s, 1, 0, 0.5)
}

/**
 * Compose one song into note events.
 * spec: { seed, bpm, root (MIDI), mode, prog (degree per bar), sections: [[bars, "parts"]],
 *         drums, bass, arp ("up"|"updown"|"random"|null), leadInst, leadOct }
 */
function compose(spec) {
  const r = rng(spec.seed)
  const step = 60 / spec.bpm / 4
  const ev = []
  const c = {
    spec,
    r,
    mode: MODES[spec.mode],
    add: (inst, bar, st, len, midi, vel) =>
      ev.push({ inst, t: (bar * 16 + st) * step, dur: len * step, midi, vel }),
    chordAt: (bar) => spec.prog[bar % spec.prog.length],
    motifs: [makeMotif(r), makeMotif(r)],
  }
  let bar = 0
  spec.sections.forEach(([bars, parts], si) => {
    const has = (p) => parts.split(" ").includes(p)
    if (si > 0 && has("drums")) c.add("crash", bar, 0, 16, 0, 0.8)
    for (let b = 0; b < bars; b++, bar++) composeBar(c, has, si, bars, b, bar)
  })
  // fixed melody [bar, step, len, semitones above root] on brass, doubled an octave down
  for (const [b, st, len, semi] of spec.melody ?? []) {
    c.add("brass", b, st, len, spec.root + semi, 1)
    c.add("brass", b, st, len, spec.root - 12 + semi, 0.6)
  }
  return { ev, length: bar * 16 * step, step }
}

/** Sidechain envelope: every kick pulls the ducked bus down and lets it swell back. */
function duckEnvelope(ev, n) {
  const duck = new Float32Array(n).fill(1)
  for (const e of ev) {
    if (e.inst !== "kick") continue
    const at = secs(e.t)
    for (let i = 0; i < secs(0.25) && at + i < n; i++)
      duck[at + i] = Math.min(duck[at + i], 1 - Math.exp(-i / SR / 0.06))
  }
  return duck
}

/** Fold the reverb tail (samples past `len`) back onto the start so the loop is seamless. */
function wrapTail(L, R, len) {
  const outL = L.slice(0, len)
  const outR = R.slice(0, len)
  for (let i = len; i < L.length; i++) {
    outL[i - len] += L[i]
    outR[i - len] += R[i]
  }
  return [outL, outR]
}

/** Render one note event into the dry, ducked, reverb and delay buses (`seed` varies per voice). */
function mixEvent(e, seed, bus) {
  const cfg = BUS[e.inst]
  const f = mtof(e.midi)
  const at = secs(e.t)
  const voices = cfg.wide ? [-0.7, 0.7] : [cfg.pan]
  for (const pan of voices) {
    const buf = INST[e.inst](cfg.wide ? f * (1 + pan * 0.002) : f, e.dur, e.vel, seed++)
    const g = (cfg.gain / voices.length) * 1.4
    const gl = g * Math.cos(((pan + 1) * Math.PI) / 4)
    const gr = g * Math.sin(((pan + 1) * Math.PI) / 4)
    mixInto(cfg.duck ? bus.duckL : bus.L, buf, at, gl)
    mixInto(cfg.duck ? bus.duckR : bus.R, buf, at, gr)
    if (cfg.rev) mixInto(bus.rev, buf, at, cfg.rev * g)
    if (cfg.dly) mixInto(bus.dly, buf, at, cfg.dly * g)
  }
  return seed
}

/** Render events to a stereo loop (tails wrap to the start) or a one-shot. */
function mixSong({ ev, length, step }, loop) {
  const tail = 3
  const n = secs(length + tail)
  const buses = {
    L: new Float32Array(n),
    R: new Float32Array(n),
    rev: new Float32Array(n),
    dly: new Float32Array(n),
    duckL: new Float32Array(n),
    duckR: new Float32Array(n),
  }
  const { L, R, rev: revS, dly: dlyS, duckL: duckBusL, duckR: duckBusR } = buses
  const duck = duckEnvelope(ev, n)
  let seed = 100
  for (const e of ev) seed = mixEvent(e, seed, buses)
  for (let i = 0; i < n; i++) {
    const d = 1 - 0.4 * (1 - duck[i])
    L[i] += duckBusL[i] * d
    R[i] += duckBusR[i] * d
  }
  const [rl, rr] = reverb(revS)
  const [dl, dr] = delay(dlyS, step * 3, 0.4)
  for (let i = 0; i < n; i++) {
    L[i] += rl[i] + dl[i] * 0.6
    R[i] += rr[i] + dr[i] * 0.6
  }
  const [outL, outR] = loop ? wrapTail(L, R, secs(length)) : [L, R]
  // gentle master saturation: peaks at 1.0 into tanh, then about -1.5 dBFS
  normalize([outL, outR], 1)
  for (const b of [outL, outR]) softClip(b, 1.2)
  normalize([outL, outR], 0.7)
  if (!loop) {
    fadeEdges(outL, 0.002, 1.5)
    fadeEdges(outR, 0.002, 1.5)
  }
  return [outL, outR]
}

const SONGS = {
  // title theme: wide, epic, D minor
  mainmenu: {
    seed: 11,
    bpm: 96,
    root: 50,
    mode: "minor",
    prog: [0, 5, 2, 6],
    sections: [
      [4, "pad arp"],
      [8, "pad arp bass drums"],
      [8, "pad arp bass drums lead"],
      [4, "pad lead hats"],
      [4, "pad arp bass drums lead"],
    ],
    drums: "half",
    bass: "eighth",
    arp: "updown",
    leadInst: "lead",
    leadOct: 1,
  },
  // hangar / shop: laid back, F dorian, bells
  hangar: {
    seed: 12,
    bpm: 88,
    root: 53,
    mode: "dorian",
    prog: [0, 3, 0, 6],
    sections: [
      [4, "pad bell"],
      [8, "pad bell bass hats"],
      [8, "pad bell bass arp hats"],
      [4, "pad bell"],
    ],
    drums: "half",
    bass: "long",
    arp: "up",
    leadInst: "bell",
    leadOct: 1,
  },
  // waves 2, 6: driving breakbeat, E minor
  rap2: {
    seed: 21,
    bpm: 132,
    root: 52,
    mode: "minor",
    prog: [0, 0, 5, 6],
    sections: [
      [4, "arp bass"],
      [8, "arp bass drums"],
      [8, "pad arp bass drums lead"],
      [4, "pad arp hats"],
      [8, "pad arp bass drums lead"],
    ],
    drums: "break",
    bass: "syncop",
    arp: "random",
    leadInst: "lead",
    leadOct: 1,
  },
  // wave 7: dark F# dorian arps
  rap3: {
    seed: 31,
    bpm: 128,
    root: 54,
    mode: "dorian",
    prog: [0, 3, 4, 3],
    sections: [
      [4, "pad arp"],
      [8, "pad arp bass drums"],
      [8, "arp bass drums lead"],
      [4, "pad arp hats"],
      [8, "pad arp bass drums lead"],
    ],
    drums: "four",
    bass: "offbeat",
    arp: "updown",
    leadInst: "lead",
    leadOct: 1,
  },
  // waves 3, 8: heroic C minor
  rap4: {
    seed: 41,
    bpm: 120,
    root: 48,
    mode: "minor",
    prog: [0, 5, 6, 4],
    sections: [
      [4, "pad bass"],
      [8, "pad arp bass drums"],
      [8, "pad arp bass drums lead"],
      [4, "pad lead"],
      [8, "pad arp bass drums lead"],
    ],
    drums: "drive",
    bass: "gallop",
    arp: "up",
    leadInst: "lead",
    leadOct: 1,
  },
  // mission failed / ship destroyed (one-shot): dark A harmonic minor
  rap5: {
    seed: 51,
    bpm: 84,
    root: 45,
    mode: "harmonic",
    prog: [0, 5, 4, 0],
    sections: [[2, "pad bass drums lead"]],
    drums: "half",
    bass: "long",
    arp: null,
    leadInst: "lead",
    leadOct: 1,
    once: true,
  },
  // mission won (one-shot): military bugle fanfare in C, bugle notes only (C G C E G C)
  fanfare: {
    seed: 91,
    bpm: 104,
    root: 60,
    mode: "major",
    prog: [0],
    sections: [
      [3, "pad bass drums"],
      [1, "pad bass drums"],
    ],
    drums: "march",
    bass: "long",
    arp: null,
    leadInst: "lead",
    leadOct: 1,
    once: true,
    // ta-ta-TAA ta-TAA | TAA-ta ta-TAA | ta-ta-TAA ta-ta ta-TAA | TAAA
    melody: [
      [0, 0, 1, 7],
      [0, 1, 1, 7],
      [0, 2, 2, 7],
      [0, 4, 4, 12],
      [0, 8, 3, 7],
      [0, 11, 1, 12],
      [0, 12, 4, 16],
      [1, 0, 6, 19],
      [1, 6, 2, 16],
      [1, 8, 3, 12],
      [1, 11, 1, 16],
      [1, 12, 4, 19],
      [2, 0, 1, 19],
      [2, 1, 1, 19],
      [2, 2, 2, 19],
      [2, 4, 3, 16],
      [2, 7, 1, 12],
      [2, 8, 3, 16],
      [2, 11, 1, 19],
      [2, 12, 4, 16],
      [3, 0, 16, 24],
    ],
  },
  // waves 5, 9: intense G harmonic minor
  rap6: {
    seed: 61,
    bpm: 140,
    root: 55,
    mode: "harmonic",
    prog: [0, 5, 3, 4],
    sections: [
      [4, "arp bass hats"],
      [8, "pad arp bass drums"],
      [8, "pad arp bass drums lead"],
      [4, "pad arp"],
      [12, "pad arp bass drums lead"],
    ],
    drums: "drive",
    bass: "eighth",
    arp: "random",
    leadInst: "lead",
    leadOct: 1,
  },
  // wave 4: mysterious B phrygian, half-time
  rap7: {
    seed: 71,
    bpm: 108,
    root: 47,
    mode: "phrygian",
    prog: [0, 1, 0, 6],
    sections: [
      [4, "pad"],
      [8, "pad bass drums bell"],
      [8, "pad arp bass drums bell"],
      [4, "pad arp"],
      [4, "pad arp bass drums bell"],
    ],
    drums: "half",
    bass: "syncop",
    arp: "random",
    leadInst: "bell",
    leadOct: 1,
  },
  // wave 1: upbeat A minor four-on-the-floor
  rap8: {
    seed: 81,
    bpm: 126,
    root: 45,
    mode: "minor",
    prog: [0, 5, 2, 6],
    sections: [
      [4, "pad arp"],
      [8, "pad arp bass drums"],
      [8, "pad arp bass drums lead"],
      [4, "pad arp hats"],
      [8, "pad arp bass drums lead"],
    ],
    drums: "four",
    bass: "offbeat",
    arp: "up",
    leadInst: "lead",
    leadOct: 1,
  },
}

function genMusic() {
  const dir = join(ROOT, "public/assets/music")
  mkdirSync(dir, { recursive: true })
  for (const [name, spec] of Object.entries(SONGS)) {
    if (only && only !== name) continue
    const song = compose(spec)
    const chans = mixSong(song, !spec.once)
    toOgg(wav16(chans), join(dir, `${name}.ogg`), "2")
    process.stdout.write(`${name} (${song.length.toFixed(0)} s) `)
  }
  console.log(`\nwrote music to ${dir}`)
}

if (what === "all" || what === "sfx") genSfx()
if (what === "all" || what === "music") genMusic()
