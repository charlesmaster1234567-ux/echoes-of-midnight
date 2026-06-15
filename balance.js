// ═════════════════════════════════════════════════════════════════
//  BALANCE.JS — Game Balance, Bug Fixes, Quality of Life
//  Load AFTER all other JS files, BEFORE game.js
// ═════════════════════════════════════════════════════════════════

const Balance = {

    // ─── CONFIGURATION ───────────────────────────────────────────
    BASE_LOOP_DURATION: 600,   // 600 s = 10 minutes

    // ─── XP TABLE ────────────────────────────────────────────────
    XP_SCALE: {
        clue_found:          10,
        room_first_visit:     5,
        seal_found:          30,
        enemy_killed:        12,
        boss_killed:        150,
        quest_complete:      40,
        mission_complete:    35,
        loop_survived:       15,
        item_found:           8,
        npc_first_meet:      15,
        puzzle_solved:       25,
        set_piece_survived:  50,
        death_ghost_read:     5,
    },

    // ─── FRIENDLY GHOST TYPES (used in several places) ───────────
    _friendlyGhosts: new Set([
        "eleanora","reader","playing","sleeper","mother","sitter"
    ]),

    // ═════════════════════════════════════════════════════════════
    //  SAFE GAME-STATE ACCESSORS
    //  All Balance calculations go through these so a missing or
    //  partially-initialised `game` object never causes a throw.
    // ═════════════════════════════════════════════════════════════
    _game() {
        return (typeof game !== "undefined" && game) ? game : null;
    },
    _loop()  { const g = this._game(); return (g && Number.isFinite(g.loop))  ? g.loop  : 0; },
    _level() { const g = this._game(); return (g && Number.isFinite(g.level)) ? g.level : 1; },
    _flags() { const g = this._game(); return (g && g.permanentFlags)         ? g.permanentFlags : {}; },
    _gflags(){ const g = this._game(); return (g && g.flags)                  ? g.flags : {}; },

    // ═════════════════════════════════════════════════════════════
    //  DIFFICULTY SCALING
    // ═════════════════════════════════════════════════════════════
    getDifficultyMultiplier() {
        const loopFactor  = 1 + this._loop()  * 0.12;
        const levelFactor = 1 + this._level() * 0.05;
        return loopFactor / Math.max(0.1, levelFactor);
    },

    getEnemyHPMultiplier()     { return 1 + this._loop()  * 0.15; },
    getEnemyDamageMultiplier() { return 1 + this._loop()  * 0.10; },

    getSanityDrainRate() {
        const f = this._flags();
        return Math.max(0.001,
            0.003
            + this._loop()  * 0.0005
            - this._level() * 0.0002
            - (f.hasPrayerBeads ? 0.001  : 0)
            - (f.holyShield     ? 0.0005 : 0)
            - (f.musicBond      ? 0.0003 : 0)
        );
    },

    getMaxSanity() {
        const f = this._flags();
        return 100
            + (this._level() - 1) * 10
            + (f.mercyBonus   ? 15 : 0)
            + (f.scholarBonus ? 10 : 0);
    },

    getMaxHP() {
        const f = this._flags();
        return 80
            + this._level() * 10
            + (f.holyShield ? 20 : 0);
    },

    getFlashlightDrainRate() {
        return Math.max(0.002, 0.006 - this._level() * 0.0003);
    },

    getLoopDuration() {
        const f  = this._flags();
        const gf = this._gflags();
        return this.BASE_LOOP_DURATION
            + (f.pianoBonus    ?  60 : 0)
            + (gf.gearAltered  ? 120 : 0)
            + (f.speedBonus    ?  30 : 0);
    },

    // ─── GHOST DRAIN ─────────────────────────────────────────────
    _ghostRates: {
        entity:    0.050,
        deep_one:  0.040,
        victor:    0.030,
        doppelganger: 0.030,
        ancient:   0.020,
        watcher:   0.020,
        walker:    0.015,
        dripping:  0.015,
        wraith:    0.020,
        eleanora:  0,
        reader:    0.010,
        playing:   0.005,
        sleeper:   0.010,
        mother:    0.005,
        gardener:  0.010,
        worker:    0.010,
        sitter:    0.010,
        hiding:    0.015,
        dancers:   0.010,
    },

    getGhostDrainRate(ghostType) {
        if (this._flags().musicBond && this._friendlyGhosts.has(ghostType)) return 0;
        return this._ghostRates[ghostType] ?? 0.02;
    },

    // ─── COMBAT ──────────────────────────────────────────────────
    getWeaponDamage(weaponId, baseMultiplier) {
        const f          = this._flags();
        const levelBonus = this._level() * 0.8;
        const base       = (baseMultiplier || 1) * (1 + levelBonus / 10);
        const entity     = f.entityPowered ?  3 : 0;
        const mercy      = f.mercyBonus    ? -2 : 0;
        return Math.max(1, Math.floor(base + entity + mercy));
    },

    getPlayerDamageReduction() {
        const f          = this._flags();
        const levelArmor = this._level() * 0.5;
        const holyArmor  = f.holyShield ? 3 : 0;
        const essenceArmor = (
            typeof hasItem === "function" &&
            hasItem("purification_essence")
        ) ? 2 : 0;
        return levelArmor + holyArmor + essenceArmor;
    },

    getEncounterChance(roomId) {
        const dangerBonus = (
            typeof StoryEngine !== "undefined" &&
            StoryEngine?.consequences?.dangerRooms?.has?.(roomId)
        ) ? 0.15 : 0;
        const allianceReduction = this._flags().ghostAlliance ? -0.05 : 0;
        return Math.min(0.5, Math.max(0.05,
            0.15
            + this._loop() * 0.03
            + dangerBonus
            + allianceReduction
        ));
    },

    // ═════════════════════════════════════════════════════════════
    //  APPLY BALANCE TO GAME STATE
    //  Safe to call at any time — guards every write.
    // ═════════════════════════════════════════════════════════════
    apply() {
        const g = this._game();
        if (!g) return;

        // Max sanity — preserve current ratio when ceiling changes
        const newMaxSanity = this.getMaxSanity();
        if (g.maxSanity !== newMaxSanity) {
            const ratio  = Number.isFinite(g.sanity) && g.maxSanity > 0
                           ? g.sanity / g.maxSanity : 1;
            g.maxSanity  = newMaxSanity;
            g.sanity     = Math.min(newMaxSanity, ratio * newMaxSanity);
        }

        // maxLoopTime — only reset at the very start of a loop
        // Prevents stomping the timer mid-loop.
        if ((g.loopTime ?? 0) < 1.0) {
            g.maxLoopTime = this.getLoopDuration();
        }

        // Combat HP ceiling
        if (typeof combat !== "undefined" && combat) {
            combat.maxHP = this.getMaxHP();
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  PER-FRAME UPDATE
    //  Called once per game loop tick from masterUpdate().
    //  Every branch is guarded — no unchecked global access.
    // ═════════════════════════════════════════════════════════════

    // Internal frame counter — decoupled from the global `frame`
    // variable so Balance never crashes if `frame` is undefined.
    _tick: 0,

    update() {
        const g = this._game();
        if (!g) return;
        if (typeof gameState === "undefined" || gameState !== "playing") return;

        this._tick++;

        // ── Sanity drain ─────────────────────────────────────────
        const dialogPaused =
            (typeof dialogActive     !== "undefined" && dialogActive)    ||
            (typeof journalOpen      !== "undefined" && journalOpen)     ||
            (typeof transitionState  !== "undefined" && transitionState !== "none");

        if (!dialogPaused) {
            g.sanity = Math.max(0, Math.min(g.maxSanity,
                g.sanity - this.getSanityDrainRate()
            ));
        }

        // ── Flashlight drain ─────────────────────────────────────
        if (g.flashlightOn) {
            g.flashlightBattery = Math.max(0,
                (g.flashlightBattery ?? 0) - this.getFlashlightDrainRate()
            );
        }

        // ── Passive room heals ────────────────────────────────────
        const room = g.currentRoom;
        switch (room) {
            case "sanctuary":
                g.sanity = Math.min(g.maxSanity, g.sanity + 0.05);
                if (typeof combat !== "undefined" && combat) {
                    combat.playerHP = Math.min(combat.maxHP, (combat.playerHP ?? 0) + 0.03);
                }
                break;
            case "chapel":
                g.sanity = Math.min(g.maxSanity, g.sanity + 0.02);
                break;
            case "secret_garden":
                g.sanity = Math.min(g.maxSanity, g.sanity + 0.01);
                break;
        }

        // ── Item passives ─────────────────────────────────────────
        if (typeof hasItem === "function") {
            if (hasItem("blessed_candle")) {
                g.sanity = Math.min(g.maxSanity, g.sanity + 0.0005);
            }
        }

        // ── Cat friend (every 10 s at 60 fps) ────────────────────
        if (this._flags().catFriend && this._tick % 600 === 0) {
            g.sanity = Math.min(g.maxSanity, g.sanity + 1);
        }

        // ── Periodic balance apply (every 5 s) ───────────────────
        // apply() guards maxLoopTime internally, so this is safe.
        if (this._tick % 300 === 0) {
            this.apply();
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  CLAMPING / BUG FIXES
    // ═════════════════════════════════════════════════════════════
    clampSanity() {
        const g = this._game();
        if (!g) return;
        g.sanity = Math.max(0, Math.min(g.maxSanity ?? 100, g.sanity ?? 0));
    },

    clampBattery() {
        const g = this._game();
        if (!g) return;
        g.flashlightBattery = Math.max(0, Math.min(100, g.flashlightBattery ?? 0));
    },

    clampPlayerPosition() {
        const g = this._game();
        if (!g) return;
        const room = typeof getCurrentRoom === "function" ? getCurrentRoom() : null;
        if (!room) return;
        const w = room.width  ?? 800;
        const h = room.height ?? 600;
        g.playerX = Math.max(30, Math.min(w - 30, g.playerX ?? 30));
        g.playerY = Math.max(30, Math.min(h - 30, g.playerY ?? 30));
    },

    clampLevel() {
        const g = this._game();
        if (!g) return;
        if ((g.level ?? 1) > 50) g.level = 50;
        if ((g.xp    ?? 0) < 0)  g.xp    = 0;
    },

    validateRoom(roomId) {
        return typeof ROOMS !== "undefined" && ROOMS != null && roomId in ROOMS;
    },

    syncCombatHP() {
        if (typeof combat === "undefined" || !combat) return;
        const newMax = this.getMaxHP();
        if (combat.maxHP !== newMax)           combat.maxHP    = newMax;
        if ((combat.playerHP ?? 0) > newMax)   combat.playerHP = newMax;
        if ((combat.playerHP ?? 0) < 0)        combat.playerHP = 0;
    },

    fixBugs() {
        this.clampSanity();
        this.clampBattery();
        this.clampPlayerPosition();
        this.clampLevel();
        this.syncCombatHP();
    },

    // ═════════════════════════════════════════════════════════════
    //  INTERACTION COOLDOWN
    // ═════════════════════════════════════════════════════════════
    interactionCooldown: 0,

    canInteract() {
        if (this.interactionCooldown > 0) return false;
        this.interactionCooldown = 10;
        return true;
    },

    updateCooldowns() {
        if (this.interactionCooldown > 0) this.interactionCooldown--;
    },

    // ═════════════════════════════════════════════════════════════
    //  QOL — AUTO-EQUIP BEST WEAPON
    //  Runs every 2 s (120 ticks). Weapons checked in priority order.
    // ═════════════════════════════════════════════════════════════
    autoEquipBestWeapon() {
        if (typeof combat    === "undefined" || !combat)   return;
        if (typeof WEAPONS   === "undefined")              return;
        if (typeof hasItem   !== "function")               return;

        const g = this._game();
        if (!g) return;

        // [weaponId, condition]  — first passing entry wins
        const priority = [
            ["seal_blast",       () => typeof countSeals === "function" && countSeals() >= 3],
            ["holy_water",       () => this._flags().hasHolyWater],
            ["fire_poker",       () => hasItem("fire_poker_item")],
            ["crucifix_weapon",  () => hasItem("crucifix")],
            ["candelabra",       () => this._gflags().hasCandelabra],
            ["fists",            () => true],   // always available fallback
        ];

        for (const [id, cond] of priority) {
            try {
                if (cond()) { combat.equippedWeapon = id; return; }
            } catch (_) {}
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  QOL — SMART BATTERY AUTO-USE
    //  Only triggers once per 10 s (600 ticks) to avoid spam.
    // ═════════════════════════════════════════════════════════════
    smartBatteryUse() {
        const g = this._game();
        if (!g) return;
        if (!g.flashlightOn) return;
        if ((g.flashlightBattery ?? 100) >= 5) return;
        if (typeof hasItem !== "function" || !hasItem("battery")) return;

        g.flashlightBattery = Math.min(100, (g.flashlightBattery ?? 0) + 50);
        if (typeof removeItem === "function") removeItem("battery");

        this._notify("SYSTEM", "Auto-used battery — flashlight recharged.", 180);
        if (typeof playSound === "function") playSound("pickup");
    },

    // ═════════════════════════════════════════════════════════════
    //  QOL — DANGER INDICATORS
    //  Uses its own independent timer so it never depends on the
    //  global `frame` counter being accurate.
    // ═════════════════════════════════════════════════════════════
    _dangerTick:       0,
    _lastSanityWarn:  -1,
    _lastTimeWarn:    -1,

    checkDangers() {
        const g = this._game();
        if (!g) return;

        this._dangerTick++;
        if (this._dangerTick < 300) return;   // check every ~5 s at 60 fps
        this._dangerTick = 0;

        const loop = this._loop();

        // Sanity warning — once per loop, only in the 15-20 window
        if (
            (g.sanity ?? 100) < 20 &&
            (g.sanity ?? 100) > 15 &&
            this._lastSanityWarn !== loop
        ) {
            this._lastSanityWarn = loop;
            this._notify(
                "SYSTEM",
                "⚠️ Sanity critical! Find the chapel, sanctuary, or use herbs.",
                300
            );
        }

        // Time warning — once per loop, only when 40-45 s remain
        const timeLeft = (g.maxLoopTime ?? 600) - (g.loopTime ?? 0);
        if (
            timeLeft < 45 && timeLeft > 40 &&
            this._lastTimeWarn !== loop
        ) {
            this._lastTimeWarn = loop;
            if (typeof triggerMonologue === "function") {
                try { triggerMonologue("time_low"); } catch (_) {}
            }
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  NOTIFICATION HELPER
    //  Tries SubtitleSystem first, falls back to showDialog,
    //  falls back silently. Never throws.
    // ═════════════════════════════════════════════════════════════
    _notify(speaker, text, duration) {
        try {
            if (typeof SubtitleSystem !== "undefined" &&
                SubtitleSystem && typeof SubtitleSystem.show === "function") {
                SubtitleSystem.show(speaker, text, duration ?? 180);
            } else if (typeof showDialog === "function") {
                showDialog(speaker, text);
            }
        } catch (_) {}
    },

    // ═════════════════════════════════════════════════════════════
    //  MASTER UPDATE — single entry point called by game loop
    // ═════════════════════════════════════════════════════════════
    masterUpdate() {
        try { this.updateCooldowns();    } catch (_) {}
        try { this.update();             } catch (_) {}
        try { this.fixBugs();            } catch (_) {}
        try { this.checkDangers();       } catch (_) {}

        // Lower-frequency tasks keyed to internal tick
        if (this._tick % 600 === 0) {
            try { this.smartBatteryUse();     } catch (_) {}
        }
        if (this._tick % 120 === 0) {
            try { this.autoEquipBestWeapon(); } catch (_) {}
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  RESET — call at the start of every new loop / new game
    // ═════════════════════════════════════════════════════════════
    reset() {
        this.interactionCooldown = 0;
        this._tick               = 0;
        this._dangerTick         = 0;
        this._lastSanityWarn     = -1;
        this._lastTimeWarn       = -1;
        // game.loopTime is 0 here, so apply() will correctly set maxLoopTime
        this.apply();
    },
};

// ─── FLAGS consumed by game.js to skip its own drain loops ───────
const BALANCE_HANDLES_SANITY    = true;
const BALANCE_HANDLES_FLASHLIGHT = true;