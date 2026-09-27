import { describe, expect, it } from "vitest"
import { captureInstallPrompt, hasInstallPrompt, promptInstall } from "./pwa"

class FakeInstallPrompt extends Event {
  prompted = false
  outcome: "accepted" | "dismissed" = "accepted"
  async prompt(): Promise<void> {
    this.prompted = true
  }
  get userChoice(): Promise<{ outcome: "accepted" | "dismissed" }> {
    return Promise.resolve({ outcome: this.outcome })
  }
}

function setup(outcome: "accepted" | "dismissed" = "accepted") {
  const target = new EventTarget()
  captureInstallPrompt(target)
  const event = new FakeInstallPrompt("beforeinstallprompt", {
    cancelable: true,
  })
  event.outcome = outcome
  return { target, event }
}

describe("install prompt", () => {
  it("reports no prompt before the browser fires one", async () => {
    captureInstallPrompt(new EventTarget())
    expect(hasInstallPrompt()).toBe(false)
    await expect(promptInstall()).resolves.toBe(false)
  })

  it("captures the event and resolves true when accepted", async () => {
    const { target, event } = setup("accepted")
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(hasInstallPrompt()).toBe(true)
    await expect(promptInstall()).resolves.toBe(true)
    expect(event.prompted).toBe(true)
    expect(hasInstallPrompt()).toBe(false)
  })

  it("resolves false when dismissed", async () => {
    const { target, event } = setup("dismissed")
    target.dispatchEvent(event)
    await expect(promptInstall()).resolves.toBe(false)
  })
})
