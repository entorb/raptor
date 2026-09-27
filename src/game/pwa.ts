// PWA install prompt. Chrome/Android fire `beforeinstallprompt` once the app is
// installable; we stash the event so the Menu's install button can trigger the
// native prompt. iOS Safari never fires it, so the button falls back to the
// manual instructions there.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface InstallPrompt {
  has(): boolean
  prompt(): Promise<boolean>
}

let controller: InstallPrompt | null = null

/** Start listening for `beforeinstallprompt`. Call once at startup. */
export function captureInstallPrompt(target: EventTarget = window): void {
  let deferred: InstallPromptEvent | null = null
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
  })
  controller = {
    has: () => deferred !== null,
    prompt: async () => {
      const event = deferred
      if (!event) return false
      deferred = null
      await event.prompt()
      const choice = await event.userChoice
      return choice.outcome === "accepted"
    },
  }
}

export function hasInstallPrompt(): boolean {
  return controller?.has() ?? false
}

/** Show the native install prompt. Resolves true if the user accepted. */
export function promptInstall(): Promise<boolean> {
  return controller?.prompt() ?? Promise.resolve(false)
}

// Update prompt. The service worker uses registerType "prompt": a new version
// installs in the background and waits until the player accepts it.

/** Look for a newer version. Resolves with its waiting service worker, or null. */
export async function checkForUpdate(): Promise<ServiceWorker | null> {
  const sw = typeof navigator === "undefined" ? undefined : navigator.serviceWorker
  const reg = await sw?.getRegistration().catch(() => undefined)
  if (!sw || !reg) return null
  // vite-plugin-pwa periodic-update recipe: no check offline or while one is installing
  if (navigator.onLine && !reg.installing) await reg.update().catch(() => {})
  const installing = reg.installing
  if (installing && !reg.waiting)
    await new Promise<void>((resolve) => {
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installing") resolve()
      })
    })
  // no controller = first install, nothing to replace
  return sw.controller ? reg.waiting : null
}

/** Activate the waiting service worker (workbox SKIP_WAITING) and reload once it controls the page. */
export function applyUpdate(waiting: ServiceWorker): void {
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  })
  waiting.postMessage({ type: "SKIP_WAITING" })
}
