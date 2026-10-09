// Sound effects (FX.C SND_Setup table) and music (WINDOWS.C songsg1) on Phaser's Web Audio.
import { type Scene, Sound } from "phaser"
import type { Sector } from "../data/save"
import type { Fx } from "../sim/consts"
import type { SfxEvent } from "../sim/world"

/** Extracted samples (public/assets/sfx/<key>.ogg). */
export const SFX_FILES = [
  "explo",
  "explo2",
  "bonus",
  "crash",
  "flyby",
  "egrab",
  "gexplo",
  "gun",
  "laser",
  "missle",
  "swep",
  "turret",
  "warn",
  "boss",
  "hit",
  "eshot",
  "mon1",
] as const
type SfxFile = (typeof SFX_FILES)[number]

/** Songs (public/assets/music/<key>.ogg). */
export const SONG_FILES = [
  "mainmenu",
  "hangar",
  "bravo1",
  "bravo2",
  "bravo3",
  "bravo4",
  "bravo5",
  "bravo6",
  "bravo7",
  "bravo8",
  "bravo9",
  "train1",
  "train2",
  "train3",
  "train4",
  "train5",
  "rap5",
  "fanfare",
] as const
export type Song = (typeof SONG_FILES)[number]

/** Music per sector wave: one theme per sector, one song per wave (web change: DOS songsg1 reused songs). */
export const WAVE_SONGS: Record<Sector, Song[]> = {
  bravo: ["bravo1", "bravo2", "bravo3", "bravo4", "bravo5", "bravo6", "bravo7", "bravo8", "bravo9"],
  train: ["train1", "train2", "train3", "train4", "train5"],
}

/** FX.C SND_Setup: sample, DMX pitch (128 = normal) and volume (0..127). */
export const FX: Record<Fx, [SfxFile, number, number]> = {
  AIREXPLO: ["explo", 128, 127],
  AIREXPLO2: ["explo2", 128, 127],
  BONUS: ["bonus", 128, 127],
  CRASH: ["crash", 128, 127],
  FLYBY: ["flyby", 120, 127],
  EGRAB: ["egrab", 128, 40],
  GEXPLO: ["gexplo", 128, 127],
  GUN: ["gun", 125, 30],
  LASER: ["laser", 120, 50],
  MISSLE: ["missle", 120, 50],
  SWEP: ["swep", 128, 127],
  TURRET: ["turret", 128, 60],
  WARNING: ["warn", 128, 100],
  BOSS1: ["boss", 127, 127],
  ENEMYSHOT: ["eshot", 100, 50],
  ENEMYLASER: ["laser", 70, 120],
  ENEMYMISSLE: ["missle", 140, 55],
  ENEMYPLASMA: ["eshot", 127, 127],
  SHIT: ["hit", 132, 127],
  HIT: ["gun", 214, 100],
  NOSHOOT: ["eshot", 254, 40],
  PULSE: ["eshot", 100, 50],
  MONKEY: ["mon1", 128, 127],
}

/** Voices per sample; a new one cuts off the oldest (DOS FX.C mixed 2..8 channels in total). */
export const MAX_VOICES = 4

const SND_CLOSE = 40
const SND_FAR = 500

/** apodmx/DMX.C: ((pitch - 128) * 2400) / 128 cents. */
export function pitchRate(pitch: number): number {
  return 2 ** (((pitch - 128) * 2400) / 128 / 1200)
}

/** FX.C SND_3DPatch distance volume (0..127) and pan (-1..1). */
export function spatial(
  x: number,
  y: number,
  pcx: number,
  pcy: number,
): { vol: number; pan: number } {
  const dxs = x - pcx
  const xpos = Math.max(1, Math.min(255, 127 + dxs))
  const dx = Math.abs(dxs)
  const dy = Math.abs(y - pcy)
  const dist = dx + dy - Math.trunc(Math.min(dx, dy) / 2)
  let vol = 127
  if (dist > SND_FAR) vol = 1
  else if (dist >= SND_CLOSE)
    vol = 127 - Math.trunc(((dist - SND_CLOSE) * 127) / (SND_FAR - SND_CLOSE))
  return { vol, pan: (xpos - 128) / 127 }
}

/** Menu sounds: sample, playback rate, volume. */
type UiSfx = "move" | "confirm" | "back" | "charge"
const UI_SFX: Record<UiSfx, [SfxFile, number, number]> = {
  move: ["gun", 2.2, 0.12],
  confirm: ["bonus", 1.2, 0.3],
  back: ["swep", 0.8, 0.25],
  charge: ["bonus", 1.6, 0.2],
}

export class Audio {
  private readonly manager: Sound.WebAudioSoundManager | null
  private song: Sound.BaseSound | null = null
  private songKey: Song | null = null
  private queued: [Scene, Song] | null = null
  private boss: Sound.BaseSound | null = null
  private readonly voices = new Map<SfxFile, Sound.BaseSound[]>()
  musicVolume = 0.6
  sfxVolume = 0.8

  constructor(manager: Sound.BaseSoundManager) {
    // no Ogg Vorbis (iOS < 17 Safari): the loader skips every sample, so stay silent
    const ogg = manager.game.device.audio.ogg
    this.manager = ogg && manager instanceof Sound.WebAudioSoundManager ? manager : null
  }

  /** Play one frame of sim sound events (player position for 3D sounds). */
  play(events: SfxEvent[], pcx: number, pcy: number): void {
    if (!this.manager || this.sfxVolume <= 0) return
    for (const e of events) {
      const def = FX[e.fx]
      if (!def) continue
      const [file, pitch, v] = def
      let vol = v / 127
      let pan = 0
      if (e.x !== null && e.y !== null) {
        const s = spatial(e.x, e.y, pcx, pcy)
        vol = (vol * s.vol) / 127
        pan = s.pan
      }
      this.voice(this.manager, file).play({
        volume: vol * this.sfxVolume,
        rate: pitchRate(pitch + e.rnd),
        pan,
      })
    }
  }

  /** A one-shot sound for `file` (destroyed when done), within MAX_VOICES of that sample. */
  private voice(manager: Sound.WebAudioSoundManager, file: SfxFile): Sound.BaseSound {
    const list = this.voices.get(file) ?? []
    this.voices.set(file, list)
    if (list.length >= MAX_VOICES) list[0]?.destroy()
    const s = manager.add(`sfx-${file}`)
    list.push(s)
    s.once(Sound.Events.DESTROY, () => list.splice(list.indexOf(s), 1))
    s.once(Sound.Events.COMPLETE, () => s.destroy())
    return s
  }

  /** FX_BOSS1 is re-triggered while not playing (ENEMY_Think boss_sound). */
  bossLoop(on: boolean): void {
    if (!this.manager) return
    if (on && !this.boss?.isPlaying) {
      this.boss?.destroy()
      this.boss = this.manager.add("sfx-boss", { volume: this.sfxVolume, rate: pitchRate(127) })
      this.boss.play()
    } else if (!on && this.boss) {
      this.boss.stop()
      this.boss.destroy()
      this.boss = null
    }
  }

  /** Switch music; songs not loaded yet are fetched on demand through `scene`'s loader. */
  playSong(scene: Scene, key: Song | null, loop = true): void {
    if (!this.manager || key === this.songKey) return
    // a one-shot jingle (death, fanfare) finishes before the next looping song starts
    const jingle = this.song
    if (loop && key && jingle?.isPlaying && !(jingle as Sound.WebAudioSound).loop) {
      if (!this.queued) jingle.once("complete", () => this.queued && this.playSong(...this.queued))
      this.queued = [scene, key]
      return
    }
    this.queued = null
    this.song?.stop()
    this.song?.destroy()
    this.song = null
    this.songKey = key
    if (!key) return
    const cacheKey = `music-${key}`
    const start = () => {
      if (this.songKey !== key || !this.manager) return
      this.song = this.manager.add(cacheKey, { loop, volume: this.musicVolume })
      this.song.play()
    }
    if (scene.cache.audio.exists(cacheKey)) start()
    else {
      scene.load.audio(cacheKey, `assets/music/${key}.ogg`)
      scene.load.once(`filecomplete-audio-${cacheKey}`, start)
      // failed load or scene left before it finished: forget the key so the next call retries
      const retry = () => {
        if (this.songKey === key && !this.song) this.songKey = null
      }
      // the batch "complete" also fires after a failed file; a started song makes it a no-op
      scene.load.once("complete", retry)
      scene.events.once("shutdown", retry)
      scene.load.start()
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v
    if (this.song instanceof Sound.WebAudioSound) this.song.setVolume(v)
  }

  /** Menu feedback (web addition): cursor move, confirm, back; shield recharge blip. */
  ui(kind: UiSfx): void {
    if (!this.manager || this.sfxVolume <= 0) return
    const [file, rate, vol] = UI_SFX[kind]
    this.voice(this.manager, file).play({ volume: vol * this.sfxVolume, rate })
  }

  stopAll(): void {
    this.bossLoop(false)
  }
}

let instance: Audio | null = null
export function initAudio(manager: Sound.BaseSoundManager): Audio {
  instance = new Audio(manager)
  return instance
}
export function getAudio(): Audio {
  if (!instance) throw new Error("audio not initialized")
  return instance
}
