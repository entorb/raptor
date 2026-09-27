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
