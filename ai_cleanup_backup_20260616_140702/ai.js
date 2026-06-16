// ═════════════════════════════════════════════════════════════════
//  AI.JS — Echoes of Midnight  AI Integration Hub  v3.1
//  ───────────────────────────────────────────────────────────────
//  PHILOSOPHY:
//  • AI is an ENHANCEMENT layer, never a requirement.
//  • Game already works perfectly via subtitle_system.js.
//  • When online → AI generates fresh subtitles + grows memory bank
//  • When offline → AI does NOTHING. subtitle_system.js handles everything.
//  • If server endpoints return 404 → AI permanently disabled this session.
//  • AI-generated content persists in localStorage across sessions.
//
//  Load AFTER: subtitle_system.js
//  Load BEFORE: events.js, game.js
// ═════════════════════════════════════════════════════════════════

const AI = {

    // ── Core state ────────────────────────────────────────────────
    initialized:    false,
    available:      false,    // server responds + has active keys
    online:         false,    // navigator.onLine
    mode:           "offline",// "online" | "offline" | "starting"
    _serverMissing: false,    // true if /api/ai endpoints return 404 — permanent

    // ── AI-generated memory bank (persists in localStorage) ──────
    runtimeCache:   {},

    // ── Timing ────────────────────────────────────────────────────
    _tick:                 0,
    _lastHealthCheck:      0,
    _healthCheckInterval:  1800,
    _lastModeChangeTime:   0,

    // ── Request management ────────────────────────────────────────
    _pending:        new Map(),
    _requestTimeout: 10000,

    // ── Ambient triggering ────────────────────────────────────────
    _lastAmbientRoom:    null,
    _lastAmbientTick:    -9999,
    _ambientInterval:    900,
    _lastWhisperTick:    -9999,
    _whisperInterval:    1200,

    // ── Prefetch system ───────────────────────────────────────────
    _prefetchQueue:        new Set(),
    _prefetchInProgress:   false,
    _prefetchCooldownTick: 0,
    _prefetchCooldown:     300,

    // ── Menu dialogue ─────────────────────────────────────────────
    _menuDialogueActive:  false,
    _menuDialogueStep:    0,
    _menuDialogueLines:   [],
    _menuAudioStarted:    false,

    // ── Constants ─────────────────────────────────────────────────
    STORAGE_KEY:           "eom_ai_thoughts_v3",
    CACHE_MAX_ENTRIES:     500,
    PREFETCH_PER_ROOM:     3,
    MAX_LINES_PER_KEY:     10,


    // ═════════════════════════════════════════════════════════════
    //  INIT
    // ═════════════════════════════════════════════════════════════

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        this.mode = "starting";

        // Load AI-generated content from past sessions
        this._loadRuntimeCache();

        // Check online status
        this.online = navigator.onLine;

        // Listen for online/offline events
        window.addEventListener("online",  () => {
            if (this._serverMissing) return; // permanent disable, ignore
            console.log("[AI] Network online — checking server");
            this.online = true;
            this._checkHealth();
        });
        window.addEventListener("offline", () => {
            console.log("[AI] Network offline — game continues normally");
            this.online    = false;
            this.available = false;
            this._setMode("offline");
        });

        // Initial health check
        await this._checkHealth();

        console.log(`[AI] Ready. Mode: ${this.mode}. Memory bank: ${Object.keys(this.runtimeCache).length} entries.`);
    },


    // ═════════════════════════════════════════════════════════════
    //  RUNTIME CACHE — localStorage persistence (the "thoughts.json")
    // ═════════════════════════════════════════════════════════════

    _loadRuntimeCache() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    this.runtimeCache = parsed;
                }
            }
        } catch (err) {
            console.warn("[AI] Cache load failed:", err.message);
            this.runtimeCache = {};
        }
    },

    _saveRuntimeCache() {
        try {
            const keys = Object.keys(this.runtimeCache);
            if (keys.length > this.CACHE_MAX_ENTRIES) {
                const sorted = keys
                    .map(k => ({ k, t: this.runtimeCache[k]?._timestamp || 0 }))
                    .sort((a, b) => b.t - a.t)
                    .slice(0, Math.floor(this.CACHE_MAX_ENTRIES / 2));
                const newCache = {};
                for (const { k } of sorted) newCache[k] = this.runtimeCache[k];
                this.runtimeCache = newCache;
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.runtimeCache));
        } catch (err) {
            try {
                localStorage.removeItem(this.STORAGE_KEY);
                this.runtimeCache = {};
            } catch (_) {}
        }
    },

    _cacheKey(type, room) {
        return `${type}:${room || "_global"}`;
    },

    _getCachedContent(type, room) {
        const key   = this._cacheKey(type, room);
        const entry = this.runtimeCache[key];
        if (!entry || !Array.isArray(entry.lines) || entry.lines.length === 0) return null;

        const idx = (entry._cursor || 0) % entry.lines.length;
        entry._cursor = (entry._cursor || 0) + 1;
        return entry.lines[idx];
    },

    _addCachedContent(type, room, newText) {
        if (!newText || typeof newText !== "string") return;
        const key = this._cacheKey(type, room);
        if (!this.runtimeCache[key]) {
            this.runtimeCache[key] = { lines: [], _cursor: 0, _timestamp: Date.now() };
        }
        const entry = this.runtimeCache[key];
        if (!entry.lines.includes(newText)) {
            entry.lines.push(newText);
            if (entry.lines.length > this.MAX_LINES_PER_KEY) entry.lines.shift();
        }
        entry._timestamp = Date.now();
        this._saveRuntimeCache();
    },


    // ═════════════════════════════════════════════════════════════
    //  HEALTH CHECK — detects server, 404 = permanent disable
    // ═════════════════════════════════════════════════════════════

    async _checkHealth() {
        // Permanently disabled — never check again
        if (this._serverMissing) {
            this.available = false;
            this._setMode("offline");
            return;
        }

        if (!this.online) {
            this.available = false;
            this._setMode("offline");
            return;
        }

        try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 5000);
            const res = await fetch("/api/ai/status", { signal: controller.signal });
            clearTimeout(timeout);

            // 404 = no server endpoint = permanently disable AI
            if (res.status === 404) {
                this._permanentlyDisable("Status endpoint returned 404 — no AI server running");
                return;
            }

            if (res.ok) {
                const data = await res.json();
                this.available = data.available === true;
                this._setMode(this.available ? "online" : "offline");
            } else {
                this.available = false;
                this._setMode("offline");
            }
        } catch (err) {
            // Network error — could be CORS, server down, etc.
            // Try once more silently, then give up
            this.available = false;
            this._setMode("offline");
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  PERMANENTLY DISABLE AI (called on 404)
    // ═════════════════════════════════════════════════════════════

    _permanentlyDisable(reason) {
        this._serverMissing       = true;
        this.available            = false;
        this._healthCheckInterval = 999999;  // never check again
        this._prefetchQueue.clear();
        this._setMode("offline");
        console.log(`[AI] ⊘ Permanently disabled this session: ${reason}`);
        console.log(`[AI] ⊘ Game continues normally using subtitle_system.js`);
    },

    _setMode(newMode) {
        if (this.mode === newMode) return;
        const old = this.mode;
        this.mode = newMode;
        this._lastModeChangeTime = Date.now();
        console.log(`[AI] Mode: ${old} → ${newMode}`);
    },


    // ═════════════════════════════════════════════════════════════
    //  CONTEXT BUILDER
    // ═════════════════════════════════════════════════════════════

    _buildContext(roomOverride) {
        const g = (typeof game !== "undefined") ? game : null;
        if (!g) return { room: roomOverride || "unknown" };
        return {
            room:     roomOverride || g.currentRoom || "unknown",
            sanity:   Math.round(g.sanity ?? 100),
            loop:     g.loop ?? 0,
            seals:    (typeof countSeals === "function") ? countSeals() : 0,
            timeLeft: Math.round((g.maxLoopTime ?? 600) - (g.loopTime ?? 0)),
            combat:   !!(typeof combat !== "undefined" && combat?.active),
        };
    },


    // ═════════════════════════════════════════════════════════════
    //  CORE GETTER — returns AI content or null
    // ═════════════════════════════════════════════════════════════

    get(type, context) {
        const ctx  = context || this._buildContext();
        const room = ctx.room;

        // 1. Check cache for AI-generated content from past calls
        const cached = this._getCachedContent(type, room);
        if (cached) {
            this._maybeRefreshCache(type, room, ctx);
            return cached;
        }

        // 2. Queue AI generation for future use (only if online and server exists)
        if (this.mode === "online" && !this._serverMissing) {
            this._queuePrefetch(type, room, ctx);
        }

        // 3. Return null — caller uses subtitle_system.js fallback
        return null;
    },

    _maybeRefreshCache(type, room, ctx) {
        if (this.mode !== "online" || this._serverMissing) return;
        const key   = this._cacheKey(type, room);
        const entry = this.runtimeCache[key];
        if (!entry) return;
        const lowLines = entry.lines.length < 3;
        const old      = (Date.now() - (entry._timestamp || 0)) > 600000;
        if (lowLines || old) {
            this._queuePrefetch(type, room, ctx);
        }
    },


    // ═════════════════════════════════════════════════════════════
    //  PREFETCH SYSTEM
    // ═════════════════════════════════════════════════════════════

    _queuePrefetch(type, room, ctx) {
        if (this._serverMissing) return;
        this._prefetchQueue.add(JSON.stringify({ type, room, ctx }));
    },

    async _drainPrefetchQueue() {
        if (this._serverMissing)      return;
        if (this._prefetchInProgress) return;
        if (this.mode !== "online")   return;
        if (this._tick < this._prefetchCooldownTick) return;
        if (this._prefetchQueue.size === 0) return;

        this._prefetchInProgress = true;

        const batch = [];
        const items = Array.from(this._prefetchQueue).slice(0, 6);
        for (const item of items) {
            this._prefetchQueue.delete(item);
            try {
                const parsed = JSON.parse(item);
                batch.push({
                    type:    parsed.type,
                    context: parsed.ctx,
                });
            } catch (_) {}
        }

        if (batch.length === 0) {
            this._prefetchInProgress = false;
            return;
        }

        try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), this._requestTimeout);

            const res = await fetch("/api/ai/batch", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ requests: batch }),
                signal:  controller.signal,
            });

            clearTimeout(timeout);

            // 404 = server endpoint missing — permanently disable
            if (res.status === 404) {
                this._permanentlyDisable("Batch endpoint returned 404");
                this._prefetchInProgress = false;
                return;
            }

            if (!res.ok) {
                if (res.status === 503 || res.status === 429) {
                    this.available = false;
                    this._setMode("offline");
                }
                this._prefetchInProgress = false;
                return;
            }

            const data = await res.json();
            const results = data.results || [];

            // Save each result into the growing thoughts memory bank
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const req = batch[i];
                if (r && r.text && req) {
                    this._addCachedContent(req.type, req.context?.room, r.text);
                }
            }
        } catch (err) {
            // Network error — go offline but don't permanently disable
            this.available = false;
            this._setMode("offline");
        }

        this._prefetchCooldownTick = this._tick + this._prefetchCooldown;
        this._prefetchInProgress   = false;
    },

    onRoomEntered(roomId) {
        if (this.mode !== "online" || this._serverMissing) return;

        const ctx = this._buildContext(roomId);

        const entry = this.runtimeCache[this._cacheKey("ambient", roomId)];
        if (!entry || entry.lines.length < this.PREFETCH_PER_ROOM) {
            for (let i = 0; i < this.PREFETCH_PER_ROOM; i++) {
                this._queuePrefetch("ambient", roomId, ctx);
            }
        }

        const adjacent = this._getAdjacentRooms(roomId);
        for (const adjRoom of adjacent) {
            const adjEntry = this.runtimeCache[this._cacheKey("ambient", adjRoom)];
            if (!adjEntry || adjEntry.lines.length < 2) {
                this._queuePrefetch("ambient", adjRoom, this._buildContext(adjRoom));
            }
        }

        for (const type of ["whisper", "entity", "eleanora", "scare"]) {
            const ge = this.runtimeCache[this._cacheKey(type, null)];
            if (!ge || ge.lines.length < 2) {
                this._queuePrefetch(type, null, ctx);
            }
        }
    },

    _getAdjacentRooms(roomId) {
        if (typeof ROOMS === "undefined" || !ROOMS[roomId]) return [];
        const room = ROOMS[roomId];
        const exits = room.exits || room.doors || {};
        const adj = [];
        if (Array.isArray(exits)) {
            for (const exit of exits) {
                const target = exit.targetRoom || exit.to;
                if (target && ROOMS[target]) adj.push(target);
            }
        } else {
            for (const key of Object.keys(exits)) {
                const target = exits[key];
                const targetId = (typeof target === "string") ? target : target?.to;
                if (targetId && ROOMS[targetId]) adj.push(targetId);
            }
        }
        return adj;
    },


    // ═════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═════════════════════════════════════════════════════════════

    getAmbient(roomId)   { return this.get("ambient",  this._buildContext(roomId)); },
    getWhisper()         { return this.get("whisper",  this._buildContext()); },
    getEntityLine()      { return this.get("entity",   this._buildContext()); },
    getEleanorLine()     { return this.get("eleanora", this._buildContext()); },
    getScare()           { return this.get("scare",    this._buildContext()); },
    getLore()            { return this.get("lore",     this._buildContext()); },
    getMenuText()        { return this.get("menu",     {}); },
    getDeathText()       { return this.get("death",    this._buildContext()); },
    getEndingText(t)     { return this.get("ending",   { ...this._buildContext(), endingType: t }); },

    speakAmbient(roomId) {
        if (this.mode !== "online" || this._serverMissing) return false;
        const t = this.getAmbient(roomId);
        if (!t) return false;
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
            SubtitleSystem.show("", t, 300);
        }
        return true;
    },

    speakWhisper() {
        if (this.mode !== "online" || this._serverMissing) return false;
        const t = this.getWhisper();
        if (!t) return false;
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
            SubtitleSystem.show("???", t, 200);
        }
        try { if (typeof playSound === "function") playSound("whisper"); } catch (_) {}
        return true;
    },

    speakEntity() {
        if (this.mode !== "online" || this._serverMissing) return false;
        const t = this.getEntityLine();
        if (!t) return false;
        if (typeof showDialog === "function") {
            showDialog("AZATHIEL", t);
        }
        try { if (typeof playSound === "function") playSound("scare"); } catch (_) {}
        return true;
    },

    speakEleanora() {
        if (this.mode !== "online" || this._serverMissing) return false;
        const t = this.getEleanorLine();
        if (!t) return false;
        if (typeof showDialog === "function") {
            showDialog("ELEANORA", t);
        }
        try { if (typeof playSound === "function") playSound("ghost"); } catch (_) {}
        return true;
    },

    speakScare() {
        if (this.mode !== "online" || this._serverMissing) return false;
        const t = this.getScare();
        if (!t) return false;
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
            SubtitleSystem.show("NARRATOR", t, 240);
        }
        try { if (typeof playSound === "function") playSound("scare"); } catch (_) {}
        return true;
    },


    // ═════════════════════════════════════════════════════════════
    //  PRE-MENU HORROR DIALOGUE
    // ═════════════════════════════════════════════════════════════

    startMenuDialogue() {
        if (this.mode !== "online" || this._serverMissing) {
            this._menuDialogueActive = false;
            return;
        }

        this._menuDialogueActive = true;
        this._menuDialogueStep   = 0;
        this._menuAudioStarted   = false;
        this._menuDialogueLines  = [];

        const types = [
            { speaker: "???",       type: "menu"    },
            { speaker: "THE HOUSE", type: "whisper" },
            { speaker: "???",       type: "scare"   },
        ];

        for (const { speaker, type } of types) {
            const text = this.get(type, {});
            if (text) {
                this._menuDialogueLines.push({ speaker, text });
            }
        }

        if (this._menuDialogueLines.length === 0) {
            this._menuDialogueActive = false;
            return;
        }
    },

    advanceMenuDialogue() {
        if (!this._menuDialogueActive) return true;

        if (!this._menuAudioStarted) {
            this._menuAudioStarted = true;
            try {
                if (typeof initAudio === "function") initAudio();
                if (typeof AudioManager !== "undefined" && AudioManager.initialized) {
                    AudioManager.playMusic("music_menu", 2.0);
                }
            } catch (_) {}
        }

        const step = this._menuDialogueStep;
        if (step >= this._menuDialogueLines.length) {
            this._menuDialogueActive = false;
            return true;
        }

        const line = this._menuDialogueLines[step];
        this._menuDialogueStep++;

        if (typeof showDialog === "function") {
            showDialog(line.speaker, line.text);
        }
        return false;
    },

    isMenuDialogueActive() {
        return this._menuDialogueActive;
    },


    // ═════════════════════════════════════════════════════════════
    //  PER-FRAME UPDATE
    // ═════════════════════════════════════════════════════════════

    update() {
        if (!this.initialized) return;
        this._tick++;

        // ── OFFLINE / DISABLED EARLY RETURN ──────────────────────
        if (this._serverMissing) return;

        // Periodic health check
        if (this._tick - this._lastHealthCheck > this._healthCheckInterval) {
            this._lastHealthCheck = this._tick;
            this._checkHealth();
        }

        // Drain prefetch queue
        this._drainPrefetchQueue();

        if (this.mode !== "online") return;

        if (typeof gameState === "undefined" || gameState !== "playing") return;
        const g = (typeof game !== "undefined") ? game : null;
        if (!g) return;

        // Room change detection
        if (g.currentRoom !== this._lastAmbientRoom) {
            this._lastAmbientRoom = g.currentRoom;
            this._lastAmbientTick = this._tick;
            this.onRoomEntered(g.currentRoom);
            this.speakAmbient(g.currentRoom);
            return;
        }

        // Periodic ambient
        if (this._tick - this._lastAmbientTick > this._ambientInterval) {
            const spoke = this.speakAmbient(g.currentRoom);
            if (spoke) {
                this._lastAmbientTick = this._tick;
            } else {
                this._lastAmbientTick = this._tick - this._ambientInterval + 60;
            }
        }

        // Low-sanity whispers
        const sanityRatio = (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100);
        if (sanityRatio < 0.5) {
            const adjusted = this._whisperInterval * Math.max(0.3, sanityRatio);
            if (this._tick - this._lastWhisperTick > adjusted) {
                const spoke = this.speakWhisper();
                if (spoke) this._lastWhisperTick = this._tick;
            }
        }
    },


    // ═════════════════════════════════════════════════════════════
    //  RESET
    // ═════════════════════════════════════════════════════════════

    reset() {
        this._lastAmbientRoom = null;
        this._lastAmbientTick = this._tick;
        this._lastWhisperTick = this._tick;
    },

    fullReset() {
        this.reset();
    },


    // ═════════════════════════════════════════════════════════════
    //  DEBUG / EXPORT
    // ═════════════════════════════════════════════════════════════

    debug() {
        return {
            mode:           this.mode,
            online:         this.online,
            available:      this.available,
            serverMissing:  this._serverMissing,
            cacheEntries:   Object.keys(this.runtimeCache).length,
            cacheTypes:     [...new Set(Object.keys(this.runtimeCache).map(k => k.split(":")[0]))],
            prefetchQueue:  this._prefetchQueue.size,
            tick:           this._tick,
        };
    },

    clearCache() {
        this.runtimeCache = {};
        this._saveRuntimeCache();
        console.log("[AI] Memory bank cleared");
    },

    exportThoughts() {
        return JSON.stringify(this.runtimeCache, null, 2);
    },
};