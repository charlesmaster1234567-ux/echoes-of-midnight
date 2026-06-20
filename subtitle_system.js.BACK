// ═══════════════════════════════════════════════════════════════════════════════
//  SUBTITLE_SYSTEM.JS — Echoes of Midnight  v4.0
//  ONE message at a time. Queue everything else. Each speaker looks unique.
//
//  game.js calls:
//    SubtitleSystem.update()           — line 2178 (every game frame)
//    SubtitleSystem.draw(ctx, cw, ch)  — line 1680 (every render frame)
//    showDialog(speaker, text, cb)     — routes here via installSubtitleOverride
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  SPEAKER PROFILES
//  Every speaker has a completely unique look, position, and personality.
// ═══════════════════════════════════════════════════════════════════════════════
const _SP = {

    // ── NARRATOR ─────────────────────────────────────────────────────────────
    // Wide cinematic bar. Centered bottom. Italic serif. Parchment color.
    // Like a novel caption. No speaker label shown — just the words.
    "NARRATOR": {
        color:      "#e8e0d0",
        accent:     "#5a4a2e",
        glow:       "#3a2a10",
        labelColor: null,           // null = hide label entirely
        font:       "italic {S}px Georgia, serif",
        textAlign:  "center",
        position:   "bottom-center",
        barStyle:   "cinematic",    // wide, thin, letterbox feel
        maxW:       0.90,           // fraction of canvas width
        maxWpx:     900,
        priority:   2,
        duration:   260,
        textSize:   17,
        labelSize:  0,
    },

    // ── VICTOR ───────────────────────────────────────────────────────────────
    // Left side. Red-orange. Aggressive border. Bold.
    "VICTOR": {
        color:      "#ff7755",
        accent:     "#8b1500",
        glow:       "#cc2200",
        labelColor: "#ff5533",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-left",
        barStyle:   "character",
        maxW:       0.55,
        maxWpx:     520,
        priority:   3,
        duration:   280,
        textSize:   16,
        labelSize:  12,
    },

    // ── ELEANORA ─────────────────────────────────────────────────────────────
    // Right side. Soft blue. Gentle glow. Elegant.
    "ELEANORA": {
        color:      "#aaccff",
        accent:     "#1a3366",
        glow:       "#2255aa",
        labelColor: "#88bbff",
        font:       "{S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-right",
        barStyle:   "character",
        maxW:       0.55,
        maxWpx:     520,
        priority:   3,
        duration:   280,
        textSize:   16,
        labelSize:  12,
    },

    // ── JAMES ────────────────────────────────────────────────────────────────
    "JAMES": {
        color:      "#88ddaa",
        accent:     "#1a5533",
        glow:       "#2a7744",
        labelColor: "#55cc88",
        font:       "{S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-left",
        barStyle:   "character",
        maxW:       0.52,
        maxWpx:     500,
        priority:   3,
        duration:   270,
        textSize:   16,
        labelSize:  12,
    },

    // ── MARY ─────────────────────────────────────────────────────────────────
    "MARY": {
        color:      "#ddaaee",
        accent:     "#660077",
        glow:       "#9922aa",
        labelColor: "#cc77dd",
        font:       "italic {S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-right",
        barStyle:   "character",
        maxW:       0.52,
        maxWpx:     500,
        priority:   3,
        duration:   270,
        textSize:   16,
        labelSize:  12,
    },

    // ── THOMAS ───────────────────────────────────────────────────────────────
    "THOMAS": {
        color:      "#bbcc77",
        accent:     "#445511",
        glow:       "#778833",
        labelColor: "#aabb55",
        font:       "{S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-left",
        barStyle:   "character",
        maxW:       0.52,
        maxWpx:     500,
        priority:   3,
        duration:   270,
        textSize:   16,
        labelSize:  12,
    },

    // ── FATHER HARMON ────────────────────────────────────────────────────────
    "FATHER HARMON": {
        color:      "#ffe066",
        accent:     "#775500",
        glow:       "#bb8800",
        labelColor: "#ddaa33",
        font:       "{S}px Georgia, serif",
        textAlign:  "left",
        position:   "bottom-left",
        barStyle:   "character",
        maxW:       0.55,
        maxWpx:     520,
        priority:   3,
        duration:   280,
        textSize:   16,
        labelSize:  12,
    },

    // ── AZATHIEL ─────────────────────────────────────────────────────────────
    // TOP CENTER. Purple. Pulsing. Full width. Terrifying.
    "AZATHIEL": {
        color:      "#dd88ff",
        accent:     "#330066",
        glow:       "#7700bb",
        labelColor: "#cc44ff",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "top-center",      // appears at TOP — unique
        barStyle:   "entity",
        maxW:       0.80,
        maxWpx:     800,
        priority:   8,
        duration:   320,
        textSize:   18,
        labelSize:  13,
        pulse:      true,
        shake:      true,
    },

    // ── YOUR PAST SELF ────────────────────────────────────────────────────────
    // Top-left corner. Ghost blue. Faint.
    "YOUR PAST SELF": {
        color:      "#99ccee",
        accent:     "#112233",
        glow:       "#224466",
        labelColor: "#55aacc",
        font:       "italic {S}px Georgia, serif",
        textAlign:  "left",
        position:   "top-left",
        barStyle:   "ghost",
        maxW:       0.45,
        maxWpx:     420,
        priority:   4,
        duration:   300,
        textSize:   15,
        labelSize:  11,
    },

    // ── ??? ──────────────────────────────────────────────────────────────────
    // Center screen. Mysterious. Glitchy look.
    "???": {
        color:      "#cc99ee",
        accent:     "#330044",
        glow:       "#660088",
        labelColor: "#aa66cc",
        font:       "italic {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",      // middle of screen — eerie
        barStyle:   "ghost",
        maxW:       0.50,
        maxWpx:     460,
        priority:   4,
        duration:   300,
        textSize:   16,
        labelSize:  12,
    },

    // ── SYSTEM ───────────────────────────────────────────────────────────────
    // Small. Top-right. Green terminal style. Short duration.
    "SYSTEM": {
        color:      "#44ff88",
        accent:     "#003311",
        glow:       "#00aa44",
        labelColor: null,              // no label — just the text
        font:       "{S}px 'Courier New', monospace",
        textAlign:  "left",
        position:   "top-right",
        barStyle:   "terminal",
        maxW:       0.38,
        maxWpx:     360,
        priority:   1,
        duration:   180,
        textSize:   13,
        labelSize:  0,
    },

    // ── ⏰ TIME RESET ─────────────────────────────────────────────────────────
    // Full screen. Orange. Big text. Center screen. Shake.
    "⏰ TIME RESET": {
        color:      "#ffaa33",
        accent:     "#663300",
        glow:       "#cc5500",
        labelColor: "#ff8800",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",
        barStyle:   "fullwidth",
        maxW:       0.92,
        maxWpx:     920,
        priority:   9,
        duration:   200,
        textSize:   20,
        labelSize:  13,
        shake:      true,
    },

    // ── ⏰ WARNING ────────────────────────────────────────────────────────────
    "⏰ WARNING": {
        color:      "#ff4444",
        accent:     "#550000",
        glow:       "#aa0000",
        labelColor: "#ff2222",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",
        barStyle:   "fullwidth",
        maxW:       0.92,
        maxWpx:     920,
        priority:   9,
        duration:   220,
        textSize:   20,
        labelSize:  13,
        shake:      true,
    },

    // ── ⏰ (generic time) ─────────────────────────────────────────────────────
    "⏰": {
        color:      "#ff8833",
        accent:     "#552200",
        glow:       "#994400",
        labelColor: "#ff6600",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",
        barStyle:   "fullwidth",
        maxW:       0.88,
        maxWpx:     860,
        priority:   8,
        duration:   200,
        textSize:   18,
        labelSize:  12,
    },

    // ── ⚔️ COMBAT ─────────────────────────────────────────────────────────────
    // Bottom. Full width. Red. Shake. Big.
    "⚔️ COMBAT": {
        color:      "#ff5544",
        accent:     "#660011",
        glow:       "#cc1100",
        labelColor: "#ff3322",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "bottom-center",
        barStyle:   "fullwidth",
        maxW:       0.94,
        maxWpx:     940,
        priority:   10,
        duration:   200,
        textSize:   17,
        labelSize:  12,
        shake:      true,
    },

    // ── ⚔️ BOSS ───────────────────────────────────────────────────────────────
    // Full screen overlay feel. Blood red. Maximum intensity.
    "⚔️ BOSS": {
        color:      "#ff1111",
        accent:     "#330000",
        glow:       "#880000",
        labelColor: "#ff0000",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",
        barStyle:   "boss",
        maxW:       0.96,
        maxWpx:     960,
        priority:   11,
        duration:   300,
        textSize:   22,
        labelSize:  14,
        shake:      true,
        pulse:      true,
    },

    // ── 🏆 VICTORY ────────────────────────────────────────────────────────────
    "🏆 VICTORY": {
        color:      "#44ff88",
        accent:     "#004422",
        glow:       "#00cc44",
        labelColor: "#22ff66",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "mid-center",
        barStyle:   "fullwidth",
        maxW:       0.90,
        maxWpx:     900,
        priority:   7,
        duration:   320,
        textSize:   20,
        labelSize:  13,
    },

    // ── 🏆 MISSION / QUEST ────────────────────────────────────────────────────
    "🏆 MISSION COMPLETE": {
        color:      "#ffdd33",
        accent:     "#664400",
        glow:       "#cc9900",
        labelColor: "#ffbb00",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "top-center",
        barStyle:   "banner",
        maxW:       0.70,
        maxWpx:     680,
        priority:   6,
        duration:   300,
        textSize:   17,
        labelSize:  11,
    },
    "🏆 MISSION": {
        color:      "#ffcc44",
        accent:     "#553300",
        glow:       "#bb8800",
        labelColor: "#ffaa00",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "top-center",
        barStyle:   "banner",
        maxW:       0.70,
        maxWpx:     680,
        priority:   5,
        duration:   280,
        textSize:   17,
        labelSize:  11,
    },
    "🏆 QUEST COMPLETE": {
        color:      "#ffdd33",
        accent:     "#664400",
        glow:       "#cc9900",
        labelColor: "#ffbb00",
        font:       "bold {S}px Georgia, serif",
        textAlign:  "center",
        position:   "top-center",
        barStyle:   "banner",
        maxW:       0.70,
        maxWpx:     680,
        priority:   6,
        duration:   300,
        textSize:   17,
        labelSize:  11,
    },
    "📋 QUEST ACCEPTED": {
        color:      "#44bbff",
        accent:     "#001144",
        glow:       "#0055aa",
        labelColor: "#22aaff",
        font:       "{S}px 'Courier New', monospace",
        textAlign:  "left",
        position:   "top-right",
        barStyle:   "terminal",
        maxW:       0.42,
        maxWpx:     400,
        priority:   3,
        duration:   220,
        textSize:   14,
        labelSize:  11,
    },
    "📋 QUEST": {
        color:      "#44bbff",
        accent:     "#001144",
        glow:       "#0055aa",
        labelColor: "#22aaff",
        font:       "{S}px 'Courier New', monospace",
        textAlign:  "left",
        position:   "top-right",
        barStyle:   "terminal",
        maxW:       0.42,
        maxWpx:     400,
        priority:   3,
        duration:   220,
        textSize:   14,
        labelSize:  11,
    },
};

const _SP_DEFAULT = {
    color: "#c8c8c8", accent: "#333344", glow: "#444455",
    labelColor: "#aaaaaa",
    font: "{S}px Georgia, serif",
    textAlign: "left", position: "bottom-center",
    barStyle: "character",
    maxW: 0.60, maxWpx: 580,
    priority: 1, duration: 240,
    textSize: 15, labelSize: 11,
};

function _sp(name) { return _SP[name] || _SP_DEFAULT; }

// ═══════════════════════════════════════════════════════════════════════════════
//  LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const _K = {
    PAD_X:      20,
    PAD_TOP:    11,
    PAD_BOT:    14,
    LABEL_GAP:  5,
    DIV_GAP:    5,
    LINE_H:     24,
    MAX_LINES:  3,
    RADIUS:     12,
    MARGIN:     24,    // distance from canvas edge
    FADE_IN:    14,
    FADE_OUT:   20,
    SLIDE:      22,    // slide px on entrance
    TYPE_SPD:   2.4,   // chars per frame
    PROG_H:     2,
    MAX_QUEUE:  30,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBTITLE SYSTEM  — ONE AT A TIME
// ═══════════════════════════════════════════════════════════════════════════════
const SubtitleSystem = {

    _current:   null,    // ONE active message at a time
    _queue:     [],      // everything else waits here
    _history:   [],
    _id:        0,
    _shakeX:    0,
    _shakeY:    0,
    _shakeTimer:0,
    _lastW:     0,
    _lastH:     0,
    _showHistory: false,
    _historyScroll: 0,

    // ── show() ────────────────────────────────────────────────────────────────
    show(speaker, text, duration) {
        speaker  = typeof speaker === "string" ? speaker.trim() : "";
        text     = typeof text    === "string" ? text.trim()    : String(text ?? "");
        if (!text) return;

        const sp  = _sp(speaker);
        duration  = Number.isFinite(duration) && duration > 0
                  ? Math.round(duration)
                  : sp.duration;

        const msg = {
            id:       ++this._id,
            speaker,
            text,
            duration,
            maxDur:   duration,
            sp,
            alpha:    0,
            slide:    _K.SLIDE,
            state:    "in",       // in | hold | out
            chars:    0,
            done:     false,
            _layout:  null,
        };

        // History
        this._history.unshift({ speaker, text, time: Date.now() });
        if (this._history.length > 50) this._history.pop();

        // Shake
        if (sp.shake) this._shake(sp.priority >= 10 ? 10 : 6);

        // HIGH PRIORITY (combat/boss/time) — interrupt current immediately
        if (sp.priority >= 9 && this._current) {
            this._queue.unshift(this._current); // push current back to front
            this._current = null;
        }

        if (!this._current) {
            this._current = msg;
        } else {
            // Insert by priority — highest first
            let at = this._queue.length;
            for (let i = 0; i < this._queue.length; i++) {
                if (msg.sp.priority > this._queue[i].sp.priority) { at = i; break; }
            }
            // Drop oldest low-priority if queue full
            if (this._queue.length >= _K.MAX_QUEUE) {
                let lowestIdx = this._queue.length - 1;
                for (let i = this._queue.length - 1; i >= 0; i--) {
                    if (this._queue[i].sp.priority <= this._queue[lowestIdx].sp.priority) {
                        lowestIdx = i;
                    }
                }
                if (this._queue[lowestIdx].sp.priority <= msg.sp.priority) {
                    this._queue.splice(lowestIdx, 1);
                } else {
                    return; // drop incoming
                }
            }
            this._queue.splice(at, 0, msg);
        }
    },

    clear() {
        this._current    = null;
        this._queue      = [];
        this._shakeTimer = 0;
    },

    toggleHistory() {
        this._showHistory   = !this._showHistory;
        this._historyScroll = 0;
    },

    // ── update() — called every frame by game.js:2178 ─────────────────────────
    update() {
        // Shake decay
        if (this._shakeTimer > 0) {
            this._shakeTimer--;
            const m  = this._shakeTimer * 0.5;
            this._shakeX = (Math.random() - 0.5) * m;
            this._shakeY = (Math.random() - 0.5) * m;
        } else {
            this._shakeX = 0; this._shakeY = 0;
        }

        const m = this._current;
        if (!m) return;

        switch (m.state) {
            case "in":
                m.alpha = Math.min(1, m.alpha + 1 / _K.FADE_IN);
                m.slide = Math.max(0, m.slide - _K.SLIDE / _K.FADE_IN);
                if (m.alpha >= 1) { m.alpha = 1; m.slide = 0; m.state = "hold"; }
                break;

            case "hold":
                m.duration--;
                // Only start fading when typewriter is done
                if (m.duration <= _K.FADE_OUT && m.done) m.state = "out";
                // If typewriter not done yet, extend slightly
                if (m.duration <= 0) m.state = "out";
                break;

            case "out":
                m.alpha = Math.max(0, m.alpha - 1 / _K.FADE_OUT);
                if (m.alpha <= 0) {
                    this._current = null;
                    // Next message after a tiny breath gap
                    if (this._queue.length > 0) {
                        setTimeout(() => {
                            if (!this._current && this._queue.length > 0) {
                                this._current = this._queue.shift();
                            }
                        }, 120); // 120ms gap between messages
                    }
                }
                break;
        }

        // Typewriter
        if (!m.done) {
            m.chars = Math.min(m.text.length, m.chars + _K.TYPE_SPD);
            if (m.chars >= m.text.length) m.done = true;
        }
    },

    // ── draw() — called every frame by game.js:1680 ───────────────────────────
    draw(ctx, cw, ch) {
        if (this._showHistory) {
            this._drawHistory(ctx, cw, ch);
            return;
        }

        // Invalidate layout on resize
        if (cw !== this._lastW || ch !== this._lastH) {
            if (this._current) this._current._layout = null;
            this._lastW = cw; this._lastH = ch;
        }

        if (!this._current) return;

        const m = this._current;
        if (!m._layout) m._layout = this._layout(ctx, m, cw, ch);

        ctx.save();
        if (this._shakeTimer > 0) ctx.translate(this._shakeX, this._shakeY);
        ctx.globalAlpha = Math.max(0, Math.min(1, m.alpha));

        this._drawBar(ctx, m, cw, ch);

        ctx.restore();
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  LAYOUT — computes bar position and size from speaker profile
    // ═══════════════════════════════════════════════════════════════════════════
    _layout(ctx, msg, cw, ch) {
        const sp    = msg.sp;
        const barW  = Math.min(sp.maxWpx, cw * sp.maxW);
        const innerW = barW - _K.PAD_X * 2 - (sp.barStyle === "character" ? 6 : 0);
        const tSize = sp.textSize;

        ctx.font = sp.font.replace("{S}", tSize);
        const lines = this._wrap(ctx, msg.text, innerW, _K.MAX_LINES);

        const hasLabel = sp.labelColor !== null && msg.speaker.length > 0;
        const labelH   = hasLabel ? (sp.labelSize + _K.LABEL_GAP + _K.DIV_GAP + 1) : 0;
        const barH     = _K.PAD_TOP + labelH + lines.length * _K.LINE_H
                       + _K.PAD_BOT + _K.PROG_H + 3;

        // ── Position ───────────────────────────────────────────────────────────
        const M  = _K.MARGIN;
        let barX, barY, slideDir;

        switch (sp.position) {
            case "bottom-center":
                barX     = (cw - barW) / 2;
                barY     = ch - barH - M;
                slideDir = "up";
                break;
            case "bottom-left":
                barX     = M;
                barY     = ch - barH - M;
                slideDir = "up";
                break;
            case "bottom-right":
                barX     = cw - barW - M;
                barY     = ch - barH - M;
                slideDir = "up";
                break;
            case "top-center":
                barX     = (cw - barW) / 2;
                barY     = M;
                slideDir = "down";
                break;
            case "top-left":
                barX     = M;
                barY     = M;
                slideDir = "down";
                break;
            case "top-right":
                barX     = cw - barW - M;
                barY     = M;
                slideDir = "down";
                break;
            case "mid-center":
                barX     = (cw - barW) / 2;
                barY     = ch * 0.38 - barH / 2;
                slideDir = "up";
                break;
            default:
                barX     = (cw - barW) / 2;
                barY     = ch - barH - M;
                slideDir = "up";
        }

        return { barW, barH, barX, barY, lines, hasLabel, tSize, slideDir };
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  DRAW BAR — each barStyle looks completely different
    // ═══════════════════════════════════════════════════════════════════════════
    _drawBar(ctx, msg, cw, ch) {
        const { barW, barH, barX, lines, hasLabel, tSize, slideDir } = msg._layout;
        const sp = msg.sp;

        // Apply slide direction
        let barY = msg._layout.barY;
        if (slideDir === "up")   barY += msg.slide;
        if (slideDir === "down") barY -= msg.slide;

        const R  = _K.RADIUS;
        const bs = sp.barStyle;

        // ── GLOW ──────────────────────────────────────────────────────────────
        const glowBlur = sp.pulse
            ? 24 + Math.sin(Date.now() * 0.005) * 10
            : bs === "boss" ? 30 : bs === "entity" ? 22 : 14;

        ctx.save();
        ctx.shadowColor = sp.glow;
        ctx.shadowBlur  = glowBlur;
        ctx.fillStyle   = "transparent";
        this._pill(ctx, barX - 2, barY - 2, barW + 4, barH + 4, R + 2);
        ctx.fill();
        ctx.restore();

        // ── BACKGROUND ────────────────────────────────────────────────────────
        ctx.save();
        let fillStyle;

        if (bs === "cinematic") {
            // Dark letterbox — nearly black, very subtle warm tint
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0,   "rgba(10, 7, 15, 0.96)");
            g.addColorStop(1,   "rgba(5,  3,  8, 0.98)");
            fillStyle = g;

        } else if (bs === "character") {
            // Character: slightly tinted by speaker color
            const r = parseInt(sp.accent.slice(1,3)||"0",16);
            const g2= parseInt(sp.accent.slice(3,5)||"0",16);
            const b = parseInt(sp.accent.slice(5,7)||"0",16);
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, `rgba(${Math.min(r+10,30)},${Math.min(g2+5,20)},${Math.min(b+15,35)},0.94)`);
            g.addColorStop(1, `rgba(4,2,8,0.97)`);
            fillStyle = g;

        } else if (bs === "terminal") {
            // Terminal: dark green tint, flat
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, "rgba(0, 12, 6, 0.95)");
            g.addColorStop(1, "rgba(0,  6, 3, 0.98)");
            fillStyle = g;

        } else if (bs === "ghost") {
            // Ghost: very dark, barely visible edges
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, "rgba(8,  5, 15, 0.85)");
            g.addColorStop(1, "rgba(3,  2,  8, 0.90)");
            fillStyle = g;

        } else if (bs === "boss") {
            // Boss: blood red tinted
            const pulse = 0.15 + Math.abs(Math.sin(Date.now() * 0.003)) * 0.08;
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, `rgba(${Math.round(30 + pulse*40)},3,3,0.97)`);
            g.addColorStop(1, "rgba(8,0,0,0.99)");
            fillStyle = g;

        } else if (bs === "entity") {
            // Entity (Azathiel): deep purple
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, "rgba(15, 2, 25, 0.97)");
            g.addColorStop(1, "rgba(5,  0, 10, 0.99)");
            fillStyle = g;

        } else if (bs === "fullwidth") {
            // Full width events: strong color tint
            const r = parseInt(sp.accent.slice(1,3)||"0",16);
            const gv= parseInt(sp.accent.slice(3,5)||"0",16);
            const b = parseInt(sp.accent.slice(5,7)||"0",16);
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, `rgba(${r},${gv},${b},0.35)`);
            g.addColorStop(0.3, "rgba(6,3,10,0.95)");
            g.addColorStop(1, "rgba(3,1,5,0.98)");
            fillStyle = g;

        } else if (bs === "banner") {
            // Banner (mission): gold tinted top
            const g = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            g.addColorStop(0, "rgba(25,15,2,0.97)");
            g.addColorStop(1, "rgba(8, 5, 0,0.98)");
            fillStyle = g;

        } else {
            fillStyle = "rgba(8,5,12,0.95)";
        }

        ctx.fillStyle = fillStyle;
        this._pill(ctx, barX, barY, barW, barH, R);
        ctx.fill();
        ctx.restore();

        // ── BORDER ────────────────────────────────────────────────────────────
        ctx.strokeStyle = sp.accent + "66";
        ctx.lineWidth   = bs === "boss" || bs === "entity" ? 2 : 1;
        this._pill(ctx, barX, barY, barW, barH, R);
        ctx.stroke();

        // ── STYLE-SPECIFIC DECORATIONS ────────────────────────────────────────

        if (bs === "cinematic") {
            // Thin gold line top and bottom (letterbox)
            ctx.fillStyle = sp.accent + "88";
            ctx.fillRect(barX, barY, barW, 1);
            ctx.fillRect(barX, barY + barH - 1, barW, 1);

        } else if (bs === "character") {
            // Colored left stripe
            const sg = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            sg.addColorStop(0,   sp.color  + "ff");
            sg.addColorStop(0.5, sp.accent + "aa");
            sg.addColorStop(1,   sp.accent + "11");
            ctx.fillStyle = sg;
            this._pill(ctx, barX, barY, 4, barH, [R, 0, 0, R]);
            ctx.fill();

        } else if (bs === "terminal") {
            // Scanline effect (subtle)
            ctx.fillStyle = "rgba(0,255,100,0.025)";
            for (let sy = barY; sy < barY + barH; sy += 3) {
                ctx.fillRect(barX, sy, barW, 1);
            }
            // Green left border
            ctx.fillStyle = sp.color + "66";
            ctx.fillRect(barX, barY, 2, barH);

        } else if (bs === "ghost") {
            // Dashed border instead of solid
            ctx.save();
            ctx.strokeStyle = sp.color + "44";
            ctx.lineWidth   = 1;
            ctx.setLineDash([4, 4]);
            this._pill(ctx, barX, barY, barW, barH, R);
            ctx.stroke();
            ctx.restore();

        } else if (bs === "boss") {
            // Double border + corner marks
            ctx.strokeStyle = sp.color + "44";
            ctx.lineWidth   = 3;
            this._pill(ctx, barX - 2, barY - 2, barW + 4, barH + 4, R + 2);
            ctx.stroke();
            // Corner accent marks
            const cLen = 18;
            ctx.strokeStyle = sp.color + "cc";
            ctx.lineWidth   = 2;
            // top-left
            ctx.beginPath(); ctx.moveTo(barX, barY + cLen); ctx.lineTo(barX, barY); ctx.lineTo(barX + cLen, barY); ctx.stroke();
            // top-right
            ctx.beginPath(); ctx.moveTo(barX + barW - cLen, barY); ctx.lineTo(barX + barW, barY); ctx.lineTo(barX + barW, barY + cLen); ctx.stroke();
            // bottom-left
            ctx.beginPath(); ctx.moveTo(barX, barY + barH - cLen); ctx.lineTo(barX, barY + barH); ctx.lineTo(barX + cLen, barY + barH); ctx.stroke();
            // bottom-right
            ctx.beginPath(); ctx.moveTo(barX + barW - cLen, barY + barH); ctx.lineTo(barX + barW, barY + barH); ctx.lineTo(barX + barW, barY + barH - cLen); ctx.stroke();

        } else if (bs === "fullwidth" || bs === "banner") {
            // Full-width gradient top line
            const tg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            tg.addColorStop(0,   "transparent");
            tg.addColorStop(0.15, sp.color + "99");
            tg.addColorStop(0.5,  sp.color + "ff");
            tg.addColorStop(0.85, sp.color + "99");
            tg.addColorStop(1,   "transparent");
            ctx.fillStyle = tg;
            ctx.fillRect(barX, barY, barW, 2);

        } else if (bs === "entity") {
            // Purple corner runes
            ctx.fillStyle = sp.color + "55";
            const rS = 12;
            ctx.fillRect(barX + 6,       barY + 4,     rS, 2);
            ctx.fillRect(barX + 6,       barY + 4,     2, rS);
            ctx.fillRect(barX + barW - 6 - rS, barY + 4, rS, 2);
            ctx.fillRect(barX + barW - 8, barY + 4,    2, rS);
            ctx.fillRect(barX + 6,       barY + barH - 6, rS, 2);
            ctx.fillRect(barX + 6,       barY + barH - 6 - rS, 2, rS);
            ctx.fillRect(barX + barW - 6 - rS, barY + barH - 6, rS, 2);
            ctx.fillRect(barX + barW - 8, barY + barH - 6 - rS, 2, rS);
        }

        // ── SPEAKER LABEL ─────────────────────────────────────────────────────
        let textY = barY + _K.PAD_TOP;
        const textX = bs === "cinematic" || sp.textAlign === "center"
                    ? barX + barW / 2
                    : bs === "character" ? barX + _K.PAD_X + 6
                    : barX + _K.PAD_X;

        if (hasLabel) {
            ctx.save();
            ctx.font         = `bold ${sp.labelSize}px 'Courier New', monospace`;
            ctx.textAlign    = sp.textAlign === "center" ? "center" : "left";
            ctx.textBaseline = "top";
            ctx.shadowColor  = sp.glow;
            ctx.shadowBlur   = 8;
            ctx.fillStyle    = sp.labelColor;
            ctx.fillText(msg.speaker, textX, textY);
            ctx.restore();

            textY += sp.labelSize + _K.LABEL_GAP;

            // Divider
            const dg = ctx.createLinearGradient(barX + _K.PAD_X, 0, barX + barW - _K.PAD_X, 0);
            dg.addColorStop(0,   "transparent");
            dg.addColorStop(0.1, sp.accent + "99");
            dg.addColorStop(0.5, sp.accent + "dd");
            dg.addColorStop(0.9, sp.accent + "99");
            dg.addColorStop(1,   "transparent");
            ctx.fillStyle = dg;
            ctx.fillRect(barX + _K.PAD_X, textY, barW - _K.PAD_X * 2, 1);

            textY += _K.DIV_GAP + 1;
        }

        // ── BODY TEXT (typewriter) ─────────────────────────────────────────────
        const visible  = msg.text.slice(0, Math.ceil(msg.chars));
        const visLines = this._typeLines(lines, visible);
        const font     = sp.font.replace("{S}", tSize);

        ctx.font         = font;
        ctx.textAlign    = sp.textAlign === "center" ? "center" : "left";
        ctx.textBaseline = "top";

        for (let i = 0; i < visLines.length; i++) {
            const line = visLines[i];
            if (!line) break;

            // Drop shadow
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillText(line, textX + 1, textY + 1);

            // Main
            ctx.fillStyle = sp.color;
            ctx.fillText(line, textX, textY);

            textY += _K.LINE_H;
        }

        // ── TYPEWRITER CURSOR ──────────────────────────────────────────────────
        if (!msg.done && Math.floor(Date.now() / 300) % 2 === 0) {
            const lastLine = visLines[visLines.length - 1] || "";
            ctx.font       = font;
            const tw       = ctx.measureText(lastLine).width;
            const cursorX  = sp.textAlign === "center"
                           ? textX + tw / 2 + 3
                           : textX + tw + 3;
            const cursorY  = textY - _K.LINE_H + 3;
            ctx.fillStyle  = sp.color + "bb";
            ctx.fillRect(cursorX, cursorY, 2, tSize - 2);
        }

        // ── PROGRESS BAR ───────────────────────────────────────────────────────
        const pct   = Math.max(0, Math.min(1, msg.duration / msg.maxDur));
        const progY = barY + barH - _K.PROG_H - 3;
        const progX = barX + _K.PAD_X;
        const progW = barW - _K.PAD_X * 2;

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(progX, progY, progW, _K.PROG_H);

        const pg = ctx.createLinearGradient(progX, 0, progX + progW, 0);
        pg.addColorStop(0,   sp.color  + "cc");
        pg.addColorStop(0.6, sp.color  + "77");
        pg.addColorStop(1,   sp.accent + "33");
        ctx.fillStyle = pg;
        ctx.fillRect(progX, progY, progW * pct, _K.PROG_H);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  HISTORY OVERLAY
    // ═══════════════════════════════════════════════════════════════════════════
    _drawHistory(ctx, cw, ch) {
        const W = Math.min(680, cw * 0.88);
        const H = Math.min(500, ch * 0.78);
        const X = (cw - W) / 2;
        const Y = (ch - H) / 2;

        ctx.save();
        ctx.globalAlpha = 0.97;

        ctx.fillStyle = "rgba(4,2,8,0.97)";
        this._pill(ctx, X, Y, W, H, 14);
        ctx.fill();

        ctx.strokeStyle = "#55336688";
        ctx.lineWidth   = 1.5;
        this._pill(ctx, X, Y, W, H, 14);
        ctx.stroke();

        ctx.fillStyle    = "#ccaa55";
        ctx.font         = "bold 13px 'Courier New', monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        ctx.fillText("MESSAGE HISTORY  —  press H to close", X + W / 2, Y + 14);

        ctx.fillStyle = "#33224433";
        ctx.fillRect(X + 16, Y + 36, W - 32, 1);

        // Messages
        const lineH = 50;
        const clipY = Y + 42;
        ctx.save();
        ctx.beginPath();
        ctx.rect(X + 10, clipY, W - 20, H - 56);
        ctx.clip();

        this._history.forEach((e, i) => {
            const ey  = Y + 46 + i * lineH + this._historyScroll;
            if (ey > Y + H - 16 || ey + lineH < clipY) return;
            const sp  = _sp(e.speaker);
            const age = Math.min(1, (Date.now() - e.time) / 12000);
            ctx.globalAlpha = 0.97 - age * 0.45;

            ctx.font      = `bold 10px 'Courier New', monospace`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillStyle = sp.labelColor || sp.color;
            ctx.fillText(e.speaker || "—", X + 18, ey + 4);

            ctx.font      = "13px Georgia, serif";
            ctx.fillStyle = "#c8c4bc";
            let t = e.text;
            ctx.font = "13px Georgia, serif";
            while (ctx.measureText(t).width > W - 40 && t.length > 0) t = t.slice(0,-1);
            if (t.length < e.text.length) t += "…";
            ctx.fillText(t, X + 18, ey + 20);

            ctx.fillStyle = "#ffffff07";
            ctx.fillRect(X + 14, ey + lineH - 2, W - 28, 1);
        });

        ctx.restore();

        ctx.globalAlpha  = 1;
        ctx.fillStyle    = "#443322";
        ctx.font         = "11px 'Courier New', monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
            this._history.length + " messages  —  scroll with mouse wheel",
            X + W / 2, Y + H - 6
        );

        ctx.restore();
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    _shake(intensity) {
        this._shakeTimer = Math.max(this._shakeTimer, intensity * 3);
    },

    _wrap(ctx, text, maxW, maxLines) {
        const words = text.split(" ");
        const lines = [];
        let   line  = "";
        for (let i = 0; i < words.length; i++) {
            const test  = line ? line + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = words[i];
                if (lines.length >= maxLines) {
                    let rest = line;
                    for (let j = i + 1; j < words.length; j++) rest += " " + words[j];
                    while (ctx.measureText(rest + "…").width > maxW && rest.length > 0) {
                        rest = rest.slice(0,-1).trimEnd();
                    }
                    lines[lines.length - 1] = rest + "…";
                    return lines;
                }
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    },

    _typeLines(lines, visible) {
        const out = [];
        let rem   = visible;
        for (const line of lines) {
            if (!rem) break;
            if (rem.length >= line.length) {
                out.push(line);
                rem = rem.slice(line.length).replace(/^ /, "");
            } else {
                out.push(rem);
                break;
            }
        }
        return out;
    },

    _pill(ctx, x, y, w, h, r) {
        if (typeof r === "number") r = [r,r,r,r];
        const [tl,tr,br,bl] = r;
        ctx.beginPath();
        ctx.moveTo(x+tl,y);
        ctx.lineTo(x+w-tr,y);
        ctx.arcTo(x+w,y,x+w,y+tr,tr);
        ctx.lineTo(x+w,y+h-br);
        ctx.arcTo(x+w,y+h,x+w-br,y+h,br);
        ctx.lineTo(x+bl,y+h);
        ctx.arcTo(x,y+h,x,y+h-bl,bl);
        ctx.lineTo(x,y+tl);
        ctx.arcTo(x,y,x+tl,y,tl);
        ctx.closePath();
    },

    onWheel(e) {
        if (!this._showHistory) return;
        this._historyScroll = Math.min(0, this._historyScroll - e.deltaY * 0.4);
    },
};

// ── Input wiring ──────────────────────────────────────────────────────────────
window.addEventListener("wheel", (e) => SubtitleSystem.onWheel(e), { passive: true });
window.addEventListener("keydown", (e) => {
    if ((e.key === "h" || e.key === "H") &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA") {
        SubtitleSystem.toggleHistory();
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DIALOG OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════════
let _installed = false;

function installSubtitleOverride() {
    if (_installed) return;
    _installed = true;

    const _origChoices =
        window._gameShowDialogWithChoices ||
        (typeof showDialogWithChoices === "function" ? showDialogWithChoices : null);

    window.showDialog = function(speaker, text, callback) {
        try { SubtitleSystem.show(speaker, text); } catch(e) {}
        if (typeof callback === "function") {
            setTimeout(() => { try { callback(); } catch(e) {} }, 80);
        }
    };

    if (_origChoices) {
        window.showDialogWithChoices = function(speaker, text, choices) {
            try { _origChoices.call(window, speaker, text, choices); }
            catch(e) { console.warn("[Subtitles] choices error:", e); }
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FLASHLIGHT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const FlashlightSystem = {
    flickerTimer: 0, flickerIntensity: 0, dimLevel: 1.0,

    update(battery) {
        battery = Number.isFinite(battery) ? Math.max(0, battery) : 0;
        if      (battery > 50) { this.dimLevel = 1.0; }
        else if (battery > 20) { this.dimLevel = 0.5 + (battery-20)/60; }
        else if (battery > 5)  { this.dimLevel = 0.2 + (battery-5)/50;  this._flicker(battery,30,30); }
        else if (battery > 0)  { this.dimLevel = 0.05+battery/100;       this._flicker(battery,10,15); }
        else                   { this.dimLevel = 0; }
        this.flickerIntensity *= 0.85;
        return Math.max(0, this.dimLevel - this.flickerIntensity);
    },

    _flicker(battery, base, rand) {
        this.flickerTimer++;
        if (this.flickerTimer % (base + Math.floor(Math.random()*rand)) === 0) {
            this.flickerIntensity = 0.3 + Math.random()*0.5;
            try {
                if (typeof AudioEngine !== "undefined" && AudioEngine.initialized &&
                    typeof AudioEngine.playFlashlightFlicker === "function") {
                    AudioEngine.playFlashlightFlicker(battery);
                }
            } catch(e) {}
        }
    },

    getRange(battery) {
        const eff = this.update(battery);
        return { range: 80+eff*170, alpha: 0.3+eff*0.6, coneAngle: 0.4+eff*0.2 };
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SOUNDTRACK STUB
// ═══════════════════════════════════════════════════════════════════════════════
const SoundtrackManager = { lastRoom: null, update() {} };