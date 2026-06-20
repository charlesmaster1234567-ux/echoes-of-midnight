// ═════════════════════════════════════════════════════════════════
//  ECHOES OF MIDNIGHT — mobile.js v3.0 "Phantom Touch"
//  Phone-only touch controls. Auto-disabled on non-phones.
//  This file only LOADS if the phone detector in index.html
//  confirms a real mobile phone. Zero cost on PC/tablet.
//
//  Features:
//  — Floating virtual joystick (repositions naturally)
//  — Multitouch action buttons (E, Q, Shift, F, J, R, U)
//  — Intro/menu/ending touch handling
//  — Dialog advance + choice tap
//  — Per-button haptic feedback
//  — Holdable attack button
//  — Adaptive layout (portrait + landscape)
//  — Safe game loop hook (waits for render, patches once)
//  — Full error isolation — never crashes the game
// ═════════════════════════════════════════════════════════════════
"use strict";

// ═════════════════════════════════════════════════════════════════
//  GUARD — Should never run on non-phones (detector prevents load)
//  but double-check here as a safety net.
// ═════════════════════════════════════════════════════════════════
(function() {
    const det = window._mobileDetection;
    if (det && !det.isPhone) {
        console.warn("[Mobile] mobile.js loaded on non-phone — aborting init.");
        // Expose a dead stub so nothing crashes if Mobile is referenced
        window.Mobile = { active: false, update: function(){}, draw: function(){} };
        return;
    }
    // Detection passed — proceed with full init below
})();

// ═════════════════════════════════════════════════════════════════
//  MOBILE CONTROLLER
// ═════════════════════════════════════════════════════════════════
const Mobile = (function() {
    "use strict";

    // ── Private state ────────────────────────────────────────────
    let _active   = false;
    let _hooked   = false;
    let _hookRaf  = null;

    // ── Layout cache (rebuilt on resize) ─────────────────────────
    let _cw = window.innerWidth;
    let _ch = window.innerHeight;
    let _resizeTick = 0;
    let _lastW = 0;
    let _lastH = 0;

    // ── Joystick state ────────────────────────────────────────────
    const _joy = {
        active:  false,
        touchId: null,
        baseX:   0,  baseY:   0,
        stickX:  0,  stickY:  0,
        x:       0,  y:       0,
        MAX:     58,           // cage radius px
        FLOAT:   85,           // rebase threshold px
    };

    // ── Button definitions (rebuilt on resize) ────────────────────
    let _buttons = [];

    // ── Per-button touch tracking (multitouch safe) ───────────────
    // Map<buttonId, touchIdentifier>
    const _btnTouches = new Map();

    // ── Keys currently held by mobile ────────────────────────────
    const _heldKeys = new Set();

    // ─────────────────────────────────────────────────────────────
    //  LAYOUT — builds button positions from current screen size
    // ─────────────────────────────────────────────────────────────
    function _buildLayout() {
        _cw = window.innerWidth;
        _ch = window.innerHeight;
        _lastW = _cw;
        _lastH = _ch;

        // Base button size — scales with screen, clamped
        const bSize = Math.max(52, Math.min(70, _cw * 0.14));
        const pad   = 16;

        // Right cluster origin (bottom-right)
        const rX = _cw - bSize - pad;
        const bY = _ch - bSize - pad;

        // Preserve pressed state across resize
        const prevPressed = new Map();
        for (const btn of _buttons) prevPressed.set(btn.id, btn.pressed);

        _buttons = [

            // ── PRIMARY ACTION — Interact [E] ─────────────────
            {
                id:          "interact",
                icon:        "E",
                label:       "USE",
                x:           rX,
                y:           bY - bSize * 2.6,
                w:           bSize,
                h:           bSize,
                color:       "rgba(70,110,180,0.45)",
                activeColor: "rgba(100,150,255,0.90)",
                pressed:     prevPressed.get("interact") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("KeyE", 130); },
            },

            // ── ATTACK [Q] ────────────────────────────────────
            {
                id:          "attack",
                icon:        "Q",
                label:       "ATK",
                x:           rX - bSize * 1.4,
                y:           bY - bSize * 1.35,
                w:           bSize,
                h:           bSize,
                color:       "rgba(180,60,60,0.45)",
                activeColor: "rgba(255,90,90,0.90)",
                pressed:     prevPressed.get("attack") || false,
                holdable:    true,
                _holdTimer:  0,
                action() { _tapKey("KeyQ", 130); },
            },

            // ── DODGE [Shift] ─────────────────────────────────
            {
                id:          "dodge",
                icon:        "⇧",
                label:       "DODGE",
                x:           rX,
                y:           bY - bSize * 1.35,
                w:           bSize,
                h:           bSize,
                color:       "rgba(180,160,50,0.45)",
                activeColor: "rgba(255,220,80,0.90)",
                pressed:     prevPressed.get("dodge") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("ShiftLeft", 200); },
            },

            // ── FLASHLIGHT [F] ────────────────────────────────
            {
                id:          "flashlight",
                icon:        "F",
                label:       "FLASH",
                x:           rX - bSize * 1.4,
                y:           bY - bSize * 2.6,
                w:           bSize,
                h:           bSize,
                color:       "rgba(180,150,40,0.45)",
                activeColor: "rgba(255,210,80,0.90)",
                pressed:     prevPressed.get("flashlight") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("KeyF", 130); },
            },

            // ── JOURNAL [J] — left side ───────────────────────
            {
                id:          "journal",
                icon:        "J",
                label:       "LOG",
                x:           pad,
                y:           bY - bSize * 1.15,
                w:           bSize * 0.82,
                h:           bSize * 0.82,
                color:       "rgba(140,110,60,0.45)",
                activeColor: "rgba(200,160,90,0.90)",
                pressed:     prevPressed.get("journal") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("KeyJ", 130); },
            },

            // ── UNSTUCK [U] — left side ───────────────────────
            {
                id:          "unstuck",
                icon:        "U",
                label:       "FREE",
                x:           pad + bSize * 0.95,
                y:           bY - bSize * 1.15,
                w:           bSize * 0.72,
                h:           bSize * 0.72,
                color:       "rgba(90,90,90,0.35)",
                activeColor: "rgba(150,150,150,0.80)",
                pressed:     prevPressed.get("unstuck") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("KeyU", 130); },
            },

            // ── BATTERY / USE [R] — left side ────────────────
            {
                id:          "battery",
                icon:        "R",
                label:       "USE",
                x:           pad + bSize * 1.8,
                y:           bY - bSize * 1.15,
                w:           bSize * 0.72,
                h:           bSize * 0.72,
                color:       "rgba(60,130,60,0.35)",
                activeColor: "rgba(90,200,90,0.80)",
                pressed:     prevPressed.get("battery") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("KeyR", 130); },
            },

            // ── PAUSE / ESC — top center ──────────────────────
            {
                id:          "pause",
                icon:        "||",
                label:       "MENU",
                x:           _cw / 2 - bSize * 0.38,
                y:           pad,
                w:           bSize * 0.76,
                h:           bSize * 0.60,
                color:       "rgba(50,50,70,0.50)",
                activeColor: "rgba(90,90,140,0.88)",
                pressed:     prevPressed.get("pause") || false,
                holdable:    false,
                _holdTimer:  0,
                action() { _tapKey("Escape", 130); },
            },
        ];
    }

    // ─────────────────────────────────────────────────────────────
    //  KEY HELPERS
    // ─────────────────────────────────────────────────────────────

    // Tap a key — fires keysJustPressed for one frame, holds keys
    // for durationMs then releases automatically
    function _tapKey(code, durationMs) {
        try {
            if (typeof keys !== "undefined") {
                keys[code] = true;
                _heldKeys.add(code);
            }
            if (typeof keysJustPressed !== "undefined") {
                keysJustPressed[code] = true;
                // Clear justPressed next animation frame
                // so it behaves identically to a real keydown
                requestAnimationFrame(function() {
                    try {
                        if (typeof keysJustPressed !== "undefined") {
                            keysJustPressed[code] = false;
                        }
                    } catch(_) {}
                });
            }
            setTimeout(function() {
                try {
                    if (typeof keys !== "undefined") keys[code] = false;
                    _heldKeys.delete(code);
                } catch(_) {}
            }, durationMs || 130);
        } catch(_) {}
    }

    // Hold a key continuously (attack button held)
    function _holdKey(code) {
        try {
            if (typeof keys !== "undefined") {
                keys[code] = true;
                _heldKeys.add(code);
            }
        } catch(_) {}
    }

    // Release a specific key
    function _releaseKey(code) {
        try {
            if (typeof keys !== "undefined") keys[code] = false;
            _heldKeys.delete(code);
        } catch(_) {}
    }

    // Emergency: release every key mobile is holding
    function _releaseAll() {
        try {
            for (const code of _heldKeys) {
                if (typeof keys !== "undefined") keys[code] = false;
            }
            _heldKeys.clear();
        } catch(_) {}
    }

    // ─────────────────────────────────────────────────────────────
    //  HIT TEST — circular, generous radius
    // ─────────────────────────────────────────────────────────────
    function _hitButton(tx, ty, touchId) {
        for (const btn of _buttons) {
            const cx = btn.x + btn.w / 2;
            const cy = btn.y + btn.h / 2;
            // Generous hit radius: half of smallest dimension + 8px
            const r  = Math.min(btn.w, btn.h) / 2 + 8;
            if (Math.hypot(tx - cx, ty - cy) <= r) {
                // Don't double-register the same button
                if (_btnTouches.has(btn.id)) return true;
                btn.pressed = true;
                _btnTouches.set(btn.id, touchId);
                _vibrate(28);
                try { btn.action(); } catch(_) {}
                return true;
            }
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────
    //  DIALOG CHOICE TAP
    // ─────────────────────────────────────────────────────────────
    function _handleChoiceTap(tx, ty) {
        try {
            if (typeof dialogActive === "undefined" || !dialogActive)    return false;
            if (typeof currentDialog === "undefined" || !currentDialog)  return false;
            if (!Array.isArray(currentDialog.choices))                   return false;
            if (currentDialog._typeInterval)                             return false;

            // Try real DOM elements first (most accurate)
            const divs = document.querySelectorAll("#dialogChoices div");
            if (divs.length > 0) {
                for (let i = 0; i < divs.length; i++) {
                    const r = divs[i].getBoundingClientRect();
                    if (tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom) {
                        divs[i].click();
                        return true;
                    }
                }
                return false;
            }

            // Canvas-drawn fallback
            const choices = currentDialog.choices;
            const bw      = Math.min(320, _cw * 0.75);
            const bh      = 52;
            const gap     = 10;
            const startY  = _ch / 2 - (choices.length * (bh + gap)) / 2;
            const bx      = _cw / 2 - bw / 2;

            for (let i = 0; i < choices.length; i++) {
                const cy = startY + i * (bh + gap);
                if (tx >= bx && tx <= bx + bw && ty >= cy && ty <= cy + bh) {
                    try {
                        if (typeof dialogActive    !== "undefined") dialogActive = false;
                        if (typeof dialogQueue     !== "undefined") dialogQueue  = [];
                        const box = document.getElementById("dialogBox");
                        if (box) box.classList.add("hidden");
                        if (typeof choices[i].action === "function") choices[i].action();
                    } catch(_) {}
                    return true;
                }
            }
        } catch(_) {}
        return false;
    }

    // ─────────────────────────────────────────────────────────────
    //  HAPTIC FEEDBACK
    // ─────────────────────────────────────────────────────────────
    function _vibrate(ms) {
        try { if (navigator.vibrate) navigator.vibrate(ms); } catch(_) {}
    }

    // ─────────────────────────────────────────────────────────────
    //  AUDIO UNLOCK
    // ─────────────────────────────────────────────────────────────
    function _unlockAudio() {
        try { if (typeof initAudio === "function") initAudio(); } catch(_) {}
        try {
            if (window.AudioEngine && typeof window.AudioEngine.resume === "function") {
                window.AudioEngine.resume();
            }
        } catch(_) {}
    }

    // ─────────────────────────────────────────────────────────────
    //  TOUCH EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────
    function _onTouchStart(e) {
        // If continue modal is open, let it handle its own buttons
        if (document.getElementById("eom-continue-modal")) {
            return; // do NOT preventDefault — allow native button clicks
        }
        e.preventDefault();
        _unlockAudio();

        const gs = _getState();

        for (const touch of e.changedTouches) {
            const tx = touch.clientX;
            const ty = touch.clientY;
            const id = touch.identifier;

            // ── Intro state ──────────────────────────────────
            if (gs === "intro") {
                // Advance intro dialogue on any tap
                try {
                    if (typeof _advanceIntroDialogue === "function") {
                        _advanceIntroDialogue();
                    }
                } catch(_) {}
                continue;
            }

            // ── Menu state ───────────────────────────────────
            if (gs === "menu") {
                // If continue modal is already open, let it handle taps natively
                if (document.getElementById("eom-continue-modal")) {
                    return;
                }
                try {
                    if (typeof startNewGame === "function") startNewGame();
                } catch(_) {}
                return;
            }

            // ── Ending state ─────────────────────────────────
            if (gs === "ending") {
                try {
                    if (typeof gameState !== "undefined") gameState = "menu";
                } catch(_) {}
                return;
            }

            // ── Playing state ────────────────────────────────

            // Dialog active — advance or tap choice
            if (typeof dialogActive !== "undefined" && dialogActive) {
                if (_handleChoiceTap(tx, ty)) continue;
                try {
                    if (typeof advanceDialog === "function") advanceDialog();
                } catch(_) {}
                continue;
            }

            // Button hit test (right side + left buttons)
            if (_hitButton(tx, ty, id)) continue;

            // Joystick zone — left 48% of screen width
            if (!_joy.active && tx < _cw * 0.48) {
                _joy.active  = true;
                _joy.touchId = id;
                _joy.baseX   = tx;
                _joy.baseY   = ty;
                _joy.stickX  = tx;
                _joy.stickY  = ty;
                _joy.x       = 0;
                _joy.y       = 0;
            }
        }
    }

    function _onTouchMove(e) {
        if (document.getElementById("eom-continue-modal")) return;
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (!_joy.active || touch.identifier !== _joy.touchId) continue;

            const dx   = touch.clientX - _joy.baseX;
            const dy   = touch.clientY - _joy.baseY;
            const dist = Math.hypot(dx, dy);

            // Floating base — reposition when dragged beyond FLOAT threshold
            // Makes the joystick feel natural on any thumb position
            if (dist > _joy.FLOAT) {
                _joy.baseX = touch.clientX - (dx / dist) * _joy.MAX;
                _joy.baseY = touch.clientY - (dy / dist) * _joy.MAX;
            }

            if (dist > _joy.MAX) {
                _joy.stickX = _joy.baseX + (dx / dist) * _joy.MAX;
                _joy.stickY = _joy.baseY + (dy / dist) * _joy.MAX;
                _joy.x      = dx / dist;
                _joy.y      = dy / dist;
            } else {
                _joy.stickX = touch.clientX;
                _joy.stickY = touch.clientY;
                _joy.x      = dist > 3 ? dx / _joy.MAX : 0;
                _joy.y      = dist > 3 ? dy / _joy.MAX : 0;
            }
        }
    }

    function _onTouchEnd(e) {
        if (document.getElementById("eom-continue-modal")) return;
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const id = touch.identifier;

            // Release joystick
            if (_joy.active && id === _joy.touchId) {
                _joy.active  = false;
                _joy.touchId = null;
                _joy.x       = 0;
                _joy.y       = 0;
                // Immediately clear movement keys
                try {
                    if (typeof keys !== "undefined") {
                        keys["KeyW"] = false;
                        keys["KeyA"] = false;
                        keys["KeyS"] = false;
                        keys["KeyD"] = false;
                    }
                } catch(_) {}
            }

            // Release buttons
            for (const [btnId, btnTouchId] of _btnTouches.entries()) {
                if (btnTouchId !== id) continue;
                _btnTouches.delete(btnId);
                const btn = _buttons.find(b => b.id === btnId);
                if (!btn) continue;
                btn.pressed = false;
                btn._holdTimer = 0;
                // Release holdable keys
                if (btn.holdable) {
                    if (btn.id === "attack") _releaseKey("KeyQ");
                }
            }
        }
    }

    function _onTouchCancel(e) {
        // Treat as touchend then do full safety reset
        _onTouchEnd(e);
        _releaseAll();
        _joy.active  = false;
        _joy.touchId = null;
        _joy.x       = 0;
        _joy.y       = 0;
        for (const btn of _buttons) { btn.pressed = false; btn._holdTimer = 0; }
        _btnTouches.clear();
    }

    // ─────────────────────────────────────────────────────────────
    //  UPDATE — called every frame by hooked render
    // ─────────────────────────────────────────────────────────────
    function _update() {
        if (!_active) return;

        // Throttled resize check — every 90 frames
        _resizeTick++;
        if (_resizeTick >= 90) {
            _resizeTick = 0;
            if (window.innerWidth !== _lastW || window.innerHeight !== _lastH) {
                _buildLayout();
            }
        }

        try {
            if (typeof keys === "undefined") return;

            // Map joystick to WASD
            const T = 0.18; // deadzone
            if (_joy.active) {
                keys["KeyA"] = _joy.x < -T;
                keys["KeyD"] = _joy.x >  T;
                keys["KeyW"] = _joy.y < -T;
                keys["KeyS"] = _joy.y >  T;
            } else {
                keys["KeyW"] = false;
                keys["KeyA"] = false;
                keys["KeyS"] = false;
                keys["KeyD"] = false;
            }

            // Holdable buttons — fire repeatedly while held
            for (const btn of _buttons) {
                if (!btn.holdable || !btn.pressed) {
                    btn._holdTimer = 0;
                    continue;
                }
                btn._holdTimer++;
                // Fire every 8 frames while held ≈ 7.5×/sec at 60fps
                if (btn._holdTimer % 8 === 0) {
                    try { btn.action(); } catch(_) {}
                }
            }
        } catch(_) {}
    }

    // ─────────────────────────────────────────────────────────────
    //  DRAW — renders joystick + buttons on top of game canvas
    // ─────────────────────────────────────────────────────────────
    function _draw(ctx) {
        if (!_active || !ctx) return;

        const gs = _getState();

        // Don't draw controls during menu/intro/ending
        if (gs === "menu" || gs === "ending" || gs === "intro") return;

        ctx.save();

        // ── Joystick ─────────────────────────────────────────
        if (_joy.active) {
            const bx = _joy.baseX;
            const by = _joy.baseY;
            const sx = _joy.stickX;
            const sy = _joy.stickY;

            // Outer cage ring
            ctx.globalAlpha = 1;
            ctx.fillStyle   = "rgba(255,255,255,0.06)";
            ctx.beginPath();
            ctx.arc(bx, by, _joy.MAX, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.18)";
            ctx.lineWidth   = 1.5;
            ctx.stroke();

            // Guide line base → stick
            ctx.strokeStyle = "rgba(255,255,255,0.10)";
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Centre dot on base
            ctx.fillStyle   = "rgba(255,255,255,0.12)";
            ctx.beginPath();
            ctx.arc(bx, by, 6, 0, Math.PI * 2);
            ctx.fill();

            // Stick knob
            ctx.fillStyle   = "rgba(255,255,255,0.28)";
            ctx.beginPath();
            ctx.arc(sx, sy, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth   = 2;
            ctx.stroke();

        } else {
            // Passive hint circle — shows where to place thumb
            const hintX = _cw * 0.14;
            const hintY = _ch * 0.62;
            ctx.fillStyle   = "rgba(255,255,255,0.04)";
            ctx.beginPath();
            ctx.arc(hintX, hintY, 42, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.09)";
            ctx.lineWidth   = 1;
            ctx.stroke();
            ctx.fillStyle    = "rgba(255,255,255,0.15)";
            ctx.font         = "10px 'Courier New', monospace";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("MOVE", hintX, hintY);
        }

        // ── Action Buttons ────────────────────────────────────
        for (const btn of _buttons) {
            _drawButton(ctx, btn);
        }

        // ── Canvas-fallback choice overlay ────────────────────
        // Only if DOM choices div is empty (no DOM choices rendered)
        const domChoices = document.querySelectorAll("#dialogChoices div");
        if (domChoices.length === 0 &&
            typeof dialogActive  !== "undefined" && dialogActive &&
            typeof currentDialog !== "undefined" && currentDialog &&
            Array.isArray(currentDialog.choices) &&
            !currentDialog._typeInterval) {
            _drawChoiceOverlay(ctx, currentDialog.choices);
        }

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    //  DRAW SINGLE BUTTON
    // ─────────────────────────────────────────────────────────────
    function _drawButton(ctx, btn) {
        const cx = btn.x + btn.w / 2;
        const cy = btn.y + btn.h / 2;
        const r  = Math.min(btn.w, btn.h) / 2;

        ctx.save();

        // Glow when pressed
        if (btn.pressed) {
            ctx.shadowColor = btn.activeColor;
            ctx.shadowBlur  = 18;
        }

        // Fill circle
        ctx.globalAlpha = btn.pressed ? 1 : 0.92;
        ctx.fillStyle   = btn.pressed ? btn.activeColor : btn.color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = btn.pressed
            ? "rgba(255,255,255,0.70)"
            : "rgba(255,255,255,0.20)";
        ctx.lineWidth   = btn.pressed ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Icon
        const iconSize  = Math.floor(r * 0.72);
        ctx.fillStyle   = btn.pressed
            ? "rgba(255,255,255,1.0)"
            : "rgba(255,255,255,0.80)";
        ctx.font         = `bold ${iconSize}px 'Courier New', monospace`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.icon, cx, cy + 1);

        // Label below button
        ctx.fillStyle    = "rgba(255,255,255,0.28)";
        ctx.font         = "9px 'Courier New', monospace";
        ctx.textBaseline = "top";
        ctx.textAlign    = "center";
        ctx.fillText(btn.label, cx, btn.y + btn.h + 4);

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    //  DRAW CHOICE OVERLAY (canvas fallback)
    // ─────────────────────────────────────────────────────────────
    function _drawChoiceOverlay(ctx, choices) {
        const bw     = Math.min(340, _cw * 0.78);
        const bh     = 54;
        const gap    = 10;
        const totalH = choices.length * (bh + gap) - gap;
        const bx     = _cw / 2 - bw / 2;
        const startY = _ch / 2 - totalH / 2;

        ctx.save();
        for (let i = 0; i < choices.length; i++) {
            const cy = startY + i * (bh + gap);

            // Background panel
            ctx.fillStyle   = "rgba(12,12,40,0.93)";
            ctx.strokeStyle = "rgba(100,100,200,0.55)";
            ctx.lineWidth   = 1;
            _roundRect(ctx, bx, cy, bw, bh, 8);
            ctx.fill();
            ctx.stroke();

            // Choice text
            ctx.fillStyle    = "#cccccc";
            ctx.font         = "15px Georgia, serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${i + 1}. ${choices[i].text}`, _cw / 2, cy + bh / 2);
        }
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    //  ROUND RECT HELPER (ctx.roundRect not available everywhere)
    // ─────────────────────────────────────────────────────────────
    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x,     y,     x + r, y);
        ctx.closePath();
    }

    // ─────────────────────────────────────────────────────────────
    //  GAME STATE HELPER
    // ─────────────────────────────────────────────────────────────
    function _getState() {
        try { return (typeof gameState !== "undefined") ? gameState : "menu"; }
        catch(_) { return "menu"; }
    }

    // ─────────────────────────────────────────────────────────────
    //  GET CANVAS CONTEXT
    // ─────────────────────────────────────────────────────────────
    function _getCtx() {
        try {
            if (typeof canvas !== "undefined" && canvas) return canvas.getContext("2d");
            const c = document.getElementById("gameCanvas");
            return c ? c.getContext("2d") : null;
        } catch(_) { return null; }
    }

    // ─────────────────────────────────────────────────────────────
    //  HOOK INTO GAME LOOP
    //  Waits for window.render to exist (defined by game.js),
    //  then wraps it once to call _update() + _draw() after.
    //  Uses rAF polling — no setInterval, no timeout chains.
    // ─────────────────────────────────────────────────────────────
    function _hookGameLoop() {
        if (_hooked) return;

        function tryPatch() {
            if (typeof window.render !== "function") {
                _hookRaf = requestAnimationFrame(tryPatch);
                return;
            }

            const origRender = window.render;

            window.render = function() {
                // Run the real game render first
                try { origRender.apply(this, arguments); } catch(err) {
                    console.error("[Mobile] render error:", err);
                }
                // Then overlay mobile controls
                // These always run even if origRender threw
                try { _update(); } catch(err) {
                    console.error("[Mobile] update error:", err);
                }
                const ctx2d = _getCtx();
                if (ctx2d) {
                    try { _draw(ctx2d); } catch(err) {
                        console.error("[Mobile] draw error:", err);
                    }
                }
            };

            _hooked  = true;
            _hookRaf = null;
            console.log("[Mobile] Game loop hooked ✓");
        }

        _hookRaf = requestAnimationFrame(tryPatch);
    }

    // ─────────────────────────────────────────────────────────────
    //  BIND TOUCH EVENTS
    // ─────────────────────────────────────────────────────────────
    function _bindEvents() {
        const opts = { passive: false };
        document.addEventListener("touchstart",  _onTouchStart,  opts);
        document.addEventListener("touchmove",   _onTouchMove,   opts);
        document.addEventListener("touchend",    _onTouchEnd,    opts);
        document.addEventListener("touchcancel", _onTouchCancel, opts);

        // Resize: rebuild layout
        window.addEventListener("resize", function() {
            try { _buildLayout(); } catch(_) {}
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  PUBLIC INIT
    // ─────────────────────────────────────────────────────────────
    function init() {
        if (_active) return;

        // Final safety check — should already be guaranteed by
        // the detector in index.html, but never trust once
        const det = window._mobileDetection;
        if (det && !det.isPhone) {
            console.log("[Mobile] init() called on non-phone — skipping.");
            return;
        }

        _active = true;

        // Lock body scroll / touch
        document.body.style.overflow    = "hidden";
        document.body.style.touchAction = "none";
        document.body.style.userSelect  = "none";

        _buildLayout();
        _bindEvents();
        _hookGameLoop();

        console.log(
            "[Mobile] Touch controls active ✓ | " +
            `Score: ${det ? det.score : "?"} | ` +
            `Screen: ${Math.round(_cw)}×${Math.round(_ch)}`
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  PUBLIC API
    // ─────────────────────────────────────────────────────────────
    return {
        get active() { return _active; },

        init,

        // Exposed for debug overlay in game.js
        debug() {
            return {
                active:    _active,
                hooked:    _hooked,
                joystick:  { x: _joy.x.toFixed(2), y: _joy.y.toFixed(2), active: _joy.active },
                buttons:   _buttons.map(b => ({ id: b.id, pressed: b.pressed })),
                heldKeys:  [..._heldKeys],
                detection: window._mobileDetection || null,
            };
        },

        // Allow external call (e.g. from a settings menu)
        rebuildLayout() {
            try { _buildLayout(); } catch(_) {}
        },
    };

})(); // end IIFE

// ═════════════════════════════════════════════════════════════════
//  AUTO-INIT
//  Runs as soon as mobile.js finishes loading.
//  If DOM isn't ready yet, waits for DOMContentLoaded.
// ═════════════════════════════════════════════════════════════════
(function() {
    function _boot() {
        try { Mobile.init(); } catch(err) {
            console.error("[Mobile] Boot failed:", err);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _boot, { once: true });
    } else {
        _boot();
    }
})();