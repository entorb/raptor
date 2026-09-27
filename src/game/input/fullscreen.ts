import type { Scene } from "phaser"

// iOS Safari (iPhone) has no Fullscreen API for canvas/div, so the button would
// be a dead no-op there. Hide it wherever the browser can't fulfil the request.
function fullscreenAvailable(scene: Scene): boolean {
  return scene.scale.fullscreen.available
}

export function toggleFullscreen(scene: Scene): void {
  if (!fullscreenAvailable(scene)) return
  const scale = scene.scale
  if (scale.isFullscreen) scale.stopFullscreen()
  else scale.startFullscreen()
}
