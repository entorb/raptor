import { AUTO, Game, Scale, type Types } from "phaser"
import { PLAY } from "./data/playfield"
import { Boot } from "./scenes/Boot"
import { Game as MainGame } from "./scenes/Game"
import { Hangar } from "./scenes/Hangar"
import { Menu } from "./scenes/Menu"
import { Shop } from "./scenes/Shop"

const config: Types.Core.GameConfig = {
  type: AUTO,
  width: PLAY.w,
  height: PLAY.h,
  parent: "game-container",
  backgroundColor: "#05060d",
  fullscreenTarget: "app",
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },
  dom: { createContainer: true },
  input: {
    activePointers: 3,
  },
  scene: [Boot, Menu, Hangar, Shop, MainGame],
}

const StartGame = (parent: string) => {
  return new Game({ ...config, parent })
}

export default StartGame
