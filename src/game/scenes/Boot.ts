import { Scene } from "phaser"
import { buildTextures } from "../art/textures"
import { initAudio, SFX_FILES } from "../audio/audio"
import { runCampaignSelfCheck } from "../campaign"
import { loadSettings } from "../data/save"

export class Boot extends Scene {
  constructor() {
    super("Boot")
  }

  preload(): void {
    const bar = this.add.rectangle(480, 300, 4, 6, 0x39d0ff).setOrigin(0, 0.5)
    bar.x = 280
    this.load.on("progress", (v: number) => {
      bar.width = 400 * v
    })
    for (const f of SFX_FILES) this.load.audio(`sfx-${f}`, `assets/sfx/${f}.ogg`)
  }

  create(): void {
    if (import.meta.env.DEV) runCampaignSelfCheck()
    buildTextures(this)
    const audio = initAudio(this.sound)
    const s = loadSettings()
    audio.musicVolume = s.music
    audio.sfxVolume = s.sfx
    this.scene.start("Menu")
  }
}
