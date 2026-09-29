// UI strings, English (default) and German. Headers stay English in both: RAPTOR, CALL OF THE VOID,
// HANGAR, SUPPLY SHOP, MISSION BRIEFING; so do the item names (`OBJ_LIB`). Add a key here for any new text.
export type Lang = "en" | "de"

interface Entry {
  en: string
  de: string
}

const e = (en: string, de: string): Entry => ({ en, de })

export const STRINGS = {
  "rotate.title": e("ROTATE YOUR DEVICE", "GERÄT DREHEN"),
  "rotate.sub": e("LANDSCAPE REQUIRED", "QUERFORMAT ERFORDERLICH"),
  "lang.other": e("Deutsch", "English"),

  back: e("Back", "Zurück"),
  ok: e("OK", "OK"),
  on: e("ON", "AN"),
  off: e("OFF", "AUS"),
  wave: e("WAVE", "WELLE"),
  kills: e("kills", "Abschüsse"),

  "sector.bravo": e("BRAVO", "BRAVO"),
  "sector.train": e("TRAINING", "TRAINING"),
  "sector.bravoName": e("BRAVO SECTOR", "SEKTOR BRAVO"),

  "diff.rookie": e("Rookie", "Rekrut"),
  "diff.veteran": e("Veteran", "Veteran"),
  "diff.elite": e("Elite", "Elite"),
  "diff.easy": e("easy", "leicht"),
  "diff.normal": e("normal", "normal"),
  "diff.hard": e("hard", "schwer"),

  "hud.credits": e("CREDITS", "CREDITS"),
  "hud.shield": e("SHIELD", "SCHILD"),
  "hud.phase": e("PHASE", "PHASE"),
  "hud.nova": e("NOVA", "NOVA"),

  "menu.credit": e(
    "A remake of Raptor: Call of the Shadows (1994, Cygnus Studios / Apogee)",
    "Ein Remake von Raptor: Call of the Shadows (1994, Cygnus Studios / Apogee)",
  ),
  "menu.globalMissions": e("Global Missions: {n}", "Missionen weltweit: {n}"),
  "menu.play": e("Play", "Spielen"),
  "menu.options": e("Options", "Optionen"),
  "menu.fullscreen": e("Fullscreen", "Vollbild"),
  "menu.exitFullscreen": e("Exit Fullscreen", "Vollbild beenden"),
  "menu.exit": e("Exit", "Beenden"),
  "menu.newPilot": e("New Pilot", "Neuer Pilot"),
  "menu.fly": e("Fly", "Fliegen"),
  "menu.deletePilot": e("Delete Pilot", "Pilot löschen"),
  "menu.deleteConfirm": e(
    "Delete pilot {name}? This cannot be undone.",
    "Pilot {name} löschen? Das kann nicht rückgängig gemacht werden.",
  ),
  "menu.yesDelete": e("Yes, delete", "Ja, löschen"),
  "menu.newPilotInfo": e("New pilot: {name}", "Neuer Pilot: {name}"),
  "menu.pilotName": e("Pilot name", "Pilotenname"),
  "menu.enterName": e("Enter a name", "Namen eingeben"),
  "menu.nameTaken": e("Name already taken", "Name bereits vergeben"),
  "menu.installHelp": e(
    'Android: menu (3 dots) → "Add to Home screen"\niPhone: Share icon → "Add to Home Screen"',
    'Android: Menü (3 Punkte) → "Zum Startbildschirm hinzufügen"\niPhone: Teilen-Symbol → "Zum Home-Bildschirm"',
  ),
  "menu.updateAvailable": e(
    "A new version of Raptor is available.",
    "Eine neue Version von Raptor ist verfügbar.",
  ),
  "menu.update": e("Update", "Aktualisieren"),
  "menu.updating": e("Updating…", "Aktualisiere…"),
  "menu.skip": e("Skip", "Überspringen"),
  "menu.shieldInfo": e(
    "Shield only recharges while not firing: Auto-Fire blocks regen",
    "Schild lädt nur ohne Feuern auf: Autofeuer verhindert das",
  ),
  "menu.music": e("Music", "Musik"),
  "menu.sfx": e("Sound Effects", "Soundeffekte"),
  "menu.installApp": e("Install", "Installieren"),
  "menu.share": e("Share", "Teilen"),
  "menu.contact": e("Contact", "Kontakt"),
  "menu.home": e("Home", "Startseite"),
  "menu.source": e("Source", "Quellcode"),
  "menu.linkCopied": e("Link copied", "Link kopiert"),

  "hangar.shop": e("Shop", "Shop"),
  "hangar.exit": e("Exit to Main Menu", "Zum Hauptmenü"),
  "hangar.launch": e("LAUNCH", "START"),
  "hangar.replay": e("REPLAY", "WIEDERHOLEN"),
  "hangar.topLine": e(
    "WAVE {wave} · TOP 10 · {flown} flown · {won} won",
    "WELLE {wave} · TOP 10 · {flown} geflogen · {won} gewonnen",
  ),
  "hangar.noRuns": e("No runs yet", "Noch keine Flüge"),

  "shop.buy": e("BUY", "KAUFEN"),
  "shop.sell": e("SELL", "VERKAUFEN"),
  "shop.keys": e(
    "↑↓ select   ←→ buy/sell   Enter confirm   Esc hangar",
    "↑↓ wählen   ←→ kaufen/verkaufen   Enter bestätigen   Esc Hangar",
  ),
  "shop.nothingBuy": e("Nothing for sale.", "Nichts zu verkaufen."),
  "shop.nothingSell": e("Nothing to sell.", "Nichts zum Verkaufen."),
  "shop.onBoard": e("On board: {n}", "An Bord: {n}"),
  "shop.notOnBoard": e("Not on board", "Nicht an Bord"),
  "shop.noRoom": e("No room on the ship", "Kein Platz im Schiff"),
  "shop.purchased": e("Purchased {name}", "{name} gekauft"),
  "shop.noMoney": e("Not enough credits", "Nicht genug Credits"),
  "shop.sold": e("Sold {name}", "{name} verkauft"),

  "desc.forwardGuns": e(
    "Standard twin blasters. Hit air and surface targets.",
    "Standard-Zwillingsblaster. Treffen Luft- und Bodenziele.",
  ),
  "desc.plasmaGuns": e(
    "Heavy plasma bolts, air targets only.",
    "Schwere Plasmageschosse, nur Luftziele.",
  ),
  "desc.microMissle": e(
    "Wing-mounted micro missiles, air and surface.",
    "Mikroraketen an den Flügeln, Luft- und Bodenziele.",
  ),
  "desc.dumbMissle": e(
    "Special: unguided missiles, dropped then launched.",
    "Spezial: ungelenkte Raketen, erst abgeworfen, dann gezündet.",
  ),
  "desc.miniGun": e(
    "Special: auto-tracking minigun, locks on random targets.",
    "Spezial: selbstzielendes Minigun, erfasst zufällige Ziele.",
  ),
  "desc.turret": e(
    "Special: auto-tracking laser turret vs. fighters.",
    "Spezial: selbstzielender Laserturm gegen Jäger.",
  ),
  "desc.misslePods": e(
    "Special: rapid missile pods vs. fighters.",
    "Spezial: Schnellfeuer-Raketenwerfer gegen Jäger.",
  ),
  "desc.airMissle": e("Special: air-to-air missiles.", "Spezial: Luft-Luft-Raketen."),
  "desc.grdMissle": e(
    "Special: heavy missiles vs. surface targets.",
    "Spezial: schwere Raketen gegen Bodenziele.",
  ),
  "desc.bomb": e(
    "Special: hull buster bomb for station modules.",
    "Spezial: Rumpfbrecher-Bombe gegen Stationsmodule.",
  ),
  "desc.energyGrab": e(
    "Special: siphons enemy energy and jams their guns.",
    "Spezial: saugt Feindenergie ab und blockiert ihre Waffen.",
  ),
  "desc.megaBomb": e(
    "Nova bomb: damages everything on screen (max 5).",
    "Nova-Bombe: beschädigt alles auf dem Bildschirm (max. 5).",
  ),
  "desc.pulseCannon": e("Special: wide pulse waves.", "Spezial: breite Impulswellen."),
  "desc.forwardLaser": e(
    "Special: twin lasers that cut through fighters.",
    "Spezial: Zwillingslaser, die Jäger durchschneiden.",
  ),
  "desc.deathRay": e("Special: the death ray.", "Spezial: der Todesstrahl."),
  "desc.superShield": e(
    "Phase shield: absorbs damage before the hull shield.",
    "Phasenschild: fängt Schaden vor dem Rumpfschild ab.",
  ),
  "desc.energy": e("Shield energy (25% per unit).", "Schildenergie (25% pro Einheit)."),
  "desc.detect": e(
    "Damage scanner: shows the boss hull integrity.",
    "Schadensscanner: zeigt den Rumpfzustand des Bosses.",
  ),

  "ctl.touchSteer": e(
    "STEER        drag anywhere (also beside the game)",
    "LENKEN       überall ziehen (auch neben dem Spiel)",
  ),
  "ctl.touchFire": e(
    "FIRE         auto-fire {state} · green button (right)",
    "FEUER        Autofeuer {state} · grüner Knopf (rechts)",
  ),
  "ctl.touchSpecial": e(
    "SPECIAL      ▶ button: next · tap icon at bottom",
    "SONDERWAFFE  ▶ Knopf: nächste · Symbol unten tippen",
  ),
  "ctl.touchNova": e(
    "NOVA BOMB    nova button (right, top)",
    "NOVA-BOMBE   Nova-Knopf (rechts oben)",
  ),
  "ctl.touchPause": e("PAUSE        ❚❚ button", "PAUSE        ❚❚ Knopf"),
  "ctl.move": e("MOVE         Arrows / WASD", "BEWEGEN      Pfeile / WASD"),
  "ctl.fire": e("FIRE         Space / Ctrl", "FEUER        Leertaste / Strg"),
  "ctl.special": e(
    "SPECIAL      Shift / Alt: next weapon",
    "SONDERWAFFE  Shift / Alt: nächste Waffe",
  ),
  "ctl.nova": e("NOVA BOMB    B / Enter", "NOVA-BOMBE   B / Enter"),
  "ctl.pause": e("PAUSE        P / Esc", "PAUSE        P / Esc"),
  "ctl.autoFire": e(
    "AUTO-FIRE    F: on/off (now {state})",
    "AUTOFEUER    F: an/aus (jetzt {state})",
  ),
  "ctl.recharge": e(
    "             not firing recharges the shield",
    "             ohne Feuern lädt das Schild auf",
  ),
  "ctl.specialsTouch": e("SPECIAL WEAPONS ON BOARD", "SONDERWAFFEN AN BORD"),
  "ctl.specialsKeys": e("SELECT SPECIAL WEAPON", "SONDERWAFFE WÄHLEN"),
  "ctl.noSpecials": e(
    "No special weapons on board: buy some in the supply shop.",
    "Keine Sonderwaffen an Bord: kaufe welche im Supply Shop.",
  ),

  "game.trainSim": e("TRAINING SIMULATION", "TRAININGSSIMULATION"),
  "game.pickupShield": e("+SHIELD", "+SCHILD"),
  "game.pickupCredits": e("+CREDITS", "+CREDITS"),
  "game.pickupWeapon": e("WEAPON", "WAFFE"),
  "game.demo": e("DEMO\ntap or press any key", "DEMO\nTaste drücken oder tippen"),
  "game.autoFire": e("AUTO-FIRE {state}", "AUTOFEUER {state}"),
  "game.start": e("START", "START"),
  "game.kills": e("KILLS", "ABSCHÜSSE"),
  "game.weaponLost": e("WEAPON LOST\nSHIELD LOW", "WAFFE VERLOREN\nSCHILD NIEDRIG"),
  "game.shieldLow": e("SHIELD LOW", "SCHILD NIEDRIG"),
  "game.paused": e("PAUSED", "PAUSE"),
  "game.resume": e("Resume", "Weiter"),
  "game.autoFireLabel": e("Auto-Fire: {state}", "Autofeuer: {state}"),
  "game.fullscreenLabel": e("Fullscreen: {state}", "Vollbild: {state}"),
  "game.abort": e("Abort Mission", "Mission abbrechen"),
  "game.pauseHint": e("Arrows + Enter, Esc/P resume", "Pfeile + Enter, Esc/P weiter"),
  "game.specialWeapon": e("SPECIAL WEAPON", "SONDERWAFFE"),
  "game.simFailed": e("SIMULATION FAILED", "SIMULATION FEHLGESCHLAGEN"),
  "game.shipDestroyed": e("SHIP DESTROYED", "SCHIFF ZERSTÖRT"),
  "game.simFailedMsg": e(
    "Simulation failed. Last save restored.",
    "Simulation fehlgeschlagen. Letzter Spielstand geladen.",
  ),
  "game.shipDestroyedMsg": e(
    "Ship destroyed. Last save restored.",
    "Schiff zerstört. Letzter Spielstand geladen.",
  ),
  "game.trainingCompleteMsg": e(
    "Training complete. Missions can be replayed.",
    "Training abgeschlossen. Missionen können wiederholt werden.",
  ),
  "game.sectorSecuredMsg": e(
    "Sector secured! Missions can be replayed.",
    "Sektor gesichert! Missionen können wiederholt werden.",
  ),
  "game.trainingComplete": e("TRAINING COMPLETE", "TRAINING ABGESCHLOSSEN"),
  "game.sectorSecured": e("{sector} SECURED", "{sector} GESICHERT"),
  "game.aborted": e("Mission aborted.", "Mission abgebrochen."),
  "game.waveReplayed": e("Wave {n} replayed: +{cr} CR", "Welle {n} wiederholt: +{cr} CR"),
  "game.waveComplete": e("Wave {n} complete: +{cr} CR", "Welle {n} geschafft: +{cr} CR"),
  "game.simComplete": e("SIMULATION COMPLETE", "SIMULATION ABGESCHLOSSEN"),
  "game.waveCompleteTitle": e("WAVE COMPLETE", "WELLE GESCHAFFT"),
  "game.missionAborted": e("MISSION ABORTED", "MISSION ABGEBROCHEN"),
  "game.destroyed": e(
    "Enemies {e}  ·  Buildings {b} destroyed",
    "Feinde {e}  ·  Gebäude {b} zerstört",
  ),
  "game.topLine": e(
    "WAVE {wave}  ·  TOP 10  ·  {n}x flown",
    "WELLE {wave}  ·  TOP 10  ·  {n}x geflogen",
  ),
  "game.notTop": e("This run is not in the top 10", "Dieser Flug ist nicht in den Top 10"),
  "game.continue": e("CONTINUE", "WEITER"),
} as const satisfies Record<string, Entry>

export type StringKey = keyof typeof STRINGS
