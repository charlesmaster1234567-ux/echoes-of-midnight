// ═══════════════════════════════════════════════════════════════════════════════
//  STATE.JS — Echoes of Midnight
//  Persistent game state across page refreshes, tab closes, sessions.
//  Saves to localStorage every 30 seconds + on every room change.
//  On load: offers Continue or New Game if a save exists.
//
//  Used by game.js:
//    GameState.save()          — call whenever game state changes
//    GameState.load()          — call on startup to check for save
//    GameState.hasSave()       — returns true if valid save exists
//    GameState.clear()         — wipe save (new game)
//    GameState.getSaveInfo()   — returns { level, loop, room, savedAt, playTime }
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

const GameState = (() => {

    // ── Config ────────────────────────────────────────────────────────────────
    const STORAGE_KEY    = "eom_save_v1";
    const AUTOSAVE_MS    = 30_000;   // autosave every 30 seconds
    const STATE_VERSION  = 1;

    // ── Internal ──────────────────────────────────────────────────────────────
    let _autosaveTimer   = null;
    let _sessionStart    = Date.now();
    let _lastSaveTime    = null;
    let _dirty           = false;    // true when game state changed since last save

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _getGame() {
        try {
            if (typeof game !== "undefined" && game && game.level !== undefined) return game;
        } catch (e) {}
        return null;
    }

    function _formatTime(ms) {
        if (!ms || ms < 0) return "0m";
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        if (h > 0) return h + "h " + m + "m";
        return m + "m";
    }

    function _formatDate(ts) {
        if (!ts) return "never";
        try {
            const d = new Date(ts);
            return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
        } catch (e) { return "unknown"; }
    }

    // ── Snapshot the full game object ─────────────────────────────────────────
    function _snapshot() {
        const g = _getGame();
        if (!g) return null;

        try {
            // Session time accumulation
            const existingMeta = _loadRaw();
            const prevPlayTime = existingMeta ? (existingMeta.meta.totalPlayTime || 0) : 0;
            const sessionTime  = Date.now() - _sessionStart;

            return {
                version:   STATE_VERSION,
                savedAt:   Date.now(),
                hasData:   true,

                // ── Full game state ───────────────────────────────────────────
                game: {
                    // Position and navigation
                    currentRoom:    g.currentRoom    || "foyer",
                    playerX:        g.playerX        || 400,
                    playerY:        g.playerY        || 300,
                    playerAngle:    g.playerAngle    || 0,

                    // Progression
                    level:          g.level          || 1,
                    xp:             g.xp             || 0,
                    xpToNext:       g.xpToNext       || 100,
                    totalXP:        g.totalXP        || 0,
                    loop:           g.loop           || 0,

                    // Stats
                    sanity:         g.sanity         || 100,
                    maxSanity:      g.maxSanity      || 100,
                    health:         g.health         || 100,
                    maxHealth:      g.maxHealth      || 100,
                    flashlightBattery: g.flashlightBattery || 100,
                    flashlightOn:   g.flashlightOn   || false,

                    // Items and inventory
                    inventory:      g.inventory      ? JSON.parse(JSON.stringify(g.inventory))      : [],
                    itemsFound:     g.itemsFound     || 0,
                    combatWins:     g.combatWins     || 0,
                    roomsExplored:  g.roomsExplored  || 0,
                    missionsComplete: g.missionsComplete || 0,
                    completedMissions: g.completedMissions ? [...g.completedMissions] : [],

                    // Seals
                    sealsFound:     g.sealsFound     || 0,

                    // Time loop
                    loopTime:       g.loopTime       || 0,
                    maxLoopTime:    g.maxLoopTime    || 36000,

                    // Flags (all room interaction flags)
                    flags: g.flags ? JSON.parse(JSON.stringify(g.flags)) : {},

                    // Permanent flags (persist across loops)
                    permanentFlags: g.permanentFlags
                        ? JSON.parse(JSON.stringify(g.permanentFlags)) : {},

                    // Clues and journal
                    cluesFound:     g.cluesFound     ? [...g.cluesFound]     : [],
                    journalEntries: g.journalEntries ? JSON.parse(JSON.stringify(g.journalEntries)) : [],

                    // Rooms visited
                    roomsVisited:   g.roomsVisited
                        ? [...g.roomsVisited]
                        : [],

                    // Ending
                    endingReached:  g.endingReached  || null,
                },

                // ── Meta (playtime, session info) ─────────────────────────────
                meta: {
                    totalPlayTime: prevPlayTime + sessionTime,
                    sessionCount:  existingMeta ? (existingMeta.meta.sessionCount || 0) + 1 : 1,
                    lastRoom:      g.currentRoom || "foyer",
                    lastLevel:     g.level       || 1,
                    lastLoop:      g.loop        || 0,
                    lastSavedAt:   Date.now(),
                },
            };
        } catch (e) {
            console.error("[State] Snapshot error:", e);
            return null;
        }
    }

    // ── Write raw to localStorage ─────────────────────────────────────────────
    function _writeRaw(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn("[State] Could not write save:", e.message);
            return false;
        }
    }

    // ── Read raw from localStorage ────────────────────────────────────────────
    function _loadRaw() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || data.version !== STATE_VERSION || !data.hasData) return null;
            return data;
        } catch (e) {
            console.warn("[State] Could not read save:", e.message);
            return null;
        }
    }

    // ── Apply saved data to live game object ──────────────────────────────────
    function _applyToGame(saved) {
        const g = _getGame();
        if (!g) {
            console.warn("[State] Cannot apply save — game object not ready");
            return false;
        }

        const sg = saved.game;
        if (!sg) return false;

        try {
            // Navigation
            g.currentRoom    = sg.currentRoom    || "foyer";
            g.playerX        = sg.playerX        || 400;
            g.playerY        = sg.playerY        || 300;
            g.playerAngle    = sg.playerAngle    || 0;

            // Progression
            g.level          = sg.level          || 1;
            g.xp             = sg.xp             || 0;
            g.xpToNext       = sg.xpToNext       || 100;
            g.totalXP        = sg.totalXP        || 0;
            g.loop           = sg.loop           || 0;

            // Stats
            g.sanity         = sg.sanity         || 100;
            g.maxSanity      = sg.maxSanity       || 100;
            g.health         = sg.health         || 100;
            g.maxHealth      = sg.maxHealth      || 100;
            g.flashlightBattery = sg.flashlightBattery || 100;
            g.flashlightOn   = sg.flashlightOn   || false;

            // Items
            g.inventory      = sg.inventory      ? JSON.parse(JSON.stringify(sg.inventory)) : [];
            g.itemsFound     = sg.itemsFound     || 0;
            g.combatWins     = sg.combatWins     || 0;
            g.roomsExplored  = sg.roomsExplored  || 0;
            g.missionsComplete = sg.missionsComplete || 0;
            g.completedMissions = sg.completedMissions ? [...sg.completedMissions] : [];
            g.sealsFound     = sg.sealsFound     || 0;

            // Time
            g.loopTime       = sg.loopTime       || 0;
            g.maxLoopTime    = sg.maxLoopTime    || 36000;

            // Flags
            g.flags          = sg.flags          ? JSON.parse(JSON.stringify(sg.flags)) : {};
            g.permanentFlags = sg.permanentFlags
                ? JSON.parse(JSON.stringify(sg.permanentFlags)) : {};

            // Clues and journal
            g.cluesFound     = sg.cluesFound     ? [...sg.cluesFound]     : [];
            g.journalEntries = sg.journalEntries
                ? JSON.parse(JSON.stringify(sg.journalEntries)) : [];

            // Rooms visited (restore as Set)
            g.roomsVisited   = sg.roomsVisited
                ? new Set(sg.roomsVisited)
                : new Set();

            g.endingReached  = sg.endingReached  || null;

            console.log("[State] Game state restored — level " + g.level +
                " loop " + g.loop + " room " + g.currentRoom);
            return true;
        } catch (e) {
            console.error("[State] Apply error:", e);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════
    return {

        /**
         * save()
         * Saves current game state immediately.
         * Call this: on room change, on level up, on item pickup, on loop reset.
         */
        save() {
            const data = _snapshot();
            if (!data) return false;
            const ok = _writeRaw(data);
            if (ok) {
                _lastSaveTime = Date.now();
                _dirty = false;
                console.log("[State] Saved — level " + (data.game.level || "?") +
                    " loop " + (data.game.loop || 0) +
                    " room " + (data.game.currentRoom || "?"));
            }
            return ok;
        },

        /**
         * hasSave()
         * Returns true if a valid save exists.
         */
        hasSave() {
            return _loadRaw() !== null;
        },

        /**
         * getSaveInfo()
         * Returns human-readable info about the save for the Continue screen.
         */
        getSaveInfo() {
            const data = _loadRaw();
            if (!data) return null;
            const g    = data.game;
            const meta = data.meta;
            return {
                level:      g.level       || 1,
                loop:       g.loop        || 0,
                room:       g.currentRoom || "foyer",
                sanity:     g.sanity      || 100,
                seals:      g.sealsFound  || 0,
                savedAt:    _formatDate(data.savedAt),
                savedAtRaw: data.savedAt,
                playTime:   _formatTime(meta.totalPlayTime),
                sessions:   meta.sessionCount || 1,
                inventory:  g.inventory   ? g.inventory.length : 0,
                clues:      g.cluesFound  ? g.cluesFound.length : 0,
            };
        },

        /**
         * load()
         * Applies saved data to the live game object.
         * Call after game object is initialized.
         * Returns true on success.
         */
        load() {
            const data = _loadRaw();
            if (!data) {
                console.log("[State] No save found");
                return false;
            }
            const ok = _applyToGame(data);
            if (ok) _sessionStart = Date.now();
            return ok;
        },

        /**
         * clear()
         * Wipes save data. Call on New Game.
         */
        clear() {
            try {
                localStorage.removeItem(STORAGE_KEY);
                _dirty = false;
                _lastSaveTime = null;
                console.log("[State] Save cleared");
                return true;
            } catch (e) {
                return false;
            }
        },

        /**
         * markDirty()
         * Call whenever game state changes.
         * Autosave will pick it up within 30 seconds.
         */
        markDirty() {
            _dirty = true;
        },

        /**
         * startAutosave()
         * Begins 30-second autosave loop.
         * Call once after game starts playing.
         */
        startAutosave() {
            if (_autosaveTimer) clearInterval(_autosaveTimer);
            _sessionStart = Date.now();

            _autosaveTimer = setInterval(() => {
                try {
                    // Only autosave during active gameplay
                    if (typeof gameState === "undefined" || gameState !== "playing") return;
                    if (!this.save()) return;
                    // Notify player with subtle subtitle
                    try {
                        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
                            SubtitleSystem.show("SYSTEM", "Progress saved.", 140);
                        }
                    } catch (e) {}
                } catch (e) {
                    console.warn("[State] Autosave error:", e);
                }
            }, AUTOSAVE_MS);

            console.log("[State] Autosave started (every " + (AUTOSAVE_MS/1000) + "s)");
        },

        /**
         * stopAutosave()
         * Stops autosave. Call when leaving game state.
         */
        stopAutosave() {
            if (_autosaveTimer) {
                clearInterval(_autosaveTimer);
                _autosaveTimer = null;
            }
        },

        /**
         * showContinuePrompt(onContinue, onNewGame)
         * Shows a styled overlay asking player to Continue or Start New Game.
         * Draws on canvas if SubtitleSystem is available,
         * otherwise falls back to a DOM modal.
         */
        showContinuePrompt(onContinue, onNewGame) {
            const info = this.getSaveInfo();
            if (!info) { if (typeof onNewGame === "function") onNewGame(); return; }

            // ── DOM modal (works regardless of canvas state) ──────────────────
            const existing = document.getElementById("eom-continue-modal");
            if (existing) existing.remove();

            const modal = document.createElement("div");
            modal.id    = "eom-continue-modal";
            modal.style.cssText = `
                position:fixed; inset:0; background:rgba(5,3,10,0.96);
                display:flex; align-items:center; justify-content:center;
                z-index:99999; font-family:Georgia,serif;
                animation: fadeIn 0.4s ease;
            `;

            const style = document.createElement("style");
            style.textContent = `
                @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
                #eom-continue-modal button {
                    cursor:pointer; border:none; border-radius:6px;
                    padding:14px 32px; font-family:Georgia,serif;
                    font-size:15px; font-weight:bold; transition:all 0.2s;
                }
                #eom-continue-modal button:hover { filter:brightness(1.15); transform:translateY(-1px); }
            `;
            document.head.appendChild(style);

            modal.innerHTML = `
                <div style="
                    background:linear-gradient(160deg,#130f1a,#0a0608);
                    border:1px solid #3a2544;
                    border-radius:16px; padding:40px 48px;
                    max-width:480px; width:90%; text-align:center;
                    box-shadow:0 0 60px rgba(100,40,140,0.3);
                ">
                    <div style="font-size:2.4rem;margin-bottom:8px;">⏰</div>
                    <h2 style="color:#d4a853;font-size:1.5rem;letter-spacing:0.08em;margin-bottom:4px;">
                        ECHOES OF MIDNIGHT
                    </h2>
                    <p style="color:#5a4a3e;font-size:0.85rem;margin-bottom:28px;font-style:italic;">
                        A save was found from a previous session
                    </p>

                    <div style="
                        background:#0f0b14; border:1px solid #2a1e34;
                        border-radius:10px; padding:20px; margin-bottom:28px;
                        text-align:left;
                    ">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">LEVEL</div>
                                <div style="color:#c8b8e0;font-size:18px;font-weight:bold;">${info.level}</div>
                            </div>
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">TIME LOOP</div>
                                <div style="color:#c8b8e0;font-size:18px;font-weight:bold;">${info.loop > 0 ? "#" + (info.loop + 1) : "First"}</div>
                            </div>
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">SEALS FOUND</div>
                                <div style="color:#c8b8e0;font-size:18px;font-weight:bold;">${info.seals}/5</div>
                            </div>
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">CLUES</div>
                                <div style="color:#c8b8e0;font-size:18px;font-weight:bold;">${info.clues}</div>
                            </div>
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">PLAY TIME</div>
                                <div style="color:#c8b8e0;font-size:14px;">${info.playTime}</div>
                            </div>
                            <div>
                                <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">SAVED</div>
                                <div style="color:#c8b8e0;font-size:12px;">${info.savedAt}</div>
                            </div>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e1428;">
                            <div style="color:#6b5a7e;font-size:10px;font-family:monospace;margin-bottom:2px;">LAST ROOM</div>
                            <div style="color:#c8b8e0;font-size:13px;font-style:italic;">
                                ${(info.room || "foyer").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                            </div>
                        </div>
                    </div>

                    <div style="display:flex;gap:14px;justify-content:center;">
                        <button id="eom-btn-continue" style="
                            background:linear-gradient(135deg,#d4a853,#b8842a);
                            color:#0a0608; flex:1;
                        ">
                            ▶ Continue
                        </button>
                        <button id="eom-btn-newgame" style="
                            background:transparent;
                            color:#6b5a7e; border:1px solid #2a1e34 !important;
                            flex:0.6;
                        ">
                            New Game
                        </button>
                    </div>

                    <p style="
                        color:#2a1e34; font-size:10px;
                        margin-top:16px; font-family:monospace;
                    ">New Game will permanently erase your current progress</p>
                </div>
            `;

            document.body.appendChild(modal);

            // Button handlers
            document.getElementById("eom-btn-continue").onclick = () => {
                modal.style.animation = "none";
                modal.style.opacity   = "0";
                modal.style.transition = "opacity 0.3s";
                setTimeout(() => {
                    modal.remove();
                    try { if (typeof onContinue === "function") onContinue(); } catch (e) {}
                }, 300);
            };

            document.getElementById("eom-btn-newgame").onclick = () => {
                // Confirm before wiping
                const confirm2 = document.createElement("div");
                confirm2.style.cssText = `
                    position:absolute; inset:0; background:rgba(5,3,10,0.95);
                    display:flex; align-items:center; justify-content:center;
                    border-radius:16px;
                `;
                confirm2.innerHTML = `
                    <div style="text-align:center;padding:24px;">
                        <p style="color:#c8b8a2;margin-bottom:20px;font-size:15px;">
                            Erase all progress and start over?
                        </p>
                        <div style="display:flex;gap:12px;justify-content:center;">
                            <button id="eom-confirm-yes" style="
                                background:#cc2222;color:#fff;
                                border-radius:6px;padding:10px 24px;
                                font-family:Georgia,serif;font-size:14px;
                                border:none;cursor:pointer;
                            ">Yes, erase</button>
                            <button id="eom-confirm-no" style="
                                background:#2a1e34;color:#c8b8a2;
                                border-radius:6px;padding:10px 24px;
                                font-family:Georgia,serif;font-size:14px;
                                border:none;cursor:pointer;
                            ">Cancel</button>
                        </div>
                    </div>
                `;
                modal.querySelector("div").style.position = "relative";
                modal.querySelector("div").appendChild(confirm2);

                document.getElementById("eom-confirm-yes").onclick = () => {
                    GameState.clear();
                    modal.remove();
                    try { if (typeof onNewGame === "function") onNewGame(); } catch (e) {}
                };
                document.getElementById("eom-confirm-no").onclick = () => {
                    confirm2.remove();
                };
            };
        },

        // Getters
        getLastSaveTime() { return _lastSaveTime; },
        getPlayTime()     { return Date.now() - _sessionStart; },
        isDirty()         { return _dirty; },
    };

})();

// ── Save on page hide/close ───────────────────────────────────────────────────
window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        try {
            if (typeof gameState !== "undefined" && gameState === "playing") {
                GameState.save();
            }
        } catch (e) {}
    }
});

window.addEventListener("beforeunload", () => {
    try {
        if (typeof gameState !== "undefined" && gameState === "playing") {
            GameState.save();
        }
    } catch (e) {}
});

// ── Save on room change (hook into moveToRoom if it exists) ───────────────────
(function _hookRoomChange() {
    const MAX_ATTEMPTS = 20;
    let attempts = 0;

    function tryHook() {
        attempts++;
        if (typeof window.moveToRoom === "function" && !window._stateHooked) {
            const orig = window.moveToRoom;
            window.moveToRoom = function(...args) {
                const result = orig.apply(this, args);
                try { GameState.save(); } catch (e) {}
                return result;
            };
            window._stateHooked = true;
            console.log("[State] Hooked into moveToRoom for auto-save");
        } else if (attempts < MAX_ATTEMPTS) {
            setTimeout(tryHook, 500);
        }
    }

    setTimeout(tryHook, 1000);
})();

console.log("[State] GameState ready");