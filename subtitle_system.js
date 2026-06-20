// ═══════════════════════════════════════════════════════════════════════════════
//  SUBTITLE_SYSTEM.JS — Echoes of Midnight  v5.0
//  Smart queue: max 2 visible + max 5 queued, no duplicates,
//  pressure-based fade acceleration, all visual styles preserved.
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  SPEAKER PROFILES — every speaker unique position + style
// ═══════════════════════════════════════════════════════════════════════════════
const _SP = {
    "NARRATOR": {
        color:"#e8e0d0", accent:"#5a4a2e", glow:"#3a2a10",
        labelColor:null, font:"italic {S}px Georgia,serif",
        textAlign:"center", position:"bottom-center", barStyle:"cinematic",
        maxW:0.90, maxWpx:900, priority:2, duration:260, textSize:17, labelSize:0,
    },
    "VICTOR": {
        color:"#ff7755", accent:"#8b1500", glow:"#cc2200",
        labelColor:"#ff5533", font:"bold {S}px Georgia,serif",
        textAlign:"left", position:"bottom-left", barStyle:"character",
        maxW:0.55, maxWpx:520, priority:3, duration:280, textSize:16, labelSize:12,
    },
    "ELEANORA": {
        color:"#aaccff", accent:"#1a3366", glow:"#2255aa",
        labelColor:"#88bbff", font:"{S}px Georgia,serif",
        textAlign:"left", position:"bottom-right", barStyle:"character",
        maxW:0.55, maxWpx:520, priority:3, duration:280, textSize:16, labelSize:12,
    },
    "JAMES": {
        color:"#88ddaa", accent:"#1a5533", glow:"#2a7744",
        labelColor:"#55cc88", font:"{S}px Georgia,serif",
        textAlign:"left", position:"bottom-left", barStyle:"character",
        maxW:0.52, maxWpx:500, priority:3, duration:270, textSize:16, labelSize:12,
    },
    "MARY": {
        color:"#ddaaee", accent:"#660077", glow:"#9922aa",
        labelColor:"#cc77dd", font:"italic {S}px Georgia,serif",
        textAlign:"left", position:"bottom-right", barStyle:"character",
        maxW:0.52, maxWpx:500, priority:3, duration:270, textSize:16, labelSize:12,
    },
    "THOMAS": {
        color:"#bbcc77", accent:"#445511", glow:"#778833",
        labelColor:"#aabb55", font:"{S}px Georgia,serif",
        textAlign:"left", position:"bottom-left", barStyle:"character",
        maxW:0.52, maxWpx:500, priority:3, duration:270, textSize:16, labelSize:12,
    },
    "FATHER HARMON": {
        color:"#ffe066", accent:"#775500", glow:"#bb8800",
        labelColor:"#ddaa33", font:"{S}px Georgia,serif",
        textAlign:"left", position:"bottom-left", barStyle:"character",
        maxW:0.55, maxWpx:520, priority:3, duration:280, textSize:16, labelSize:12,
    },
    "AZATHIEL": {
        color:"#dd88ff", accent:"#330066", glow:"#7700bb",
        labelColor:"#cc44ff", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"top-center", barStyle:"entity",
        maxW:0.80, maxWpx:800, priority:8, duration:320, textSize:18, labelSize:13,
        pulse:true, shake:true,
    },
    "YOUR PAST SELF": {
        color:"#99ccee", accent:"#112233", glow:"#224466",
        labelColor:"#55aacc", font:"italic {S}px Georgia,serif",
        textAlign:"left", position:"top-left", barStyle:"ghost",
        maxW:0.45, maxWpx:420, priority:4, duration:300, textSize:15, labelSize:11,
    },
    "???": {
        color:"#cc99ee", accent:"#330044", glow:"#660088",
        labelColor:"#aa66cc", font:"italic {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"ghost",
        maxW:0.50, maxWpx:460, priority:4, duration:300, textSize:16, labelSize:12,
    },
    "SYSTEM": {
        color:"#44ff88", accent:"#003311", glow:"#00aa44",
        labelColor:null, font:"{S}px 'Courier New',monospace",
        textAlign:"left", position:"top-right", barStyle:"terminal",
        maxW:0.38, maxWpx:360, priority:1, duration:180, textSize:13, labelSize:0,
    },
    "⏰ TIME RESET": {
        color:"#ffaa33", accent:"#663300", glow:"#cc5500",
        labelColor:"#ff8800", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"fullwidth",
        maxW:0.92, maxWpx:920, priority:9, duration:200, textSize:20, labelSize:13,
        shake:true,
    },
    "⏰ WARNING": {
        color:"#ff4444", accent:"#550000", glow:"#aa0000",
        labelColor:"#ff2222", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"fullwidth",
        maxW:0.92, maxWpx:920, priority:9, duration:220, textSize:20, labelSize:13,
        shake:true,
    },
    "⏰": {
        color:"#ff8833", accent:"#552200", glow:"#994400",
        labelColor:"#ff6600", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"fullwidth",
        maxW:0.88, maxWpx:860, priority:8, duration:200, textSize:18, labelSize:12,
    },
    "⚔️ COMBAT": {
        color:"#ff5544", accent:"#660011", glow:"#cc1100",
        labelColor:"#ff3322", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"bottom-center", barStyle:"fullwidth",
        maxW:0.94, maxWpx:940, priority:10, duration:200, textSize:17, labelSize:12,
        shake:true,
    },
    "⚔️ BOSS": {
        color:"#ff1111", accent:"#330000", glow:"#880000",
        labelColor:"#ff0000", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"boss",
        maxW:0.96, maxWpx:960, priority:11, duration:300, textSize:22, labelSize:14,
        shake:true, pulse:true,
    },
    "🏆 VICTORY": {
        color:"#44ff88", accent:"#004422", glow:"#00cc44",
        labelColor:"#22ff66", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"mid-center", barStyle:"fullwidth",
        maxW:0.90, maxWpx:900, priority:7, duration:320, textSize:20, labelSize:13,
    },
    "🏆 MISSION COMPLETE": {
        color:"#ffdd33", accent:"#664400", glow:"#cc9900",
        labelColor:"#ffbb00", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"top-center", barStyle:"banner",
        maxW:0.70, maxWpx:680, priority:6, duration:300, textSize:17, labelSize:11,
    },
    "🏆 MISSION": {
        color:"#ffcc44", accent:"#553300", glow:"#bb8800",
        labelColor:"#ffaa00", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"top-center", barStyle:"banner",
        maxW:0.70, maxWpx:680, priority:5, duration:280, textSize:17, labelSize:11,
    },
    "🏆 QUEST COMPLETE": {
        color:"#ffdd33", accent:"#664400", glow:"#cc9900",
        labelColor:"#ffbb00", font:"bold {S}px Georgia,serif",
        textAlign:"center", position:"top-center", barStyle:"banner",
        maxW:0.70, maxWpx:680, priority:6, duration:300, textSize:17, labelSize:11,
    },
    "📋 QUEST ACCEPTED": {
        color:"#44bbff", accent:"#001144", glow:"#0055aa",
        labelColor:"#22aaff", font:"{S}px 'Courier New',monospace",
        textAlign:"left", position:"top-right", barStyle:"terminal",
        maxW:0.42, maxWpx:400, priority:3, duration:220, textSize:14, labelSize:11,
    },
    "📋 QUEST": {
        color:"#44bbff", accent:"#001144", glow:"#0055aa",
        labelColor:"#22aaff", font:"{S}px 'Courier New',monospace",
        textAlign:"left", position:"top-right", barStyle:"terminal",
        maxW:0.42, maxWpx:400, priority:3, duration:220, textSize:14, labelSize:11,
    },
};

const _SP_DEFAULT = {
    color:"#c8c8c8", accent:"#333344", glow:"#444455",
    labelColor:"#aaaaaa", font:"{S}px Georgia,serif",
    textAlign:"left", position:"bottom-center", barStyle:"character",
    maxW:0.60, maxWpx:580, priority:1, duration:240, textSize:15, labelSize:11,
};

function _sp(name) { return _SP[name] || _SP_DEFAULT; }

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const _K = {
    PAD_X:6, PAD_TOP:11, PAD_BOT:14,
    LABEL_GAP:5, DIV_GAP:5, LINE_H:24,
    MAX_LINES:3, RADIUS:12, MARGIN:24,
    FADE_IN:14, FADE_OUT:20, SLIDE:22,
    TYPE_SPD:2.4, PROG_H:2,

    // ── Queue limits ──────────────────────────────────────────────────────────
    MAX_VISIBLE: 2,    // max simultaneously shown
    MAX_QUEUED:  5,    // max waiting in queue
    GAP_MS:      90,   // ms gap between promotions
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBTITLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const SubtitleSystem = {

    // ── State ─────────────────────────────────────────────────────────────────
    _active:      [],   // max 2 visible messages
    _queue:       [],   // max 5 waiting
    _history:     [],   // last 50 for H-key overlay
    _id:          0,
    _lastW:       0,
    _lastH:       0,
    _shakeX:      0,
    _shakeY:      0,
    _shakeTimer:  0,
    _showHistory: false,
    _histScroll:  0,
    _lastPromote: 0,    // timestamp of last queue promotion

    // ── show() ────────────────────────────────────────────────────────────────
    show(speaker, text, duration) {
        speaker = typeof speaker === "string" ? speaker.trim() : "";
        text    = typeof text    === "string" ? text.trim()    : String(text ?? "");
        if (!text) return;

        const sp = _sp(speaker);
        duration = Number.isFinite(duration) && duration > 0
                 ? Math.round(duration) : sp.duration;

        // ── RULE 1: Duplicate suppression ─────────────────────────────────────
        // If exact same text is currently showing → discard
        for (const m of this._active) {
            if (m.text === text) return;
        }
        // If exact same text is already queued → discard
        for (const m of this._queue) {
            if (m.text === text) return;
        }

        const msg = {
            id:      ++this._id,
            speaker, text, duration,
            maxDur:  duration,
            sp,
            alpha:   0,
            slide:   _K.SLIDE,
            state:   "in",
            chars:   0,
            done:    false,
            _layout: null,
        };

        // History (always recorded)
        this._history.unshift({ speaker, text, time: Date.now() });
        if (this._history.length > 50) this._history.pop();

        // Shake
        if (sp.shake) this._shake(sp.priority >= 10 ? 10 : 6);

        // ── RULE 2: High priority (≥9) interrupts first active slot ───────────
        if (sp.priority >= 9) {
            // Push lowest-priority active back to queue front if active full
            if (this._active.length >= _K.MAX_VISIBLE) {
                const lowest = this._active.reduce((a, b) =>
                    a.sp.priority < b.sp.priority ? a : b
                );
                if (lowest.sp.priority < sp.priority) {
                    lowest.state = "out"; // force fade immediately
                }
            }
            // Put at front of queue so it's next
            this._queue.unshift(msg);
            this._tryPromote();
            return;
        }

        // ── RULE 3: Slot available → show immediately ─────────────────────────
        if (this._active.length < _K.MAX_VISIBLE) {
            this._activate(msg);
            return;
        }

        // ── RULE 4: Queue has space → add by priority ─────────────────────────
        if (this._queue.length < _K.MAX_QUEUED) {
            let at = this._queue.length;
            for (let i = 0; i < this._queue.length; i++) {
                if (msg.sp.priority > this._queue[i].sp.priority) { at = i; break; }
            }
            this._queue.splice(at, 0, msg);

            // ── Pressure: accelerate active messages when queue is filling ────
            this._applyPressure();
            return;
        }

        // ── RULE 5: Queue full → drop lowest priority item ────────────────────
        // Find lowest priority in queue
        let lowestIdx = 0;
        for (let i = 1; i < this._queue.length; i++) {
            if (this._queue[i].sp.priority < this._queue[lowestIdx].sp.priority) {
                lowestIdx = i;
            }
        }
        // Only replace if incoming is more important
        if (msg.sp.priority > this._queue[lowestIdx].sp.priority) {
            this._queue.splice(lowestIdx, 1);
            let at = this._queue.length;
            for (let i = 0; i < this._queue.length; i++) {
                if (msg.sp.priority > this._queue[i].sp.priority) { at = i; break; }
            }
            this._queue.splice(at, 0, msg);
            this._applyPressure();
        }
        // else: incoming is lowest priority → silently drop it
    },

    // ── Pressure system: more queued = faster fade ───────────────────────────
    _applyPressure() {
        const qLen = this._queue.length;
        if (qLen === 0) return;

        // pressure: 0 at 1 queued, 1.0 at 5 queued
        const pressure = (qLen - 1) / (_K.MAX_QUEUED - 1);

        for (const m of this._active) {
            if (m.state !== "hold") continue;
            // Reduce remaining duration proportionally
            // At max pressure, cut remaining duration by up to 60%
            const minDur = Math.ceil(m.maxDur * 0.40);
            const target = Math.max(minDur,
                Math.floor(m.maxDur * (1 - pressure * 0.60))
            );
            if (m.duration > target) {
                m.duration = target;
            }
        }
    },

    // ── Activate a message into the visible slot ──────────────────────────────
    _activate(msg) {
        msg.alpha  = 0;
        msg.slide  = _K.SLIDE;
        msg.state  = "in";
        msg.chars  = 0;
        msg.done   = false;
        msg._layout = null;
        this._active.push(msg);
    },

    // ── Try to promote from queue ─────────────────────────────────────────────
    _tryPromote() {
        const now = Date.now();
        if (now - this._lastPromote < _K.GAP_MS) return;
        while (this._queue.length > 0 && this._active.length < _K.MAX_VISIBLE) {
            this._activate(this._queue.shift());
            this._lastPromote = Date.now();
        }
    },

    clear() {
        this._active     = [];
        this._queue      = [];
        this._shakeTimer = 0;
        this._shakeX     = 0;
        this._shakeY     = 0;
    },

    toggleHistory() {
        this._showHistory = !this._showHistory;
        this._histScroll  = 0;
    },

    // ── update() — called every frame by game.js:2178 ────────────────────────
    update() {
        // Shake decay
        if (this._shakeTimer > 0) {
            this._shakeTimer--;
            const mag    = this._shakeTimer * 0.45;
            this._shakeX = (Math.random() - 0.5) * mag;
            this._shakeY = (Math.random() - 0.5) * mag;
        } else {
            this._shakeX = 0; this._shakeY = 0;
        }

        // Update active messages
        for (let i = this._active.length - 1; i >= 0; i--) {
            const m = this._active[i];

            switch (m.state) {
                case "in":
                    m.alpha = Math.min(1, m.alpha + 1 / _K.FADE_IN);
                    m.slide = Math.max(0, m.slide - _K.SLIDE / _K.FADE_IN);
                    if (m.alpha >= 1) { m.alpha = 1; m.slide = 0; m.state = "hold"; }
                    break;

                case "hold":
                    m.duration--;
                    if (m.duration <= _K.FADE_OUT && m.done) m.state = "out";
                    if (m.duration <= 0) m.state = "out";
                    break;

                case "out":
                    m.alpha = Math.max(0, m.alpha - 1 / _K.FADE_OUT);
                    if (m.alpha <= 0) {
                        this._active.splice(i, 1);
                        // Re-apply pressure for remaining active
                        this._applyPressure();
                        // Promote next from queue after gap
                        setTimeout(() => this._tryPromote(), _K.GAP_MS);
                        continue;
                    }
                    break;
            }

            // Typewriter
            if (!m.done) {
                m.chars = Math.min(m.text.length, m.chars + _K.TYPE_SPD);
                if (m.chars >= m.text.length) m.done = true;
            }
        }
    },

    // ── draw() — called every frame by game.js:1680 ──────────────────────────
    draw(ctx, cw, ch) {
        if (this._showHistory) {
            this._drawHistory(ctx, cw, ch);
            return;
        }

        if (cw !== this._lastW || ch !== this._lastH) {
            this._active.forEach((m) => { m._layout = null; });
            this._lastW = cw; this._lastH = ch;
        }

        if (this._active.length === 0) return;

        ctx.save();
        if (this._shakeTimer > 0) ctx.translate(this._shakeX, this._shakeY);

        for (const m of this._active) {
            if (!m._layout) m._layout = this._buildLayout(ctx, m, cw, ch);
            ctx.globalAlpha = Math.max(0, Math.min(1, m.alpha));
            this._drawBar(ctx, m, cw, ch);
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        // Queue indicator — small dot badge shows how many are waiting
        if (this._queue.length > 0) {
            this._drawQueueBadge(ctx, cw, ch);
        }
    },

    // ── Queue badge ───────────────────────────────────────────────────────────
    _drawQueueBadge(ctx, cw, ch) {
        const n    = this._queue.length;
        const txt  = "+" + n;
        const bx   = cw - 42;
        const by   = ch - 52;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle   = "#1a1020";
        ctx.beginPath();
        ctx.arc(bx + 14, by + 14, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle    = n >= 4 ? "#ff6644" : "#aaaacc";
        ctx.font         = "bold 11px 'Courier New', monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, bx + 14, by + 14);
        ctx.restore();
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  LAYOUT
    // ═══════════════════════════════════════════════════════════════════════════
    _buildLayout(ctx, msg, cw, ch) {
        const sp    = msg.sp;
        const barW  = Math.min(sp.maxWpx, cw * sp.maxW);
        const innerW = barW - _K.PAD_X * 2 - (sp.barStyle === "character" ? 6 : 0);

        ctx.font = sp.font.replace("{S}", sp.textSize);
        const lines = this._wrap(ctx, msg.text, innerW, _K.MAX_LINES);

        const hasLabel = sp.labelColor !== null && msg.speaker.length > 0;
        const labelH   = hasLabel ? sp.labelSize + _K.LABEL_GAP + _K.DIV_GAP + 1 : 0;
        const barH     = _K.PAD_TOP + labelH + lines.length * _K.LINE_H
                       + _K.PAD_BOT + _K.PROG_H + 3;

        const M = _K.MARGIN;
        let barX, barY, slideDir;

        // If two active, offset second one so they don't overlap
        const slotIdx = this._active.indexOf(msg);

        switch (sp.position) {
            case "bottom-center":
                barX     = (cw - barW) / 2;
                barY     = ch - barH - M - (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "up"; break;
            case "bottom-left":
                barX     = M;
                barY     = ch - barH - M - (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "up"; break;
            case "bottom-right":
                barX     = cw - barW - M;
                barY     = ch - barH - M - (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "up"; break;
            case "top-center":
                barX     = (cw - barW) / 2;
                barY     = M + (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "down"; break;
            case "top-left":
                barX     = M;
                barY     = M + (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "down"; break;
            case "top-right":
                barX     = cw - barW - M;
                barY     = M + (slotIdx > 0 ? barH + 8 : 0);
                slideDir = "down"; break;
            case "mid-center":
                barX     = (cw - barW) / 2;
                barY     = ch * 0.38 - barH / 2;
                slideDir = "up"; break;
            default:
                barX     = (cw - barW) / 2;
                barY     = ch - barH - M;
                slideDir = "up";
        }

        return { barW, barH, barX, barY, lines, hasLabel, slideDir };
    },

    // ═══════════════════════════════════════════════════════════════════════════
    //  DRAW BAR — all styles preserved from v4
    // ═══════════════════════════════════════════════════════════════════════════
    _drawBar(ctx, msg, cw, ch) {
        const L  = msg._layout;
        const sp = msg.sp;
        const bs = sp.barStyle;
        const R  = _K.RADIUS;
        const ts = sp.textSize;

        let barY = L.barY;
        if (L.slideDir === "up")   barY += msg.slide;
        if (L.slideDir === "down") barY -= msg.slide;

        const { barW, barH, barX } = L;

        // ── Glow ──────────────────────────────────────────────────────────────
        const glowBlur = sp.pulse
            ? 24 + Math.sin(Date.now() * 0.005) * 10
            : bs === "boss" ? 30 : bs === "entity" ? 22 : 14;

        ctx.save();
        ctx.shadowColor = sp.glow;
        ctx.shadowBlur  = glowBlur;
        ctx.fillStyle   = "transparent";
        this._pill(ctx, barX-2, barY-2, barW+4, barH+4, R+2);
        ctx.fill();
        ctx.restore();

        // ── Background ────────────────────────────────────────────────────────
        ctx.save();
        let fill;
        if (bs === "cinematic") {
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,"rgba(10,7,15,0.96)");
            g.addColorStop(1,"rgba(5,3,8,0.98)");
            fill = g;
        } else if (bs === "character") {
            const rv=parseInt(sp.accent.slice(1,3)||"0",16);
            const gv=parseInt(sp.accent.slice(3,5)||"0",16);
            const bv=parseInt(sp.accent.slice(5,7)||"0",16);
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,`rgba(${Math.min(rv+10,30)},${Math.min(gv+5,20)},${Math.min(bv+15,35)},0.94)`);
            g.addColorStop(1,"rgba(4,2,8,0.97)");
            fill = g;
        } else if (bs === "terminal") {
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,"rgba(0,12,6,0.95)");
            g.addColorStop(1,"rgba(0,6,3,0.98)");
            fill = g;
        } else if (bs === "ghost") {
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,"rgba(8,5,15,0.85)");
            g.addColorStop(1,"rgba(3,2,8,0.90)");
            fill = g;
        } else if (bs === "boss") {
            const pulse=0.15+Math.abs(Math.sin(Date.now()*0.003))*0.08;
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,`rgba(${Math.round(30+pulse*40)},3,3,0.97)`);
            g.addColorStop(1,"rgba(8,0,0,0.99)");
            fill = g;
        } else if (bs === "entity") {
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,"rgba(15,2,25,0.97)");
            g.addColorStop(1,"rgba(5,0,10,0.99)");
            fill = g;
        } else if (bs === "fullwidth") {
            const rv=parseInt(sp.accent.slice(1,3)||"0",16);
            const gv=parseInt(sp.accent.slice(3,5)||"0",16);
            const bv=parseInt(sp.accent.slice(5,7)||"0",16);
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,`rgba(${rv},${gv},${bv},0.35)`);
            g.addColorStop(0.3,"rgba(6,3,10,0.95)");
            g.addColorStop(1,"rgba(3,1,5,0.98)");
            fill = g;
        } else if (bs === "banner") {
            const g = ctx.createLinearGradient(barX,barY,barX,barY+barH);
            g.addColorStop(0,"rgba(25,15,2,0.97)");
            g.addColorStop(1,"rgba(8,5,0,0.98)");
            fill = g;
        } else {
            fill = "rgba(8,5,12,0.95)";
        }
        ctx.fillStyle = fill;
        this._pill(ctx,barX,barY,barW,barH,R);
        ctx.fill();
        ctx.restore();

        // ── Border ────────────────────────────────────────────────────────────
        ctx.strokeStyle = sp.accent+"66";
        ctx.lineWidth   = bs==="boss"||bs==="entity"?2:1;
        this._pill(ctx,barX,barY,barW,barH,R);
        ctx.stroke();

        // ── Style decorations ─────────────────────────────────────────────────
        if (bs === "cinematic") {
            ctx.fillStyle=sp.accent+"88";
            ctx.fillRect(barX,barY,barW,1);
            ctx.fillRect(barX,barY+barH-1,barW,1);

        } else if (bs === "character") {
            const sg=ctx.createLinearGradient(barX,barY,barX,barY+barH);
            sg.addColorStop(0,sp.color+"ff");
            sg.addColorStop(0.5,sp.accent+"aa");
            sg.addColorStop(1,sp.accent+"11");
            ctx.fillStyle=sg;
            this._pill(ctx,barX,barY,4,barH,[R,0,0,R]);
            ctx.fill();

        } else if (bs === "terminal") {
            ctx.fillStyle="rgba(0,255,100,0.02)";
            for (let sy=barY;sy<barY+barH;sy+=3) ctx.fillRect(barX,sy,barW,1);
            ctx.fillStyle=sp.color+"66";
            ctx.fillRect(barX,barY,2,barH);

        } else if (bs === "ghost") {
            ctx.save();
            ctx.strokeStyle=sp.color+"44";
            ctx.lineWidth=1;
            ctx.setLineDash([4,4]);
            this._pill(ctx,barX,barY,barW,barH,R);
            ctx.stroke();
            ctx.restore();

        } else if (bs === "boss") {
            ctx.strokeStyle=sp.color+"44";
            ctx.lineWidth=3;
            this._pill(ctx,barX-2,barY-2,barW+4,barH+4,R+2);
            ctx.stroke();
            const cL=18;
            ctx.strokeStyle=sp.color+"cc"; ctx.lineWidth=2;
            ctx.beginPath(); ctx.moveTo(barX,barY+cL); ctx.lineTo(barX,barY); ctx.lineTo(barX+cL,barY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(barX+barW-cL,barY); ctx.lineTo(barX+barW,barY); ctx.lineTo(barX+barW,barY+cL); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(barX,barY+barH-cL); ctx.lineTo(barX,barY+barH); ctx.lineTo(barX+cL,barY+barH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(barX+barW-cL,barY+barH); ctx.lineTo(barX+barW,barY+barH); ctx.lineTo(barX+barW,barY+barH-cL); ctx.stroke();

        } else if (bs==="fullwidth"||bs==="banner") {
            const tg=ctx.createLinearGradient(barX,0,barX+barW,0);
            tg.addColorStop(0,"transparent");
            tg.addColorStop(0.15,sp.color+"99");
            tg.addColorStop(0.5,sp.color+"ff");
            tg.addColorStop(0.85,sp.color+"99");
            tg.addColorStop(1,"transparent");
            ctx.fillStyle=tg;
            ctx.fillRect(barX,barY,barW,2);

        } else if (bs==="entity") {
            ctx.fillStyle=sp.color+"55";
            const rS=12;
            ctx.fillRect(barX+6,barY+4,rS,2); ctx.fillRect(barX+6,barY+4,2,rS);
            ctx.fillRect(barX+barW-6-rS,barY+4,rS,2); ctx.fillRect(barX+barW-8,barY+4,2,rS);
            ctx.fillRect(barX+6,barY+barH-6,rS,2); ctx.fillRect(barX+6,barY+barH-6-rS,2,rS);
            ctx.fillRect(barX+barW-6-rS,barY+barH-6,rS,2); ctx.fillRect(barX+barW-8,barY+barH-6-rS,2,rS);
        }

        // ── Label ─────────────────────────────────────────────────────────────
        let textY = barY + _K.PAD_TOP;
        const isCenter = sp.textAlign === "center";
        const textX    = isCenter
            ? barX + barW / 2
            : bs === "character"
                ? barX + _K.PAD_X + 6
                : barX + _K.PAD_X;

        if (L.hasLabel) {
            ctx.save();
            ctx.font         = `bold ${sp.labelSize}px 'Courier New',monospace`;
            ctx.textAlign    = isCenter ? "center" : "left";
            ctx.textBaseline = "top";
            ctx.shadowColor  = sp.glow;
            ctx.shadowBlur   = 8;
            ctx.fillStyle    = sp.labelColor;
            ctx.fillText(msg.speaker, textX, textY);
            ctx.restore();
            textY += sp.labelSize + _K.LABEL_GAP;

            const dg=ctx.createLinearGradient(barX+_K.PAD_X,0,barX+barW-_K.PAD_X,0);
            dg.addColorStop(0,"transparent");
            dg.addColorStop(0.1,sp.accent+"99");
            dg.addColorStop(0.5,sp.accent+"dd");
            dg.addColorStop(0.9,sp.accent+"99");
            dg.addColorStop(1,"transparent");
            ctx.fillStyle=dg;
            ctx.fillRect(barX+_K.PAD_X,textY,barW-_K.PAD_X*2,1);
            textY += _K.DIV_GAP+1;
        }

        // ── Body text ─────────────────────────────────────────────────────────
        const visible  = msg.text.slice(0, Math.ceil(msg.chars));
        const visLines = this._typeLines(L.lines, visible);
        const font     = sp.font.replace("{S}", ts);

        ctx.font         = font;
        ctx.textAlign    = isCenter ? "center" : "left";
        ctx.textBaseline = "top";

        for (let i = 0; i < visLines.length; i++) {
            const line = visLines[i];
            if (!line) break;
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillText(line, textX+1, textY+1);
            ctx.fillStyle = sp.color;
            ctx.fillText(line, textX, textY);
            textY += _K.LINE_H;
        }

        // ── Cursor ────────────────────────────────────────────────────────────
        if (!msg.done && Math.floor(Date.now()/300)%2===0) {
            const lastLine = visLines[visLines.length-1]||"";
            ctx.font = font;
            const tw  = ctx.measureText(lastLine).width;
            const cx  = isCenter ? textX+tw/2+3 : textX+tw+3;
            const cy  = textY-_K.LINE_H+3;
            ctx.fillStyle = sp.color+"bb";
            ctx.fillRect(cx,cy,2,ts-2);
        }

        // ── Progress bar ──────────────────────────────────────────────────────
        const pct   = Math.max(0, Math.min(1, msg.duration/msg.maxDur));
        const progY = barY+barH-_K.PROG_H-3;
        const progX = barX+_K.PAD_X;
        const progW = barW-_K.PAD_X*2;
        ctx.fillStyle="rgba(255,255,255,0.05)";
        ctx.fillRect(progX,progY,progW,_K.PROG_H);
        const pg=ctx.createLinearGradient(progX,0,progX+progW,0);
        pg.addColorStop(0,sp.color+"cc");
        pg.addColorStop(0.6,sp.color+"77");
        pg.addColorStop(1,sp.accent+"33");
        ctx.fillStyle=pg;
        ctx.fillRect(progX,progY,progW*pct,_K.PROG_H);
    },

    // ── History overlay ───────────────────────────────────────────────────────
    _drawHistory(ctx, cw, ch) {
        const W=Math.min(680,cw*0.88);
        const H=Math.min(500,ch*0.78);
        const X=(cw-W)/2;
        const Y=(ch-H)/2;
        ctx.save();
        ctx.globalAlpha=0.97;
        ctx.fillStyle="rgba(4,2,8,0.97)";
        this._pill(ctx,X,Y,W,H,14); ctx.fill();
        ctx.strokeStyle="#55336688"; ctx.lineWidth=1.5;
        this._pill(ctx,X,Y,W,H,14); ctx.stroke();
        ctx.fillStyle="#ccaa55";
        ctx.font="bold 13px 'Courier New',monospace";
        ctx.textAlign="center"; ctx.textBaseline="top";
        ctx.fillText("MESSAGE HISTORY  —  press H to close",X+W/2,Y+14);
        ctx.fillStyle="#33224433";
        ctx.fillRect(X+16,Y+36,W-32,1);
        const lineH=50;
        const clipY=Y+42;
        ctx.save();
        ctx.beginPath(); ctx.rect(X+10,clipY,W-20,H-56); ctx.clip();
        this._history.forEach((e,i) => {
            const ey=Y+46+i*lineH+this._histScroll;
            if (ey>Y+H-16||ey+lineH<clipY) return;
            const sp2=_sp(e.speaker);
            const age=Math.min(1,(Date.now()-e.time)/12000);
            ctx.globalAlpha=0.97-age*0.45;
            ctx.font="bold 10px 'Courier New',monospace";
            ctx.textAlign="left"; ctx.textBaseline="top";
            ctx.fillStyle=sp2.labelColor||sp2.color;
            ctx.fillText(e.speaker||"—",X+18,ey+4);
            ctx.font="13px Georgia,serif"; ctx.fillStyle="#c8c4bc";
            let t=e.text;
            while(ctx.measureText(t).width>W-40&&t.length>0) t=t.slice(0,-1);
            if(t.length<e.text.length) t+="…";
            ctx.fillText(t,X+18,ey+20);
            ctx.fillStyle="#ffffff07";
            ctx.fillRect(X+14,ey+lineH-2,W-28,1);
        });
        ctx.restore();
        ctx.globalAlpha=1;
        ctx.fillStyle="#443322";
        ctx.font="11px 'Courier New',monospace";
        ctx.textAlign="center"; ctx.textBaseline="bottom";
        ctx.fillText(this._history.length+" messages — scroll with mouse wheel",X+W/2,Y+H-6);
        ctx.restore();
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    _shake(intensity) {
        this._shakeTimer = Math.max(this._shakeTimer, intensity*3);
    },

    _wrap(ctx, text, maxW, maxLines) {
        const words=text.split(" ");
        const lines=[];
        let line="";
        for (let i=0;i<words.length;i++) {
            const test=line?line+" "+words[i]:words[i];
            if (ctx.measureText(test).width>maxW&&line) {
                lines.push(line); line=words[i];
                if (lines.length>=maxLines) {
                    let rest=line;
                    for (let j=i+1;j<words.length;j++) rest+=" "+words[j];
                    while(ctx.measureText(rest+"…").width>maxW&&rest.length>0)
                        rest=rest.slice(0,-1).trimEnd();
                    lines[lines.length-1]=rest+"…";
                    return lines;
                }
            } else { line=test; }
        }
        if (line) lines.push(line);
        return lines;
    },

    _typeLines(lines, visible) {
        const out=[];
        let rem=visible;
        for (const line of lines) {
            if (!rem) break;
            if (rem.length>=line.length) {
                out.push(line);
                rem=rem.slice(line.length).replace(/^ /,"");
            } else { out.push(rem); break; }
        }
        return out;
    },

    _pill(ctx, x, y, w, h, r) {
        if (typeof r==="number") r=[r,r,r,r];
        const [tl,tr,br,bl]=r;
        ctx.beginPath();
        ctx.moveTo(x+tl,y); ctx.lineTo(x+w-tr,y);
        ctx.arcTo(x+w,y,x+w,y+tr,tr); ctx.lineTo(x+w,y+h-br);
        ctx.arcTo(x+w,y+h,x+w-br,y+h,br); ctx.lineTo(x+bl,y+h);
        ctx.arcTo(x,y+h,x,y+h-bl,bl); ctx.lineTo(x,y+tl);
        ctx.arcTo(x,y,x+tl,y,tl); ctx.closePath();
    },

    onWheel(e) {
        if (!this._showHistory) return;
        this._histScroll=Math.min(0,this._histScroll-e.deltaY*0.4);
    },
};

window.addEventListener("wheel",(e)=>SubtitleSystem.onWheel(e),{passive:true});
window.addEventListener("keydown",(e)=>{
    if ((e.key==="h"||e.key==="H")&&
        document.activeElement.tagName!=="INPUT"&&
        document.activeElement.tagName!=="TEXTAREA") {
        SubtitleSystem.toggleHistory();
    }
});

// ── Dialog override ───────────────────────────────────────────────────────────
let _installed=false;
function installSubtitleOverride() {
    if (_installed) return;
    _installed=true;
    const _origChoices=window._gameShowDialogWithChoices||
        (typeof showDialogWithChoices==="function"?showDialogWithChoices:null);
    window.showDialog=function(speaker,text,callback) {
        try { SubtitleSystem.show(speaker,text); } catch(e) {}
        if (typeof callback==="function") {
            setTimeout(()=>{ try{callback();}catch(e){} },80);
        }
    };
    if (_origChoices) {
        window.showDialogWithChoices=function(speaker,text,choices) {
            try{_origChoices.call(window,speaker,text,choices);}
            catch(e){console.warn("[Subtitles] choices error:",e);}
        };
    }
}

// ── FlashlightSystem ──────────────────────────────────────────────────────────
const FlashlightSystem={
    flickerTimer:0,flickerIntensity:0,dimLevel:1.0,
    update(battery){
        battery=Number.isFinite(battery)?Math.max(0,battery):0;
        if(battery>50){this.dimLevel=1.0;}
        else if(battery>20){this.dimLevel=0.5+(battery-20)/60;}
        else if(battery>5){this.dimLevel=0.2+(battery-5)/50;this._f(battery,30,30);}
        else if(battery>0){this.dimLevel=0.05+battery/100;this._f(battery,10,15);}
        else{this.dimLevel=0;}
        this.flickerIntensity*=0.85;
        return Math.max(0,this.dimLevel-this.flickerIntensity);
    },
    _f(battery,base,rand){
        this.flickerTimer++;
        if(this.flickerTimer%(base+Math.floor(Math.random()*rand))===0){
            this.flickerIntensity=0.3+Math.random()*0.5;
            try{if(typeof AudioEngine!=="undefined"&&AudioEngine.initialized&&
                typeof AudioEngine.playFlashlightFlicker==="function")
                AudioEngine.playFlashlightFlicker(battery);}catch(e){}
        }
    },
    getRange(battery){
        const eff=this.update(battery);
        return{range:80+eff*170,alpha:0.3+eff*0.6,coneAngle:0.4+eff*0.2};
    },
};

const SoundtrackManager={lastRoom:null,update(){}};