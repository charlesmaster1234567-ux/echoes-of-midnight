// ═════════════════════════════════════════════════════════════════
//  MOBILE.JS — Touch Controls  v2.0
//  Virtual joystick + multitouch action buttons
//  Load AFTER game.js
// ═════════════════════════════════════════════════════════════════

const Mobile = {
    active:  false,
    _hooked: false,

    // ── Joystick state ──────────────────────────────────────────
    joystick: {
        active:  false,
        touchId: null,
        baseX:   0,  baseY:   0,
        stickX:  0,  stickY:  0,
        x:       0,  y:       0,
        MAX:     60,         // px radius of joystick cage
        FLOAT_THRESHOLD: 80, // px — base repositions when stick exceeds this
    },

    // ── Button definitions (rebuilt on resize) ───────────────────
    buttons: [],

    // ── Per-button active touch tracking (multitouch) ────────────
    // Map<buttonId, touchIdentifier>
    _btnTouches: new Map(),

    // ── Resize throttle ─────────────────────────────────────────
    _lastW: 0, _lastH: 0, _resizeTick: 0,

    // ── Keys that mobile is currently holding down ───────────────
    // Used to cleanly release them when joystick releases
    _heldKeys: new Set(),


    // ─── DETECTION ──────────────────────────────────────────────
    isMobile() {
        return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i
                   .test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    },


    // ─── INIT ───────────────────────────────────────────────────
    init() {
        if (this.active) return;
        if (!this.isMobile()) return;

        this.active = true;

        document.body.style.overflow    = "hidden";
        document.body.style.touchAction = "none";
        document.body.style.userSelect  = "none";

        this._setupButtons();
        this._bindTouchEvents();
        this._hookGameLoop();

        console.log("[Mobile] Touch controls active");
    },


    // ─── CANVAS REFERENCE ───────────────────────────────────────
    _canvas() {
        return (typeof canvas !== "undefined" && canvas)
            ? canvas
            : document.getElementById("gameCanvas");
    },


    // ─── BIND TOUCH EVENTS ──────────────────────────────────────
    // Binds to document instead of canvas so touches on DOM dialog
    // elements are also caught. We check manually what was hit.
    _bindTouchEvents() {
        const opts = { passive: false };
        document.addEventListener("touchstart",  this._onTouchStart.bind(this),  opts);
        document.addEventListener("touchmove",   this._onTouchMove.bind(this),   opts);
        document.addEventListener("touchend",    this._onTouchEnd.bind(this),    opts);
        document.addEventListener("touchcancel", this._onTouchCancel.bind(this), opts);
    },


    // ─── BUTTON LAYOUT ──────────────────────────────────────────
    _setupButtons() {
        const cw    = window.innerWidth;
        const ch    = window.innerHeight;
        const bSize = Math.max(48, Math.min(64, cw * 0.13));
        const pad   = 14;

        // Right-side cluster origin
        const rX = cw - bSize - pad;
        const bY = ch - bSize - pad;

        this._lastW = cw;
        this._lastH = ch;

        // Preserve pressed states across resize
        const prevPressed = new Map();
        for (const btn of this.buttons) {
            prevPressed.set(btn.id, btn.pressed);
        }

        this.buttons = [
            // ── Right cluster ────────────────────────────────
            {
                id: "interact",
                label: "E",   icon: "E",
                x: rX,        y: bY - bSize * 2.5,
                w: bSize,     h: bSize,
                color:       "rgba(80,120,200,0.45)",
                activeColor: "rgba(100,150,255,0.88)",
                pressed: prevPressed.get("interact") || false,
                holdable: false,
                action: () => this._pressKey("KeyE", 120),
            },
            {
                id: "attack",
                label: "ATK", icon: "✕",
                x: rX - bSize * 1.35, y: bY - bSize * 1.3,
                w: bSize,     h: bSize,
                color:       "rgba(200,80,80,0.45)",
                activeColor: "rgba(255,100,100,0.88)",
                pressed: prevPressed.get("attack") || false,
                holdable: true,   // fires repeatedly while held
                _holdTimer: 0,
                action: () => this._pressKey("KeyQ", 120),
            },
            {
                id: "dodge",
                label: "DODGE", icon: "○",
                x: rX,        y: bY - bSize * 1.3,
                w: bSize,     h: bSize,
                color:       "rgba(200,200,80,0.45)",
                activeColor: "rgba(255,255,100,0.88)",
                pressed: prevPressed.get("dodge") || false,
                holdable: false,
                action: () => this._pressKey("ShiftLeft", 180),
            },
            {
                id: "flashlight",
                label: "F",   icon: "F",
                x: rX - bSize * 1.35, y: bY - bSize * 2.5,
                w: bSize,     h: bSize,
                color:       "rgba(200,180,60,0.45)",
                activeColor: "rgba(255,220,100,0.88)",
                pressed: prevPressed.get("flashlight") || false,
                holdable: false,
                action: () => this._pressKey("KeyF", 120),
            },

            // ── Left cluster (top-left area, above joystick zone) ──
            {
                id: "journal",
                label: "J",   icon: "J",
                x: pad,       y: bY - bSize * 1.1,
                w: bSize * 0.85, h: bSize * 0.85,
                color:       "rgba(150,120,80,0.45)",
                activeColor: "rgba(200,160,100,0.88)",
                pressed: prevPressed.get("journal") || false,
                holdable: false,
                action: () => this._pressKey("KeyJ", 120),
            },
            {
                id: "unstuck",
                label: "U",   icon: "U",
                x: pad + bSize, y: bY - bSize * 1.1,
                w: bSize * 0.75, h: bSize * 0.75,
                color:       "rgba(100,100,100,0.35)",
                activeColor: "rgba(160,160,160,0.75)",
                pressed: prevPressed.get("unstuck") || false,
                holdable: false,
                action: () => this._pressKey("KeyU", 120),
            },
            {
                id: "battery",
                label: "R",   icon: "R",
                x: pad + bSize * 1.9, y: bY - bSize * 1.1,
                w: bSize * 0.75,      h: bSize * 0.75,
                color:       "rgba(80,150,80,0.35)",
                activeColor: "rgba(100,200,100,0.75)",
                pressed: prevPressed.get("battery") || false,
                holdable: false,
                action: () => this._pressKey("KeyR", 120),
            },

            // ── Pause / Menu ─────────────────────────────────
            {
                id: "pause",
                label: "||",  icon: "||",
                x: cw / 2 - bSize * 0.4, y: pad,
                w: bSize * 0.8,           h: bSize * 0.65,
                color:       "rgba(60,60,80,0.5)",
                activeColor: "rgba(100,100,150,0.85)",
                pressed: prevPressed.get("pause") || false,
                holdable: false,
                action: () => this._pressKey("Escape", 120),
            },
        ];
    },


    // ─── KEY PRESS / HOLD HELPER ─────────────────────────────────
    _pressKey(code, durationMs) {
        if (typeof keys === "undefined") return;

        // Set keysJustPressed safely
        if (typeof keysJustPressed !== "undefined") {
            keysJustPressed[code] = true;
            // Clear it next frame so it doesn't stay "just pressed" forever
            requestAnimationFrame(() => {
                if (typeof keysJustPressed !== "undefined") {
                    keysJustPressed[code] = false;
                }
            });
        }

        keys[code] = true;
        this._heldKeys.add(code);

        // Clear after duration
        setTimeout(() => {
            if (typeof keys !== "undefined") {
                keys[code] = false;
                this._heldKeys.delete(code);
            }
        }, durationMs || 120);
    },

    // Hold a key down continuously (for attack button held)
    _holdKey(code) {
        if (typeof keys === "undefined") return;
        keys[code] = true;
        this._heldKeys.add(code);
    },

    // Release a specific key
    _releaseKey(code) {
        if (typeof keys !== "undefined") {
            keys[code] = false;
        }
        this._heldKeys.delete(code);
    },

    // Emergency — release every key mobile is holding
    _releaseAllKeys() {
        for (const code of this._heldKeys) {
            if (typeof keys !== "undefined") keys[code] = false;
        }
        this._heldKeys.clear();
    },


    // ─── TOUCH START ─────────────────────────────────────────────
    _onTouchStart(e) {
        e.preventDefault();

        // Resume audio on first touch
        if (typeof initAudio === "function") {
            try { initAudio(); } catch (_) {}
        }
        if (window.AudioEngine && typeof window.AudioEngine.resume === "function") {
            try { window.AudioEngine.resume(); } catch (_) {}
        }

        const gs = (typeof gameState !== "undefined") ? gameState : "menu";

        for (const touch of e.changedTouches) {
            const tx = touch.clientX;
            const ty = touch.clientY;
            const id = touch.identifier;

            // ── Menu / Ending state ───────────────────────
            if (gs === "menu") {
                if (typeof startNewGame === "function") {
                    try { startNewGame(); } catch (_) {}
                }
                return;
            }
            if (gs === "ending") {
                if (typeof gameState !== "undefined") gameState = "menu";
                return;
            }

            // ── Dialog advance / choice ───────────────────
            if (typeof dialogActive !== "undefined" && dialogActive) {
                if (this._handleChoiceTap(tx, ty)) continue;
                if (typeof advanceDialog === "function") {
                    try { advanceDialog(); } catch (_) {}
                }
                continue;
            }

            // ── Button hit test ───────────────────────────
            if (this._hitButton(tx, ty, id)) continue;

            // ── Joystick (left 48% of screen) ────────────
            if (!this.joystick.active && tx < window.innerWidth * 0.48) {
                this.joystick.active  = true;
                this.joystick.touchId = id;
                this.joystick.baseX   = tx;
                this.joystick.baseY   = ty;
                this.joystick.stickX  = tx;
                this.joystick.stickY  = ty;
                this.joystick.x       = 0;
                this.joystick.y       = 0;
            }
        }
    },


    // ─── TOUCH MOVE ──────────────────────────────────────────────
    _onTouchMove(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const id = touch.identifier;

            // ── Joystick move ─────────────────────────────
            if (this.joystick.active && id === this.joystick.touchId) {
                const dx   = touch.clientX - this.joystick.baseX;
                const dy   = touch.clientY - this.joystick.baseY;
                const dist = Math.hypot(dx, dy);
                const MAX  = this.joystick.MAX;

                // Floating base — reposition base if dragged very far
                // Makes the joystick feel natural, not anchored
                if (dist > this.joystick.FLOAT_THRESHOLD) {
                    this.joystick.baseX = touch.clientX - (dx / dist) * MAX;
                    this.joystick.baseY = touch.clientY - (dy / dist) * MAX;
                }

                if (dist > MAX) {
                    this.joystick.stickX = this.joystick.baseX + (dx / dist) * MAX;
                    this.joystick.stickY = this.joystick.baseY + (dy / dist) * MAX;
                    this.joystick.x      = dx / dist;
                    this.joystick.y      = dy / dist;
                } else {
                    this.joystick.stickX = touch.clientX;
                    this.joystick.stickY = touch.clientY;
                    this.joystick.x      = dist > 2 ? dx / MAX : 0;
                    this.joystick.y      = dist > 2 ? dy / MAX : 0;
                }
            }
        }
    },


    // ─── TOUCH END ───────────────────────────────────────────────
    _onTouchEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const id = touch.identifier;

            // ── Joystick release ──────────────────────────
            if (this.joystick.active && id === this.joystick.touchId) {
                this.joystick.active  = false;
                this.joystick.touchId = null;
                this.joystick.x       = 0;
                this.joystick.y       = 0;

                // Immediately release all movement keys
                if (typeof keys !== "undefined") {
                    keys["KeyW"] = false;
                    keys["KeyA"] = false;
                    keys["KeyS"] = false;
                    keys["KeyD"] = false;
                }
            }

            // ── Button release (per touch ID) ─────────────
            for (const [btnId, btnTouchId] of this._btnTouches.entries()) {
                if (btnTouchId === id) {
                    this._btnTouches.delete(btnId);
                    const btn = this.buttons.find(b => b.id === btnId);
                    if (btn) {
                        btn.pressed = false;
                        // If it was a holdable button, release its key
                        if (btn.holdable) {
                            // Attack key
                            if (btn.id === "attack") this._releaseKey("KeyQ");
                        }
                    }
                }
            }
        }
    },


    // ─── TOUCH CANCEL ────────────────────────────────────────────
    // Same as touchend but also do a full safety release
    _onTouchCancel(e) {
        this._onTouchEnd(e);
        // Safety — if something went wrong, release everything
        this._releaseAllKeys();
        this.joystick.active  = false;
        this.joystick.touchId = null;
        this.joystick.x       = 0;
        this.joystick.y       = 0;
        for (const btn of this.buttons) btn.pressed = false;
        this._btnTouches.clear();
    },


    // ─── HIT TESTING — per touch ID for multitouch ───────────────
    _hitButton(tx, ty, touchId) {
        for (const btn of this.buttons) {
            const cx = btn.x + btn.w / 2;
            const cy = btn.y + btn.h / 2;
            const r  = btn.w / 2 + 6;  // slightly generous hit area

            if (Math.hypot(tx - cx, ty - cy) <= r) {
                // Don't double-register same button
                if (this._btnTouches.has(btn.id)) return true;

                btn.pressed = true;
                this._btnTouches.set(btn.id, touchId);

                // Fire haptic if available
                this._vibrate(30);

                try { btn.action(); } catch (_) {}
                return true;
            }
        }
        return false;
    },


    // ─── DIALOG CHOICE TAP ───────────────────────────────────────
    // Taps on the DOM dialog box element — check if choices are visible
    _handleChoiceTap(tx, ty) {
        if (typeof dialogActive === "undefined" || !dialogActive)   return false;
        if (typeof currentDialog === "undefined" || !currentDialog) return false;
        if (!Array.isArray(currentDialog.choices))                  return false;
        if (currentDialog._typeInterval)                            return false; // still typing

        // Try to hit-test against the real DOM choice elements first
        // This is more accurate than calculating positions manually
        const choiceDivs = document.querySelectorAll("#dialogChoices div");
        if (choiceDivs.length > 0) {
            for (let i = 0; i < choiceDivs.length; i++) {
                const rect = choiceDivs[i].getBoundingClientRect();
                if (tx >= rect.left && tx <= rect.right && ty >= rect.top && ty <= rect.bottom) {
                    choiceDivs[i].click();
                    return true;
                }
            }
            return false;
        }

        // Fallback: canvas-drawn choices (if DOM dialog not present)
        const choices = currentDialog.choices;
        const bw      = Math.min(300, window.innerWidth * 0.7);
        const bx      = window.innerWidth  / 2 - bw / 2;
        const startY  = window.innerHeight / 2 - choices.length * 35;

        for (let i = 0; i < choices.length; i++) {
            const cy = startY + i * 70;
            if (tx >= bx && tx <= bx + bw && ty >= cy && ty <= cy + 55) {
                if (typeof dialogActive !== "undefined") dialogActive = false;
                if (typeof dialogQueue  !== "undefined") dialogQueue  = [];
                const dbox = document.getElementById("dialogBox");
                if (dbox) dbox.classList.add("hidden");
                try {
                    if (typeof choices[i].action === "function") choices[i].action();
                } catch (_) {}
                return true;
            }
        }

        return false;
    },


    // ─── HAPTIC FEEDBACK ─────────────────────────────────────────
    _vibrate(ms) {
        try {
            if (navigator.vibrate) navigator.vibrate(ms);
        } catch (_) {}
    },


    // ─── RESIZE CHECK ────────────────────────────────────────────
    _checkResize() {
        if (window.innerWidth  !== this._lastW ||
            window.innerHeight !== this._lastH) {
            this._setupButtons();
        }
    },


    // ─── PER-FRAME UPDATE ────────────────────────────────────────
    // Called by hooked render — maps joystick to WASD
    update() {
        if (!this.active) return;

        // Throttled resize check (every 90 frames ≈ 1.5s)
        this._resizeTick++;
        if (this._resizeTick >= 90) {
            this._resizeTick = 0;
            this._checkResize();
        }

        // Map joystick axes → WASD keys
        if (typeof keys === "undefined") return;

        const T = 0.18;  // deadzone threshold

        if (this.joystick.active) {
            keys["KeyA"] = this.joystick.x < -T;
            keys["KeyD"] = this.joystick.x >  T;
            keys["KeyW"] = this.joystick.y < -T;
            keys["KeyS"] = this.joystick.y >  T;
        } else {
            // Joystick released — ensure keys are cleared
            // (safety in case _onTouchEnd missed it)
            keys["KeyW"] = false;
            keys["KeyA"] = false;
            keys["KeyS"] = false;
            keys["KeyD"] = false;
        }

        // Holdable buttons — fire continuously while held
        for (const btn of this.buttons) {
            if (btn.holdable && btn.pressed) {
                btn._holdTimer = (btn._holdTimer || 0) + 1;
                // Fire every 8 frames while held (≈ 7.5 times/sec at 60fps)
                if (btn._holdTimer % 8 === 0) {
                    try { btn.action(); } catch (_) {}
                }
            } else {
                btn._holdTimer = 0;
            }
        }
    },


    // ─── DRAW ───────────────────────────────────────────────────
    draw(ctx) {
        if (!this.active || !ctx) return;

        const gs = (typeof gameState !== "undefined") ? gameState : "menu";

        // Don't draw during menu or ending — nothing to control
        if (gs === "menu" || gs === "ending") return;

        ctx.save();

        // ── Joystick ─────────────────────────────────────────────
        if (this.joystick.active) {
            const bx = this.joystick.baseX;
            const by = this.joystick.baseY;
            const sx = this.joystick.stickX;
            const sy = this.joystick.stickY;

            // Base ring
            ctx.globalAlpha = 1;
            ctx.fillStyle   = "rgba(255,255,255,0.07)";
            ctx.beginPath();
            ctx.arc(bx, by, this.joystick.MAX, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth   = 1.5;
            ctx.stroke();

            // Line from base to stick
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Stick knob
            ctx.fillStyle   = "rgba(255,255,255,0.30)";
            ctx.beginPath();
            ctx.arc(sx, sy, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth   = 2;
            ctx.stroke();

        } else {
            // Passive hint — bottom left area, above the left buttons
            const hintX = window.innerWidth  * 0.13;
            const hintY = window.innerHeight * 0.60;
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.beginPath();
            ctx.arc(hintX, hintY, 44, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.10)";
            ctx.lineWidth   = 1;
            ctx.stroke();
            ctx.fillStyle    = "rgba(255,255,255,0.18)";
            ctx.font         = "11px 'Courier New', monospace";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("MOVE", hintX, hintY);
        }

        // ── Buttons ───────────────────────────────────────────────
        for (const btn of this.buttons) {
            this._drawButton(ctx, btn);
        }

        // ── Dialog choice overlay (canvas fallback) ───────────────
        // Only draws if DOM dialog is NOT showing choices
        // (avoids double-rendering choices)
        const domChoices = document.querySelectorAll("#dialogChoices div");
        const useCanvasChoices = domChoices.length === 0;

        if (useCanvasChoices &&
            typeof dialogActive   !== "undefined" && dialogActive &&
            typeof currentDialog  !== "undefined" && currentDialog &&
            Array.isArray(currentDialog.choices)  &&
            !currentDialog._typeInterval) {

            this._drawChoices(ctx, currentDialog.choices);
        }

        ctx.restore();
    },


    // ─── DRAW A SINGLE BUTTON ────────────────────────────────────
    _drawButton(ctx, btn) {
        const cx = btn.x + btn.w / 2;
        const cy = btn.y + btn.h / 2;
        const r  = btn.w / 2;

        ctx.save();

        // Shadow glow when pressed
        if (btn.pressed) {
            ctx.shadowColor = btn.activeColor;
            ctx.shadowBlur  = 16;
        }

        // Fill
        ctx.fillStyle = btn.pressed ? btn.activeColor : btn.color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = btn.pressed
            ? "rgba(255,255,255,0.65)"
            : "rgba(255,255,255,0.22)";
        ctx.lineWidth   = btn.pressed ? 2 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Icon text (safe fallback — no emoji)
        ctx.fillStyle    = btn.pressed
            ? "rgba(255,255,255,1.0)"
            : "rgba(255,255,255,0.80)";
        ctx.font         = `bold ${Math.floor(btn.w * 0.36)}px 'Courier New', monospace`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.icon, cx, cy + 1);

        // Label below
        ctx.fillStyle    = "rgba(255,255,255,0.30)";
        ctx.font         = "9px 'Courier New', monospace";
        ctx.textBaseline = "top";
        ctx.fillText(btn.label, cx, btn.y + btn.h + 3);

        ctx.restore();
    },


    // ─── DRAW CANVAS CHOICE OVERLAY ──────────────────────────────
    _drawChoices(ctx, choices) {
        const bw     = Math.min(320, window.innerWidth * 0.75);
        const bh     = 52;
        const gap    = 10;
        const totalH = choices.length * (bh + gap) - gap;
        const bx     = window.innerWidth  / 2 - bw / 2;
        const startY = window.innerHeight / 2 - totalH / 2;

        ctx.save();
        for (let i = 0; i < choices.length; i++) {
            const cy = startY + i * (bh + gap);

            // Background
            ctx.fillStyle   = "rgba(15,15,45,0.90)";
            ctx.strokeStyle = "rgba(100,100,200,0.55)";
            ctx.lineWidth   = 1;
            this._roundRect(ctx, bx, cy, bw, bh, 8);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle    = "#cccccc";
            ctx.font         = "14px Georgia, serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                `${i + 1}. ${choices[i].text}`,
                window.innerWidth / 2,
                cy + bh / 2,
            );
        }
        ctx.restore();
    },

    // Rounded rect helper (ctx.roundRect not available in all browsers)
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },


    // ─── HOOK INTO GAME LOOP ─────────────────────────────────────
    // Waits for window.render to be defined (set by game.js)
    // then wraps it once — no polling setTimeouts
    _hookGameLoop() {
        if (this._hooked) return;

        const self = this;

        function tryPatch() {
            if (typeof window.render !== "function") {
                requestAnimationFrame(tryPatch);
                return;
            }

            const origRender = window.render;

            window.render = function() {
                // Run the real render first
                try {
                    origRender.apply(this, arguments);
                } catch(err) {
                    console.error("[Mobile] render error:", err);
                }

                // Then update + draw mobile controls on top
                // These run even if origRender threw — important for releasing keys
                const c  = self._canvas();
                const cx = c ? c.getContext("2d") : null;

                try { self.update(); } catch(err) {
                    console.error("[Mobile] update error:", err);
                }

                if (cx) {
                    try { self.draw(cx); } catch(err) {
                        console.error("[Mobile] draw error:", err);
                    }
                }
            };

            self._hooked = true;
            console.log("[Mobile] Game loop hooked ✓");
        }

        requestAnimationFrame(tryPatch);
    },
};


// ─── AUTO-INIT ────────────────────────────────────────────────────
function _initMobile() {
    try { Mobile.init(); } catch(err) {
        console.error("[Mobile] Init failed:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initMobile, { once: true });
} else {
    _initMobile();
}