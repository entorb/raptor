import { describe, expect, it, vi } from "vitest"

vi.mock("phaser", () => {
  class FakeSound {
    destroyed = false
    private readonly handlers = new Map<string, () => void>()
    once(ev: string, fn: () => void): void {
      this.handlers.set(ev, fn)
    }
    emit(ev: string): void {
      this.handlers.get(ev)?.()
    }
    play(): boolean {
      return true
    }
    destroy(): void {
      this.destroyed = true
      this.emit("destroy")
    }
  }
  class WebAudioSoundManager {
    game = { device: { audio: { ogg: true } } }
    sounds: FakeSound[] = []
    add(): FakeSound {
      const s = new FakeSound()
      this.sounds.push(s)
      return s
    }
  }
  return { Sound: { WebAudioSoundManager, Events: { COMPLETE: "complete", DESTROY: "destroy" } } }
})

const { Sound } = await import("phaser")
const { Audio, MAX_VOICES } = await import("./audio")

describe("Audio.play voice cap", () => {
  it("keeps at most MAX_VOICES of one sample, cutting off the oldest", () => {
    const Mgr = Sound.WebAudioSoundManager as unknown as new () => {
      sounds: { destroyed: boolean; emit(ev: string): void }[]
    }
    const manager = new Mgr()
    const audio = new Audio(manager as never)
    const gun = [{ fx: "GUN", x: null, y: null, rnd: 0 }] as never
    const cut = () => manager.sounds.flatMap((s, i) => (s.destroyed ? [i] : []))
    for (let i = 0; i < MAX_VOICES + 2; i++) audio.play(gun, 0, 0)
    expect(cut()).toEqual([0, 1])
    // a finished voice frees its slot: the next one cuts nobody off
    manager.sounds[5]?.emit("complete")
    audio.play(gun, 0, 0)
    expect(cut()).toEqual([0, 1, 5])
  })

  it("stays silent without Ogg support (iOS < 17: no sample was loaded)", () => {
    const Mgr = Sound.WebAudioSoundManager as unknown as new () => {
      game: { device: { audio: { ogg: boolean } } }
      sounds: unknown[]
    }
    const manager = new Mgr()
    manager.game.device.audio.ogg = false
    const audio = new Audio(manager as never)
    audio.play([{ fx: "GUN", x: null, y: null, rnd: 0 }] as never, 0, 0)
    audio.ui("confirm")
    expect(manager.sounds).toEqual([])
  })
})
