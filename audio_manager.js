// ═════════════════════════════════════════════════════════════════
//  AUDIO_MANAGER.JS — Bulletproof, never blocks main thread
// ═════════════════════════════════════════════════════════════════

const AudioManager = {

    // ── State ─────────────────────────────────────────────────────
    ctx:            null,
    masterGain:     null,
    musicGain:      null,
    ambienceGain:   null,
    sfxGain:        null,
    voiceGain:      null,

    masterVolume:   0.8,
    musicVolume:    0.35,
    ambienceVolume: 0.4,
    sfxVolume:      0.6,
    voiceVolume:    0.5,

    initialized:    false,
    buffers:        {},
    loading:        {},         // key → true while fetch is in-flight
    failed:         new Set(),

    currentMusicKey:      null,
    currentMusicSource:   null,
    currentMusicGainNode: null,

    ambienceSources: {},        // key → { src, gain }
    lastRoom:        null,
    inCombat:        false,

    // Load queue — guarantees ≤ N concurrent fetches
    _loadQueue:          [],
    _loadInProgress:     0,
    _maxConcurrentLoads: 3,

    // Retry book-keeping for playMusic()
    _musicRetryTimers: {},      // key → setInterval id

    // ── Asset manifest ────────────────────────────────────────────
    FILES: {
        music_menu:           "sounds/music/menu_theme.mp3",
        music_foyer:          "sounds/music/foyer_piano.mp3",
        music_library:        "sounds/music/library_piano.mp3",
        music_upstairs:       "sounds/music/upstairs_strings.mp3",
        music_basement:       "sounds/music/basement_drone.mp3",
        music_ritual:         "sounds/music/ritual_chants.mp3",
        music_void:           "sounds/music/void_ambience.mp3",
        music_garden:         "sounds/music/garden_melancholy.mp3",
        music_chapel:         "sounds/music/chapel_organ.mp3",
        music_combat:         "sounds/music/combat_tension.mp3",
        music_ending_good:    "sounds/music/ending_liberation.mp3",
        music_ending_bad:     "sounds/music/ending_dark.mp3",
        music_ending_perfect: "sounds/music/ending_dawn.mp3",
        music_ending_sacrifice:"sounds/music/ending_sacrifice.mp3",

        amb_wind_inside:   "sounds/ambience/wind_inside.mp3",
        amb_wind_outside:  "sounds/ambience/wind_outside.mp3",
        amb_wind_howling:  "sounds/ambience/wind_howling.mp3",
        amb_rain:          "sounds/ambience/rain_light.mp3",
        amb_fire_crackle:  "sounds/ambience/fire_crackling.mp3",
        amb_dripping:      "sounds/ambience/water_dripping.mp3",
        amb_heartbeat:     "sounds/ambience/heartbeat_slow.mp3",
        amb_cricket:       "sounds/ambience/crickets_night.mp3",
        amb_owl:           "sounds/ambience/owl_distant.mp3",
        amb_water_lapping: "sounds/ambience/water_lapping.mp3",
        amb_deep_hum:      "sounds/ambience/deep_hum.mp3",
        amb_void_pulse:    "sounds/ambience/void_pulse.mp3",
        amb_choir_distant: "sounds/ambience/choir_distant.mp3",
        amb_clock_ticking: "sounds/ambience/clock_ticking.mp3",
        amb_piano_distant: "sounds/ambience/piano_distant.mp3",
        amb_music_box:     "sounds/ambience/music_box.mp3",

        sfx_footstep_wood:      "sounds/sfx/footstep_wood.mp3",
        sfx_footstep_stone:     "sounds/sfx/footstep_stone.mp3",
        sfx_footstep_grass:     "sounds/sfx/footstep_grass.mp3",
        sfx_door_open:          "sounds/sfx/door_open.mp3",
        sfx_door_slam:          "sounds/sfx/door_slam.mp3",
        sfx_door_creak:         "sounds/sfx/door_creak.mp3",
        sfx_door_lock:          "sounds/sfx/door_lock.mp3",
        sfx_item_pickup:        "sounds/sfx/item_pickup.mp3",
        sfx_item_use:           "sounds/sfx/item_use.mp3",
        sfx_clock_chime:        "sounds/sfx/clock_chime.mp3",
        sfx_unlock:             "sounds/sfx/lock_unlock.mp3",
        sfx_glass_break:        "sounds/sfx/glass_break.mp3",
        sfx_chain_rattle:       "sounds/sfx/chain_rattle.mp3",
        sfx_time_reset:         "sounds/sfx/time_reset.mp3",
        sfx_level_up:           "sounds/sfx/level_up.mp3",
        sfx_book_open:          "sounds/sfx/book_open.mp3",
        sfx_flashlight_click:   "sounds/sfx/flashlight_click.mp3",
        sfx_flashlight_flicker: "sounds/sfx/flashlight_flicker.mp3",
        sfx_piano_key:          "sounds/sfx/piano_key_single.mp3",
        sfx_bell_toll:          "sounds/sfx/bell_toll.mp3",
        sfx_thunder:            "sounds/sfx/thunder_distant.mp3",
        sfx_match_strike:       "sounds/sfx/match_strike.mp3",
        sfx_candle_light:       "sounds/sfx/candle_light.mp3",
        sfx_achievement:        "sounds/sfx/achievement_unlock.mp3",
        sfx_attack_swing:       "sounds/sfx/attack_swing.mp3",
        sfx_hit_enemy:          "sounds/sfx/hit_enemy.mp3",
        sfx_hit_player:         "sounds/sfx/hit_player.mp3",
        sfx_enemy_death:        "sounds/sfx/enemy_death.mp3",
        sfx_boss_appear:        "sounds/sfx/boss_appear.mp3",
        sfx_seal_found:         "sounds/sfx/seal_found.mp3",
        sfx_seal_restore:       "sounds/sfx/seal_restore.mp3",
        sfx_rocking_horse:      "sounds/sfx/rocking_horse.mp3",
        sfx_gramophone:         "sounds/sfx/gramophone_static.mp3",

        voice_whisper_1:       "sounds/voices/whisper_help.mp3",
        voice_whisper_2:       "sounds/voices/whisper_run.mp3",
        voice_whisper_3:       "sounds/voices/whisper_find_me.mp3",
        voice_whisper_4:       "sounds/voices/whisper_leave.mp3",
        voice_child_laugh:     "sounds/voices/child_laugh.mp3",
        voice_child_cry:       "sounds/voices/child_crying.mp3",
        voice_child_giggle:    "sounds/voices/child_giggle.mp3",
        voice_woman_moan:      "sounds/voices/woman_moan.mp3",
        voice_woman_scream:    "sounds/voices/woman_scream_distant.mp3",
        voice_man_groan:       "sounds/voices/man_groan.mp3",
        voice_breathing_near:  "sounds/voices/breathing_close.mp3",
        voice_breathing_far:   "sounds/voices/breathing_distant.mp3",
        voice_entity_growl:    "sounds/voices/entity_growl.mp3",
        voice_entity_roar:     "sounds/voices/entity_roar.mp3",
        voice_footsteps_ghost: "sounds/voices/ghost_footsteps.mp3",
        voice_scare_stab:      "sounds/voices/scare_stab.mp3",
    },

    // ── Room → music mapping ─────────────────────────────────────
    ROOM_MUSIC: {
        foyer:"music_foyer", library:"music_library", dining_room:"music_foyer",
        parlor:"music_foyer", kitchen:"music_foyer", ballroom:"music_foyer",
        gallery:"music_foyer", servants_quarters:"music_foyer", trophy_room:"music_foyer",
        wine_cellar:"music_basement", wine_tasting:"music_basement",
        conservatory:"music_garden", greenhouse:"music_garden", potting_shed:"music_garden",
        secret_garden:"music_garden", hedge_maze:"music_garden", chapel:"music_chapel",
        upstairs_hall:"music_upstairs", master_bedroom:"music_upstairs",
        childrens_room:"music_upstairs", nursery:"music_upstairs", study:"music_upstairs",
        attic_stairs:"music_upstairs", attic:"music_upstairs", tower_stairs:"music_upstairs",
        observatory:"music_upstairs", music_room:"music_upstairs",
        mirror_gallery:"music_upstairs", balcony:"music_upstairs",
        clock_tower:"music_upstairs", clock_gears:"music_upstairs",
        basement:"music_basement", catacombs:"music_basement",
        underground_lake:"music_basement", coal_room:"music_basement",
        root_cellar:"music_basement", laundry:"music_basement",
        ice_house:"music_basement", servants_tunnel:"music_basement",
        laboratory:"music_basement", ritual_chamber:"music_ritual",
        secret_room:"music_ritual", sanctuary:"music_ritual",
        void_chamber:"music_void", tower_peak:"music_void",
        // null = silence outdoors
        garden_path:null, graveyard:null, well:null, bell_tower:null, dovecote:null,
    },

    // ── Room → ambience layers ───────────────────────────────────
    ROOM_AMBIENCE: {
        foyer:            ["amb_wind_inside","amb_clock_ticking"],
        library:          ["amb_wind_inside","amb_fire_crackle"],
        dining_room:      ["amb_wind_inside","amb_clock_ticking"],
        parlor:           ["amb_wind_inside"],
        kitchen:          ["amb_dripping","amb_wind_inside"],
        ballroom:         ["amb_wind_inside"],
        gallery:          ["amb_wind_inside"],
        trophy_room:      ["amb_wind_inside"],
        conservatory:     ["amb_rain","amb_wind_outside"],
        greenhouse:       ["amb_rain","amb_wind_outside","amb_cricket"],
        potting_shed:     ["amb_wind_outside"],
        secret_garden:    ["amb_wind_outside","amb_cricket"],
        hedge_maze:       ["amb_wind_outside","amb_owl"],
        garden_path:      ["amb_wind_outside","amb_cricket","amb_owl"],
        graveyard:        ["amb_wind_outside","amb_owl","amb_cricket"],
        well:             ["amb_wind_outside","amb_dripping"],
        dovecote:         ["amb_wind_outside"],
        chapel:           ["amb_wind_inside","amb_choir_distant"],
        servants_quarters:["amb_wind_inside","amb_dripping"],
        servants_tunnel:  ["amb_dripping"],
        wine_cellar:      ["amb_dripping","amb_wind_inside"],
        wine_tasting:     ["amb_wind_inside"],
        laundry:          ["amb_dripping"],
        upstairs_hall:    ["amb_wind_inside","amb_clock_ticking"],
        master_bedroom:   ["amb_wind_inside"],
        childrens_room:   ["amb_music_box","amb_wind_inside"],
        nursery:          ["amb_music_box","amb_wind_inside"],
        study:            ["amb_wind_inside","amb_clock_ticking"],
        laboratory:       ["amb_wind_inside"],
        attic_stairs:     ["amb_wind_howling"],
        attic:            ["amb_wind_howling"],
        tower_stairs:     ["amb_wind_howling"],
        observatory:      ["amb_wind_howling"],
        bell_tower:       ["amb_wind_howling","amb_wind_outside"],
        tower_peak:       ["amb_wind_howling"],
        clock_tower:      ["amb_clock_ticking","amb_wind_inside"],
        clock_gears:      ["amb_clock_ticking"],
        music_room:       ["amb_piano_distant"],
        mirror_gallery:   ["amb_wind_inside"],
        balcony:          ["amb_wind_outside"],
        basement:         ["amb_dripping","amb_heartbeat","amb_deep_hum"],
        coal_room:        ["amb_deep_hum"],
        root_cellar:      ["amb_dripping"],
        ice_house:        ["amb_deep_hum"],
        catacombs:        ["amb_dripping","amb_wind_inside"],
        underground_lake: ["amb_water_lapping","amb_dripping"],
        ritual_chamber:   ["amb_heartbeat","amb_deep_hum"],
        sanctuary:        ["amb_choir_distant"],
        void_chamber:     ["amb_void_pulse","amb_heartbeat"],
        secret_room:      ["amb_wind_inside"],
    },

    // ═════════════════════════════════════════════════════════════
    //  INIT
    // ═════════════════════════════════════════════════════════════
    init() {
        if (this.initialized) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();

            const mkGain = (val, dest) => {
                const g = this.ctx.createGain();
                g.gain.value = val;
                g.connect(dest);
                return g;
            };

            this.masterGain  = mkGain(this.masterVolume,   this.ctx.destination);
            this.musicGain   = mkGain(this.musicVolume,    this.masterGain);
            this.ambienceGain= mkGain(this.ambienceVolume, this.masterGain);
            this.sfxGain     = mkGain(this.sfxVolume,      this.masterGain);
            this.voiceGain   = mkGain(this.voiceVolume,    this.masterGain);

            this.initialized = true;
            this._preloadEssentials();
        } catch (e) {
            console.warn("[AudioManager] init failed:", e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  LOADING
    // ═════════════════════════════════════════════════════════════
    _preloadEssentials() {
        const priority = [
            "music_menu","music_foyer",
            "sfx_footstep_wood","sfx_door_open","sfx_item_pickup",
            "sfx_clock_chime","sfx_time_reset","sfx_level_up","sfx_unlock",
            "voice_whisper_1","amb_wind_inside","amb_clock_ticking",
        ];
        for (const key of priority) this._enqueue(key);
    },

    // Public — safe to call many times for the same key
    load(key) {
        if (!this.ctx) return;
        if (this.buffers[key] || this.loading[key] || this.failed.has(key)) return;
        if (!this.FILES[key]) { this.failed.add(key); return; }
        this._enqueue(key);
    },

    _enqueue(key) {
        if (this.buffers[key] || this.loading[key] || this.failed.has(key)) return;
        if (!this.FILES[key]) { this.failed.add(key); return; }
        if (!this._loadQueue.includes(key)) this._loadQueue.push(key);
        this._pump();
    },

    // Drain the queue — never called recursively on the call stack;
    // recursive calls come from resolved Promises (microtask queue).
    _pump() {
        while (
            this._loadInProgress < this._maxConcurrentLoads &&
            this._loadQueue.length > 0
        ) {
            const key = this._loadQueue.shift();

            // Double-check now that it is at the front of the queue
            if (this.buffers[key] || this.loading[key] || this.failed.has(key)) continue;
            if (!this.FILES[key]) { this.failed.add(key); continue; }

            this.loading[key] = true;
            this._loadInProgress++;

            fetch(this.FILES[key])
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.arrayBuffer();
                })
                .then(ab => this.ctx.decodeAudioData(ab))
                .then(buf => {
                    this.buffers[key] = buf;
                    delete this.loading[key];
                    this._loadInProgress--;
                    this._pump();
                })
                .catch(() => {
                    delete this.loading[key];
                    this.failed.add(key);
                    this._loadInProgress--;
                    this._pump();
                });
        }
    },

    isLoaded(key) { return !!this.buffers[key]; },

    // ═════════════════════════════════════════════════════════════
    //  LOW-LEVEL PLAYBACK
    // ═════════════════════════════════════════════════════════════
    _playBuffer(key, destGain, options = {}) {
        if (!this.ctx || !this.initialized) return null;
        const buf = this.buffers[key];
        if (!buf) return null;
        try {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.loop = !!options.loop;
            src.playbackRate.value = options.rate != null ? options.rate : 1.0;

            const g = this.ctx.createGain();
            const vol = options.volume != null ? options.volume : 1.0;
            const now = this.ctx.currentTime;

            if (options.fadeIn && options.fadeIn > 0) {
                g.gain.setValueAtTime(0.0001, now);
                g.gain.linearRampToValueAtTime(vol, now + options.fadeIn);
            } else {
                g.gain.setValueAtTime(vol, now);
            }

            src.connect(g);
            g.connect(destGain || this.sfxGain);
            src.start(now + (options.delay || 0));
            return { src, gain: g };
        } catch (e) {
            return null;
        }
    },

    // Safely stop a BufferSourceNode — never throws
    _stopSource(src) {
        if (!src) return;
        try { src.stop(); } catch (_) {}
    },

    // Fade a GainNode to near-zero then stop the source
    _fadeAndStop(gainNode, sourceNode, fadeSec) {
        if (!gainNode) return;
        try {
            const now = this.ctx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
        } catch (_) {}
        // Stop after fade + small buffer
        setTimeout(() => this._stopSource(sourceNode), (fadeSec * 1000) + 120);
    },

    // ═════════════════════════════════════════════════════════════
    //  MUSIC
    // ═════════════════════════════════════════════════════════════
    playMusic(key, fadeTime = 2.0) {
        if (!this.ctx || !this.initialized) return;

        // Already playing this track — do nothing
        if (key === this.currentMusicKey && this.currentMusicSource) return;

        // Cancel any pending retry for a *different* key
        this._cancelMusicRetry(key);

        // Fade out whatever is currently playing
        this._fadeAndStop(this.currentMusicGainNode, this.currentMusicSource, fadeTime);
        this.currentMusicSource   = null;
        this.currentMusicGainNode = null;
        this.currentMusicKey      = key;

        if (this.buffers[key]) {
            this._startMusic(key, fadeTime);
        } else if (!this.failed.has(key)) {
            // Load then start — use a bounded retry loop
            this._enqueue(key);
            this._waitForBuffer(key, fadeTime);
        }
        // If key is in failed set — silently do nothing
    },

    // Poll until the buffer is ready, then start.
    // Caps at 30 attempts (~12 s) so it can never loop forever.
    _waitForBuffer(key, fadeTime) {
        // Only one waiter per key at a time
        if (this._musicRetryTimers[key]) return;

        let tries = 0;
        const MAX  = 30;
        const TICK = 400; // ms

        this._musicRetryTimers[key] = setInterval(() => {
            tries++;

            if (this.buffers[key]) {
                this._cancelMusicRetry(key);
                // Only start if this key is still the desired track
                if (this.currentMusicKey === key) {
                    this._startMusic(key, fadeTime);
                }
                return;
            }

            if (tries >= MAX || this.failed.has(key)) {
                this._cancelMusicRetry(key);
            }
        }, TICK);
    },

    _cancelMusicRetry(key) {
        // Cancel all pending retries when called without argument,
        // or just the one for the given key.
        if (key == null) {
            for (const k of Object.keys(this._musicRetryTimers)) {
                clearInterval(this._musicRetryTimers[k]);
            }
            this._musicRetryTimers = {};
        } else if (this._musicRetryTimers[key]) {
            clearInterval(this._musicRetryTimers[key]);
            delete this._musicRetryTimers[key];
        }
    },

    _startMusic(key, fadeTime = 2.0) {
        if (!this.ctx || !this.buffers[key]) return;
        // Guard: another track may have been requested while we waited
        if (this.currentMusicKey !== key) return;
        try {
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffers[key];
            src.loop   = true;

            const g   = this.ctx.createGain();
            const now = this.ctx.currentTime;
            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(1.0, now + fadeTime);

            src.connect(g);
            g.connect(this.musicGain);
            src.start();

            this.currentMusicSource   = src;
            this.currentMusicGainNode = g;
        } catch (e) {
            console.warn("[AudioManager] _startMusic failed:", e);
        }
    },

    stopMusic(fadeTime = 1.5) {
        this._cancelMusicRetry();           // cancel any waiting retry
        this._fadeAndStop(this.currentMusicGainNode, this.currentMusicSource, fadeTime);
        this.currentMusicSource   = null;
        this.currentMusicGainNode = null;
        this.currentMusicKey      = null;
    },

    // ═════════════════════════════════════════════════════════════
    //  AMBIENCE
    // ═════════════════════════════════════════════════════════════
    setRoomAmbience(roomId) {
        if (!this.ctx || !this.initialized) return;
        const needed = this.ROOM_AMBIENCE[roomId] || [];

        // Stop layers that are no longer needed
        for (const key of Object.keys(this.ambienceSources)) {
            if (!needed.includes(key)) this._fadeOutAmbience(key);
        }

        // Start new layers
        for (const key of needed) {
            if (!this.ambienceSources[key]) this._startAmbienceLayer(key);
        }
    },

    _startAmbienceLayer(key) {
        if (!this.ctx) return;

        // Mark slot immediately so duplicate calls are ignored
        this.ambienceSources[key] = null;   // placeholder

        const _start = () => {
            // Layer was cancelled while we were waiting
            if (!(key in this.ambienceSources)) return;
            if (this.failed.has(key)) {
                delete this.ambienceSources[key];
                return;
            }
            if (!this.buffers[key]) {
                this._enqueue(key);
                setTimeout(_start, 400);
                return;
            }
            try {
                const src = this.ctx.createBufferSource();
                src.buffer = this.buffers[key];
                src.loop   = true;

                const g   = this.ctx.createGain();
                const now = this.ctx.currentTime;
                g.gain.setValueAtTime(0.0001, now);
                g.gain.linearRampToValueAtTime(1.0, now + 2.0);

                src.connect(g);
                g.connect(this.ambienceGain);
                src.start();

                this.ambienceSources[key] = { src, gain: g };
            } catch (e) {
                delete this.ambienceSources[key];
            }
        };

        _start();
    },

    _fadeOutAmbience(key) {
        const layer = this.ambienceSources[key];
        // Remove from map immediately so _startAmbienceLayer won't
        // re-create it and setRoomAmbience won't double-fade it
        delete this.ambienceSources[key];

        if (!layer || !layer.src) return;   // was still pending — nothing to stop
        this._fadeAndStop(layer.gain, layer.src, 2.0);
    },

    stopAllAmbience() {
        for (const key of Object.keys(this.ambienceSources)) {
            this._fadeOutAmbience(key);
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  SFX & VOICE — fire-and-forget
    // ═════════════════════════════════════════════════════════════
    playSFX(key, options = {}) {
        if (!this.ctx || !this.initialized) return null;
        if (!this.buffers[key]) {
            // Kick off a background load; return null this frame
            this._enqueue(key);
            return null;
        }
        return this._playBuffer(key, this.sfxGain, options);
    },

    playVoice(key, options = {}) {
        if (!this.ctx || !this.initialized) return null;
        if (!this.buffers[key]) {
            this._enqueue(key);
            return null;
        }
        return this._playBuffer(key, this.voiceGain, options);
    },

    // ═════════════════════════════════════════════════════════════
    //  PER-FRAME UPDATE  (call once per game loop tick)
    // ═════════════════════════════════════════════════════════════
    update(roomId) {
        if (!this.initialized) return;
        this.resume();

        // ── Combat music switching ────────────────────────────────
        const combatNow = !!(
            typeof combat !== "undefined" && combat && combat.active
        );
        if (combatNow !== this.inCombat) {
            this.inCombat = combatNow;
            if (combatNow) {
                this.playMusic("music_combat", 0.5);
            } else {
                this._playRoomMusic(roomId, 1.5);
            }
        }

        // ── Room transition ───────────────────────────────────────
        if (roomId !== this.lastRoom) {
            this.lastRoom = roomId;
            if (!combatNow) this._playRoomMusic(roomId, 2.0);
            this.setRoomAmbience(roomId);
        }

        // ── Sanity-driven music warp ──────────────────────────────
        if (
            typeof game !== "undefined" &&
            game.sanity != null && game.maxSanity != null &&
            this.currentMusicSource && this.musicGain
        ) {
            try {
                const ratio = Math.max(0, Math.min(1, game.sanity / game.maxSanity));
                this.currentMusicSource.playbackRate.value = 1.0 - (1 - ratio) * 0.08;
                this.musicGain.gain.value = this.musicVolume * (0.7 + ratio * 0.3);
            } catch (_) {}
        }
    },

    _playRoomMusic(roomId, fadeTime) {
        const musicKey = Object.prototype.hasOwnProperty.call(this.ROOM_MUSIC, roomId)
            ? this.ROOM_MUSIC[roomId]
            : "music_foyer";

        if (musicKey === null) this.stopMusic(fadeTime);
        else                   this.playMusic(musicKey, fadeTime);
    },

    // ═════════════════════════════════════════════════════════════
    //  VOLUME CONTROLS
    // ═════════════════════════════════════════════════════════════
    _clamp(v) { return Math.max(0, Math.min(1, v)); },

    setMasterVolume(v) {
        this.masterVolume = this._clamp(v);
        if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    },
    setMusicVolume(v) {
        this.musicVolume = this._clamp(v);
        if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    },
    setAmbienceVolume(v) {
        this.ambienceVolume = this._clamp(v);
        if (this.ambienceGain) this.ambienceGain.gain.value = this.ambienceVolume;
    },
    setSFXVolume(v) {
        this.sfxVolume = this._clamp(v);
        if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    },
    setVoiceVolume(v) {
        this.voiceVolume = this._clamp(v);
        if (this.voiceGain) this.voiceGain.gain.value = this.voiceVolume;
    },
};


// ═════════════════════════════════════════════════════════════════
//  playSound() — convenience wrapper
// ═════════════════════════════════════════════════════════════════
function playSound(type) {
    if (!AudioManager.initialized) return;

    const WHISPERS = [
        "voice_whisper_1","voice_whisper_2",
        "voice_whisper_3","voice_whisper_4",
    ];
    const rndWhisper = () => WHISPERS[Math.floor(Math.random() * WHISPERS.length)];

    const MAP = {
        step:        () => AudioManager.playSFX("sfx_footstep_wood", { volume: 0.5 + Math.random() * 0.3, rate: 0.9 + Math.random() * 0.2 }),
        door:        () => AudioManager.playSFX("sfx_door_open",    { volume: 0.7 }),
        door_open:   () => AudioManager.playSFX("sfx_door_open",    { volume: 0.7 }),
        door_creak:  () => AudioManager.playSFX("sfx_door_creak",   { volume: 0.6 }),
        door_slam:   () => AudioManager.playSFX("sfx_door_slam",    { volume: 0.8 }),
        pickup:      () => AudioManager.playSFX("sfx_item_pickup",  { volume: 0.7 }),
        use:         () => AudioManager.playSFX("sfx_item_use",     { volume: 0.6 }),
        unlock:      () => AudioManager.playSFX("sfx_unlock",       { volume: 0.7 }),
        clock:       () => AudioManager.playSFX("sfx_clock_chime",  { volume: 0.6 }),
        heartbeat:   () => AudioManager.playSFX("sfx_hit_player",   { volume: 0.3, rate: 0.5 }),
        timeReset:   () => AudioManager.playSFX("sfx_time_reset",   { volume: 0.8 }),
        levelup:     () => AudioManager.playSFX("sfx_level_up",     { volume: 0.7 }),
        book_open:   () => AudioManager.playSFX("sfx_book_open",    { volume: 0.6 }),
        flashlight:  () => AudioManager.playSFX("sfx_flashlight_click", { volume: 0.6 }),
        piano_note:  () => AudioManager.playSFX("sfx_piano_key",    { volume: 0.5, rate: 0.8 + Math.random() * 0.4 }),
        bell_ring:   () => AudioManager.playSFX("sfx_bell_toll",    { volume: 0.7 }),
        achievement: () => AudioManager.playSFX("sfx_achievement",  { volume: 0.7 }),
        seal_found:  () => AudioManager.playSFX("sfx_seal_found",   { volume: 0.75 }),
        attack:      () => AudioManager.playSFX("sfx_attack_swing", { volume: 0.6 }),
        hit_enemy:   () => AudioManager.playSFX("sfx_hit_enemy",    { volume: 0.65 }),
        hit_player:  () => AudioManager.playSFX("sfx_hit_player",   { volume: 0.65 }),
        boss_appear: () => AudioManager.playSFX("sfx_boss_appear",  { volume: 0.8 }),
        glass_break: () => AudioManager.playSFX("sfx_glass_break",  { volume: 0.7 }),
        chain:       () => AudioManager.playSFX("sfx_chain_rattle", { volume: 0.6 }),
        thunder:     () => AudioManager.playSFX("sfx_thunder",      { volume: 0.55 }),
        match:       () => AudioManager.playSFX("sfx_match_strike", { volume: 0.6 }),
        whisper:     () => AudioManager.playVoice(rndWhisper(),     { volume: 0.35, fadeIn: 0.5 }),
        ghost:       () => AudioManager.playVoice(rndWhisper(),     { volume: 0.50, fadeIn: 0.3 }),
        scare:       () => AudioManager.playVoice("voice_scare_stab",    { volume: 0.75 }),
        sanityLoss:  () => AudioManager.playVoice("voice_breathing_near",{ volume: 0.30 }),
        laugh:       () => AudioManager.playVoice("voice_child_laugh",   { volume: 0.50 }),
        scream:      () => AudioManager.playVoice("voice_woman_scream",  { volume: 0.50, fadeIn: 0.2 }),
        enemy_death: () => AudioManager.playVoice("voice_entity_growl",  { volume: 0.50 }),
        ambience:    () => {},   // handled by setRoomAmbience
    };

    const fn = MAP[type];
    if (fn) {
        try { fn(); } catch (e) { console.warn("[playSound] error for type:", type, e); }
    }
}


// ═════════════════════════════════════════════════════════════════
//  initAudio() — call once on first user gesture
// ═════════════════════════════════════════════════════════════════
function initAudio() {
    try {
        AudioManager.init();
        AudioManager.resume();

        // Keep legacy global references in sync
        if (typeof audioCtx !== "undefined") audioCtx = AudioManager.ctx;
        if (typeof AudioEngine !== "undefined" && AudioEngine) {
            if (typeof AudioEngine.init === "function") AudioEngine.init();
            AudioEngine.ctx = AudioManager.ctx;
        }

        if (
            typeof gameState !== "undefined" &&
            gameState === "menu" &&
            !AudioManager.currentMusicKey
        ) {
            AudioManager.playMusic("music_menu", 2.0);
        }
    } catch (e) {
        console.warn("[initAudio] failed:", e);
    }
}