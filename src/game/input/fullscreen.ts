import type { Scene } from "phaser"
import { isInstalled } from "../pwa"

// iOS Safari (iPhone) has no Fullscreen API for canvas/div, so the button would
// be a dead no-op there. Hide it wherever the browser can't fulfil the request.
function fullscreenAvailable(scene: Scene): boolean {
  return scene.scale.fullscreen.available
}

/** No Fullscreen API (iPhone) and not installed: the Home Screen app is the way to fullscreen. */
export function fullscreenNeedsInstall(scene: Scene): boolean {
  return !fullscreenAvailable(scene) && !isInstalled()
}

export function toggleFullscreen(scene: Scene): void {
  if (!fullscreenAvailable(scene)) return
  const scale = scene.scale
  if (scale.isFullscreen) scale.stopFullscreen()
  else scale.startFullscreen()
}
