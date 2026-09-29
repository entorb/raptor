import { type Lang, STRINGS, type StringKey } from "./strings"

const LANG_KEY = "raptor.lang"

function load(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "de" ? "de" : "en"
  } catch {
    return "en"
  }
}

let current: Lang = load()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // storage blocked: the choice lasts for this session only
  }
  if (typeof document !== "undefined") applyDocumentLang()
}

/** Sets `<html lang>` and the static `#rotate` overlay text from index.html. */
export function applyDocumentLang(): void {
  document.documentElement.lang = current
  const set = (sel: string, key: StringKey) => {
    const el = document.querySelector(sel)
    if (el) el.textContent = t(key)
  }
  set(".rotate-title", "rotate.title")
  set(".rotate-sub", "rotate.sub")
}

/** Translate a key, interpolating `{name}` placeholders. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  let text: string = STRINGS[key][current]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}
