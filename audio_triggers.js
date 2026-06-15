// ═════════════════════════════════════════════════════════════════
//  AUDIO_TRIGGERS.JS — Periodic atmospheric audio
//  Load AFTER audio_manager.js, BEFORE game.js
// ═════════════════════════════════════════════════════════════════

const AudioTriggers = {

    // ── Own tick counter — never reads global `frame` ─────────────
    _tick: 0,

    // ── Per-trigger last-fire timestamps (in ticks) ───────────────
    _last: {
        roomAtmos:       -9999,
        fireCrackle:     -9999,
        candleLight:     -9999,
        thunder:         -9999,
        sanityWhisper:   -9999,
        sanityBreathe:   -9999,
        scarestab:       -9999,
        clockChime:      -9999,
        ghostFootstep:   -9999,
        entityRumble:    -9999,
        windGust:        -9999,
    },

    // ── Minimum ticks between firings for each trigger ────────────
    _INTERVALS: {
        roomAtmos:       540,
        fireCrackle:     220,
        candleLight:     580,
        thunder:         870,
        sanityWhisper:   700,
        sanityBreathe:   340,
        scarestab:      1750,
        clockChime:      720,
        ghostFootstep:   900,
        entityRumble:    480,
        windGust:        660,
    },

    // ── Rooms that count as "outdoor" ─────────────────────────────
    _OUTDOOR: new Set([
        "garden_path","graveyard","greenhouse","well","conservatory",
        "secret_garden","hedge_maze","balcony","dovecote","bell_tower",
        "tower_peak",
    ]),

    // ── Rooms with a ticking clock ────────────────────────────────
    _CLOCK_ROOMS: new Set([
        "foyer","dining_room","upstairs_hall","study","clock_tower","clock_gears",
    ]),

    // ── Room → [candidates] for atmospheric one-shots ─────────────
    _ROOM_ATMOS: {
        childrens_room: [
            ["voice_child_laugh",    "voice", 0.40, 0.4],
            ["voice_child_giggle",   "voice", 0.38, 0.4],
            ["voice_child_cry",      "voice", 0.35, 0.6],
            ["sfx_rocking_horse",    "sfx",   0.50],
        ],
        nursery: [
            ["voice_child_laugh",    "voice", 0.38, 0.5],
            ["voice_child_giggle",   "voice", 0.36, 0.5],
            ["voice_child_cry",      "voice", 0.35, 0.6],
            ["sfx_rocking_horse",    "sfx",   0.48],
        ],
        master_bedroom: [
            ["voice_woman_moan",     "voice", 0.35, 0.5],
            ["voice_woman_scream",   "voice", 0.30, 0.8],
            ["voice_breathing_far",  "voice", 0.28, 0.6],
        ],
        study: [
            ["voice_man_groan",      "voice", 0.35, 0.3],
            ["sfx_book_open",        "sfx",   0.30],
        ],
        library: [
            ["voice_man_groan",      "voice", 0.32, 0.4],
            ["sfx_book_open",        "sfx",   0.35],
        ],
        bell_tower: [
            ["sfx_bell_toll",        "sfx",   0.65],
            ["sfx_bell_toll",        "sfx",   0.55],
        ],
        graveyard: [
            ["voice_whisper_3",      "voice", 0.40, 0.8],
            ["voice_whisper_4",      "voice", 0.38, 0.8],
            ["voice_breathing_far",  "voice", 0.35, 1.0],
            ["voice_entity_growl",   "voice", 0.30, 0.5],
        ],
        ritual_chamber: [
            ["voice_entity_growl",   "voice", 0.45],
            ["voice_entity_roar",    "voice", 0.42],
            ["sfx_chain_rattle",     "sfx",   0.38],
        ],
        void_chamber: [
            ["voice_entity_growl",   "voice", 0.48],
            ["voice_entity_roar",    "voice", 0.45],
            ["voice_breathing_near", "voice", 0.35, 0.4],
        ],
        basement: [
            ["voice_footsteps_ghost","voice", 0.35, 0.5],
            ["voice_breathing_far",  "voice", 0.30, 0.6],
            ["voice_man_groan",      "voice", 0.28, 0.4],
        ],
        catacombs: [
            ["voice_footsteps_ghost","voice", 0.38, 0.5],
            ["voice_whisper_1",      "voice", 0.32, 0.6],
            ["voice_entity_growl",   "voice", 0.28],
        ],
        secret_room: [
            ["voice_breathing_near", "voice", 0.40, 0.4],
            ["voice_whisper_2",      "voice", 0.35, 0.5],
        ],
        attic: [
            ["voice_child_cry",      "voice", 0.30, 0.5],
            ["sfx_rocking_horse",    "sfx",   0.35],
            ["voice_woman_moan",     "voice", 0.28, 0.6],
        ],
        parlor: [
            ["sfx_gramophone",       "sfx",   0.40],
            ["voice_woman_moan",     "voice", 0.25, 0.8],
        ],
        music_room: [
            ["sfx_piano_key",        "sfx",   0.50, null, 0.8],
            ["sfx_piano_key",        "sfx",   0.45, null, 1.0],
            ["sfx_piano_key",        "sfx",   0.42, null, 1.2],
        ],
        well: [
            ["sfx_chain_rattle",     "sfx",   0.50],
            ["voice_man_groan",      "voice", 0.28, 0.5],
        ],
        ice_house: [
            ["sfx_door_creak",       "sfx",   0.40],
            ["voice_breathing_far",  "voice", 0.28, 0.6],
        ],
        mirror_gallery: [
            ["sfx_glass_break",      "sfx",   0.40],
            ["voice_whisper_4",      "voice", 0.32, 0.5],
        ],
        laboratory: [
            ["sfx_glass_break",      "sfx",   0.30],
            ["voice_man_groan",      "voice", 0.30, 0.4],
        ],
        underground_lake: [
            ["voice_breathing_far",  "voice", 0.30, 0.8],
            ["voice_entity_growl",   "voice", 0.25, 0.5],
        ],
        observatory: [
            ["voice_whisper_1",      "voice", 0.28, 0.6],
            ["sfx_bell_toll",        "sfx",   0.30],
        ],
        chapel: [
            ["voice_child_cry",      "voice", 0.25, 0.8],
            ["voice_breathing_far",  "voice", 0.22, 1.0],
        ],
        servants_tunnel: [
            ["voice_footsteps_ghost","voice", 0.40, 0.4],
            ["voice_breathing_near", "voice", 0.35, 0.3],
        ],
        coal_room: [
            ["voice_man_groan",      "voice", 0.30, 0.4],
            ["sfx_chain_rattle",     "sfx",   0.35],
        ],
    },

    // ── Whisper pool ──────────────────────────────────────────────
    _WHISPERS: [
        "voice_whisper_1","voice_whisper_2",
        "voice_whisper_3","voice_whisper_4",
    ],

    // ── Active voice handles — tracked so reset can stop them ─────
    // FIX: was missing entirely — voices had no way to be stopped
    _activeVoices: [],

    // ═════════════════════════════════════════════════════════════
    //  SAFE HELPERS
    // ═════════════════════════════════════════════════════════════
    _am() {
        return (typeof AudioManager !== "undefined" && AudioManager.initialized)
            ? AudioManager : null;
    },
    _g() {
        return (typeof game !== "undefined" && game) ? game : null;
    },

    // FIX: now tracks the returned handle so stopAllVoices() can
    // cleanly stop voices that were fired just before loop reset.
    // Original _voice() discarded the handle — voices echoed forever.
    _voice(am, key, vol, fadeIn) {
        try {
            const handle = am.playVoice(key, {
                volume: vol,
                ...(fadeIn ? { fadeIn } : {}),
            });
            if (handle && handle.src) {
                this._activeVoices.push(handle);
                // Auto-evict from tracking list after 12 s (safety net)
                setTimeout(() => {
                    const i = this._activeVoices.indexOf(handle);
                    if (i !== -1) this._activeVoices.splice(i, 1);
                }, 12000);
            }
        } catch (_) {}
    },

    _sfx(am, key, vol, opts) {
        try {
            am.playSFX(key, { volume: vol, ...(opts || {}) });
        } catch (_) {}
    },

    // Returns true if enough ticks have passed since last fire
    _ready(key) {
        return (this._tick - this._last[key]) >= this._INTERVALS[key];
    },
    _fire(key) {
        this._last[key] = this._tick;
    },

    _jitterReady(key, jitter) {
        const elapsed  = this._tick - this._last[key];
        const interval = this._INTERVALS[key];
        if (elapsed < interval) return false;
        return Math.random() < (1 / Math.max(1, jitter));
    },

    // ═════════════════════════════════════════════════════════════
    //  STOP ALL VOICES — call at loop reset
    // ═════════════════════════════════════════════════════════════
    // FIX: new method — stops every tracked voice with a short fade
    // so voices fired just before reset don't echo into new loop.
    stopAllVoices() {
        for (const handle of this._activeVoices) {
            try {
                if (handle.gain && AudioManager.ctx) {
                    const now = AudioManager.ctx.currentTime;
                    handle.gain.gain.cancelScheduledValues(now);
                    handle.gain.gain.setValueAtTime(
                        handle.gain.gain.value, now
                    );
                    handle.gain.gain.linearRampToValueAtTime(
                        0.0001, now + 0.25
                    );
                }
                setTimeout(() => {
                    try { handle.src.stop(); } catch (_) {}
                }, 300);
            } catch (_) {}
        }
        this._activeVoices = [];
    },

    // ═════════════════════════════════════════════════════════════
    //  MASTER UPDATE  (call once per game-loop tick)
    // ═════════════════════════════════════════════════════════════
    update() {
        const am = this._am();
        const g  = this._g();
        if (!am || !g) return;
        if (typeof gameState === "undefined" || gameState !== "playing") return;

        this._tick++;
        const room   = g.currentRoom || "";
        const sanity = g.sanity      ?? 100;
        const loop   = g.loop        ?? 0;

        // ── Room atmospheric one-shot ────────────────────────────
        if (this._jitterReady("roomAtmos", 40)) {
            const candidates = this._ROOM_ATMOS[room];
            if (candidates && candidates.length > 0) {
                const minLoop = (room === "study" || room === "library") ? 1
                              : (room === "mirror_gallery")               ? 2
                              : 0;
                if (loop >= minLoop && Math.random() < 0.55) {
                    const pick = candidates[Math.floor(Math.random() * candidates.length)];
                    const [key, type, vol, fadeIn, rate] = pick;
                    if (type === "voice") {
                        this._voice(am, key, vol, fadeIn);
                    } else {
                        this._sfx(am, key, vol, rate ? { rate } : undefined);
                    }
                    this._fire("roomAtmos");
                }
            }
        }

        // ── Clock chime (ticking rooms) ──────────────────────────
        if (this._CLOCK_ROOMS.has(room) && this._jitterReady("clockChime", 60)) {
            if (Math.random() < 0.35) {
                this._sfx(am, "sfx_clock_chime", 0.40);
                this._fire("clockChime");
            }
        }

        // ── Ghost footstep (dark lower rooms) ────────────────────
        if ((room === "basement" || room === "catacombs" ||
             room === "servants_tunnel" || room === "coal_room") &&
             loop >= 1 && this._jitterReady("ghostFootstep", 80)) {
            if (Math.random() < 0.30) {
                this._voice(am, "voice_footsteps_ghost", 0.35, 0.5);
                this._fire("ghostFootstep");
            }
        }

        // ── Entity rumble (high-tension rooms) ───────────────────
        if ((room === "void_chamber" || room === "ritual_chamber") &&
             loop >= 2 && this._jitterReady("entityRumble", 60)) {
            if (Math.random() < 0.28) {
                this._voice(am,
                    Math.random() < 0.5 ? "voice_entity_growl" : "voice_entity_roar",
                    0.40);
                this._fire("entityRumble");
            }
        }

        // ── Fireplace crackle ─────────────────────────────────────
        if (g.flags?.fireLit && room === "library" &&
            this._jitterReady("fireCrackle", 30)) {
            if (Math.random() < 0.45) {
                this._sfx(am, "sfx_match_strike", 0.22, { rate: 1.5 });
                this._fire("fireCrackle");
            }
        }

        // ── Candle ambience ───────────────────────────────────────
        if (g.flags?.candlesLit && room === "dining_room" &&
            this._jitterReady("candleLight", 50)) {
            if (Math.random() < 0.32) {
                this._sfx(am, "sfx_candle_light", 0.30);
                this._fire("candleLight");
            }
        }

        // ── Outdoor thunder ───────────────────────────────────────
        if (this._OUTDOOR.has(room) && this._jitterReady("thunder", 80)) {
            if (Math.random() < 0.28) {
                this._sfx(am, "sfx_thunder", 0.50);
                this._fire("thunder");
            }
        }

        // ── Outdoor wind gust ─────────────────────────────────────
        if (this._OUTDOOR.has(room) && this._jitterReady("windGust", 60)) {
            if (Math.random() < 0.22 &&
                typeof AudioEngine !== "undefined" && AudioEngine.initialized) {
                try {
                    AudioEngine.synthWind(
                        AudioEngine.ctx.currentTime,
                        0.015 + Math.random() * 0.01,
                        1.5 + Math.random() * 1.5
                    );
                } catch (_) {}
                this._fire("windGust");
            }
        }

        // ── Low-sanity whispers (sanity < 70) ────────────────────
        if (sanity < 70 && this._jitterReady("sanityWhisper", 60)) {
            if (Math.random() < 0.42) {
                const key = this._WHISPERS[
                    Math.floor(Math.random() * this._WHISPERS.length)
                ];
                this._voice(am, key, 0.35, 0.5);
                this._fire("sanityWhisper");
            }
        }

        // ── Critical sanity breathing (sanity < 30) ──────────────
        if (sanity < 30 && this._jitterReady("sanityBreathe", 30)) {
            if (Math.random() < 0.55) {
                this._voice(am, "voice_breathing_near", 0.45, 0.3);
                this._fire("sanityBreathe");
            }
        }

        // ── Scare stab (sanity < 20, very rare) ──────────────────
        if (sanity < 20 && this._jitterReady("scarestab", 120)) {
            if (Math.random() < 0.25) {
                this._voice(am, "voice_scare_stab", 0.70);
                this._fire("scarestab");
            }
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  RESET  (call at loop start)
    // ═════════════════════════════════════════════════════════════
    // FIX: old reset set _last to -9999 which caused every trigger
    // to fire instantly on frame 1 of the new loop (burst of noise).
    // New reset uses current _tick so triggers must wait their full
    // interval PLUS a grace period before they can fire again.
    // Random spread prevents all triggers becoming ready on the same frame.
    reset() {
        // Stop all voices that are still playing from the old loop
        this.stopAllVoices();

        const GRACE  = 200; // ticks (~3.3 s at 60 fps) before any trigger fires
        const SPREAD = 120; // max extra random offset per trigger

        for (const key of Object.keys(this._last)) {
            const offset = Math.floor(Math.random() * SPREAD);
            this._last[key] = this._tick
                            - this._INTERVALS[key]
                            + GRACE
                            + offset;
        }
        // _tick is intentionally NOT reset — keeps jitter math correct
    },
};