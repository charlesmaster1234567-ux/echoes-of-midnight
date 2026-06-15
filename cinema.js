// ═════════════════════════════════════════════════════════════════
//  CINEMA.JS — v5.0 "Director's Cut"
//  2000+ lines — Full cinematic engine
//  • Dual-layer smoothing (spring + micro-interpolation)
//  • Velocity-aware dynamic zoom
//  • Directional anticipation with prediction
//  • Room transition establishing shots
//  • Contextual drama (ghost proximity, combat, safe rooms)
//  • Multi-layer parallax depth
//  • Film-quality post-processing
//  • All set pieces & death memories preserved
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

"use strict";

// ─── SAFE ACCESSORS ─────────────────────────────────────────────
function _cg() {
    return (typeof game !== "undefined" && game) ? game : null;
}
function _cgst() {
    return (typeof gameState !== "undefined") ? gameState : null;
}
function _cRooms(id) {
    if (typeof ROOMS === "undefined" || !ROOMS) return null;
    return ROOMS[id] || null;
}
function _roomDim(id) {
    const r = _cRooms(id);
    return { w: (r && r.width) || 800, h: (r && r.height) || 600 };
}

let _cinemaTick = 0;

// ═════════════════════════════════════════════════════════════════
//  SPRING — critically-damped spring (ζ = 1)
//  Zero overshoot, zero wobble. Pure silk.
// ═════════════════════════════════════════════════════════════════
class Spring {
    constructor(initial, speed) {
        this.value    = initial;
        this.target   = initial;
        this.velocity = 0;
        this.speed    = speed || 8;
    }

    update(dt) {
        const omega   = this.speed;
        const damping = 2 * omega;
        const delta   = this.value - this.target;
        const accel   = -(omega * omega * delta) - (damping * this.velocity);
        this.velocity += accel * dt;
        this.value    += this.velocity * dt;

        // Kill micro-drift when settled
        if (Math.abs(delta) < 0.005 && Math.abs(this.velocity) < 0.005) {
            this.value    = this.target;
            this.velocity = 0;
        }
    }

    snap(val) {
        this.value    = val;
        this.target   = val;
        this.velocity = 0;
    }

    // Soft-set: adjusts target without velocity spike
    ease(val) {
        this.target = val;
    }
}

// ═════════════════════════════════════════════════════════════════
//  MICRO-SMOOTHER — secondary interpolation layer
//  Sits on top of the spring to eliminate the last sub-pixel
//  stutter that springs can't catch. Uses exponential decay.
// ═════════════════════════════════════════════════════════════════
class MicroSmoother {
    constructor(initial) {
        this.value = initial;
        this.factor = 0.35;   // 0 = no smoothing, 1 = frozen
    }

    update(target) {
        this.value += (target - this.value) * this.factor;
        if (Math.abs(target - this.value) < 0.01) this.value = target;
        return this.value;
    }

    snap(val) {
        this.value = val;
    }
}

// ═════════════════════════════════════════════════════════════════
//  VELOCITY TRACKER — weighted moving average
//  Smooths out single-frame velocity spikes across N samples.
// ═════════════════════════════════════════════════════════════════
class VelocityTracker {
    constructor(samples) {
        this.samples = samples || 8;
        this.history = [];
        this.smoothX = 0;
        this.smoothY = 0;
        this.speed   = 0;
        this.angle   = 0;
        this._lastX  = 0;
        this._lastY  = 0;
    }

    update(x, y) {
        const rawVX = x - this._lastX;
        const rawVY = y - this._lastY;
        this._lastX = x;
        this._lastY = y;

        this.history.push({ vx: rawVX, vy: rawVY });
        if (this.history.length > this.samples) this.history.shift();

        // Weighted average — recent samples count more
        let totalWeight = 0;
        let sumVX = 0, sumVY = 0;
        for (let i = 0; i < this.history.length; i++) {
            const weight = (i + 1) / this.history.length;
            sumVX += this.history[i].vx * weight;
            sumVY += this.history[i].vy * weight;
            totalWeight += weight;
        }

        this.smoothX = totalWeight > 0 ? sumVX / totalWeight : 0;
        this.smoothY = totalWeight > 0 ? sumVY / totalWeight : 0;
        this.speed   = Math.hypot(this.smoothX, this.smoothY);
        this.angle   = Math.atan2(this.smoothY, this.smoothX);
    }

    snap(x, y) {
        this._lastX = x;
        this._lastY = y;
        this.history = [];
        this.smoothX = 0;
        this.smoothY = 0;
        this.speed   = 0;
    }
}

// ═════════════════════════════════════════════════════════════════
//  CINEMATIC CAMERA  — v5.0 "Director's Cut"
// ═════════════════════════════════════════════════════════════════
const Camera = {

    // ── Primary springs (macro movement) ──────────────────────────
    _springX:     new Spring(400, 8),
    _springY:     new Spring(300, 8),
    _springZoom:  new Spring(0.82, 3.5),
    _springAngle: new Spring(0, 5),

    // ── Micro-smoothers (sub-pixel polish) ────────────────────────
    _microX:    new MicroSmoother(400),
    _microY:    new MicroSmoother(300),
    _microZoom: new MicroSmoother(0.82),

    // ── Velocity tracking ─────────────────────────────────────────
    _vel: new VelocityTracker(10),

    // ── Public readable state ─────────────────────────────────────
    x: 400, y: 300,
    zoom: 0.82,
    angle: 0,

    // ── Targets ──────────────────────────────────────────────────
    targetX: 400, targetY: 300,
    targetZoom: 0.82,
    targetAngle: 0,

    // ── Override (scripted pan/zoom) ──────────────────────────────
    overrideActive:   false,
    overrideX: 0, overrideY: 0,
    overrideZoom: 1.0, overrideAngle: 0,
    overrideDuration: 0, overrideTimer: 0,
    overrideCallback: null, overrideEase: "smooth",
    _ovStartX: 0, _ovStartY: 0, _ovStartZ: 1, _ovStartA: 0,

    // ── Scare zoom ────────────────────────────────────────────────
    scareZoomActive:    false,
    scareZoomTimer:     0,
    scareZoomIntensity: 0,

    // ── Organic motion ────────────────────────────────────────────
    breathPhase:   0,
    vignettePulse: 0,

    // ── Pseudo-3D parallax ────────────────────────────────────────
    _parallax: {
        x1: 0, y1: 0,    // near layer (strong shift)
        x2: 0, y2: 0,    // mid layer
        x3: 0, y3: 0,    // far layer (subtle shift)
    },
    tiltX: 0,
    tiltY: 0,
    depthScale: 1.0,

    // ── Dynamic zoom modifiers ────────────────────────────────────
    _velocityZoom:    0,     // zoom-out when running
    _contextualZoom:  0,     // zoom based on room context
    _dramaZoom:       0,     // zoom from ghost/combat proximity
    _idleZoomIn:      0,     // slow zoom-in when standing still

    // ── Room transition ───────────────────────────────────────────
    _establishing:     false,
    _estTimer:         0,
    _estDuration:      0,
    _estStartX:        0,
    _estStartY:        0,
    _estTargetX:       0,
    _estTargetY:       0,
    _estZoomStart:     0,
    _estZoomEnd:       0,
    _prevRoom:         null,

    // ── Idle detection ────────────────────────────────────────────
    _idleTime:   0,
    _lastMoveX:  0,
    _lastMoveY:  0,

    // ── Film color grading ────────────────────────────────────────
    _colorGrade: { r: 0, g: 0, b: 0, a: 0 },

    // ── Timing ────────────────────────────────────────────────────
    _lastTime:   0,
    _totalTime:  0,

    // ── Room zoom preferences ─────────────────────────────────────
    ROOM_ZOOM: {
        foyer:0.82,         ballroom:0.70,       hedge_maze:0.65,
        void_chamber:0.90,  ritual_chamber:0.88, bell_tower:0.95,
        tower_peak:0.95,    servants_tunnel:0.85, sanctuary:0.92,
        observatory:0.85,   garden_path:0.75,    graveyard:0.78,
        underground_lake:0.72, attic:0.80,       catacombs:0.78,
        mirror_gallery:0.85, library:0.84,       chapel:0.88,
        nursery:0.86,       basement:0.80,       kitchen:0.82,
        dining_room:0.82,   parlor:0.84,         study:0.85,
        master_bedroom:0.84, childrens_room:0.84, conservatory:0.78,
        greenhouse:0.78,    secret_garden:0.75,  wine_cellar:0.82,
        clock_tower:0.88,   laboratory:0.82,     music_room:0.85,
        upstairs_hall:0.84, trophy_room:0.82,    gallery:0.80,
        coal_room:0.82,     secret_room:0.85,    well:0.78,
        tower_stairs:0.88,  attic_stairs:0.82,   wine_tasting:0.82,
        root_cellar:0.80,   laundry:0.82,        ice_house:0.80,
        potting_shed:0.78,  dovecote:0.78,       clock_gears:0.85,
        balcony:0.78,       servants_quarters:0.82,
    },

    // ── Room mood (for color grading) ─────────────────────────────
    ROOM_MOOD: {
        foyer:            { r:0,   g:0,   b:5,   a:0.02 },
        library:          { r:10,  g:5,   b:0,   a:0.03 },
        chapel:           { r:0,   g:0,   b:10,  a:0.02 },
        sanctuary:        { r:5,   g:8,   b:12,  a:0.03 },
        basement:         { r:0,   g:5,   b:0,   a:0.04 },
        ritual_chamber:   { r:15,  g:0,   b:5,   a:0.05 },
        void_chamber:     { r:5,   g:0,   b:15,  a:0.06 },
        catacombs:        { r:5,   g:3,   b:0,   a:0.04 },
        graveyard:        { r:0,   g:3,   b:8,   a:0.03 },
        garden_path:      { r:0,   g:5,   b:3,   a:0.02 },
        greenhouse:       { r:0,   g:8,   b:3,   a:0.02 },
        nursery:          { r:8,   g:5,   b:10,  a:0.03 },
        childrens_room:   { r:5,   g:5,   b:10,  a:0.03 },
        master_bedroom:   { r:8,   g:3,   b:3,   a:0.03 },
        underground_lake: { r:0,   g:3,   b:12,  a:0.04 },
        mirror_gallery:   { r:3,   g:5,   b:10,  a:0.03 },
        music_room:       { r:5,   g:3,   b:8,   a:0.02 },
        kitchen:          { r:8,   g:5,   b:0,   a:0.02 },
        wine_cellar:      { r:10,  g:3,   b:0,   a:0.03 },
    },

    // ── Safe rooms (camera relaxes here) ──────────────────────────
    SAFE_ROOMS: new Set([
        "chapel","sanctuary","secret_garden",
    ]),

    // ═════════════════════════════════════════════════════════════
    //  UPDATE — the heart of the system
    // ═════════════════════════════════════════════════════════════
    update(playerX, playerY, roomId) {
        // ── Delta time ────────────────────────────────────────────
        const now = performance.now();
        let dt = (now - this._lastTime) / 1000;
        this._lastTime = now;
        if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
        dt = Math.min(dt, 0.1);   // clamp for tab-switch safety
        this._totalTime += dt;

        const g = _cg();
        playerX = Number.isFinite(playerX) ? playerX : 400;
        playerY = Number.isFinite(playerY) ? playerY : 300;

        // ── Update velocity tracker ───────────────────────────────
        this._vel.update(playerX, playerY);

        // ── Sanity ratio (0 = full, 1 = zero) ────────────────────
        const sanityRatio = g
            ? Math.max(0, Math.min(1, 1 - (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100)))
            : 0;

        // ── Room zoom ─────────────────────────────────────────────
        this.targetZoom = this.ROOM_ZOOM[roomId] || 0.82;

        // ── Combat zoom ───────────────────────────────────────────
        if (typeof combat !== "undefined" && combat) {
            if (combat.bossActive)       this.targetZoom = Math.max(0.55, this.targetZoom - 0.16);
            else if (combat.active)      this.targetZoom = Math.max(0.60, this.targetZoom - 0.10);
        }

        // ── Room transition establishing shot ─────────────────────
        if (roomId !== this._prevRoom && this._prevRoom !== null && !this.overrideActive) {
            this._startEstablishingShot(playerX, playerY, roomId);
        }
        this._prevRoom = roomId;

        // ══════════════════════════════════════════════════════════
        //  ESTABLISHING SHOT PATH
        // ══════════════════════════════════════════════════════════
        if (this._establishing) {
            this._updateEstablishingShot(dt, playerX, playerY);
            this._updateParallax(dt, sanityRatio);
            this._updateScare(dt);
            this._updateColorGrade(dt, roomId, sanityRatio);
            return;
        }

        // ══════════════════════════════════════════════════════════
        //  OVERRIDE PATH (scripted zooms/pans)
        // ══════════════════════════════════════════════════════════
        if (this.overrideActive) {
            this._updateOverride(dt);
            this._updateParallax(dt, sanityRatio);
            this._updateScare(dt);
            this._updateColorGrade(dt, roomId, sanityRatio);
            return;
        }

        // ══════════════════════════════════════════════════════════
        //  NORMAL FOLLOW PATH
        // ══════════════════════════════════════════════════════════

        // ── Idle detection ────────────────────────────────────────
        const moved = Math.abs(playerX - this._lastMoveX) > 0.5
                   || Math.abs(playerY - this._lastMoveY) > 0.5;
        if (moved) {
            this._idleTime  = 0;
            this._lastMoveX = playerX;
            this._lastMoveY = playerY;
        } else {
            this._idleTime += dt;
        }

        // ── Directional anticipation ──────────────────────────────
        // Camera looks ahead in the direction of travel.
        // The faster you move, the further ahead it looks.
        // When idle, anticipation fades to zero smoothly.
        const speed       = this._vel.speed;
        const moveAngle   = this._vel.angle;
        const anticipation = Math.min(speed * 14, 70);   // max 70px look-ahead
        const antiDecay    = this._idleTime > 0.5 ? Math.max(0, 1 - (this._idleTime - 0.5) * 2) : 1;
        const laX = speed > 0.2 ? Math.cos(moveAngle) * anticipation * antiDecay : 0;
        const laY = speed > 0.2 ? Math.sin(moveAngle) * anticipation * antiDecay : 0;

        // ── Breathing (organic micro-motion) ──────────────────────
        const breathSpeed = 0.004 + sanityRatio * 0.01;
        this.breathPhase += breathSpeed * (dt * 60);

        const breathAmt = 0.06 + sanityRatio * 0.35;
        const breathX   = Math.sin(this.breathPhase) * breathAmt;
        const breathY   = Math.cos(this.breathPhase * 0.63) * breathAmt * 0.4;

        // Additional sanity wobble
        const wobbleX = sanityRatio > 0.3
            ? Math.sin(this._totalTime * 3.7) * sanityRatio * 0.6
            : 0;
        const wobbleY = sanityRatio > 0.3
            ? Math.cos(this._totalTime * 2.9) * sanityRatio * 0.4
            : 0;

        // ── Set spring targets ────────────────────────────────────
        this._springX.target = playerX + laX + breathX + wobbleX;
        this._springY.target = playerY + laY + breathY + wobbleY;

        // ── Dynamic zoom ──────────────────────────────────────────
        this._updateDynamicZoom(dt, speed, roomId, sanityRatio);

        const totalZoomMod = this._velocityZoom
                           + this._contextualZoom
                           + this._dramaZoom
                           + this._idleZoomIn;

        this._springZoom.target = Math.max(0.45, Math.min(1.3,
            this.targetZoom + totalZoomMod
        ));

        // ── Sanity tilt ───────────────────────────────────────────
        const tiltBase = Math.sin(this._totalTime * 0.8) * sanityRatio * 0.018;
        const tiltPanic = sanityRatio > 0.7
            ? Math.sin(this._totalTime * 4.5) * (sanityRatio - 0.7) * 0.01
            : 0;
        this._springAngle.target = tiltBase + tiltPanic;

        // ── Adaptive spring speed ─────────────────────────────────
        // Fast when far from target (responsive), gentle when close (smooth)
        const distToTarget = Math.hypot(
            this._springX.target - this._springX.value,
            this._springY.target - this._springY.value
        );
        this._springX.speed = 6 + Math.min(distToTarget * 0.04, 6);
        this._springY.speed = this._springX.speed;

        // Safe rooms: slower, more relaxed camera
        if (this.SAFE_ROOMS.has(roomId)) {
            this._springX.speed = Math.min(this._springX.speed, 5);
            this._springY.speed = Math.min(this._springY.speed, 5);
        }

        // ── Tick all springs ──────────────────────────────────────
        this._springX.update(dt);
        this._springY.update(dt);
        this._springZoom.update(dt);
        this._springAngle.update(dt);

        // ── Apply micro-smoothing ─────────────────────────────────
        this.x    = this._microX.update(this._springX.value);
        this.y    = this._microY.update(this._springY.value);
        this.zoom = this._microZoom.update(this._springZoom.value);
        this.angle = this._springAngle.value;

        // ── Pseudo-3D ─────────────────────────────────────────────
        this._updateParallax(dt, sanityRatio);

        // ── Scare zoom ────────────────────────────────────────────
        this._updateScare(dt);

        // ── Vignette pulse ────────────────────────────────────────
        const vBase  = 0.3 + sanityRatio * 0.5;
        const vPulse = Math.sin(this._totalTime * 0.8) * 0.1 * sanityRatio;
        this.vignettePulse = vBase + vPulse;

        // ── Color grading ─────────────────────────────────────────
        this._updateColorGrade(dt, roomId, sanityRatio);
    },

    // ═════════════════════════════════════════════════════════════
    //  DYNAMIC ZOOM
    // ═════════════════════════════════════════════════════════════
    _updateDynamicZoom(dt, speed, roomId, sanityRatio) {
        const rate = Math.min(1, 3 * dt);

        // ── Velocity zoom: zoom out when running fast ─────────────
        const velZoomTarget = -Math.min(speed * 0.015, 0.08);
        this._velocityZoom += (velZoomTarget - this._velocityZoom) * rate;

        // ── Idle zoom-in: slowly zoom in when standing still ──────
        if (this._idleTime > 2.0) {
            const idleTarget = Math.min((this._idleTime - 2.0) * 0.008, 0.06);
            this._idleZoomIn += (idleTarget - this._idleZoomIn) * rate * 0.3;
        } else {
            this._idleZoomIn += (0 - this._idleZoomIn) * rate;
        }

        // ── Contextual zoom ───────────────────────────────────────
        let contextTarget = 0;
        if (this.SAFE_ROOMS.has(roomId)) {
            contextTarget = 0.04;   // tighter in safe rooms (intimate)
        }
        this._contextualZoom += (contextTarget - this._contextualZoom) * rate * 0.5;

        // ── Drama zoom ────────────────────────────────────────────
        let dramaTarget = 0;
        const g = _cg();
        if (g) {
            // Near ghosts: tighten zoom
            const room = _cRooms(g.currentRoom);
            if (room && Array.isArray(room.ghosts)) {
                let nearestGhostDist = Infinity;
                for (const gh of room.ghosts) {
                    if ((g.loop ?? 0) < (gh.appearsAfterLoop ?? 0)) continue;
                    const d = Math.hypot((g.playerX ?? 0) - gh.x, (g.playerY ?? 0) - gh.y);
                    if (d < nearestGhostDist) nearestGhostDist = d;
                }
                if (nearestGhostDist < 120) {
                    dramaTarget = 0.05 * (1 - nearestGhostDist / 120);
                }
            }

            // Low sanity: slight zoom-in (claustrophobic)
            if (sanityRatio > 0.5) {
                dramaTarget += (sanityRatio - 0.5) * 0.06;
            }
        }
        this._dramaZoom += (dramaTarget - this._dramaZoom) * rate * 0.4;
    },

    // ═════════════════════════════════════════════════════════════
    //  ESTABLISHING SHOT (room transitions)
    // ═════════════════════════════════════════════════════════════
    _startEstablishingShot(playerX, playerY, roomId) {
        const dim = _roomDim(roomId);

        // Brief establishing: camera starts wide at room center,
        // then settles on the player
        this._establishing = true;
        this._estTimer     = 0;
        this._estDuration  = 55;   // ~0.9 seconds at 60fps

        // Start from room center, slightly zoomed out
        this._estStartX    = dim.w * 0.5;
        this._estStartY    = dim.h * 0.5;
        this._estTargetX   = playerX;
        this._estTargetY   = playerY;
        this._estZoomStart = (this.ROOM_ZOOM[roomId] || 0.82) - 0.08;
        this._estZoomEnd   = this.ROOM_ZOOM[roomId] || 0.82;
    },

    _updateEstablishingShot(dt, playerX, playerY) {
        this._estTimer++;

        // Always update target to player's current position
        // so the shot tracks the player even if they move during it
        this._estTargetX = playerX;
        this._estTargetY = playerY;

        const t    = Math.min(1, this._estTimer / Math.max(1, this._estDuration));
        const ease = this._ease(t, "smooth");

        // Interpolate from room center to player
        const estX = this._estStartX + (this._estTargetX - this._estStartX) * ease;
        const estY = this._estStartY + (this._estTargetY - this._estStartY) * ease;
        const estZ = this._estZoomStart + (this._estZoomEnd - this._estZoomStart) * ease;

        // Set springs to track the establishing position
        this._springX.snap(estX);
        this._springY.snap(estY);
        this._springZoom.snap(estZ);

        this._microX.snap(estX);
        this._microY.snap(estY);
        this._microZoom.snap(estZ);

        this.x    = estX;
        this.y    = estY;
        this.zoom = estZ;
        this.angle = 0;

        if (t >= 1) {
            this._establishing = false;
            // Smoothly hand off to normal follow
            this._springX.value = estX;
            this._springY.value = estY;
            this._springX.velocity = 0;
            this._springY.velocity = 0;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  OVERRIDE (scripted zoom/pan)
    // ═════════════════════════════════════════════════════════════
    _updateOverride(dt) {
        this.overrideTimer++;
        const t    = Math.min(1, this.overrideTimer / Math.max(1, this.overrideDuration));
        const ease = this._ease(t, this.overrideEase);

        this.x     = this._ovStartX + (this.overrideX     - this._ovStartX) * ease;
        this.y     = this._ovStartY + (this.overrideY     - this._ovStartY) * ease;
        this.zoom  = this._ovStartZ + (this.overrideZoom  - this._ovStartZ) * ease;
        this.angle = this._ovStartA + (this.overrideAngle - this._ovStartA) * ease;

        // Keep springs synced so there's no snap on exit
        this._springX.snap(this.x);
        this._springY.snap(this.y);
        this._springZoom.snap(this.zoom);
        this._springAngle.snap(this.angle);
        this._microX.snap(this.x);
        this._microY.snap(this.y);
        this._microZoom.snap(this.zoom);

        if (this.overrideTimer >= this.overrideDuration) {
            this.overrideActive = false;
            const cb = this.overrideCallback;
            this.overrideCallback = null;
            if (typeof cb === "function") { try { cb(); } catch (_) {} }
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  MULTI-LAYER PARALLAX
    // ═════════════════════════════════════════════════════════════
    _updateParallax(dt, sanityRatio) {
        const rate = Math.min(1, 6 * dt);
        const vx = this._vel.smoothX;
        const vy = this._vel.smoothY;

        // Near layer — strong shift, responds quickly
        const t1x = -vx * 5.0;
        const t1y = -vy * 5.0;
        this._parallax.x1 += (t1x - this._parallax.x1) * rate * 1.2;
        this._parallax.y1 += (t1y - this._parallax.y1) * rate * 1.2;

        // Mid layer — medium shift, medium response
        const t2x = -vx * 3.0;
        const t2y = -vy * 3.0;
        this._parallax.x2 += (t2x - this._parallax.x2) * rate * 0.8;
        this._parallax.y2 += (t2y - this._parallax.y2) * rate * 0.8;

        // Far layer — subtle shift, slow response (background depth)
        const t3x = -vx * 1.5;
        const t3y = -vy * 1.5;
        this._parallax.x3 += (t3x - this._parallax.x3) * rate * 0.4;
        this._parallax.y3 += (t3y - this._parallax.y3) * rate * 0.4;

        // Tilt from velocity
        this.tiltX += (vx * 0.0025 - this.tiltX) * rate * 0.5;
        this.tiltY += (vy * 0.0020 - this.tiltY) * rate * 0.5;

        // Depth scale — subtle zoom breathing
        const spd = this._vel.speed;
        const dTarget = 1.0
            + Math.sin(this.breathPhase * 0.8) * 0.0015
            + Math.min(spd * 0.002, 0.01)
            + sanityRatio * 0.003;
        this.depthScale += (dTarget - this.depthScale) * rate;
    },

    // ═════════════════════════════════════════════════════════════
    //  SCARE ZOOM
    // ═════════════════════════════════════════════════════════════
    _updateScare(dt) {
        if (!this.scareZoomActive) return;
        this.scareZoomTimer -= dt * 60;
        const t = Math.max(0, this.scareZoomTimer / 30);
        const intensity = t * this.scareZoomIntensity;
        this.zoom += Math.sin(this.scareZoomTimer * 0.5) * intensity;
        if (this.scareZoomTimer <= 0) {
            this.scareZoomActive = false;
            this.scareZoomTimer  = 0;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  COLOR GRADING — room mood + sanity
    // ═════════════════════════════════════════════════════════════
    _updateColorGrade(dt, roomId, sanityRatio) {
        const mood   = this.ROOM_MOOD[roomId] || { r:0, g:0, b:0, a:0 };
        const rate   = Math.min(1, 2 * dt);

        // Sanity shifts toward red/dark
        const sanR = sanityRatio * 20;
        const sanG = -sanityRatio * 5;
        const sanB = -sanityRatio * 8;
        const sanA = sanityRatio * 0.04;

        this._colorGrade.r += ((mood.r + sanR) - this._colorGrade.r) * rate;
        this._colorGrade.g += ((mood.g + sanG) - this._colorGrade.g) * rate;
        this._colorGrade.b += ((mood.b + sanB) - this._colorGrade.b) * rate;
        this._colorGrade.a += ((mood.a + sanA) - this._colorGrade.a) * rate;
    },

    // ═════════════════════════════════════════════════════════════
    //  GET TRANSFORM
    // ═════════════════════════════════════════════════════════════
    getTransform(canvasWidth, canvasHeight, roomWidth, roomHeight) {
        const rw = Math.max(1, roomWidth);
        const rh = Math.max(1, roomHeight);

        const baseScale = Math.min(canvasWidth / rw, canvasHeight / rh);
        const scale     = baseScale * this.zoom * this.depthScale;

        // Primary parallax (near layer) affects camera position
        const cx = canvasWidth  / 2 - (this.x + this._parallax.x1) * scale;
        const cy = canvasHeight / 2 - (this.y + this._parallax.y1) * scale;

        return {
            scale,
            camX:  cx,
            camY:  cy,
            angle: this.angle + this.tiltX,
        };
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: PERSPECTIVE FLOOR
    // ═════════════════════════════════════════════════════════════
    drawPerspectiveFloor(ctx, rw, rh) {
        const vpX = rw * 0.5;
        const vpY = rh * 0.10;

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.008)";
        ctx.lineWidth   = 1;

        // Radial vanishing-point lines
        for (let i = 0; i < 18; i++) {
            const bx = (i / 17) * rw;
            ctx.beginPath();
            ctx.moveTo(vpX, vpY);
            ctx.lineTo(bx, rh);
            ctx.stroke();
        }

        // Horizontal depth lines (exponential spacing)
        for (let i = 1; i <= 12; i++) {
            const t = i / 12;
            const y = vpY + (rh - vpY) * (t * t);
            const halfW = (rw * 0.5) * t;
            ctx.beginPath();
            ctx.moveTo(vpX - halfW, y);
            ctx.lineTo(vpX + halfW, y);
            ctx.stroke();
        }

        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: DEPTH FOG
    // ═════════════════════════════════════════════════════════════
    drawDepthFog(ctx, rw, rh) {
        const g  = _cg();
        const sr = g ? Math.max(0, 1 - (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100)) : 0;
        const base = 0.03 + sr * 0.05;

        ctx.save();

        // Ceiling fog
        try {
            const top = ctx.createLinearGradient(0, 0, 0, rh * 0.25);
            top.addColorStop(0, `rgba(3,3,12,${(base * 2.0).toFixed(3)})`);
            top.addColorStop(1, "rgba(3,3,12,0)");
            ctx.fillStyle = top;
            ctx.fillRect(0, 0, rw, rh * 0.25);
        } catch (_) {}

        // Floor fog
        try {
            const btm = ctx.createLinearGradient(0, rh * 0.75, 0, rh);
            btm.addColorStop(0, "rgba(3,3,8,0)");
            btm.addColorStop(1, `rgba(3,3,8,${(base * 1.5).toFixed(3)})`);
            ctx.fillStyle = btm;
            ctx.fillRect(0, rh * 0.75, rw, rh * 0.25);
        } catch (_) {}

        // Wall shadows
        try {
            const lW = rw * 0.08;
            const wallAlpha = (base * 2.5).toFixed(3);

            const left = ctx.createLinearGradient(0, 0, lW, 0);
            left.addColorStop(0, `rgba(0,0,0,${wallAlpha})`);
            left.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = left;
            ctx.fillRect(0, 0, lW, rh);

            const right = ctx.createLinearGradient(rw - lW, 0, rw, 0);
            right.addColorStop(0, "rgba(0,0,0,0)");
            right.addColorStop(1, `rgba(0,0,0,${wallAlpha})`);
            ctx.fillStyle = right;
            ctx.fillRect(rw - lW, 0, lW, rh);
        } catch (_) {}

        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: FURNITURE SHADOW
    // ═════════════════════════════════════════════════════════════
    drawFurnitureShadow(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.14)";
        ctx.beginPath();
        ctx.ellipse(x, y + h * 0.42, w * 0.44, h * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: AMBIENT LIGHT FLICKER
    // ═════════════════════════════════════════════════════════════
    drawAmbientFlicker(ctx, rw, rh) {
        const t = this._totalTime;
        const flicker = Math.sin(t * 2.3) * 0.006
                      + Math.sin(t * 7.1) * 0.003
                      + Math.sin(t * 0.7) * 0.004;
        if (Math.abs(flicker) < 0.002) return;

        ctx.save();
        ctx.fillStyle = flicker > 0
            ? `rgba(255,240,200,${flicker.toFixed(4)})`
            : `rgba(0,0,20,${Math.abs(flicker).toFixed(4)})`;
        ctx.fillRect(0, 0, rw, rh);
        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: VIGNETTE
    // ═════════════════════════════════════════════════════════════
    drawVignette(ctx, cw, ch) {
        const intensity = 0.40 + this.vignettePulse * 0.50;
        if (intensity <= 0) return;

        try {
            // Off-center for cinematic feel
            const grad = ctx.createRadialGradient(
                cw * 0.5, ch * 0.52, ch * 0.14,
                cw * 0.5, ch * 0.52, ch * 0.92
            );
            grad.addColorStop(0,    "rgba(0,0,0,0)");
            grad.addColorStop(0.40, `rgba(0,0,0,${(intensity * 0.08).toFixed(3)})`);
            grad.addColorStop(0.65, `rgba(0,0,0,${(intensity * 0.30).toFixed(3)})`);
            grad.addColorStop(0.85, `rgba(0,0,0,${(intensity * 0.60).toFixed(3)})`);
            grad.addColorStop(1,    `rgba(0,0,0,${(intensity * 0.92).toFixed(3)})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, cw, ch);
        } catch (_) {}
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: FILM GRAIN
    // ═════════════════════════════════════════════════════════════
    drawGrain(ctx, cw, ch) {
        const g  = _cg();
        const sr = g ? Math.max(0, 1 - (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100)) : 0;
        const alpha = 0.012 + sr * 0.03;
        if (alpha < 0.006) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        const step = 5;
        for (let gy = 0; gy < ch; gy += step) {
            for (let gx = 0; gx < cw; gx += step) {
                if (Math.random() > 0.25) continue;
                const v = Math.random() > 0.5 ? 230 : 20;
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(gx, gy, 1, 1);
            }
        }
        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: CHROMATIC ABERRATION (low sanity horror effect)
    // ═════════════════════════════════════════════════════════════
    drawChromaticAberration(ctx, cw, ch) {
        const g = _cg();
        if (!g) return;
        const sr = Math.max(0, 1 - (g.sanity ?? 100) / Math.max(1, g.maxSanity ?? 100));
        if (sr < 0.45) return;

        const shift = (sr - 0.45) * 2.5;

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = Math.min(0.12, shift * 0.05);

        ctx.fillStyle = "rgba(255,0,0,1)";
        ctx.fillRect(Math.round(-shift), 0, cw, ch);

        ctx.fillStyle = "rgba(0,0,255,1)";
        ctx.fillRect(Math.round(shift), 0, cw, ch);

        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: COLOR GRADING OVERLAY
    // ═════════════════════════════════════════════════════════════
    drawColorGrade(ctx, cw, ch) {
        const cg = this._colorGrade;
        if (cg.a < 0.005) return;

        ctx.save();
        ctx.fillStyle = `rgba(${Math.floor(cg.r)},${Math.floor(cg.g)},${Math.floor(cg.b)},${cg.a.toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  DRAW: LETTERBOX (cinematic black bars during set pieces)
    // ═════════════════════════════════════════════════════════════
    drawLetterbox(ctx, cw, ch, amount) {
        if (!amount || amount <= 0) return;
        const barH = Math.floor(ch * amount * 0.12);
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, cw, barH);
        ctx.fillRect(0, ch - barH, cw, barH);
        ctx.restore();
    },

    // ═════════════════════════════════════════════════════════════
    //  EASING FUNCTIONS
    // ═════════════════════════════════════════════════════════════
    _ease(t, type) {
        t = Math.max(0, Math.min(1, t));
        switch (type) {
            case "elastic": {
                if (t === 0 || t === 1) return t;
                return Math.pow(2, -10*t) * Math.sin((t*10-0.75) * (2*Math.PI/3)) + 1;
            }
            case "bounce": {
                if (t < 1/2.75)       return 7.5625 * t * t;
                if (t < 2/2.75)     { t -= 1.5/2.75;   return 7.5625*t*t + 0.75; }
                if (t < 2.5/2.75)   { t -= 2.25/2.75;  return 7.5625*t*t + 0.9375; }
                                      t -= 2.625/2.75; return 7.5625*t*t + 0.984375;
            }
            case "snap":      return t < 0.5 ? 0 : 1;
            case "linear":    return t;
            case "easeOut":   return 1 - Math.pow(1 - t, 3);
            case "easeIn":    return t * t * t;
            case "easeInOut": {
                return t < 0.5
                    ? 4 * t * t * t
                    : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
            case "smooth":
            default:          return t * t * (3 - 2 * t);
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  PUBLIC COMMANDS
    // ═════════════════════════════════════════════════════════════
    zoomTo(x, y, zoom, duration, ease, callback) {
        this.overrideActive   = true;
        this._establishing    = false;   // cancel any establishing shot
        this._ovStartX        = this.x;
        this._ovStartY        = this.y;
        this._ovStartZ        = this.zoom;
        this._ovStartA        = this.angle;
        this.overrideX        = Number.isFinite(x)    ? x    : this.x;
        this.overrideY        = Number.isFinite(y)    ? y    : this.y;
        this.overrideZoom     = Number.isFinite(zoom) ? zoom : 1.0;
        this.overrideAngle    = 0;
        this.overrideDuration = Math.max(1, (duration || 120) | 0);
        this.overrideTimer    = 0;
        this.overrideEase     = ease || "smooth";
        this.overrideCallback = (typeof callback === "function") ? callback : null;
    },

    scareZoom(intensity) {
        this.scareZoomActive    = true;
        this.scareZoomTimer     = 30;
        this.scareZoomIntensity = intensity || 0.05;
    },

    panTo(x, y, zoom, holdMs, callback) {
        this.zoomTo(x, y, zoom || 1.2, 60, "smooth", () => {
            const ms = (Number.isFinite(holdMs) && holdMs > 0) ? holdMs : 2000;
            setTimeout(() => {
                this.overrideActive = false;
                if (typeof callback === "function") { try { callback(); } catch (_) {} }
            }, ms);
        });
    },

    pullBack(duration) {
        const origZoom = this.targetZoom;
        this.zoomTo(this.x, this.y, origZoom * 0.55, duration || 90, "easeOut", () => {
            this.targetZoom = origZoom;
        });
    },

    tilt(angle, duration) {
        this.overrideActive   = true;
        this._establishing    = false;
        this._ovStartX        = this.x;
        this._ovStartY        = this.y;
        this._ovStartZ        = this.zoom;
        this._ovStartA        = this.angle;
        this.overrideX        = this.x;
        this.overrideY        = this.y;
        this.overrideZoom     = this.zoom;
        this.overrideAngle    = angle || 0;
        this.overrideDuration = Math.max(1, (duration || 60) | 0);
        this.overrideTimer    = 0;
        this.overrideEase     = "smooth";
        this.overrideCallback = null;
    },

    followPoint(x, y, speed) {
        this._springX.speed = speed ? speed * 30 : 8;
        this._springY.speed = this._springX.speed;
        this.targetX = x || 0;
        this.targetY = y || 0;
    },

    reset() {
        this.overrideActive  = false;
        this._establishing   = false;
        this.scareZoomActive = false;
        this.targetAngle     = 0;
        this.vignettePulse   = 0;
        this._parallax       = { x1:0,y1:0, x2:0,y2:0, x3:0,y3:0 };
        this.tiltX = 0; this.tiltY = 0;
        this.depthScale      = 1.0;
        this._velocityZoom   = 0;
        this._contextualZoom = 0;
        this._dramaZoom      = 0;
        this._idleZoomIn     = 0;
        this._idleTime       = 0;
        this._springX.speed  = 8;
        this._springY.speed  = 8;
        this._springZoom.speed  = 3.5;
        this._springAngle.speed = 5;
        this._colorGrade = { r:0, g:0, b:0, a:0 };
    },
};


// ═════════════════════════════════════════════════════════════════
//  SET PIECE SYSTEM (fully preserved from v4.0)
// ═════════════════════════════════════════════════════════════════
const SetPieces = {
    active: null,
    cooldowns: {},

    _say(s, t) {
        try {
            if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show)
                SubtitleSystem.show(s, t, 240);
            else if (typeof showDialog === "function")
                showDialog(s, t);
        } catch (_) {}
    },
    _sound(k)   { try { if (typeof playSound    === "function") playSound(k);       } catch (_) {} },
    _shake(i,d) { try { if (typeof triggerShake === "function") triggerShake(i, d); } catch (_) {} },
    _xp(n)      { try { if (typeof giveXP       === "function") giveXP(n);          } catch (_) {} },
    _clue(i, t) { try { if (typeof addClue      === "function") addClue(i, t);      } catch (_) {} },

    PIECES: {

        entity_chase: {
            id: "entity_chase", triggerRoom: "basement",
            triggerCondition(g) { return g.loop>=3 && !g.permanentFlags.entityChaseComplete && g.loopTime>60 && Math.random()<0.15; },
            cooldown: 99999, duration: 600,
            phases: [
                { at:0, action(sp) { sp._say("NARRATOR","The ground SHAKES. Something massive is coming. RUN!"); sp._shake(15,60); sp._sound("scare"); Camera.scareZoom(0.08); }},
                { at:30, action(sp) { sp._say("AZATHIEL","Y O U   C A N N O T   H I D E"); const g=_cg(); if(g)g.sanity-=10; }},
                { at:60, update(el,sp) { const g=_cg(); if(!g)return; if(el%5===0){try{if(typeof emitTendril==="function")emitTendril(g.playerX+(Math.random()-0.5)*100,g.playerY+50,2);}catch(_){}} if(el%30===0)sp._shake(5,15); g.sanity=Math.max(0,g.sanity-0.05); g.playerY-=0.3; }},
            ],
            onComplete(sp) { sp._say("NARRATOR","The presence recedes. You survived."); const g=_cg(); if(g)g.permanentFlags.entityChaseComplete=true; sp._xp(60); Camera.reset(); sp._clue("entity_chase","The Entity tried to chase you."); },
        },

        victor_patrol: {
            id: "victor_patrol", triggerRoom: "upstairs_hall",
            triggerCondition(g) { return g.loop>=2 && !g.flags.victorPatrolDone && g.loopTime>90 && Math.random()<0.20; },
            cooldown:1200, duration:480, victorX:100, victorY:200, victorDir:1, detected:false,
            phases: [
                { at:0, action(sp,p) { sp._say("NARRATOR","Heavy footsteps. Victor's ghost patrols. Stay hidden!"); sp._sound("ghost"); p.victorX=100; p.victorY=200; p.victorDir=1; p.detected=false; }},
                { at:1, update(el,sp,p) {
                    const g=_cg(); if(!g)return; const d=_roomDim(g.currentRoom);
                    p.victorX+=p.victorDir*1.5; if(p.victorX>d.w-50)p.victorDir=-1; if(p.victorX<50)p.victorDir=1;
                    const dist=Math.hypot(g.playerX-p.victorX,g.playerY-p.victorY);
                    const atp=Math.atan2(g.playerY-p.victorY,g.playerX-p.victorX);
                    const vf=p.victorDir>0?0:Math.PI; let diff=Math.abs(atp-vf); if(diff>Math.PI)diff=Math.PI*2-diff;
                    if(dist<100&&diff<1.2&&!p.detected){p.detected=true; sp._say("VICTOR","THERE YOU ARE!"); sp._sound("scare"); Camera.scareZoom(0.1); g.sanity-=25; sp._shake(10,30); try{if(typeof emitSpirit==="function")emitSpirit(p.victorX,p.victorY,10,{r:150,g:30,b:30});}catch(_){}}
                }},
            ],
            onComplete(sp,p) { const g=_cg(); if(!g)return; g.flags.victorPatrolDone=true; sp._say("NARRATOR",p.detected?"Victor saw you but fades.":"Victor passes. He didn't see you."); if(!p.detected){sp._xp(40);sp._clue("stealth_victor","Avoided Victor's ghost.");} Camera.reset(); },
            draw(ctx,p) {
                if(!p)return; const t=_cinemaTick*0.02;
                ctx.save(); ctx.translate(p.victorX,p.victorY); ctx.globalAlpha=0.65;
                ctx.fillStyle="#402020"; ctx.beginPath(); ctx.ellipse(0,0,20,32,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle=`rgba(200,30,30,${(0.2+Math.sin(t)*0.1).toFixed(3)})`; ctx.beginPath(); ctx.arc(0,0,44,0,Math.PI*2); ctx.fill();
                ctx.fillStyle="#ff2020"; ctx.beginPath(); ctx.arc(-6,-10,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(6,-10,3,0,Math.PI*2); ctx.fill();
                ctx.globalAlpha=0.09; ctx.fillStyle="#ff4444"; const f=p.victorDir>0?0:Math.PI; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,110,f-1.2,f+1.2); ctx.closePath(); ctx.fill();
                ctx.restore();
            },
        },

        room_collapse: {
            id:"room_collapse", triggerRoom:"attic",
            triggerCondition(g){ return g.loop>=4 && !g.flags.atticCollapse && Math.random()<0.12; },
            cooldown:99999, duration:360, debris:[],
            phases: [
                { at:0, action(sp,p){ sp._say("⚠️ DANGER","The ceiling CRACKS! Get to the door!"); sp._sound("scare"); Camera.scareZoom(0.06); p.debris=[]; }},
                { at:1, update(el,sp,p){ const g=_cg(); if(!g)return; if(el%15===0){const dim=_roomDim(g.currentRoom); p.debris.push({x:50+Math.random()*(dim.w-100),y:20,vy:2+Math.random()*3,sz:8+Math.random()*15,r:Math.random()*Math.PI*2});} const dim=_roomDim(g.currentRoom); for(const db of p.debris){db.y+=db.vy;db.r+=0.05; if(Math.hypot(g.playerX-db.x,g.playerY-db.y)<db.sz+10){g.sanity=Math.max(0,g.sanity-8); if(typeof combat!=="undefined"&&combat)combat.playerHP=Math.max(0,(combat.playerHP||0)-10); sp._shake(8,10); db.y=dim.h+50;}} p.debris=p.debris.filter(db=>db.y<dim.h+40); if(el%20===0)sp._shake(3+el*0.02,15); Camera.targetAngle=Math.sin(el*0.05)*0.015; }},
            ],
            onComplete(sp){ sp._say("NARRATOR","The collapse subsides."); const g=_cg(); if(g)g.flags.atticCollapse=true; sp._xp(50); Camera.reset(); sp._clue("attic_collapse","The attic collapsed."); },
            draw(ctx,p){ if(!p||!p.debris)return; for(const d of p.debris){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.r);ctx.fillStyle="#1a1510";ctx.fillRect(-d.sz*0.5,-d.sz*0.5,d.sz,d.sz);ctx.strokeStyle="#2a2010";ctx.lineWidth=1;ctx.strokeRect(-d.sz*0.5,-d.sz*0.5,d.sz,d.sz);ctx.restore();} },
        },

        darkness_wave: {
            id:"darkness_wave", triggerRoom:null,
            triggerCondition(g){ return g.loop>=4 && g.loopTime>180 && !g.flags.darknessWave && Math.random()<0.08; },
            cooldown:99999, duration:300, darknessLevel:0,
            phases: [
                { at:0, action(sp){ sp._say("NARRATOR","Every light goes dark."); sp._sound("scare"); Camera.scareZoom(0.04); }},
                { at:1, update(el,sp,p){ const g=_cg(); if(!g)return; p.darknessLevel=Math.min(0.55,el*0.002); g.flashlightBattery=Math.max(5,(g.flashlightBattery||0)-0.1); if(el%60===0)sp._sound("whisper"); if(el%90===0){const s=["ghost","laugh","whisper","heartbeat"];sp._sound(s[Math.floor(Math.random()*s.length)]);} g.sanity=Math.max(0,g.sanity-0.03); }},
            ],
            onComplete(sp){ sp._say("NARRATOR","The lights return slowly."); const g=_cg(); if(g)g.flags.darknessWave=true; sp._xp(45); Camera.reset(); sp._clue("darkness_wave","Entity caused a blackout."); },
            drawOverlay(ctx,cw,ch,p){ if(!p||!p.darknessLevel)return; ctx.fillStyle=`rgba(0,0,0,${p.darknessLevel.toFixed(3)})`; ctx.fillRect(0,0,cw,ch); },
        },

        memory_echo: {
            id:"memory_echo", triggerRoom:"dining_room",
            triggerCondition(g){ return g.loop>=2 && !g.flags.memoryEcho && Math.random()<0.18; },
            cooldown:99999, duration:420, ghostFamily:[],
            phases: [
                { at:0, action(sp,p){ sp._say("NARRATOR","The room shimmers. October 30, 1923."); Camera.zoomTo(350,250,1.1,60,"smooth"); p.ghostFamily=[{x:200,y:240,name:"Victor",color:"#604040"},{x:300,y:260,name:"Eleanora",color:"#406080"},{x:400,y:240,name:"James",color:"#406050"},{x:450,y:260,name:"Mary",color:"#604060"}]; }},
                { at:120, action(sp){ sp._say("ELEANORA (MEMORY)","Children, eat your supper."); }},
                { at:180, action(sp){ sp._say("VICTOR (MEMORY)","Everything will be perfect. After tonight."); }},
                { at:240, action(sp){ sp._say("JAMES (MEMORY)","Daddy, why are you looking at us like that?"); Camera.scareZoom(0.04); }},
                { at:300, action(sp){ sp._say("NARRATOR","Victor stands. His eyes are black. The vision shatters."); sp._sound("scare"); Camera.scareZoom(0.1); const g=_cg(); if(g)g.sanity-=15; sp._shake(12,30); }},
            ],
            onComplete(sp){ const g=_cg(); if(g)g.flags.memoryEcho=true; sp._clue("last_supper","Witnessed the family's last supper."); sp._xp(50); Camera.reset(); },
            draw(ctx,p){ if(!p||!p.ghostFamily)return; const t=_cinemaTick*0.02; for(const gh of p.ghostFamily){ctx.save();ctx.globalAlpha=0.4+Math.sin(t+gh.x*0.01)*0.12;ctx.translate(gh.x,gh.y);ctx.fillStyle=gh.color;ctx.beginPath();ctx.ellipse(0,0,12,20,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(180,180,180,0.7)";ctx.font="8px 'Courier New',monospace";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText(gh.name,0,-25);ctx.restore();} },
        },

        time_freeze: {
            id:"time_freeze", triggerRoom:null,
            triggerCondition(g){ return g.loop>=5 && (g.maxLoopTime-g.loopTime)<30 && !g.flags.timeFracture && Math.random()<0.30; },
            cooldown:99999, duration:240,
            phases: [
                { at:0, action(sp){ sp._say("NARRATOR","Time STOPS. A gift from Eleanora."); const g=_cg(); if(g)Camera.zoomTo(g.playerX,g.playerY,1.15,30,"smooth"); }},
                { at:1, update(){ const g=_cg(); if(g)g.loopTime=Math.max(0,g.loopTime-1/60); }},
            ],
            onComplete(sp){ sp._say("NARRATOR","Time resumes."); const g=_cg(); if(g)g.flags.timeFracture=true; sp._xp(30); Camera.reset(); sp._clue("time_gift","Eleanora froze time for you."); },
        },

        mirror_walk: {
            id:"mirror_walk", triggerRoom:"mirror_gallery",
            triggerCondition(g){ return g.loop>=3 && !g.flags.mirrorWalk && Math.random()<0.22; },
            cooldown:99999, duration:300, reflections:[],
            phases: [
                { at:0, action(sp,p){ sp._say("NARRATOR","Your reflection moves independently."); Camera.tilt(0.03,90); p.reflections=Array.from({length:5},(_,i)=>({x:80+i*130,y:200+Math.sin(i)*20,phase:i*1.2})); }},
                { at:60, action(sp){ sp._say("ELEANORA","Don't trust what you see."); Camera.scareZoom(0.03); }},
                { at:180, action(sp){ sp._say("NARRATOR","One reflection raises a hand. You did not."); sp._shake(6,20); const g=_cg(); if(g)g.sanity-=12; }},
                { at:1, update(el,sp,p){ const g=_cg(); if(!g)return; for(const r of p.reflections){r.x+=(g.playerX-r.x)*0.04;r.y+=(g.playerY-r.y)*0.04;} if(el>180)g.sanity=Math.max(0,g.sanity-0.015); }},
            ],
            onComplete(sp){ sp._say("NARRATOR","The mirrors go dark."); const g=_cg(); if(g)g.flags.mirrorWalk=true; sp._xp(45); Camera.reset(); sp._clue("mirror_walk","Your reflection moved on its own."); },
            draw(ctx,p){ if(!p||!p.reflections)return; const t=_cinemaTick*0.025; for(const r of p.reflections){ctx.save();ctx.translate(r.x,r.y);ctx.globalAlpha=0.28+Math.sin(t+r.phase)*0.08;ctx.fillStyle="#aaccff";ctx.beginPath();ctx.ellipse(0,0,10,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(200,220,255,0.7)";ctx.beginPath();ctx.arc(-3,-7,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(3,-7,2,0,Math.PI*2);ctx.fill();ctx.restore();} },
        },
    },

    update() {
        const g = _cg();
        if (!g || _cgst() !== "playing") return;
        if (typeof dialogActive !== "undefined" && dialogActive) return;

        if (this.active) {
            const piece = this.PIECES[this.active.id];
            if (!piece) { this.active = null; return; }
            this.active.elapsed++;
            const elapsed = this.active.elapsed;
            for (const phase of piece.phases) {
                if (elapsed === phase.at && typeof phase.action === "function") { try { phase.action(this, piece); } catch (_) {} }
                if (typeof phase.update === "function" && elapsed > phase.at) { try { phase.update(elapsed-phase.at, this, piece); } catch (_) {} }
            }
            if (elapsed >= piece.duration) {
                if (typeof piece.onComplete === "function") { try { piece.onComplete(this, piece); } catch (_) {} }
                this.active = null;
            }
            return;
        }

        if (_cinemaTick % 60 !== 0) return;
        for (const id in this.PIECES) {
            const piece = this.PIECES[id];
            const coolTicks = (piece.cooldown || 600) * 60;
            if (this.cooldowns[id] != null && (_cinemaTick - this.cooldowns[id]) < coolTicks) continue;
            if (piece.triggerRoom && piece.triggerRoom !== g.currentRoom) continue;
            try { if (typeof piece.triggerCondition === "function" && piece.triggerCondition(g)) { this._start(id); break; } } catch (_) {}
        }
    },

    _start(id) { this.active = { id, elapsed: 0 }; this.cooldowns[id] = _cinemaTick; },

    draw(ctx) {
        if (!this.active) return;
        const p = this.PIECES[this.active.id];
        if (p && typeof p.draw === "function") { try { p.draw(ctx, p); } catch (_) {} }
    },

    drawOverlay(ctx, cw, ch) {
        if (!this.active) return;
        const p = this.PIECES[this.active.id];
        if (p && typeof p.drawOverlay === "function") { try { p.drawOverlay(ctx, cw, ch, p); } catch (_) {} }
    },

    reset() { this.active = null; },
};


// ═════════════════════════════════════════════════════════════════
//  DEATH MEMORIES (fully preserved from v4.0)
// ═════════════════════════════════════════════════════════════════
const DeathMemories = {
    ghosts: [], maxGhosts: 20,

    _CLUES: {
        sanity:  ["I lost my mind here. Keep your sanity high.", "The whispers got too loud.", "I stared too long at something."],
        combat:  ["Something attacked me here. Be ready.", "I wasn't strong enough. Level up.", "Dodge — they're fast."],
        time:    ["I ran out of time. Move faster.", "The clock struck midnight.", "Every second counts."],
        unknown: ["I died here. Be careful.", "Something went wrong.", "This place is dangerous."],
    },

    recordDeath(room, x, y, cause) {
        const g = _cg();
        const list = this._CLUES[cause] || this._CLUES.unknown;
        this.ghosts.push({
            room, x: x||0, y: y||0,
            loop: g ? (g.loop||0) : 0,
            cause: cause || "unknown",
            clue: list[Math.floor(Math.random()*list.length)],
            opacity: 0.4, bobPhase: Math.random()*Math.PI*2,
        });
        if (this.ghosts.length > this.maxGhosts) this.ghosts.shift();
    },

    draw(ctx, currentRoom) {
        const g = _cg();
        const px = g ? (g.playerX||0) : 0;
        const py = g ? (g.playerY||0) : 0;
        const t  = _cinemaTick * 0.015;

        for (const ghost of this.ghosts) {
            if (ghost.room !== currentRoom) continue;
            const bobY = Math.sin(t + ghost.bobPhase) * 5;
            ctx.save();
            ctx.translate(ghost.x, ghost.y + bobY);
            ctx.globalAlpha = ghost.opacity * (0.8 + Math.sin(t + ghost.bobPhase) * 0.2);

            ctx.fillStyle = "rgba(100,220,100,0.3)";
            ctx.beginPath(); ctx.ellipse(0, 0, 10, 17, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(80,200,80,0.1)";
            ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(150,255,150,0.6)";
            ctx.beginPath(); ctx.arc(-3, -6, 1.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc( 3, -6, 1.5, 0, Math.PI*2); ctx.fill();

            ctx.fillStyle = "rgba(100,220,100,0.45)";
            ctx.font = "8px 'Courier New',monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
            ctx.fillText(`Loop ${ghost.loop}`, 0, -22);

            const dist = Math.hypot(px - ghost.x, py - ghost.y);
            if (dist < 55) {
                ctx.font = "10px Georgia,serif"; ctx.textBaseline = "top";
                const words = ghost.clue.split(" ");
                const maxW = 130; const lines = []; let line = "";
                for (const w of words) {
                    const test = line ? `${line} ${w}` : w;
                    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
                    else line = test;
                }
                if (line) lines.push(line);
                const lineH = 13; let startY = -30 - lines.length * lineH;
                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.fillRect(-68, startY - lineH, 136, lines.length * lineH + lineH * 0.6);
                ctx.fillStyle = "rgba(120,240,120,0.85)";
                for (const ln of lines) { ctx.fillText(ln, 0, startY); startY += lineH; }
            }
            ctx.restore();
        }
    },

    getNearestGhost(px, py, room) {
        let near = null, nd = 42;
        for (const g of this.ghosts) {
            if (g.room !== room) continue;
            const d = Math.hypot(px-g.x, py-g.y);
            if (d < nd) { nd = d; near = g; }
        }
        return near;
    },

    interactWithGhost(ghost) {
        if (!ghost) return;
        try {
            const msg = `"${ghost.clue}" [Died in Loop #${ghost.loop+1}]`;
            if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show)
                SubtitleSystem.show("YOUR PAST SELF", msg, 300);
            else if (typeof showDialog === "function")
                showDialog("YOUR PAST SELF", msg);
        } catch (_) {}
        ghost.opacity *= 0.7;
        try { if (typeof giveXP === "function") giveXP(5); } catch (_) {}
    },

    reset() { /* death memories persist across loops */ },

    save() {
        return this.ghosts.map(({ room, x, y, loop, cause, clue }) =>
            ({ room, x, y, loop, cause, clue }));
    },

    load(d) {
        if (!Array.isArray(d)) return;
        this.ghosts = d.map(g => ({
            ...g, opacity: 0.4, bobPhase: Math.random() * Math.PI * 2,
        }));
    },
};


// ═════════════════════════════════════════════════════════════════
//  MASTER UPDATE
// ═════════════════════════════════════════════════════════════════
function updateCinema(playerX, playerY, roomId) {
    _cinemaTick++;
    try { Camera.update(playerX, playerY, roomId); } catch (_) {}
    try { SetPieces.update();                       } catch (_) {}
}