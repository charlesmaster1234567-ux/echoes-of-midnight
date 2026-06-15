// ═════════════════════════════════════════════════════════════════
//  AUDIO_WIRING.JS — Complete Sound Integration
//  Hooks every game system to appropriate sound triggers.
//  AudioManager handles music & ambience; this layer only adds
//  contextual one-shot SFX and triggers.
// ═════════════════════════════════════════════════════════════════

const AudioWiring = {

    // ── State ─────────────────────────────────────────────────────
    lastRoom:                null,
    lastSanityBracket:       "high",
    lastBatteryBracket:      "full",
    combatMusicPlaying:      false,
    bossIntroPlayed:         false,
    flashlightFlickerCooldown: 0,

    // Internal tick — never reads global `frame`
    _tick: 0,

    // Per-continuous-trigger last-fire timestamps
    _last: {
        sanityHeartbeat: -999,
        sanityWhisper:   -999,
        sanityRandom:    -999,
        timeHeartbeat:   -999,
        timeClock:       -999,
        ghostWhisper:    -999,
        ghostClose:      -999,
        deathGhost:      -999,
        fireCrackle:     -999,
        waterDrip:       -999,
    },

    // Time-warning thresholds already fired this loop
    _timeFired: new Set(),

    // FIX: tracks setTimeout IDs from playDelayed() so they can be
    // cancelled at reset — prevents entry sounds from a dying loop
    // firing into the new loop.
    _pendingDelays: [],

    // ── Floor sound map ───────────────────────────────────────────
    FLOOR_SOUNDS: {
        foyer:"wood", library:"wood", dining_room:"wood", parlor:"wood",
        kitchen:"stone", ballroom:"stone", gallery:"wood",
        conservatory:"stone", greenhouse:"stone",
        garden_path:"grass", graveyard:"grass", well:"grass",
        chapel:"stone", servants_quarters:"wood", wine_cellar:"stone",
        upstairs_hall:"wood", master_bedroom:"wood", childrens_room:"wood",
        nursery:"wood", study:"wood", attic_stairs:"wood", attic:"wood",
        bell_tower:"stone", clock_tower:"stone",
        basement:"stone", catacombs:"stone", underground_lake:"stone",
        ritual_chamber:"stone", void_chamber:"stone", secret_room:"wood",
        hedge_maze:"grass", secret_garden:"grass", tower_stairs:"stone",
        observatory:"wood", laboratory:"stone", balcony:"wood",
        music_room:"wood", trophy_room:"wood", servants_tunnel:"stone",
        mirror_gallery:"wood", coal_room:"stone", root_cellar:"stone",
        laundry:"stone", ice_house:"stone", dovecote:"wood",
        potting_shed:"wood", wine_tasting:"wood", clock_gears:"stone",
        tower_peak:"stone", sanctuary:"stone",
    },

    // ── Rooms treated as "heavy door" ─────────────────────────────
    _HEAVY_DOOR_ROOMS: new Set([
        "basement","ritual_chamber","void_chamber","catacombs"
    ]),
    // ── Rooms treated as "outside" ────────────────────────────────
    _OUTSIDE_ROOMS: new Set([
        "garden_path","graveyard","well","greenhouse",
        "hedge_maze","secret_garden"
    ]),
    // ── Rooms that get danger monologue on entry ──────────────────
    _DANGER_ROOMS: new Set([
        "basement","ritual_chamber","void_chamber","catacombs","underground_lake"
    ]),
    // ── Rooms with extra water drip ambience ─────────────────────
    _WATER_ROOMS: new Set([
        "underground_lake","kitchen","basement","well"
    ]),

    // ── Entry sound recipes ───────────────────────────────────────
    _ENTRY_SOUNDS: {
        basement:         [["drip",500],["chain",1200]],
        ritual_chamber:   [["whisper",300],["heartbeat",800]],
        void_chamber:     [["scare",200],["heartbeat",600]],
        chapel:           [["bell_ring",500]],
        graveyard:        [["whisper",800]],
        attic:            [["creak",400]],
        childrens_room:   [["laugh",1500,1]],
        nursery:          [["piano_note",800,1]],
        underground_lake: [["drip",300],["drip",900]],
        mirror_gallery:   [["whisper",1000,2]],
        ice_house:        [["creak",600]],
        tower_peak:       [["scare",500,4]],
        sanctuary:        [["bell_ring",300]],
        music_room:       [["piano_note",800]],
        laboratory:       [["glass_break",1200]],
        void_chamber_2:   [["scare",400],["whisper",900]],
    },

    // ── Contextual SFX map ────────────────────────────────────────
    _CONTEXTUAL_MAP: {
        door:               ["sfx_door_open",     0.60],
        door_slam:          ["sfx_door_slam",     0.70],
        door_creak:         ["sfx_door_creak",    0.55],
        door_lock:          ["sfx_door_lock",     0.60],
        flashlight_flicker: ["sfx_flashlight_flicker", 0.50],
        creak:              ["sfx_door_creak",    0.45],
        chain:              ["sfx_chain_rattle",  0.55],
        glass_break:        ["sfx_glass_break",   0.55],
        bell_ring:          ["sfx_bell_toll",     0.60],
        boss_appear:        ["sfx_boss_appear",   0.80],
        hit_player:         ["sfx_hit_player",    0.65],
        seal_found:         ["sfx_seal_found",    0.75],
        achievement:        ["sfx_achievement",   0.70],
        unlock:             ["sfx_unlock",        0.65],
        item_pickup:        ["sfx_item_pickup",   0.65],
        book_open:          ["sfx_book_open",     0.55],
        clock_chime:        ["sfx_clock_chime",   0.60],
        piano_key:          ["sfx_piano_key",     0.50],
        time_reset:         ["sfx_time_reset",    0.80],
    },

    // ── Interaction sound → playSound key map ─────────────────────
    _INTERACT_SOUNDS: {
        letter:"book_open", diary:"book_open", journal:"book_open",
        bookshelf:"book_open", mirror:"glass_break", door:"door",
        chest:"unlock", cabinet:"door_creak", painting:"step",
        clock:"clock", piano:"piano_note", music_box:"piano_note",
        fountain:"step", altar:"bell_ring", chains:"chain",
        grave:"whisper", statue:"whisper", well:"whisper",
        fireplace:"step", candle:"step",
    },

    // ═══════════════════════════════════════════════════════════════
    //  SAFE ACCESSORS
    // ═══════════════════════════════════════════════════════════════
    _g()  { return (typeof game      !== "undefined" && game)  ? game  : null; },
    _am() {
        return (typeof AudioManager !== "undefined" &&
                AudioManager.initialized)            ? AudioManager : null;
    },
    _ae() {
        return (typeof AudioEngine  !== "undefined" &&
                AudioEngine.initialized)             ? AudioEngine  : null;
    },

    _sound(key) {
        try { if (typeof playSound === "function") playSound(key); } catch (_) {}
    },
    _cam(method, ...args) {
        try {
            if (typeof Camera !== "undefined" && Camera &&
                typeof Camera[method] === "function") {
                Camera[method](...args);
            }
        } catch (_) {}
    },
    _mono(key) {
        try {
            if (typeof triggerMonologue === "function") triggerMonologue(key);
        } catch (_) {}
    },
    _shake(intensity, duration) {
        try {
            if (typeof triggerShake === "function") triggerShake(intensity, duration);
        } catch (_) {}
    },
    _notify(speaker, text, duration) {
        try {
            if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show) {
                SubtitleSystem.show(speaker, text, duration ?? 200);
            } else if (typeof showDialog === "function") {
                showDialog(speaker, text);
            }
        } catch (_) {}
    },

    _ready(key, interval) {
        return (this._tick - this._last[key]) >= interval;
    },
    _fire(key) { this._last[key] = this._tick; },

    // ═══════════════════════════════════════════════════════════════
    //  MASTER UPDATE — call once per game-loop tick
    // ═══════════════════════════════════════════════════════════════
    update() {
        const g = this._g();
        if (!g) return;
        if (typeof gameState === "undefined" || gameState !== "playing") return;

        this._tick++;

        try { this._handleRoomChange(g);      } catch (_) {}
        try { this._handleSanityAudio(g);     } catch (_) {}
        try { this._handleFlashlightAudio(g); } catch (_) {}
        try { this._handleCombatAudio(g);     } catch (_) {}
        try { this._handleTimeAudio(g);       } catch (_) {}
        try { this._handleGhostProximity(g);  } catch (_) {}
        try { this._handleEnvironment(g);     } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  ROOM TRANSITIONS
    // ═══════════════════════════════════════════════════════════════
    _handleRoomChange(g) {
        if (g.currentRoom === this.lastRoom) return;
        const prevRoom = this.lastRoom;
        this.lastRoom  = g.currentRoom;

        // FIX: removed this._timeFired.clear() from here.
        // Time thresholds are per-loop not per-room.
        // Clearing on room change caused scare/heartbeat sounds to
        // re-fire every time the player changed room in the last 30 s.

        // Door sound
        if (prevRoom) {
            this.playContextual(this._getDoorType(prevRoom, g.currentRoom));
        }

        // Entry sounds
        const recipe = this._ENTRY_SOUNDS[g.currentRoom];
        if (recipe) {
            const loop = g.loop ?? 0;
            for (const [type, ms, minLoop] of recipe) {
                if (minLoop != null && loop < minLoop) continue;
                this.playDelayed(type, ms);
            }
        }

        // Danger room monologue
        if (this._DANGER_ROOMS.has(g.currentRoom)) {
            this._mono("near_entity");
        }
    },

    _getDoorType(from, to) {
        if (this._HEAVY_DOOR_ROOMS.has(to) ||
            this._HEAVY_DOOR_ROOMS.has(from)) return "door_slam";
        const fromOut = this._OUTSIDE_ROOMS.has(from);
        const toOut   = this._OUTSIDE_ROOMS.has(to);
        if (fromOut !== toOut) return "door_creak";
        return "door";
    },

    // ═══════════════════════════════════════════════════════════════
    //  SANITY AUDIO
    // ═══════════════════════════════════════════════════════════════
    _handleSanityAudio(g) {
        const ratio   = (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100);
        const bracket = ratio > 0.60 ? "high"
                      : ratio > 0.35 ? "medium"
                      : ratio > 0.15 ? "low"
                      :                "critical";

        if (bracket !== this.lastSanityBracket) {
            const prev             = this.lastSanityBracket;
            this.lastSanityBracket = bracket;

            if (bracket === "medium" && prev === "high") {
                this._sound("sanityLoss");
                this._mono("sanity_low");
            }
            if (bracket === "low" && prev !== "critical") {
                this._sound("heartbeat");
                this._sound("whisper");
                this._mono("sanity_low");
            }
            if (bracket === "critical") {
                this._sound("scare");
                this._sound("heartbeat");
                this._cam("scareZoom", 0.04);
            }
            if (bracket === "high" && prev !== "high") {
                this._sound("pickup");
            }
        }

        if (bracket === "critical" && this._ready("sanityHeartbeat", 90)) {
            this._sound("heartbeat");
            this._fire("sanityHeartbeat");
        }
        if (bracket === "low" && this._ready("sanityWhisper", 300)) {
            this._sound("whisper");
            this._fire("sanityWhisper");
        }
        if (bracket === "critical" && this._ready("sanityRandom", 200)) {
            const scares = ["whisper","laugh","ghost"];
            this._sound(scares[Math.floor(Math.random() * scares.length)]);
            this._fire("sanityRandom");
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLASHLIGHT AUDIO
    // ═══════════════════════════════════════════════════════════════
    _handleFlashlightAudio(g) {
        const battery = g.flashlightBattery ?? 100;
        const bracket = battery > 50 ? "full"
                      : battery > 20 ? "medium"
                      : battery >  5 ? "low"
                      :                "dead";

        if (bracket !== this.lastBatteryBracket) {
            const prev              = this.lastBatteryBracket;
            this.lastBatteryBracket = bracket;

            if (bracket === "medium" && prev === "full") {
                this.playContextual("flashlight_flicker");
            }
            if (bracket === "low") {
                this.playContextual("flashlight_flicker");
                this._notify(
                    "SYSTEM",
                    "⚠️ Flashlight battery low. Press R with a battery to recharge.",
                    240
                );
            }
            if (bracket === "dead" && prev !== "dead") {
                this.playContextual("flashlight_flicker");
                this._mono("dark_room");
            }
        }

        if (this.flashlightFlickerCooldown > 0) {
            this.flashlightFlickerCooldown--;
        } else if (bracket === "low" && Math.random() < 0.02) {
            this.playContextual("flashlight_flicker");
            this.flashlightFlickerCooldown = 120;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  COMBAT AUDIO
    // ═══════════════════════════════════════════════════════════════
    _handleCombatAudio(g) {
        if (typeof combat === "undefined" || !combat) return;

        if (combat.active && !this.combatMusicPlaying) {
            this.combatMusicPlaying = true;
            this._mono("combat_start");
        }
        if (!combat.active && this.combatMusicPlaying) {
            this.combatMusicPlaying = false;
            this.bossIntroPlayed    = false;
        }

        if (combat.bossActive && !this.bossIntroPlayed) {
            this.bossIntroPlayed = true;
            this._sound("boss_appear");
            this._cam("scareZoom", 0.08);
        }

        if (combat.playerDamageFlash === 14) {
            this._sound("hit_player");
            this._cam("scareZoom", 0.03);
        }

        if ((combat.comboCount ?? 0) > 2 && combat.comboTimer === 44) {
            this._sound("pickup");
        }

        if (combat.dodgeActive && combat.dodgeTimer === 7) {
            this._sound("step");
            this._sound("step");
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  TIME PRESSURE AUDIO
    // ═══════════════════════════════════════════════════════════════
    _handleTimeAudio(g) {
        const timeLeft = (g.maxLoopTime ?? 600) - (g.loopTime ?? 0);

        if (timeLeft <= 120 && !this._timeFired.has(120)) {
            this._timeFired.add(120);
            this._sound("clock");
        }
        if (timeLeft <= 60 && !this._timeFired.has(60)) {
            this._timeFired.add(60);
            this._sound("clock");
            this._sound("clock");
            this._mono("time_low");
        }
        if (timeLeft <= 30 && !this._timeFired.has(30)) {
            this._timeFired.add(30);
            this._sound("heartbeat");
            this._cam("scareZoom", 0.03);
        }
        if (timeLeft <= 10 && !this._timeFired.has(10)) {
            this._timeFired.add(10);
            this._sound("scare");
            this._cam("scareZoom", 0.06);
            this._shake(5, 60);
        }

        if (timeLeft < 10 && timeLeft > 0 && this._ready("timeHeartbeat", 20)) {
            this._sound("heartbeat");
            this._fire("timeHeartbeat");
        }

        if (timeLeft < 30 && timeLeft >= 10 && this._ready("timeClock", 40)) {
            this._sound("clock");
            this._fire("timeClock");
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  GHOST PROXIMITY
    // ═══════════════════════════════════════════════════════════════
    _handleGhostProximity(g) {
        const room = typeof getCurrentRoom === "function"
            ? (function() { try { return getCurrentRoom(); } catch(_){return null;} })()
            : null;

        if (room && Array.isArray(room.ghosts)) {
            const px   = g.playerX ?? 0;
            const py   = g.playerY ?? 0;
            const loop = g.loop    ?? 0;

            for (const gh of room.ghosts) {
                if (loop < (gh.appearsAfterLoop ?? 0)) continue;

                const dist = Math.hypot(px - (gh.x ?? 0), py - (gh.y ?? 0));

                if (dist < 60 && dist > 55 && this._ready("ghostWhisper", 60)) {
                    this._sound("whisper");
                    this._mono("near_ghost");
                    this._fire("ghostWhisper");
                }

                if (dist < 30 && this._ready("ghostClose", 120)) {
                    if (gh.type === "entity" || gh.type === "deep_one") {
                        this._sound("scare");
                        this._cam("scareZoom", 0.04);
                    } else {
                        this._sound("ghost");
                    }
                    this._fire("ghostClose");
                }
            }
        }

        if (typeof DeathMemories !== "undefined" &&
            typeof DeathMemories.getNearestGhost === "function") {
            try {
                const nearGhost = DeathMemories.getNearestGhost(
                    g.playerX ?? 0, g.playerY ?? 0, g.currentRoom
                );
                if (nearGhost && this._ready("deathGhost", 180)) {
                    const d = Math.hypot(
                        (g.playerX ?? 0) - nearGhost.x,
                        (g.playerY ?? 0) - nearGhost.y
                    );
                    if (d < 40) {
                        this._sound("whisper");
                        this._mono("near_death_ghost");
                        this._fire("deathGhost");
                    }
                }
            } catch (_) {}
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  ENVIRONMENT SOUNDS
    // ═══════════════════════════════════════════════════════════════
    _handleEnvironment(g) {
        const ae = this._ae();

        if (g.flags?.fireLit && g.currentRoom === "library" &&
            ae && this._ready("fireCrackle", 240)) {
            if (Math.random() < 0.4) {
                try { ae.playAmbienceSound("fire_crackle"); } catch (_) {}
                this._fire("fireCrackle");
            }
        }

        if (this._WATER_ROOMS.has(g.currentRoom) &&
            ae && this._ready("waterDrip", 300)) {
            if (Math.random() < 0.30) {
                try { ae.playAmbienceSound("drip"); } catch (_) {}
                this._fire("waterDrip");
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  CONTEXTUAL PLAY
    // ═══════════════════════════════════════════════════════════════
    playContextual(type) {
        const am    = this._am();
        const entry = this._CONTEXTUAL_MAP[type];

        if (am && entry) {
            const [key, vol] = entry;
            try { am.playSFX(key, { volume: vol }); return; } catch (_) {}
        }

        const fallback = {
            door_slam:          "door",
            door_creak:         "door",
            door_lock:          "unlock",
            flashlight_flicker: "clock",
            creak:              "door",
            chain:              "chain",
            glass_break:        "glass_break",
            bell_ring:          "bell_ring",
        };
        this._sound(fallback[type] ?? type);
    },

    // FIX: now tracks the setTimeout ID in _pendingDelays[] so
    // reset() can cancel sounds that would otherwise fire into
    // the new loop (e.g. childrens_room laugh at 1500ms delay
    // firing when only 500ms remained on the clock).
    playDelayed(type, ms) {
        if (!Number.isFinite(ms) || ms < 0) ms = 0;
        const id = setTimeout(() => {
            // Remove from pending list when it fires naturally
            const i = this._pendingDelays.indexOf(id);
            if (i !== -1) this._pendingDelays.splice(i, 1);
            this._sound(type);
        }, ms);
        this._pendingDelays.push(id);
    },

    // ── Cancel all pending delayed sounds ─────────────────────────
    // FIX: new method called by reset() — clears all queued
    // setTimeout sounds before they can cross the loop boundary.
    cancelPendingDelays() {
        for (const id of this._pendingDelays) {
            clearTimeout(id);
        }
        this._pendingDelays = [];
    },

    // ═══════════════════════════════════════════════════════════════
    //  FOOTSTEP
    // ═══════════════════════════════════════════════════════════════
    playFootstep() {
        const g = this._g();
        if (!g) return;
        const floorType = this.FLOOR_SOUNDS[g.currentRoom] || "wood";
        const am        = this._am();

        if (am) {
            const keyMap = {
                wood:  "sfx_footstep_wood",
                stone: "sfx_footstep_stone",
                grass: "sfx_footstep_grass",
            };
            const key = keyMap[floorType] || "sfx_footstep_wood";
            try {
                am.playSFX(key, {
                    volume: 0.38 + Math.random() * 0.22,
                    rate:   0.85 + Math.random() * 0.30,
                });
                return;
            } catch (_) {}
        }
        this._sound("step");
    },

    // ═══════════════════════════════════════════════════════════════
    //  INTERACTION SOUNDS
    // ═══════════════════════════════════════════════════════════════
    playInteractSound(type) {
        const key = this._INTERACT_SOUNDS[type] || "pickup";
        this._sound(key);
    },

    // ═══════════════════════════════════════════════════════════════
    //  ONE-SHOT EVENTS
    // ═══════════════════════════════════════════════════════════════
    playSealFound() {
        this._sound("seal_found");
        this._sound("unlock");
        this.playDelayed("pickup", 300);
        this._cam("scareZoom", 0.05);
    },

    playLevelUp() {
        this._sound("levelup");
        this.playDelayed("pickup", 200);
        this.playDelayed("unlock", 400);
    },

    playAchievement() {
        this._sound("achievement");
        this.playDelayed("pickup", 150);
    },

    // ═══════════════════════════════════════════════════════════════
    //  ENDING MUSIC
    // ═══════════════════════════════════════════════════════════════
    playEndingMusic(type) {
        const am = this._am();
        if (!am) return;
        const map = {
            good:      "music_ending_good",
            perfect:   "music_ending_perfect",
            sacrifice: "music_ending_sacrifice",
            bad:       "music_ending_bad",
        };
        try { am.playMusic(map[type] || "music_ending_good", 1.0); } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  RESET
    // ═══════════════════════════════════════════════════════════════
    // FIX: old reset set _tick=0 and _last=-999 which caused every
    // continuous trigger to fire instantly on frame 1 of the new loop.
    // New reset keeps _tick running and uses a grace period so triggers
    // must wait their full interval before they can fire again.
    reset() {
        // Step 1: cancel all pending delayed sounds immediately
        this.cancelPendingDelays();

        // Step 2: reset non-tick state
        this.lastRoom                  = null;
        this.lastSanityBracket         = "high";
        this.lastBatteryBracket        = "full";
        this.combatMusicPlaying        = false;
        this.bossIntroPlayed           = false;
        this.flashlightFlickerCooldown = 0;
        this._timeFired.clear();

        // Step 3: push _last values forward with grace period
        // _tick is NOT reset — keeps interval math correct
        // Each trigger also gets a random spread so they stagger
        // and don't all become ready on the same frame.
        const GRACE  = 200; // ticks (~3.3 s at 60 fps)
        const SPREAD = 90;  // max extra random offset

        const INTERVALS = {
            sanityHeartbeat: 90,
            sanityWhisper:   300,
            sanityRandom:    200,
            timeHeartbeat:   20,
            timeClock:       40,
            ghostWhisper:    60,
            ghostClose:      120,
            deathGhost:      180,
            fireCrackle:     240,
            waterDrip:       300,
        };

        for (const key of Object.keys(this._last)) {
            const interval = INTERVALS[key] || 120;
            const offset   = Math.floor(Math.random() * SPREAD);
            this._last[key] = this._tick - interval + GRACE + offset;
        }
    },
};