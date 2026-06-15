// ═════════════════════════════════════════════════════════════════
//  SUBTITLE_SYSTEM.JS — Non-blocking message display
//  Messages fade in/out, never block gameplay.
//  Choice dialogs still use the blocking system.
//  Includes FlashlightSystem (visual dimming) and
//  SoundtrackManager STUB (disabled — AudioManager handles all music).
// ═════════════════════════════════════════════════════════════════

const SubtitleSystem = {
    messages: [],
    maxMessages: 3,
    defaultDuration: 240,   // 4 seconds at 60fps
    fadeFrames: 30,
    _pendingQueue: [],       // overflow queue — never dropped, never crashes
    _processing: false,

    // ── Speaker colour palette ────────────────────────────────────
    _speakerColors: {
        "NARRATOR":            "#8899aa",
        "ELEANORA":            "#88bbff",
        "VICTOR":              "#cc5544",
        "JAMES":               "#88ccaa",
        "MARY":                "#cc88cc",
        "THOMAS":              "#88aa66",
        "FATHER HARMON":       "#cccc88",
        "AZATHIEL":            "#cc44ff",
        "SYSTEM":              "#66aa66",
        "???":                 "#aa88cc",
        "⏰ TIME RESET":       "#cc8844",
        "⏰ WARNING":          "#cc4444",
        "⏰":                  "#cc6644",
        "⚔️ COMBAT":          "#cc4444",
        "⚔️ BOSS":            "#ff4444",
        "🏆 MISSION COMPLETE": "#ffcc44",
        "🏆 QUEST COMPLETE":   "#ffcc44",
        "🏆 VICTORY":          "#44cc44",
        "📋 QUEST ACCEPTED":   "#44aacc",
        "📋 QUEST":            "#44aacc",
    },

    // ── Public API ────────────────────────────────────────────────
    show(speaker, text, duration) {
        // Sanitise inputs defensively
        speaker  = (typeof speaker  === "string") ? speaker.trim()  : "";
        text     = (typeof text     === "string") ? text.trim()     : String(text ?? "");
        duration = (Number.isFinite(duration) && duration > 0)
                   ? Math.round(duration)
                   : this.defaultDuration;

        if (!text) return;   // nothing to show

        // If there is room, add directly; otherwise queue
        if (this.messages.length < this.maxMessages) {
            this._addMessage(speaker, text, duration);
        } else {
            this._pendingQueue.push({ speaker, text, duration });
        }
    },

    // ── Internal helpers ──────────────────────────────────────────
    _addMessage(speaker, text, duration) {
        this.messages.push({
            speaker,
            text,
            duration,
            maxDuration: duration,
            alpha:       0,
            state:       "fadeIn",
            ySlot:       0,          // smoothed vertical slot
        });
    },

    _tryFlushQueue() {
        while (this._pendingQueue.length > 0 &&
               this.messages.length < this.maxMessages) {
            const next = this._pendingQueue.shift();
            this._addMessage(next.speaker, next.text, next.duration);
        }
    },

    // ── Per-frame update ──────────────────────────────────────────
    update() {
        // Iterate backwards so splice() indices stay valid
        for (let i = this.messages.length - 1; i >= 0; i--) {
            const m = this.messages[i];

            switch (m.state) {
                case "fadeIn":
                    m.alpha = Math.min(1, m.alpha + 1 / this.fadeFrames);
                    if (m.alpha >= 1) m.state = "visible";
                    break;

                case "visible":
                    m.duration--;
                    if (m.duration <= this.fadeFrames) m.state = "fadeOut";
                    break;

                case "fadeOut":
                    m.alpha    = Math.max(0, m.alpha - 1 / this.fadeFrames);
                    m.duration = Math.max(0, m.duration - 1);
                    if (m.alpha <= 0 || m.duration <= 0) {
                        this.messages.splice(i, 1);
                        continue;          // skip ySlot update for removed msg
                    }
                    break;

                default:
                    // Unknown state — defensive removal
                    this.messages.splice(i, 1);
                    continue;
            }

            // Smooth vertical position toward the message's current slot
            // (slot = position from bottom, 0 = bottom-most)
            const targetSlot = i;
            m.ySlot += (targetSlot - m.ySlot) * 0.18;
        }

        // Pull from overflow queue if slots have freed up
        this._tryFlushQueue();
    },

    // ── Render ────────────────────────────────────────────────────
    draw(ctx, cw, ch) {
        if (this.messages.length === 0) return;

        const PAD_H       = 10;      // horizontal inner padding
        const PAD_V_TOP   = 6;       // space above speaker label
        const PAD_V_BOT   = 8;       // space below text
        const LABEL_SIZE  = 11;      // speaker font size
        const TEXT_SIZE   = 15;      // body font size
        const LINE_H      = TEXT_SIZE + 4;
        const MAX_LINES   = 2;
        const MAX_WIDTH   = Math.min(700, cw * 0.82);
        const BAR_RADIUS  = 8;
        const SLOT_GAP    = 8;       // vertical gap between bars

        // We measure text to size the bar exactly, so set font first
        ctx.font = `${TEXT_SIZE}px Georgia, 'Times New Roman', serif`;

        // Pre-calculate each message's wrapped lines (cheap, one pass)
        const layouts = this.messages.map(m => {
            const innerW = MAX_WIDTH - PAD_H * 2;
            const lines  = this._wrapText(ctx, m.text, innerW, MAX_LINES);
            const hasLabel = m.speaker.length > 0;
            const barH = PAD_V_TOP
                       + (hasLabel ? LABEL_SIZE + 4 : 0)
                       + lines.length * LINE_H
                       + PAD_V_BOT;
            return { lines, hasLabel, barH };
        });

        // Compute stacked bottom-up positions
        // messages[0] is bottom-most (slot 0)
        const ANCHOR_Y = ch - 30;   // bottom anchor

        // Build slot → cumulative height map so bars don't overlap
        // even when bar heights differ
        const slotOffsets = [];     // slotOffsets[i] = y of TOP of bar i
        let cursor = ANCHOR_Y;
        for (let i = 0; i < this.messages.length; i++) {
            const barH = layouts[i].barH;
            cursor -= barH;
            slotOffsets.push(cursor);
            cursor -= SLOT_GAP;
        }

        // Draw each subtitle
        for (let i = 0; i < this.messages.length; i++) {
            const m      = this.messages[i];
            const layout = layouts[i];

            // Smoothed vertical slot interpolation
            const slotInt   = Math.round(m.ySlot);
            const slotFrac  = m.ySlot - slotInt;
            const slotIdxA  = Math.max(0, Math.min(slotOffsets.length - 1, slotInt));
            const slotIdxB  = Math.max(0, Math.min(slotOffsets.length - 1, slotInt + 1));
            const barTopY   = slotOffsets[slotIdxA] * (1 - slotFrac)
                            + slotOffsets[slotIdxB] * slotFrac;

            const barX = cw / 2 - MAX_WIDTH / 2;
            const barY = barTopY;
            const barW = MAX_WIDTH;
            const barH = layout.barH;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, m.alpha));

            // ── Background pill ───────────────────────────────────
            ctx.fillStyle = "rgba(5, 5, 10, 0.78)";
            this._roundRect(ctx, barX, barY, barW, barH, BAR_RADIUS);
            ctx.fill();

            // Subtle left-edge accent stripe
            const speakerColor = this._speakerColors[m.speaker] || "#778899";
            ctx.fillStyle = speakerColor;
            this._roundRect(ctx, barX, barY, 3, barH, [BAR_RADIUS, 0, 0, BAR_RADIUS]);
            ctx.fill();

            let textY = barY + PAD_V_TOP;

            // ── Speaker label ─────────────────────────────────────
            if (layout.hasLabel) {
                ctx.font      = `bold ${LABEL_SIZE}px 'Courier New', monospace`;
                ctx.fillStyle = speakerColor;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";

                // Subtle glow on speaker name
                ctx.shadowColor   = speakerColor;
                ctx.shadowBlur    = 6;
                ctx.fillText(m.speaker, barX + PAD_H + 6, textY);
                ctx.shadowBlur    = 0;

                textY += LABEL_SIZE + 4;
            }

            // ── Body text ─────────────────────────────────────────
            ctx.font         = `${TEXT_SIZE}px Georgia, 'Times New Roman', serif`;
            ctx.fillStyle    = "#e8e8e8";
            ctx.textAlign    = "left";
            ctx.textBaseline = "top";
            ctx.shadowBlur   = 0;

            for (const line of layout.lines) {
                ctx.fillText(line, barX + PAD_H + 6, textY);
                textY += LINE_H;
            }

            // ── Progress bar (duration indicator) ────────────────
            const progress = Math.max(0, Math.min(1, m.duration / m.maxDuration));
            const progW    = (barW - 12) * progress;
            ctx.fillStyle  = `rgba(255,255,255,0.12)`;
            ctx.fillRect(barX + 6, barY + barH - 3, barW - 12, 2);
            ctx.fillStyle  = `${speakerColor}88`;
            ctx.fillRect(barX + 6, barY + barH - 3, progW, 2);

            ctx.restore();
        }
    },

    // ── Text wrapping ─────────────────────────────────────────────
    _wrapText(ctx, text, maxWidth, maxLines) {
        const words = text.split(" ");
        const lines = [];
        let   line  = "";

        for (let w = 0; w < words.length; w++) {
            const word     = words[w];
            const testLine = line ? `${line} ${word}` : word;
            const testW    = ctx.measureText(testLine).width;

            if (testW > maxWidth && line) {
                lines.push(line);
                line = word;
                if (lines.length >= maxLines) {
                    // Truncate remaining text with ellipsis
                    let truncated = line;
                    for (let rest = w + 1; rest < words.length; rest++) {
                        truncated += " " + words[rest];
                    }
                    // Trim to fit with "…"
                    while (ctx.measureText(truncated + "…").width > maxWidth &&
                           truncated.length > 0) {
                        truncated = truncated.slice(0, -1).trimEnd();
                    }
                    lines[lines.length - 1] = truncated + "…";
                    return lines;
                }
            } else {
                line = testLine;
            }
        }

        if (line) lines.push(line);
        return lines;
    },

    // ── Cross-browser roundRect helper ────────────────────────────
    _roundRect(ctx, x, y, w, h, r) {
        if (typeof r === "number") r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        ctx.arcTo(x + w, y,     x + w, y + tr,   tr);
        ctx.lineTo(x + w, y + h - br);
        ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
        ctx.lineTo(x + bl, y + h);
        ctx.arcTo(x,     y + h, x, y + h - bl,   bl);
        ctx.lineTo(x,     y + tl);
        ctx.arcTo(x,     y,     x + tl,   y,     tl);
        ctx.closePath();
    },

    // ── Utilities ─────────────────────────────────────────────────
    clear() {
        this.messages      = [];
        this._pendingQueue = [];
    },
};


// ─── DIALOG OVERRIDE — non-blocking narration ───────────────────
let subtitleOverrideInstalled = false;

function installSubtitleOverride() {
    if (subtitleOverrideInstalled) return;
    subtitleOverrideInstalled = true;

    const origShowDialogWithChoices =
        window._gameShowDialogWithChoices ||
        (typeof showDialogWithChoices === "function" ? showDialogWithChoices : null);

    // Non-blocking — simple messages become subtitles
    window.showDialog = function (speaker, text, callback) {
        SubtitleSystem.show(speaker, text);
        if (typeof callback === "function") {
            // Defer so call-stack unwinds before any game logic fires
            setTimeout(() => { try { callback(); } catch (e) { console.warn("showDialog callback error:", e); } }, 100);
        }
    };

    // Blocking — choices still use the original system
    if (origShowDialogWithChoices) {
        window.showDialogWithChoices = function (speaker, text, choices) {
            try {
                origShowDialogWithChoices.call(window, speaker, text, choices);
            } catch (e) {
                console.warn("showDialogWithChoices error:", e);
            }
        };
    }
}


// ─── FLASHLIGHT DIMMING SYSTEM ──────────────────────────────────
const FlashlightSystem = {
    flickerTimer:     0,
    flickerIntensity: 0,
    dimLevel:         1.0,

    update(battery) {
        battery = Number.isFinite(battery) ? Math.max(0, battery) : 0;

        if (battery > 50) {
            this.dimLevel = 1.0;
        } else if (battery > 20) {
            this.dimLevel = 0.5 + (battery - 20) / 60;
        } else if (battery > 5) {
            this.dimLevel = 0.2 + (battery - 5) / 50;
            this._maybeFlicker(battery, 30, 30);
        } else if (battery > 0) {
            this.dimLevel = 0.05 + battery / 100;
            this._maybeFlicker(battery, 10, 15);
        } else {
            this.dimLevel = 0;
        }

        this.flickerIntensity *= 0.85;
        return Math.max(0, this.dimLevel - this.flickerIntensity);
    },

    _maybeFlicker(battery, baseInterval, randRange) {
        this.flickerTimer++;
        const interval = baseInterval + Math.floor(Math.random() * randRange);
        if (this.flickerTimer % interval === 0) {
            this.flickerIntensity = 0.3 + Math.random() * 0.5;
            try {
                if (typeof AudioEngine !== "undefined" &&
                    AudioEngine.initialized &&
                    typeof AudioEngine.playFlashlightFlicker === "function") {
                    AudioEngine.playFlashlightFlicker(battery);
                }
            } catch (e) { /* audio errors must never crash the game */ }
        }
    },

    getRange(baseBattery) {
        const effective = this.update(baseBattery);
        return {
            range:     80  + effective * 170,
            alpha:     0.3 + effective * 0.6,
            coneAngle: 0.4 + effective * 0.2,
        };
    },
};


// ─── SOUNDTRACK MANAGER — DISABLED STUB ─────────────────────────
// AudioManager (real MP3 files) handles ALL music and ambience.
// This stub exists only to prevent reference errors from other code
// that might still call SoundtrackManager.update().
const SoundtrackManager = {
    lastRoom: null,
    update(/* roomId */) {
        // Intentionally empty.
        // The synth-based music conflicted with MP3 music and could not
        // be properly stopped (Web Audio limitation), causing sounds to
        // persist across rooms. AudioManager handles everything now.
    },
};