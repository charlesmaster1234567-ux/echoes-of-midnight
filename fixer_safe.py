#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  FIXER_SAFE.PY — Only patches sw.js + index.html
  game.js changes printed to console for manual paste
═══════════════════════════════════════════════════════════════
"""

import re
import shutil
from pathlib import Path
from datetime import datetime

BACKUP_DIR = Path("./fixer_safe_backup_" + datetime.now().strftime("%Y%m%d_%H%M%S"))


def ok(msg):   print(f"  [OK]   {msg}")
def warn(msg): print(f"  [WARN] {msg}")
def err(msg):  print(f"  [ERR]  {msg}")
def info(msg): print(f"  [INFO] {msg}")


def backup(name):
    src = Path(name)
    if src.exists():
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, BACKUP_DIR / name)
        ok(f"Backed up {name}")


# ═══════════════════════════════════════════════════════════════
#  PATCH sw.js
# ═══════════════════════════════════════════════════════════════
def patch_sw():
    print("\n── Patching sw.js ──────────────────────────────")
    path = Path("sw.js")
    if not path.exists():
        err("sw.js not found")
        return False

    backup("sw.js")
    content = path.read_text(encoding="utf-8")
    changes = 0

    # 1. Bump version to v3.3.0
    pattern = r'const\s+SW_VERSION\s*=\s*["\']eom-v[\d.]+["\']\s*;'
    if re.search(pattern, content):
        content = re.sub(pattern, 'const SW_VERSION    = "eom-v3.3.0";', content)
        ok("Version bumped to eom-v3.3.0")
        changes += 1
    else:
        warn("Could not find SW_VERSION")

    # 2. Fix the 206 issue in fetchAndCache
    # The simple targeted replacement: replace cache.put(url, response)
    if "await cache.put(url, response);" in content:
        content = content.replace(
            "await cache.put(url, response);",
            """// Skip partial responses (206 breaks Cache API)
    if (response.status === 206) {
        console.warn("[SW] Skipping partial response: " + url);
        return;
    }
    try {
        await cache.put(url, response.clone());
    } catch (e) {
        console.warn("[SW] Cache put failed for " + url + ": " + e.message);
    }"""
        )
        ok("Fixed 206 partial response handling in fetchAndCache")
        changes += 1
    elif "response.status === 206" in content:
        ok("206 fix already present")
    else:
        warn("Could not find cache.put line to fix")

    # 3. Add state.js to CRITICAL_FILES
    if '"/state.js"' not in content:
        if '"/achievements.js",' in content:
            content = content.replace(
                '"/achievements.js",',
                '"/achievements.js",\n    "/state.js",'
            )
            ok("Added /state.js to CRITICAL_FILES")
            changes += 1
        else:
            warn("Could not find achievements.js anchor for state.js")

    # 4. Also patch cacheFirst to handle 206
    old_line = "if (res.ok) { const c = await caches.open(cacheName); c.put(req, res.clone()); }"
    new_line = "if (res.ok && res.status !== 206) { const c = await caches.open(cacheName); c.put(req, res.clone()); }"
    if old_line in content:
        content = content.replace(old_line, new_line)
        ok("Fixed cacheFirst to skip 206")
        changes += 1

    # 5. Also patch networkFirst, staleWhileRevalidate similarly
    nf_old = "if (res.ok) { const c = await caches.open(CACHE_DYNAMIC); c.put(req, res.clone()); }"
    nf_new = "if (res.ok && res.status !== 206) { const c = await caches.open(CACHE_DYNAMIC); c.put(req, res.clone()); }"
    if nf_old in content:
        content = content.replace(nf_old, nf_new)
        ok("Fixed networkFirst to skip 206")
        changes += 1

    swr_old = "if (res.ok) { const c = await caches.open(CACHE_CORE); await c.put(req, res.clone()); }"
    swr_new = "if (res.ok && res.status !== 206) { const c = await caches.open(CACHE_CORE); await c.put(req, res.clone()); }"
    if swr_old in content:
        content = content.replace(swr_old, swr_new)
        ok("Fixed staleWhileRevalidate to skip 206")
        changes += 1

    path.write_text(content, encoding="utf-8")
    info(f"sw.js: {changes} changes applied")
    return changes > 0


# ═══════════════════════════════════════════════════════════════
#  PATCH index.html
# ═══════════════════════════════════════════════════════════════
def patch_index():
    print("\n── Patching index.html ─────────────────────────")
    path = Path("index.html")
    if not path.exists():
        err("index.html not found")
        return False

    backup("index.html")
    content = path.read_text(encoding="utf-8")
    changes = 0

    # Check if already has the upgrade
    if "controllerchange" in content:
        ok("index.html already has SW auto-activate (skipping)")
    else:
        # Find the SW registration block — balanced brace search
        start_idx = content.find('if ("serviceWorker" in navigator) {')
        if start_idx == -1:
            warn("Could not find SW registration block")
        else:
            # Count braces from start_idx
            brace_count = 0
            i = start_idx
            found_open = False
            end_idx = -1
            while i < len(content):
                if content[i] == '{':
                    brace_count += 1
                    found_open = True
                elif content[i] == '}':
                    brace_count -= 1
                    if found_open and brace_count == 0:
                        end_idx = i + 1
                        break
                i += 1

            if end_idx > start_idx:
                new_block = '''if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(function(reg) {
                console.log("[SW] Registered");
                if (reg.waiting) {
                    reg.waiting.postMessage("skip-waiting");
                }
                reg.addEventListener("updatefound", function() {
                    var newSW = reg.installing;
                    if (!newSW) return;
                    newSW.addEventListener("statechange", function() {
                        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
                            newSW.postMessage("skip-waiting");
                        }
                    });
                });
                var refreshing = false;
                navigator.serviceWorker.addEventListener("controllerchange", function() {
                    if (!refreshing) { refreshing = true; window.location.reload(); }
                });
                navigator.serviceWorker.addEventListener("message", function(event) {
                    var data = event.data;
                    if (!data) return;
                    if (data.type === "sw-install-complete") {
                        console.log("[SW] All files cached — fully offline ready");
                    }
                });
            })
            .catch(function(err) { console.error("[SW] Registration failed:", err); });
    }'''

                content = content[:start_idx] + new_block + content[end_idx:]
                ok("Upgraded SW registration with auto-activate")
                changes += 1

    # Ensure state.js is loaded
    if "state.js" not in content:
        # Add before achievements.js or game.js
        if '<script src="achievements.js"></script>' in content:
            content = content.replace(
                '<script src="achievements.js"></script>',
                '<script src="state.js"></script>\n<script src="achievements.js"></script>'
            )
            ok("Added state.js before achievements.js")
            changes += 1
        elif '<script src="game.js"></script>' in content:
            content = content.replace(
                '<script src="game.js"></script>',
                '<script src="state.js"></script>\n<script src="game.js"></script>'
            )
            ok("Added state.js before game.js")
            changes += 1
        else:
            warn("Could not find anchor to add state.js")
    else:
        ok("state.js already in index.html")

    path.write_text(content, encoding="utf-8")
    info(f"index.html: {changes} changes applied")
    return changes > 0


# ═══════════════════════════════════════════════════════════════
#  PATCH manifest.json
# ═══════════════════════════════════════════════════════════════
def patch_manifest():
    print("\n── Patching manifest.json ──────────────────────")
    path = Path("manifest.json")
    if not path.exists():
        warn("manifest.json not found")
        return False

    backup("manifest.json")
    content = path.read_text(encoding="utf-8")

    if '"version"' in content:
        content = re.sub(r'"version"\s*:\s*"[^"]*"', '"version": "3.3.0"', content)
        ok("Version updated to 3.3.0")
    else:
        first_brace = content.find("{")
        if first_brace != -1:
            content = content[:first_brace + 1] + '\n  "version": "3.3.0",' + content[first_brace + 1:]
            ok("Added version 3.3.0")

    path.write_text(content, encoding="utf-8")
    return True


# ═══════════════════════════════════════════════════════════════
#  GAME.JS — print manual instructions ONLY
# ═══════════════════════════════════════════════════════════════
def show_game_js_instructions():
    print("\n" + "=" * 60)
    print("  GAME.JS — MANUAL EDIT REQUIRED")
    print("=" * 60)
    print()
    print("  game.js is too complex for safe auto-patching.")
    print("  Follow these THREE simple steps:")
    print()
    print("  ──────────────────────────────────────────────────────")
    print("  STEP 1: REMOVE the bad block")
    print("  ──────────────────────────────────────────────────────")
    print("  Open game.js, search for this comment:")
    print()
    print("      // After game object is initialized (after const game = {...}):")
    print()
    print("  DELETE everything from that comment down to and")
    print("  including:")
    print()
    print('      GameState.clear(); // or keep it for "continue from last loop"')
    print()
    print("  (About 30 lines total)")
    print()
    print("  ──────────────────────────────────────────────────────")
    print("  STEP 2: REPLACE startNewGame function")
    print("  ──────────────────────────────────────────────────────")
    print("  Search for:  function startNewGame() {")
    print("  Select that whole function (including closing brace)")
    print("  Replace with the block in: GAMEJS_PATCH.txt")
    print()
    print("  ──────────────────────────────────────────────────────")
    print("  STEP 3: Done. Save game.js")
    print("  ──────────────────────────────────────────────────────")
    print()

    # Write the replacement to a file
    patch_content = '''// ════════════════════════════════════════════════════════════════
// PASTE THIS TO REPLACE THE EXISTING startNewGame() FUNCTION
// ════════════════════════════════════════════════════════════════

function startNewGame() {
    // If save exists, show continue prompt instead of starting fresh
    if (typeof GameState !== "undefined" && GameState.hasSave()) {
        GameState.showContinuePrompt(
            // CONTINUE — load saved game
            function() {
                var loadOk = GameState.load();
                if (loadOk) {
                    _safe(window.installSubtitleOverride);
                    gameState = "playing";
                    try {
                        if (game.currentRoom && typeof moveToRoom === "function") {
                            moveToRoom(game.currentRoom);
                        }
                    } catch (e) {}
                    GameState.startAutosave();
                    try {
                        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
                            SubtitleSystem.show("NARRATOR", "The manor remembers you.", 220);
                        }
                    } catch(e) {}
                } else {
                    _startFresh();
                }
            },
            // NEW GAME — wipe save, start over
            function() {
                GameState.clear();
                _startFresh();
            }
        );
        return;
    }

    // No save → start fresh
    _startFresh();
}

function _startFresh() {
    _safe(window.installSubtitleOverride);
    gameState = "playing";

    // Reset all game state
    game.level             = 1;
    game.xp                = 0;
    game.xpToNext          = 100;
    game.totalXP           = 0;
    game.loop              = 0;
    game.sanity            = 100;
    game.maxSanity         = 100;
    game.flashlightBattery = 100;
    game.flashlightOn      = false;
    game.inventory         = [];
    game.itemsFound        = 0;
    game.combatWins        = 0;
    game.roomsExplored     = 0;
    game.missionsComplete  = 0;
    game.completedMissions = [];
    game.sealsFound        = 0;
    game.flags             = {};
    game.permanentFlags    = game.permanentFlags || {};
    game.cluesFound        = [];
    game.journalEntries    = [];
    game.roomsVisited      = new Set();
    game.endingReached     = null;
    game.currentRoom       = "foyer";
    game.loopTime          = 0;

    // Start autosave
    if (typeof GameState !== "undefined") {
        GameState.startAutosave();
    }

    // Move to starting room
    try {
        if (typeof moveToRoom === "function") moveToRoom("foyer");
    } catch (e) {}

    // Intro dialogue
    try {
        showDialog("NARRATOR", "You wake in the grand foyer of Thornwood Manor. The front door is locked.");
        showDialog("NARRATOR", "You have a flashlight. Ten minutes remain. Press E to interact with objects.");
    } catch (e) {}
}
'''

    Path("GAMEJS_PATCH.txt").write_text(patch_content, encoding="utf-8")
    ok("Wrote GAMEJS_PATCH.txt — open it and paste into game.js")
    print()


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    print()
    print("=" * 55)
    print("  FIXER_SAFE.PY — sw.js + index.html auto-patcher")
    print("=" * 55)

    sw_ok       = patch_sw()
    idx_ok      = patch_index()
    manifest_ok = patch_manifest()
    show_game_js_instructions()

    print("=" * 55)
    print("  SUMMARY")
    print("-" * 55)
    print(f"  sw.js:        {'PATCHED' if sw_ok else 'no changes'}")
    print(f"  index.html:   {'PATCHED' if idx_ok else 'no changes'}")
    print(f"  manifest.json:{'PATCHED' if manifest_ok else 'no changes'}")
    print(f"  game.js:      MANUAL — see GAMEJS_PATCH.txt")
    print(f"  Backup:       {BACKUP_DIR}")
    print("=" * 55)
    print()
    print("  Next steps:")
    print("  1. Open GAMEJS_PATCH.txt")
    print("  2. Follow the 3 steps printed above to edit game.js")
    print("  3. Test in browser")
    print("  4. git add . && git commit && git push")
    print()


if __name__ == "__main__":
    main()