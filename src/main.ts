import type { Game as PhaserGame } from "phaser"
import StartGame from "./game/main"
import { captureInstallPrompt } from "./game/pwa"

// iOS < 15.4 has no svh, so #app stays 100vh (the large viewport) and the FIT
// canvas runs behind Safari's toolbar after a portrait→landscape rotation. Size
// it from the visual viewport there.
function fitViewport(game: PhaserGame): void {
  const app = document.getElementById("app")
  if (!app || CSS.supports("height", "100svh") || !window.visualViewport) return
  const apply = () => {
    app.style.height = `${window.visualViewport?.height ?? window.innerHeight}px`
    game.scale.refresh()
  }
  apply()
  game.events.once("ready", apply)
  window.visualViewport.addEventListener("resize", apply)
  window.addEventListener("orientationchange", apply)
}

document.addEventListener("DOMContentLoaded", () => {
  captureInstallPrompt()
  const game = StartGame("game-container")
  fitViewport(game)
  // Dev-only handle for browser debugging (Playwright `page.evaluate`).
  if (import.meta.env.DEV) {
    ;(window as unknown as { __game: unknown }).__game = game
  }
})
