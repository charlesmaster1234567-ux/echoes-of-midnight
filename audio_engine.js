// ═════════════════════════════════════════════════════════════════
//  AUDIO_ENGINE.JS — Synth Audio System (SFX Fallback Only)
//  Music & ambience handled by AudioManager (real MP3 files).
//  This engine provides:
//    • SFX synthesis (fallback when MP3s missing)
//    • Flashlight flicker sound
//    • Synth primitives for any system that needs them
//  updateMusic() and updateAmbience() are DISABLED to prevent
//  conflicts with AudioManager.
// ═════════════════════════════════════════════════════════════════

const AudioEngine = {

    ctx:           null,
    masterGain:    null,
    musicGain:     null,
    sfxGain:       null,
    ambienceGain:  null,
    voiceGain:     null,

    masterVolume:   0.7,
    musicVolume:    0.3,
    sfxVolume:      0.5,
    ambienceVolume: 0.25,
    voiceVolume:    0.4,

    initialized: false,

    // ── Active node registry ──────────────────────────────────────
    // Every BufferSource / Oscillator created is tracked here so we
    // can hard-stop everything on demand and prevent ghost nodes from
    // accumulating in the audio graph.
    _nodes: new Set(),
    _MAX_NODES: 48,     // hard ceiling — oldest evicted when exceeded

    // ═══════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════
    init() {
        if (this.initialized) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();

            const mk = (vol, dest) => {
                const g = this.ctx.createGain();
                g.gain.value = vol;
                g.connect(dest);
                return g;
            };

            this.masterGain   = mk(this.masterVolume,   this.ctx.destination);
            this.musicGain    = mk(this.musicVolume,    this.masterGain);
            this.sfxGain      = mk(this.sfxVolume,      this.masterGain);
            this.ambienceGain = mk(this.ambienceVolume, this.masterGain);
            this.voiceGain    = mk(this.voiceVolume,    this.masterGain);

            this.initialized = true;
        } catch (e) {
            console.warn("[AudioEngine] init failed:", e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  DISABLED STUBS  (AudioManager owns music & ambience)
    // ═══════════════════════════════════════════════════════════════
    updateMusic(/* roomId */)    { /* intentionally empty */ },
    updateAmbience(/* roomId */) { /* intentionally empty */ },

    // ═══════════════════════════════════════════════════════════════
    //  NODE LIFECYCLE HELPERS
    // ═══════════════════════════════════════════════════════════════

    // Register a source node; evict & stop the oldest if over cap.
    _track(node) {
        if (this._nodes.size >= this._MAX_NODES) {
            // Stop and evict the oldest entry
            const oldest = this._nodes.values().next().value;
            this._nodes.delete(oldest);
            try { oldest.stop(); } catch (_) {}
        }
        this._nodes.add(node);
        // Auto-remove when the browser fires onended
        node.onended = () => this._nodes.delete(node);
    },

    // Safely start a tracked source at `when`
    _start(node, when) {
        try {
            this._track(node);
            node.start(when);
        } catch (_) {}
    },

    // Safely schedule a stop
    _stop(node, when) {
        try { node.stop(when); } catch (_) {}
    },

    // Create an oscillator, wire it, and return it (not yet started)
    _osc(type, freq, destGain) {
        const o = this.ctx.createOscillator();
        o.type = type || "sine";
        o.frequency.value = freq || 440;
        o.connect(destGain);
        return o;
    },

    // Create an envelope GainNode connected to destGain
    _env(destGain) {
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.connect(destGain);
        return g;
    },

    // ═══════════════════════════════════════════════════════════════
    //  NOISE GENERATORS
    //  Buffers are generated once and cached to avoid per-call
    //  allocation that can spike the main thread.
    // ═══════════════════════════════════════════════════════════════
    _noiseCache: {},

    createNoise(duration, type) {
        if (!this.ctx) return null;

        // Cache key — round duration to nearest 0.25 s to maximise reuse
        const key = `${type}_${Math.round(duration * 4) / 4}`;
        if (this._noiseCache[key]) return this._noiseCache[key];

        try {
            const sr  = this.ctx.sampleRate;
            const len = Math.ceil(sr * Math.min(duration + 0.5, 6)); // cap at 6 s
            const buf = this.ctx.createBuffer(1, len, sr);
            const d   = buf.getChannelData(0);

            let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;

            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                if (type === "pink") {
                    b0 = 0.99886*b0 + w*0.0555179;
                    b1 = 0.99332*b1 + w*0.0750759;
                    b2 = 0.96900*b2 + w*0.1538520;
                    b3 = 0.86650*b3 + w*0.3104856;
                    b4 = 0.55000*b4 + w*0.5329522;
                    b5 = -0.7616*b5 - w*0.0168980;
                    d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.05;
                    b6 = w * 0.115926;
                } else if (type === "brown") {
                    b0 = (b0 + 0.02 * w) / 1.02;
                    d[i] = b0 * 2.0;
                } else {
                    d[i] = w; // white
                }
            }

            // Only cache short buffers (≤ 3 s) to avoid memory bloat
            if (duration <= 3) this._noiseCache[key] = buf;
            return buf;
        } catch (e) {
            return null;
        }
    },

    // ─── Play a noise buffer at `time` through destGain ──────────
    _playNoise(time, type, dur, vol, destGain, filterType, filterFreq, filterQ) {
        if (!this.ctx) return;
        const buf = this.createNoise(dur, type);
        if (!buf) return;

        try {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;

            const env = this.ctx.createGain();
            env.gain.setValueAtTime(vol,   time);
            env.gain.linearRampToValueAtTime(0.0001, time + dur);

            if (filterType) {
                const f = this.ctx.createBiquadFilter();
                f.type            = filterType;
                f.frequency.value = filterFreq || 1000;
                f.Q.value         = filterQ    || 1;
                src.connect(f);
                f.connect(env);
            } else {
                src.connect(env);
            }

            env.connect(destGain || this.ambienceGain);
            this._start(src, time);
            this._stop(src, time + dur + 0.05);
        } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  MUSICAL NOTE
    // ═══════════════════════════════════════════════════════════════
    noteFreq(note, octave) {
        const map = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
        const semi = (map[note[0]] || 0)
                   + (note.includes("#") ?  1 : 0)
                   + (note.includes("b") ? -1 : 0);
        return 440 * Math.pow(2, (semi - 9) / 12 + ((octave || 4) - 4));
    },

    playNote(freq, duration, type, destGain, volume, delay) {
        if (!this.ctx || !this.initialized) return;
        try {
            const now  = this.ctx.currentTime + (delay || 0);
            const vol  = volume   || 0.05;
            const dur  = duration || 0.5;

            const osc  = this.ctx.createOscillator();
            const env  = this.ctx.createGain();

            osc.type = type || "sine";
            osc.frequency.setValueAtTime(freq, now);

            env.gain.setValueAtTime(0,           now);
            env.gain.linearRampToValueAtTime(vol, now + 0.02);
            env.gain.setValueAtTime(vol,          now + dur * 0.7);
            env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

            osc.connect(env);
            env.connect(destGain || this.musicGain);

            this._start(osc, now);
            this._stop(osc,  now + dur + 0.01);
        } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  AMBIENCE DISPATCHER  (backward-compatible)
    // ═══════════════════════════════════════════════════════════════
    playAmbienceSound(sound) {
        if (!this.ctx || !this.initialized) return;
        try {
            const now = this.ctx.currentTime;
            switch (sound) {
                case "clock_tick":     this.synthTick(now, 800, 0.03, 0.08); break;
                case "creak":          this.synthCreak(now, 100+Math.random()*80, 0.02, 0.3+Math.random()*0.3); break;
                case "wind_distant":   this.synthWind(now, 0.015, 2+Math.random()*2); break;
                case "wind_outside":   this.synthWind(now, 0.025, 1.5+Math.random()*1.5); break;
                case "wind_howl":      this.synthWindHowl(now, 0.03, 2+Math.random()*2); break;
                case "drip":           this.synthDrip(now, 0.04); break;
                case "drip_echo":
                    this.synthDrip(now,       0.030);
                    this.synthDrip(now + 0.15, 0.015);
                    this.synthDrip(now + 0.30, 0.008);
                    break;
                case "fire_crackle":   this.synthCrackle(now, 0.025); break;
                case "owl":            this.synthOwl(now, 0.02); break;
                case "cricket":        this.synthCricket(now, 0.01); break;
                case "heartbeat_slow": this.synthHeartbeat(now, 0.04); break;
                case "whisper_dark":   this.synthWhisper(now, 0.025, 1.5); break;
                case "void_hum":       this.synthVoidHum(now, 0.025, 1.5); break;
                // Unknown sounds → silent, never throws
            }
        } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  SYNTH PRIMITIVES
    //  All use _start/_stop so nodes are tracked and capped.
    //  All wrapped in try/catch so a bad Web Audio state never throws.
    // ═══════════════════════════════════════════════════════════════

    synthTick(time, freq, vol, dur) {
        if (!this.ctx) return;
        try {
            const env = this._env(this.ambienceGain);
            const osc = this._osc("sine", freq, env);
            env.gain.setValueAtTime(vol, time);
            env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            this._start(osc, time);
            this._stop(osc,  time + dur + 0.01);
        } catch (_) {}
    },

    synthCreak(time, freq, vol, dur) {
        if (!this.ctx) return;
        try {
            const env = this._env(this.ambienceGain);
            const osc = this._osc("sawtooth", freq, env);
            osc.frequency.linearRampToValueAtTime(
                freq * (0.8 + Math.random() * 0.4), time + dur
            );
            env.gain.setValueAtTime(0,           time);
            env.gain.linearRampToValueAtTime(vol,        time + dur * 0.10);
            env.gain.linearRampToValueAtTime(vol * 0.7,  time + dur * 0.50);
            env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            this._start(osc, time);
            this._stop(osc,  time + dur + 0.01);
        } catch (_) {}
    },

    synthWind(time, vol, dur) {
        if (!this.ctx) return;
        this._playNoise(time, "brown", dur, vol, this.ambienceGain,
            "lowpass", 400 + Math.random() * 300);
    },

    synthWindHowl(time, vol, dur) {
        if (!this.ctx) return;
        try {
            const env = this._env(this.ambienceGain);
            const osc = this._osc("sine", 250 + Math.random() * 100, env);
            osc.frequency.linearRampToValueAtTime(400 + Math.random() * 200, time + dur * 0.4);
            osc.frequency.linearRampToValueAtTime(200 + Math.random() * 100, time + dur);
            env.gain.setValueAtTime(0,           time);
            env.gain.linearRampToValueAtTime(vol,        time + dur * 0.20);
            env.gain.linearRampToValueAtTime(vol * 0.5,  time + dur * 0.60);
            env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            this._start(osc, time);
            this._stop(osc,  time + dur + 0.01);
        } catch (_) {}
    },

    synthDrip(time, vol) {
        if (!this.ctx) return;
        try {
            const freq = 1500 + Math.random() * 2000;
            const env  = this._env(this.ambienceGain);
            const osc  = this._osc("sine", freq, env);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.3, time + 0.08);
            env.gain.setValueAtTime(vol,   time);
            env.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
            this._start(osc, time);
            this._stop(osc,  time + 0.16);
        } catch (_) {}
    },

    synthCrackle(time, vol) {
        if (!this.ctx) return;
        this._playNoise(time, "white", 0.1, vol, this.ambienceGain,
            "highpass", 2000);
    },

    synthNoiseBurst(time, vol, dur, type) {
        if (!this.ctx) return;
        this._playNoise(time, type || "pink", dur, vol, this.ambienceGain);
    },

    synthOwl(time, vol) {
        if (!this.ctx) return;
        for (let i = 0; i < 2; i++) {
            try {
                const t   = time + i * 0.4;
                const env = this._env(this.ambienceGain);
                const osc = this._osc("sine", 400, env);
                osc.frequency.linearRampToValueAtTime(350, t + 0.3);
                env.gain.setValueAtTime(vol,   t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
                this._start(osc, t);
                this._stop(osc,  t + 0.41);
            } catch (_) {}
        }
    },

    synthCricket(time, vol) {
        if (!this.ctx) return;
        try {
            const env = this._env(this.ambienceGain);
            const osc = this._osc("square", 4000 + Math.random() * 1000, env);
            // Chirp pattern via gain automation
            [[0, vol],[0.03, 0],[0.06, vol],[0.09, 0],[0.12, vol]]
                .forEach(([dt, v]) => env.gain.setValueAtTime(v, time + dt));
            env.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
            this._start(osc, time);
            this._stop(osc,  time + 0.20);
        } catch (_) {}
    },

    synthGiggle(time, vol) {
        if (!this.ctx) return;
        for (let i = 0; i < 5; i++) {
            try {
                const t   = time + i * 0.08;
                const env = this._env(this.voiceGain);
                const osc = this._osc("sine", 800 + i * 100 + Math.random() * 200, env);
                osc.frequency.linearRampToValueAtTime(600 + Math.random() * 200, t + 0.06);
                env.gain.setValueAtTime(vol * (0.5 + Math.random() * 0.5), t);
                env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
                this._start(osc, t);
                this._stop(osc,  t + 0.09);
            } catch (_) {}
        }
    },

    synthChainRattle(time, vol) {
        if (!this.ctx) return;
        for (let i = 0; i < 4; i++) {
            const t = time + i * 0.05 + Math.random() * 0.03;
            this.synthTick(t, 3000 + Math.random() * 2000, vol * 0.5, 0.04);
        }
    },

    synthBell(time, vol) {
        if (!this.ctx) return;
        [523, 659, 784, 1047].forEach((f, i) => {
            try {
                const env = this._env(this.ambienceGain);
                const osc = this._osc("sine", f, env);
                env.gain.setValueAtTime(vol / (i + 1), time);
                env.gain.exponentialRampToValueAtTime(0.0001, time + 2.0);
                this._start(osc, time);
                this._stop(osc,  time + 2.5);
            } catch (_) {}
        });
    },

    synthHeartbeat(time, vol) {
        if (!this.ctx) return;
        this.synthTick(time,        50, vol,        0.12);
        this.synthTick(time + 0.15, 45, vol * 0.7,  0.10);
    },

    synthWhisper(time, vol, dur) {
        if (!this.ctx) return;
        this._playNoise(time, "pink", dur, vol, this.voiceGain,
            "bandpass", 2000 + Math.random() * 1000, 3);
    },

    synthVoidHum(time, vol, dur) {
        if (!this.ctx) return;
        [30, 45, 60].forEach(f => {
            try {
                const env = this._env(this.ambienceGain);
                const osc = this._osc("sine", f, env);
                osc.frequency.linearRampToValueAtTime(
                    f * (0.98 + Math.random() * 0.04), time + dur
                );
                env.gain.setValueAtTime(vol * 0.3, time);
                env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
                this._start(osc, time);
                this._stop(osc,  time + dur + 0.01);
            } catch (_) {}
        });
    },

    synthRealityCrack(time, vol) {
        if (!this.ctx) return;
        try {
            const env = this._env(this.sfxGain);
            const osc = this._osc("sawtooth", 100, env);
            osc.frequency.exponentialRampToValueAtTime(5000, time + 0.05);
            osc.frequency.exponentialRampToValueAtTime(50,   time + 0.40);
            env.gain.setValueAtTime(vol,   time);
            env.gain.exponentialRampToValueAtTime(0.0001, time + 0.50);
            this._start(osc, time);
            this._stop(osc,  time + 0.51);
        } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  SFX FALLBACK  (only used when AudioManager MP3s are missing)
    // ═══════════════════════════════════════════════════════════════
    playSFX(type) {
        if (!this.ctx || !this.initialized) return;
        try {
            const now = this.ctx.currentTime;
            switch (type) {
                case "step":
                    this.synthTick(now, 80 + Math.random() * 40, 0.03, 0.06);
                    break;

                case "door":
                    this.synthCreak(now, 60, 0.05, 0.5);
                    this.synthTick(now + 0.3, 200, 0.04, 0.2);
                    break;

                case "pickup":
                    [523, 659, 784].forEach((f, i) =>
                        this.playNote(f, 0.15, "sine", this.sfxGain, 0.06, i * 0.08));
                    break;

                case "ghost":
                    this.synthWhisper(now, 0.04, 1.5);
                    break;

                case "scare":
                    this.synthRealityCrack(now, 0.12);
                    try { if (typeof triggerShake === "function") triggerShake(5, 15); } catch (_) {}
                    break;

                case "clock":
                    this.synthTick(now, 800, 0.04, 0.12);
                    break;

                case "whisper":
                    this.synthWhisper(now, 0.03, 1.0);
                    break;

                case "unlock":
                    [440, 554, 659, 880].forEach((f, i) =>
                        this.playNote(f, 0.2, "square", this.sfxGain, 0.05, i * 0.08));
                    break;

                case "heartbeat":
                    this.synthHeartbeat(now, 0.08);
                    break;

                case "timeReset": {
                    const env = this._env(this.sfxGain);
                    const osc = this._osc("sine", 1200, env);
                    osc.frequency.exponentialRampToValueAtTime(50, now + 2.0);
                    env.gain.setValueAtTime(0.08,  now);
                    env.gain.linearRampToValueAtTime(0.10, now + 0.5);
                    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
                    this._start(osc, now);
                    this._stop(osc,  now + 2.01);
                    break;
                }

                case "ambience":
                    this.synthWind(now, 0.01, 2 + Math.random());
                    break;

                case "levelup":
                    [440, 554, 659, 880, 1047].forEach((f, i) =>
                        this.playNote(f, 0.2, "sine", this.sfxGain, 0.07, i * 0.1));
                    break;

                case "sanityLoss":
                    this.synthCreak(now, 300, 0.025, 0.8);
                    break;

                case "laugh":
                    this.synthGiggle(now, 0.03);
                    break;

                case "scream": {
                    const env = this._env(this.voiceGain);
                    const osc = this._osc("sawtooth", 400, env);
                    osc.frequency.linearRampToValueAtTime(1200, now + 0.10);
                    osc.frequency.linearRampToValueAtTime(300,  now + 0.80);
                    env.gain.setValueAtTime(0.08,  now);
                    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
                    this._start(osc, now);
                    this._stop(osc,  now + 1.01);
                    break;
                }

                case "door_slam":
                    this.synthTick(now, 100, 0.12, 0.3);
                    this.synthNoiseBurst(now, 0.06, 0.15, "brown");
                    break;

                case "glass_break":
                    this.synthNoiseBurst(now, 0.08, 0.2, "white");
                    [2000, 3000, 4000].forEach(f =>
                        this.synthTick(now, f, 0.03, 0.15));
                    break;

                case "chain":
                    this.synthChainRattle(now, 0.04);
                    break;

                case "bell_ring":
                    this.synthBell(now, 0.06);
                    break;

                case "piano_note": {
                    const freqs = [262, 294, 330, 349, 392, 440, 494];
                    this.playNote(
                        freqs[Math.floor(Math.random() * freqs.length)],
                        1.5, "sine", this.sfxGain, 0.05
                    );
                    break;
                }

                // Unknown type → silent, never throws
            }
        } catch (_) {}
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLASHLIGHT FLICKER SOUND
    // ═══════════════════════════════════════════════════════════════
    playFlashlightFlicker(battery) {
        if (!this.ctx || !this.initialized) return;
        if ((battery ?? 100) > 20) return;
        if (Math.random() > 0.02) return;  // sparse — 2 % chance
        this.synthTick(
            this.ctx.currentTime,
            100 + Math.random() * 50,
            0.01,
            0.03
        );
    },

    // ═══════════════════════════════════════════════════════════════
    //  EMERGENCY STOP  (call if audio graph goes wrong)
    // ═══════════════════════════════════════════════════════════════
    stopAll() {
        for (const node of this._nodes) {
            try { node.stop(); } catch (_) {}
        }
        this._nodes.clear();
    },
};

// NOTE: playSound() is defined in audio_manager.js (loaded after this file).
// It prefers real MP3s via AudioManager and falls back to AudioEngine.playSFX().