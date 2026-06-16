// ═════════════════════════════════════════════════════════════════
//  ECHOES OF MIDNIGHT — controls.js v1.1 "Dark Respite"
//  Standalone pause menu: Resume, Restart, Quit to Menu
//  Keyboard + Mouse + Touch — zero interference with game logic
//
//  NON-INTERFERENCE RULES:
//  — Pause button placed AWAY from inventory, HUD bars, minimap
//  — Pause button is semi-transparent and small — not distracting
//  — Pause button ignores taps during dialog, transitions, journal
//  — ESC only opens pause when nothing else is consuming it
//  — Keyboard capture releases keys it doesn't handle
//  — Never blocks game.js input during active gameplay
//  — Never fires during splash, intro, menu, or ending states
//
//  Load AFTER game.js, BEFORE mobile.js
// ═════════════════════════════════════════════════════════════════
"use strict";

const PauseMenu = (function () {

    // ── State ────────────────────────────────────────────────
    let _active          = false;
    let _overlayAlpha    = 0;
    let _confirmRestart  = false;
    let _confirmQuit     = false;
    let _selectedIndex   = 0;
    let _hooked          = false;
    let _frame           = 0;
    let _prevGameState   = null;
    let _pauseButtonRect = null;
    let _pauseBtnVisible = false;

    // ── Menu items ───────────────────────────────────────────
    const ITEMS = [
        { id: "resume",  label: "▸  RESUME"       },
        { id: "restart", label: "▸  RESTART"      },
        { id: "quit",    label: "▸  QUIT TO MENU" },
    ];

    // ── Button hit rects (recalculated per draw) ─────────────
    let _buttonRects = [];

    // ── Safe helper (local, no dependency on game.js) ────────
    function _sf(fn) {
        if (typeof fn !== "function") return;
        try { fn.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (_) {}
    }

    // ═════════════════════════════════════════════════════════
    //  SAFETY CHECKS — prevents interfering with game systems
    // ═════════════════════════════════════════════════════════
    function _isGameplayActive() {
        try { return typeof gameState !== "undefined" && gameState === "playing"; }
        catch (_) { return false; }
    }

    function _isDialogOpen() {
        try { return typeof dialogActive !== "undefined" && dialogActive; }
        catch (_) { return false; }
    }

    function _isJournalOpen() {
        try { return typeof journalOpen !== "undefined" && journalOpen; }
        catch (_) { return false; }
    }

    function _isTransitioning() {
        try { return typeof transitionState !== "undefined" && transitionState !== "none"; }
        catch (_) { return false; }
    }

    function _isGameBusy() {
        return _isDialogOpen() || _isJournalOpen() || _isTransitioning();
    }

    function _canOpenPause() {
        return _isGameplayActive() && !_isGameBusy();
    }

    // ═════════════════════════════════════════════════════════
    //  OPEN / CLOSE
    // ═════════════════════════════════════════════════════════
    function open() {
        if (_active) return;
        if (!_canOpenPause()) return;

        _active         = true;
        _confirmRestart = false;
        _confirmQuit    = false;
        _selectedIndex  = 0;
        _prevGameState  = "playing";
        _frame          = 0;

        gameState = "paused";

        // Temporarily hide dialog box if it exists
        try {
            var db = document.getElementById("dialogBox");
            if (db) db.style.visibility = "hidden";
        } catch (_) {}
    }

    function close() {
        if (!_active) return;

        _active         = false;
        _confirmRestart = false;
        _confirmQuit    = false;

        if (typeof gameState !== "undefined") {
            gameState = _prevGameState || "playing";
        }

        // Restore dialog box visibility
        try {
            var db = document.getElementById("dialogBox");
            if (db && typeof dialogActive !== "undefined" && dialogActive) {
                db.style.visibility = "visible";
            }
        } catch (_) {}
    }

    function toggle() {
        if (_active) close();
        else         open();
    }

    // ═════════════════════════════════════════════════════════
    //  ACTIONS
    // ═════════════════════════════════════════════════════════
    function _doResume() {
        close();
    }

    function _doRestart() {
        if (!_confirmRestart) {
            _confirmRestart = true;
            _confirmQuit    = false;
            return;
        }
        _confirmRestart = false;
        _active         = false;
        _overlayAlpha   = 0;

        try { if (typeof _stopMenuMusic === "function") _stopMenuMusic(); } catch (_) {}

        if (typeof startNewGame === "function") {
            try { startNewGame(); } catch (_) {}
        } else {
            if (typeof gameState !== "undefined") gameState = "playing";
        }
    }

    function _doQuit() {
        if (!_confirmQuit) {
            _confirmQuit    = true;
            _confirmRestart = false;
            return;
        }
        _confirmQuit  = false;
        _active       = false;
        _overlayAlpha = 0;

        // Clean up game UI
        try {
            if (typeof dialogActive !== "undefined") dialogActive = false;
            if (typeof dialogQueue  !== "undefined") dialogQueue  = [];
            var db = document.getElementById("dialogBox");
            if (db) { db.classList.add("hidden"); db.style.visibility = "visible"; }
            var jEl = document.getElementById("journal");
            if (jEl) jEl.classList.add("hidden");
            if (typeof journalOpen !== "undefined") journalOpen = false;
        } catch (_) {}

        // Stop gameplay audio
        try {
            if (typeof AudioWiring !== "undefined" && AudioWiring.cancelPendingDelays)
                AudioWiring.cancelPendingDelays();
        } catch (_) {}
        try {
            if (typeof AudioTriggers !== "undefined" && AudioTriggers.stopAllVoices)
                AudioTriggers.stopAllVoices();
        } catch (_) {}

        if (typeof gameState !== "undefined") gameState = "menu";
        try { if (typeof _playMenuMusic === "function") _playMenuMusic(); } catch (_) {}
    }

    function _executeSelected() {
        switch (ITEMS[_selectedIndex].id) {
            case "resume":  _doResume();  break;
            case "restart": _doRestart(); break;
            case "quit":    _doQuit();    break;
        }
    }

    // ═════════════════════════════════════════════════════════
    //  INPUT — KEYBOARD (capture phase)
    //
    //  NON-INTERFERENCE:
    //  — Only intercepts ESC when pause can safely open
    //  — When paused, only consumes navigation keys
    //  — All other keys pass through untouched
    // ═════════════════════════════════════════════════════════
    function _onKeyDown(e) {

        // ── ESC handling ─────────────────────────────────────
        if (e.code === "Escape") {

            // Paused + confirming → cancel confirmation
            if (_active && (_confirmRestart || _confirmQuit)) {
                _confirmRestart = false;
                _confirmQuit    = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Paused → resume
            if (_active) {
                close();
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Playing + nothing else consuming ESC → open pause
            // Let dialog/journal handle ESC first by checking _isGameBusy
            if (_canOpenPause()) {
                open();
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Otherwise — let ESC pass through to game.js
            // (dialog close, journal close, etc.)
            return;
        }

        // ── All other keys: only handle when paused ──────────
        if (!_active) return;

        switch (e.code) {
            case "ArrowUp":
            case "KeyW":
                _selectedIndex = (_selectedIndex - 1 + ITEMS.length) % ITEMS.length;
                _confirmRestart = false;
                _confirmQuit    = false;
                e.preventDefault();
                e.stopPropagation();
                break;

            case "ArrowDown":
            case "KeyS":
                _selectedIndex = (_selectedIndex + 1) % ITEMS.length;
                _confirmRestart = false;
                _confirmQuit    = false;
                e.preventDefault();
                e.stopPropagation();
                break;

            case "Enter":
            case "Space":
                _executeSelected();
                e.preventDefault();
                e.stopPropagation();
                break;

            case "KeyR":
                _selectedIndex = 1;
                _doRestart();
                e.preventDefault();
                e.stopPropagation();
                break;

            case "KeyQ":
                _selectedIndex = 2;
                _doQuit();
                e.preventDefault();
                e.stopPropagation();
                break;

            case "Digit1":
                _selectedIndex = 0; _executeSelected();
                e.preventDefault(); e.stopPropagation();
                break;
            case "Digit2":
                _selectedIndex = 1; _executeSelected();
                e.preventDefault(); e.stopPropagation();
                break;
            case "Digit3":
                _selectedIndex = 2; _executeSelected();
                e.preventDefault(); e.stopPropagation();
                break;

            default:
                // Don't consume keys we don't handle
                // They pass through to game.js naturally
                break;
        }
    }

    // ═════════════════════════════════════════════════════════
    //  INPUT — MOUSE / TOUCH
    //
    //  NON-INTERFERENCE:
    //  — Pause button only responds during clean gameplay
    //  — Ignores taps during dialog, journal, transitions
    //  — Uses circular hit test with reasonable radius
    //  — Never blocks other canvas click handlers
    // ═════════════════════════════════════════════════════════
    function _onClick(e) {
        var tx = 0, ty = 0;
        if (e.clientX !== undefined) {
            tx = e.clientX;
            ty = e.clientY;
        } else if (e.changedTouches && e.changedTouches[0]) {
            tx = e.changedTouches[0].clientX;
            ty = e.changedTouches[0].clientY;
        } else {
            return;
        }

        // ── Pause button tap (only when NOT paused) ──────────
        if (!_active && _pauseBtnVisible && _pauseButtonRect) {
            var r   = _pauseButtonRect;
            var cx2 = r.x + r.w / 2;
            var cy2 = r.y + r.h / 2;
            var rad = r.w / 2 + 8; // slightly generous but not excessive

            if (Math.hypot(tx - cx2, ty - cy2) <= rad) {
                // Final safety check — don't open if game is busy
                if (_canOpenPause()) {
                    open();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }

        // ── Pause menu button clicks (only when paused) ──────
        if (!_active) return;

        for (var i = 0; i < _buttonRects.length; i++) {
            var br = _buttonRects[i];
            if (tx >= br.x && tx <= br.x + br.w &&
                ty >= br.y && ty <= br.y + br.h) {
                _selectedIndex = i;
                _executeSelected();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        // Click outside buttons — cancel any confirmation
        if (_confirmRestart || _confirmQuit) {
            _confirmRestart = false;
            _confirmQuit    = false;
        }
    }

    // ═════════════════════════════════════════════════════════
    //  PAUSE BUTTON — Small, non-intrusive, positioned to
    //  avoid all existing HUD elements:
    //
    //  TOP-LEFT:    Room name, loop/level, XP bar
    //  TOP-CENTER:  Timer
    //  TOP-RIGHT:   Sanity bar, battery bar, inventory
    //  BOTTOM-LEFT: Weapon, stats
    //  BOTTOM-RIGHT: Controls hint, minimap
    //
    //  SAFE SPOT: Left side, below XP bar, above weapon info
    //  → Left edge, vertically centered
    // ═════════════════════════════════════════════════════════
    function _drawPauseButton(ctx2d) {
        _pauseBtnVisible = false;

        // Only during active, clean gameplay
        if (!_isGameplayActive()) return;
        if (_isGameBusy()) return;

        var cw = ctx2d.canvas.width;
        var ch = ctx2d.canvas.height;

        // ── Position: left side, mid-height ──────────────────
        // Avoids: top-left HUD, bottom-left weapon, right inventory
        var btnSize = 38;
        var btnX    = 15;
        var btnY    = Math.floor(ch * 0.42); // ~42% down from top

        _pauseButtonRect = { x: btnX, y: btnY, w: btnSize, h: btnSize };
        _pauseBtnVisible = true;

        var cx  = btnX + btnSize / 2;
        var cy  = btnY + btnSize / 2;
        var t   = _frame * 0.006;

        // Outer glow (very subtle — barely visible)
        var glowA = 0.04 + Math.sin(t * 1.5) * 0.02;
        ctx2d.fillStyle = "rgba(140,135,180," + glowA.toFixed(4) + ")";
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, btnSize / 2 + 6, 0, Math.PI * 2);
        ctx2d.fill();

        // Button background circle
        ctx2d.fillStyle = "rgba(12,10,22,0.48)";
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, btnSize / 2, 0, Math.PI * 2);
        ctx2d.fill();

        // Border ring
        ctx2d.strokeStyle = "rgba(100,95,140,0.38)";
        ctx2d.lineWidth   = 1.2;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, btnSize / 2, 0, Math.PI * 2);
        ctx2d.stroke();

        // Pause icon — two vertical bars
        var barW = 4;
        var barH = 13;
        var gap  = 3;

        ctx2d.fillStyle = "rgba(160,155,190,0.62)";
        ctx2d.fillRect(cx - gap - barW, cy - barH / 2, barW, barH);
        ctx2d.fillRect(cx + gap,        cy - barH / 2, barW, barH);

        // "ESC" label below button (helpful for keyboard users too)
        ctx2d.fillStyle    = "rgba(120,115,150,0.30)";
        ctx2d.font         = "8px 'Courier New', monospace";
        ctx2d.textAlign    = "center";
        ctx2d.textBaseline = "top";
        ctx2d.fillText("ESC", cx, btnY + btnSize + 3);
        ctx2d.textBaseline = "alphabetic"; // reset
    }

    // ═════════════════════════════════════════════════════════
    //  DRAW PAUSE OVERLAY
    // ═════════════════════════════════════════════════════════
    function _draw(ctx2d) {
        _frame++;

        // Always draw pause button during gameplay (even when not paused)
        if (!_active) {
            try { _drawPauseButton(ctx2d); } catch (_) {}
        }

        // Smooth alpha transition
        if (_active) {
            _overlayAlpha = Math.min(0.82, _overlayAlpha + 0.045);
        } else {
            _overlayAlpha = Math.max(0, _overlayAlpha - 0.06);
        }

        // Nothing to draw if fully transparent
        if (_overlayAlpha <= 0) return;

        var cw = ctx2d.canvas.width;
        var ch = ctx2d.canvas.height;
        var cx = cw / 2;
        var cy = ch / 2;
        var t  = _frame * 0.008;

        ctx2d.save();

        // ── Background dim ──────────────────────────────────
        ctx2d.fillStyle = "rgba(3,2,8," + _overlayAlpha.toFixed(3) + ")";
        ctx2d.fillRect(0, 0, cw, ch);

        // Subtle radial darkening
        var radDim = ctx2d.createRadialGradient(cx, cy, ch * 0.12, cx, cy, ch * 0.65);
        radDim.addColorStop(0, "rgba(0,0,0,0)");
        radDim.addColorStop(1, "rgba(0,0,0," + (_overlayAlpha * 0.25).toFixed(3) + ")");
        ctx2d.fillStyle = radDim;
        ctx2d.fillRect(0, 0, cw, ch);

        // Scan lines
        ctx2d.fillStyle = "rgba(0,0,0,0.03)";
        for (var y = 0; y < ch; y += 3) ctx2d.fillRect(0, y, cw, 1);

        // ── PAUSED title ────────────────────────────────────
        var titlePulse = 0.82 + Math.sin(t * 2.5) * 0.18;
        ctx2d.save();
        ctx2d.shadowColor = "rgba(140,140,220,0.55)";
        ctx2d.shadowBlur  = 22 * titlePulse;
        ctx2d.fillStyle   = "rgba(170,170,230," + titlePulse.toFixed(3) + ")";
        ctx2d.font        = "bold " + Math.min(50, cw * 0.060) + "px Georgia, serif";
        ctx2d.textAlign   = "center";
        ctx2d.fillText("⏸  PAUSED", cx, cy - 120);
        ctx2d.restore();

        // Decorative line
        var lineW = Math.min(280, cw * 0.35);
        ctx2d.strokeStyle = "rgba(130,130,200," + (0.28 + Math.sin(t * 1.3) * 0.10).toFixed(3) + ")";
        ctx2d.lineWidth   = 1;
        ctx2d.beginPath();
        ctx2d.moveTo(cx - lineW / 2, cy - 92);
        ctx2d.lineTo(cx + lineW / 2, cy - 92);
        ctx2d.stroke();

        // ── Menu buttons ────────────────────────────────────
        var btnW   = Math.min(340, cw * 0.42);
        var btnH   = Math.min(54, ch * 0.072);
        var btnGap = Math.min(18, ch * 0.022);
        var startY = cy - 50;
        var btnX   = cx - btnW / 2;

        _buttonRects = [];

        for (var i = 0; i < ITEMS.length; i++) {
            var by     = startY + i * (btnH + btnGap);
            var isHov  = (i === _selectedIndex);
            var isConf = (i === 1 && _confirmRestart) || (i === 2 && _confirmQuit);

            _buttonRects.push({ x: btnX, y: by, w: btnW, h: btnH, id: ITEMS[i].id });

            // Background
            if (isConf) {
                var warnPulse = 0.55 + Math.sin(t * 6) * 0.20;
                ctx2d.fillStyle = "rgba(120,20,20," + warnPulse.toFixed(3) + ")";
            } else if (isHov) {
                ctx2d.fillStyle = "rgba(60,55,100,0.72)";
            } else {
                ctx2d.fillStyle = "rgba(20,18,35,0.62)";
            }

            _rrect(ctx2d, btnX, by, btnW, btnH, 8);
            ctx2d.fill();

            // Border
            if (isConf) {
                var wb = 0.5 + Math.sin(t * 6) * 0.3;
                ctx2d.strokeStyle = "rgba(220,60,60," + wb.toFixed(3) + ")";
                ctx2d.lineWidth   = 2;
            } else if (isHov) {
                ctx2d.strokeStyle = "rgba(160,155,220,0.75)";
                ctx2d.lineWidth   = 2;
                // Selection glow
                ctx2d.save();
                ctx2d.shadowColor = "rgba(140,140,220,0.4)";
                ctx2d.shadowBlur  = 12;
                _rrect(ctx2d, btnX, by, btnW, btnH, 8);
                ctx2d.stroke();
                ctx2d.restore();
                // Skip normal stroke — already done with glow
                continue;
            } else {
                ctx2d.strokeStyle = "rgba(80,75,110,0.38)";
                ctx2d.lineWidth   = 1;
            }
            _rrect(ctx2d, btnX, by, btnW, btnH, 8);
            ctx2d.stroke();
        }

        // ── Button text (separate pass) ──────────────────────
        for (var j = 0; j < ITEMS.length; j++) {
            var byT    = startY + j * (btnH + btnGap);
            var isHovT = (j === _selectedIndex);
            var isConfT = (j === 1 && _confirmRestart) || (j === 2 && _confirmQuit);

            ctx2d.textAlign    = "center";
            ctx2d.textBaseline = "middle";

            if (isConfT) {
                ctx2d.fillStyle = "rgba(255,200,200,0.95)";
                ctx2d.font      = "bold " + Math.min(14, cw * 0.018) + "px 'Courier New', monospace";
                if (j === 1) {
                    ctx2d.fillText("⚠  CONFIRM RESTART?  ⚠", cx, byT + btnH / 2 - 7);
                } else {
                    ctx2d.fillText("⚠  QUIT TO MENU?  ⚠", cx, byT + btnH / 2 - 7);
                }
                ctx2d.fillStyle = "rgba(220,220,120,0.85)";
                ctx2d.font      = Math.min(11, cw * 0.014) + "px 'Courier New', monospace";
                ctx2d.fillText("Press again to confirm  ·  ESC to cancel", cx, byT + btnH / 2 + 11);
            } else {
                ctx2d.fillStyle = isHovT ? "rgba(230,230,255,0.98)" : "rgba(170,165,200,0.72)";
                ctx2d.font = (isHovT ? "bold " : "") + Math.min(18, cw * 0.023) + "px Georgia, serif";
                ctx2d.fillText(ITEMS[j].label, cx, byT + btnH / 2 + 1);

                // Number shortcut hint
                ctx2d.fillStyle = isHovT ? "rgba(200,200,255,0.45)" : "rgba(100,95,140,0.35)";
                ctx2d.font      = Math.min(11, cw * 0.014) + "px 'Courier New', monospace";
                ctx2d.textAlign = "left";
                ctx2d.fillText("[" + (j + 1) + "]", btnX + 14, byT + btnH / 2 + 1);
                ctx2d.textAlign = "center";
            }
        }

        // ── Stats ────────────────────────────────────────────
        var statsY = startY + ITEMS.length * (btnH + btnGap) + 28;
        ctx2d.fillStyle = "rgba(100,95,130,0.42)";
        ctx2d.font      = Math.min(12, cw * 0.016) + "px 'Courier New', monospace";
        ctx2d.textAlign = "center";

        try {
            var san   = typeof game !== "undefined" ? Math.floor(game.sanity) : "?";
            var loopN = typeof game !== "undefined" ? game.loop + 1 : "?";
            var lvl   = typeof game !== "undefined" ? game.level : "?";
            var rmId  = typeof game !== "undefined" ? game.currentRoom : "?";
            var tLeft = typeof game !== "undefined" ? Math.max(0, game.maxLoopTime - game.loopTime) : 0;
            var tM    = Math.floor(tLeft / 60);
            var tS    = Math.floor(tLeft % 60);
            var tStr  = tS < 10 ? "0" + tS : "" + tS;

            ctx2d.fillText(
                "Loop: " + loopN + "  ·  Lv." + lvl + "  ·  Sanity: " + san + "  ·  " + tM + ":" + tStr,
                cx, statsY
            );
            ctx2d.fillText("Room: " + rmId, cx, statsY + 18);
        } catch (_) {
            ctx2d.fillText("Game paused", cx, statsY);
        }

        // ── Controls hint ────────────────────────────────────
        ctx2d.fillStyle = "rgba(80,75,110,0.35)";
        ctx2d.font      = "10px 'Courier New', monospace";
        ctx2d.fillText("↑↓ Navigate  ·  ENTER Select  ·  1/2/3 Quick  ·  ESC Resume", cx, ch - 22);

        ctx2d.restore();
    }

    // ── Rounded rect helper ─────────────────────────────────
    function _rrect(ctx2d, x, y, w, h, r) {
        ctx2d.beginPath();
        ctx2d.moveTo(x + r, y);
        ctx2d.lineTo(x + w - r, y);
        ctx2d.quadraticCurveTo(x + w, y,     x + w, y + r);
        ctx2d.lineTo(x + w, y + h - r);
        ctx2d.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx2d.lineTo(x + r, y + h);
        ctx2d.quadraticCurveTo(x,     y + h, x,     y + h - r);
        ctx2d.lineTo(x, y + r);
        ctx2d.quadraticCurveTo(x,     y,     x + r, y);
        ctx2d.closePath();
    }

    // ═════════════════════════════════════════════════════════
    //  HOOK INTO GAME LOOP
    //  Wraps window.render once — draws pause overlay on top
    // ═════════════════════════════════════════════════════════
    function _hookGameLoop() {
        if (_hooked) return;

        function tryPatch() {
            if (typeof window.render !== "function") {
                requestAnimationFrame(tryPatch);
                return;
            }

            var origRender = window.render;

            window.render = function () {
                try { origRender.apply(this, arguments); } catch (err) {
                    console.error("[Controls] render error:", err);
                }
                try {
                    var c  = document.getElementById("gameCanvas");
                    var cx = c ? c.getContext("2d") : null;
                    if (cx) _draw(cx);
                } catch (err) {
                    console.error("[Controls] draw error:", err);
                }
            };

            _hooked = true;
            console.log("[Controls] Pause system hooked ✓");
        }

        requestAnimationFrame(tryPatch);
    }

    // ═════════════════════════════════════════════════════════
    //  BIND EVENTS
    // ═════════════════════════════════════════════════════════
    function _bindEvents() {
        // Keyboard — capture phase, runs before game.js
        window.addEventListener("keydown", _onKeyDown, true);

        // Canvas click — capture phase
        var cvs = document.getElementById("gameCanvas");
        if (cvs) {
            cvs.addEventListener("click", _onClick, true);

            // Touch — always check (pause button + menu buttons)
            cvs.addEventListener("touchstart", function (e) {
                _onClick(e);
            }, { capture: true, passive: false });
        }
    }

    // ═════════════════════════════════════════════════════════
    //  INIT
    // ═════════════════════════════════════════════════════════
    function init() {
        _bindEvents();
        _hookGameLoop();
        console.log("[Controls] Pause/Resume/Restart system ready ✓");
    }

    // ═════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═════════════════════════════════════════════════════════
    return {
        get active()   { return _active; },
        get isPaused() { return _active; },

        open:    open,
        close:   close,
        toggle:  toggle,

        doResume:  _doResume,
        doRestart: _doRestart,
        doQuit:    _doQuit,

        init: init,

        debug: function () {
            return {
                active:         _active,
                overlayAlpha:   _overlayAlpha,
                selectedIndex:  _selectedIndex,
                confirmRestart: _confirmRestart,
                confirmQuit:    _confirmQuit,
                prevState:      _prevGameState,
                hooked:         _hooked,
                btnVisible:     _pauseBtnVisible,
            };
        },
    };

})();


// ═════════════════════════════════════════════════════════════════
//  AUTO-INIT
// ═════════════════════════════════════════════════════════════════
(function () {
    function _boot() {
        try { PauseMenu.init(); } catch (err) {
            console.error("[Controls] Boot failed:", err);
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _boot, { once: true });
    } else {
        _boot();
    }
})();