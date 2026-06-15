// ═════════════════════════════════════════════════════════════════
//  PARTICLES.JS — Visual Effects Engine
//  Dust, fog, blood drips, footprints, weather, entity tendrils
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ─── CAPS ────────────────────────────────────────────────────────
const MAX_PARTICLES = 250;   // reduced from 300 — safer headroom
const MAX_FOOTPRINTS = 40;
const MAX_WEATHER = 150;     // reduced from 200

// ─── POOLS ───────────────────────────────────────────────────────
const particles      = [];
const footprints     = [];
const weatherParticles = [];   // kept for API compat — not used directly
let   currentWeather = [];

// ─── INTERNAL TICK ───────────────────────────────────────────────
// Own counter so we never depend on the global `frame` variable.
let _particleTick = 0;

// ═════════════════════════════════════════════════════════════════
//  SAFE HELPERS
// ═════════════════════════════════════════════════════════════════
function _safeGame()  { return (typeof game  !== "undefined" && game)  ? game  : null; }
function _safeRooms() { return (typeof ROOMS !== "undefined" && ROOMS) ? ROOMS : null; }

function _roomDim(roomId) {
    const R = _safeRooms();
    if (!R || !R[roomId]) return { width: 800, height: 600 };
    return {
        width:  R[roomId].width  || 800,
        height: R[roomId].height || 600,
    };
}

// Clamp a number, returning fallback if not finite
function _f(v, fallback) { return Number.isFinite(v) ? v : fallback; }

// ═════════════════════════════════════════════════════════════════
//  PARTICLE CLASS
// ═════════════════════════════════════════════════════════════════
class Particle {
    constructor(x, y, cfg) {
        cfg = cfg || {};

        this.x          = _f(x, 0);
        this.y          = _f(y, 0);
        this.vx         = _f(cfg.vx,  (Math.random() - 0.5) * 2);
        this.vy         = _f(cfg.vy,  (Math.random() - 0.5) * 2);
        this.life       = _f(cfg.life, 60);
        this.maxLife    = this.life;
        this.size       = Math.max(0.1, _f(cfg.size, 3));
        this.color      = cfg.color || { r: 200, g: 200, b: 200 };
        this.type       = cfg.type  || "dust";
        this.gravity    = _f(cfg.gravity,  0);
        this.friction   = _f(cfg.friction, 0.98);
        this.glow       = !!cfg.glow;
        this.oscillate  = !!cfg.oscillate;
        this.oscSpeed   = _f(cfg.oscSpeed, 0.05);
        this.oscAmp     = _f(cfg.oscAmp,   1);
        this.shrink     = cfg.shrink !== false;   // default true
        this.rotation   = Math.random() * Math.PI * 2;
        this.rotSpeed   = (Math.random() - 0.5) * 0.1;
        this.text       = cfg.text || "";

        // Pre-cache colour string components so draw() is cheap
        const { r, g, b } = this.color;
        this._rgb        = `${r|0},${g|0},${b|0}`;
    }

    update() {
        this.life--;
        this.vx = this.vx * this.friction;
        this.vy = this.vy * this.friction + this.gravity;

        if (this.oscillate) {
            this.vx += Math.sin(this.life * this.oscSpeed) * this.oscAmp * 0.1;
        }

        this.x        += this.vx;
        this.y        += this.vy;
        this.rotation += this.rotSpeed;
        return this.life > 0;
    }

    draw(ctx) {
        const ratio  = Math.max(0, this.life / this.maxLife);
        const alpha  = this.shrink ? ratio : Math.min(1, ratio * 2);
        const sz     = this.shrink ? this.size * ratio : this.size;
        if (alpha <= 0 || sz <= 0) return;

        const rgb = this._rgb;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = Math.min(1, alpha * 0.7);

        // Optional glow halo — only when size is big enough to matter
        if (this.glow && sz >= 1) {
            try {
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 3);
                grad.addColorStop(0, `rgba(${rgb},${alpha * 0.5})`);
                grad.addColorStop(1, `rgba(${rgb},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, sz * 3, 0, Math.PI * 2);
                ctx.fill();
            } catch (_) {}
        }

        ctx.fillStyle = `rgba(${rgb},${alpha})`;

        switch (this.type) {
            case "ember":
                ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
                break;

            case "blood":
                ctx.beginPath();
                ctx.arc(0, 0, sz, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(-sz * 0.3, 0, sz * 0.6, sz * 2);
                break;

            case "spirit":
                ctx.beginPath();
                ctx.ellipse(0, 0, sz * 0.6, sz, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case "spark": {
                ctx.beginPath();
                ctx.moveTo(0, -sz);
                ctx.lineTo(sz * 0.3, 0);
                ctx.lineTo(0,  sz);
                ctx.lineTo(-sz * 0.3, 0);
                ctx.closePath();
                ctx.fill();
                break;
            }

            case "tendril":
                ctx.strokeStyle = `rgba(${rgb},${alpha})`;
                ctx.lineWidth   = Math.max(0.5, sz * 0.5);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(
                    Math.sin(this.life * 0.1)  * 10, sz * 2,
                    Math.sin(this.life * 0.15) * 15, sz * 4
                );
                ctx.stroke();
                break;

            case "text":
                if (this.text) {
                    ctx.font        = `${Math.max(6, Math.floor(sz * 3))}px Georgia, serif`;
                    ctx.textAlign   = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(this.text, 0, 0);
                }
                break;

            // "dust", "fog", and default
            default:
                ctx.beginPath();
                ctx.arc(0, 0, sz, 0, Math.PI * 2);
                ctx.fill();
        }

        ctx.restore();   // restores globalAlpha, transform, etc.
    }
}

// ═════════════════════════════════════════════════════════════════
//  FOOTPRINT CLASS
// ═════════════════════════════════════════════════════════════════
class Footprint {
    constructor(x, y, angle, type) {
        this.x       = _f(x, 0);
        this.y       = _f(y, 0);
        this.angle   = _f(angle, 0);
        this.type    = type || "normal";
        this.life    = 300;
        this.maxLife = 300;
        this.side    = Math.random() > 0.5 ? 1 : -1;
    }

    update() {
        this.life--;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = (this.life / this.maxLife) * 0.3;
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.type === "bloody"
            ? "rgba(100,0,0,1)"
            : "rgba(40,35,30,1)";

        const offX = this.side * 4;
        ctx.beginPath();
        ctx.ellipse(offX, 0, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Three toes
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(offX + i * 2, -5, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ═════════════════════════════════════════════════════════════════
//  POOL-SAFE PUSH
//  Never exceeds MAX_PARTICLES; drops oldest if over cap.
// ═════════════════════════════════════════════════════════════════
function _pushParticle(p) {
    if (particles.length >= MAX_PARTICLES) {
        // Evict the oldest (index 0) — O(n) but rare
        particles.shift();
    }
    particles.push(p);
}

// ═════════════════════════════════════════════════════════════════
//  EMITTERS
// ═════════════════════════════════════════════════════════════════
function emitDust(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(
            x + (Math.random() - 0.5) * 20,
            y + (Math.random() - 0.5) * 20,
            {
                type:    "dust",
                vx:      (Math.random() - 0.5) * 0.5,
                vy:      -Math.random() * 0.3,
                life:    60 + Math.random() * 60,
                size:    1  + Math.random() * 2,
                color:   { r: 150, g: 140, b: 120 },
                gravity: -0.005,
            }
        ));
    }
}

function emitEmbers(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(
            x + (Math.random() - 0.5) * 30, y,
            {
                type:    "ember",
                vx:      (Math.random() - 0.5) * 2,
                vy:      -1 - Math.random() * 3,
                life:    40 + Math.random() * 40,
                size:    1  + Math.random() * 2,
                color:   { r: 255, g: 150 + Math.random() * 100, b: 30 },
                gravity: -0.02,
                glow:    true,
            }
        ));
    }
}

function emitBlood(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(x, y, {
            type:     "blood",
            vx:       (Math.random() - 0.5) * 3,
            vy:       Math.random() * 2 + 1,
            life:     80  + Math.random() * 40,
            size:     1   + Math.random() * 3,
            color:    { r: 120, g: 0, b: 0 },
            gravity:  0.05,
            friction: 0.95,
        }));
    }
}

function emitFog(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(
            x + (Math.random() - 0.5) * 80,
            y + (Math.random() - 0.5) * 80,
            {
                type:      "fog",
                vx:        (Math.random() - 0.5) * 0.3,
                vy:        (Math.random() - 0.5) * 0.2,
                life:      120 + Math.random() * 120,
                size:      8   + Math.random() * 15,
                color:     { r: 60, g: 60, b: 70 },
                shrink:    false,
                oscillate: true,
                oscSpeed:  0.02,
                oscAmp:    0.3,
            }
        ));
    }
}

function emitSpirit(x, y, count, color) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    const c = color || { r: 100, g: 150, b: 255 };
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(
            x + (Math.random() - 0.5) * 15,
            y + (Math.random() - 0.5) * 15,
            {
                type:      "spirit",
                vx:        (Math.random() - 0.5) * 1,
                vy:        -0.5 - Math.random() * 1.5,
                life:      50  + Math.random() * 50,
                size:      2   + Math.random() * 4,
                color:     c,
                glow:      true,
                oscillate: true,
                oscSpeed:  0.08,
                oscAmp:    2,
            }
        ));
    }
}

function emitTendril(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(
            x + (Math.random() - 0.5) * 20, y,
            {
                type:   "tendril",
                vx:     (Math.random() - 0.5) * 0.5,
                vy:     -0.3 - Math.random() * 0.5,
                life:   60  + Math.random() * 60,
                size:   3   + Math.random() * 5,
                color:  { r: 40, g: 0, b: 60 },
                shrink: false,
            }
        ));
    }
}

function emitSparks(x, y, count) {
    count = Math.min(count | 0, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        _pushParticle(new Particle(x, y, {
            type:     "spark",
            vx:       (Math.random() - 0.5) * 6,
            vy:       (Math.random() - 0.5) * 6,
            life:     15  + Math.random() * 20,
            size:     2   + Math.random() * 3,
            color:    { r: 255, g: 220, b: 100 },
            glow:     true,
            friction: 0.92,
        }));
    }
}

function emitLevelUpParticles(x, y) {
    const count = Math.min(30, MAX_PARTICLES - particles.length);
    for (let i = 0; i < count; i++) {
        const angle = (i / 30) * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        _pushParticle(new Particle(x, y, {
            type:     "spark",
            vx:       Math.cos(angle) * speed,
            vy:       Math.sin(angle) * speed,
            life:     30  + Math.random() * 30,
            size:     2   + Math.random() * 3,
            color:    { r: 255, g: 200 + Math.random() * 55, b: 50 },
            glow:     true,
            friction: 0.95,
        }));
    }
}

function emitScareText(x, y, text) {
    if (!text) return;
    const p = new Particle(x, y, {
        type:   "text",
        vx:     (Math.random() - 0.5) * 1,
        vy:     -0.5 - Math.random(),
        life:   80,
        size:   4 + Math.random() * 4,
        color:  { r: 150, g: 0, b: 0 },
        shrink: true,
        text:   text,
    });
    _pushParticle(p);
}

// ─── FOOTPRINTS ──────────────────────────────────────────────────
function addFootprint(x, y, angle, type) {
    if (footprints.length >= MAX_FOOTPRINTS) footprints.shift();
    footprints.push(new Footprint(x, y, angle, type));
}

// ═════════════════════════════════════════════════════════════════
//  WEATHER SYSTEM
// ═════════════════════════════════════════════════════════════════
class WeatherDrop {
    constructor(roomWidth, roomHeight, type) {
        this.type  = type;
        this.roomW = roomWidth  || 800;
        this.roomH = roomHeight || 600;
        // Initialise all fields to safe defaults first
        this.x      = 0; this.y = 0;
        this.speed  = 1; this.length = 0; this.wind = 0;
        this.size   = 1; this.wobble = 0;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.roomW;
        this.y = -10;

        if (this.type === "rain") {
            this.speed  = 4 + Math.random() * 4;
            this.length = 5 + Math.random() * 10;
            this.wind   = 1 + Math.random() * 2;
        } else if (this.type === "snow") {
            this.speed  = 0.5 + Math.random() * 1.5;
            this.wind   = (Math.random() - 0.5) * 0.5;
            this.size   = 1 + Math.random() * 3;
            this.wobble = Math.random() * Math.PI * 2;
        } else if (this.type === "ash") {
            this.speed  = 0.3 + Math.random() * 0.8;
            this.wind   = (Math.random() - 0.5) * 0.8;
            this.size   = 1 + Math.random() * 2;
            this.wobble = Math.random() * Math.PI * 2;
        }
        // "fog", "wind", "drip" — no special reset fields needed
    }

    update() {
        this.y += this.speed;
        this.x += this.wind;

        if (this.type === "snow" || this.type === "ash") {
            this.wobble += 0.05;
            this.x += Math.sin(this.wobble) * 0.3;
        }

        if (this.y > this.roomH + 10 ||
            this.x < -20 ||
            this.x > this.roomW + 20) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.type === "rain") {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "rgba(100,130,200,1)";
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.wind * 2, this.y + this.length);
            ctx.stroke();
        } else if (this.type === "snow") {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle   = "rgba(200,210,230,1)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "ash") {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle   = "rgba(80,70,60,1)";
            ctx.fillRect(
                this.x - this.size * 0.5,
                this.y - this.size * 0.5,
                this.size, this.size
            );
        }
        ctx.restore();
    }
}

// ─── ROOM CONFIGS ────────────────────────────────────────────────
const ROOM_WEATHER = {
    garden_path:    "fog",
    graveyard:      "fog",
    greenhouse:     "rain",
    well:           "rain",
    chapel:         "snow",
    bell_tower:     "wind",
    ritual_chamber: "ash",
    void_chamber:   "ash",
    catacombs:      "ash",
    basement:       "drip",
};

const ROOM_AMBIENT_PARTICLES = {
    foyer:            { type: "dust",    rate: 30 },
    library:          { type: "dust",    rate: 40 },
    dining_room:      { type: "dust",    rate: 50 },
    kitchen:          { type: "dust",    rate: 60 },
    basement:         { type: "fog",     rate: 20 },
    ritual_chamber:   { type: "tendril", rate: 15 },
    void_chamber:     { type: "tendril", rate:  8 },
    catacombs:        { type: "fog",     rate: 25 },
    underground_lake: { type: "fog",     rate: 15 },
    secret_room:      { type: "dust",    rate: 80 },
    attic:            { type: "dust",    rate: 30 },
    bell_tower:       { type: "spirit",  rate: 60 },
    chapel:           { type: "spirit",  rate: 40 },
    graveyard:        { type: "fog",     rate: 20 },
    garden_path:      { type: "fog",     rate: 25 },
    wine_cellar:      { type: "dust",    rate: 60 },
    nursery:          { type: "spirit",  rate: 50 },
};

// ─── WEATHER SETUP ───────────────────────────────────────────────
function setupWeatherForRoom(roomId) {
    currentWeather = [];

    const weatherType = ROOM_WEATHER[roomId];
    if (!weatherType) return;

    // Types that have no visible drops (handled elsewhere)
    if (weatherType === "wind" || weatherType === "drip") return;

    const dim = _roomDim(roomId);
    const count =
        weatherType === "fog"  ? Math.min(40,  MAX_WEATHER) :
        weatherType === "rain" ? Math.min(80,  MAX_WEATHER) :
        weatherType === "snow" ? Math.min(50,  MAX_WEATHER) :
        weatherType === "ash"  ? Math.min(30,  MAX_WEATHER) : 0;

    // fog → use "snow" drops with a blue-grey tint (they look right)
    const dropType = weatherType === "fog" ? "snow" : weatherType;

    for (let i = 0; i < count; i++) {
        const drop = new WeatherDrop(dim.width, dim.height, dropType);
        drop.y = Math.random() * dim.height;   // scatter vertically at start
        currentWeather.push(drop);
    }
}

// ═════════════════════════════════════════════════════════════════
//  AMBIENT PARTICLE EMITTER  (called from updateParticles)
//  Uses _particleTick, never the global `frame`.
// ═════════════════════════════════════════════════════════════════
const _SCARE_WORDS = ["HELP","RUN","BLOOD","LOOP","DEAD","TRAPPED"];

function _updateAmbient(g) {
    const ambient = ROOM_AMBIENT_PARTICLES[g.currentRoom];
    if (ambient && (_particleTick % ambient.rate === 0)) {
        const dim = _roomDim(g.currentRoom);
        const rx  = Math.random() * dim.width;
        const ry  = Math.random() * dim.height;
        switch (ambient.type) {
            case "dust":    emitDust(rx, ry, 1);    break;
            case "fog":     emitFog(rx, ry, 1);     break;
            case "tendril": emitTendril(rx, ry, 1); break;
            case "spirit":  emitSpirit(rx, ry, 1);  break;
        }
    }

    // Fireplace embers (library only)
    if (g.flags && g.flags.fireLit &&
        g.currentRoom === "library" &&
        _particleTick % 8 === 0) {
        emitEmbers(300, 50, 1);
    }

    // Void tendrils
    if (g.currentRoom === "void_chamber" && _particleTick % 5 === 0) {
        const dim = _roomDim("void_chamber");
        emitTendril(
            dim.width  * 0.5 + (Math.random() - 0.5) * 100,
            dim.height * 0.5 + (Math.random() - 0.5) * 100,
            1
        );
    }

    // Blood drips
    if ((g.currentRoom === "ritual_chamber" ||
         g.currentRoom === "basement") &&
        _particleTick % 90 === 0) {
        const dim = _roomDim(g.currentRoom);
        emitBlood(Math.random() * dim.width, 30, 1);
    }

    // Low-sanity scare text
    if ((g.sanity ?? 100) < 30 && _particleTick % 120 === 0) {
        emitScareText(
            (g.playerX ?? 400) + (Math.random() - 0.5) * 200,
            (g.playerY ?? 300) + (Math.random() - 0.5) * 200,
            _SCARE_WORDS[Math.floor(Math.random() * _SCARE_WORDS.length)]
        );
    }
}

// ═════════════════════════════════════════════════════════════════
//  UPDATE & DRAW  (called once per game-loop tick)
// ═════════════════════════════════════════════════════════════════
function updateParticles() {
    _particleTick++;

    // ── Particles ────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
        try {
            if (!particles[i].update()) particles.splice(i, 1);
        } catch (_) {
            particles.splice(i, 1);   // corrupt entry — remove silently
        }
    }

    // ── Footprints ───────────────────────────────────────────────
    for (let i = footprints.length - 1; i >= 0; i--) {
        try {
            if (!footprints[i].update()) footprints.splice(i, 1);
        } catch (_) {
            footprints.splice(i, 1);
        }
    }

    // ── Weather ──────────────────────────────────────────────────
    for (let i = 0; i < currentWeather.length; i++) {
        try { currentWeather[i].update(); } catch (_) {}
    }

    // ── Room ambient spawning ─────────────────────────────────────
    const g = _safeGame();
    if (g) {
        try { _updateAmbient(g); } catch (_) {}
    }
}

function drawParticles(ctx) {
    if (!ctx) return;

    // Footprints drawn first (on the floor)
    for (let i = 0; i < footprints.length; i++) {
        try { footprints[i].draw(ctx); } catch (_) {}
    }

    // Particles on top
    for (let i = 0; i < particles.length; i++) {
        try { particles[i].draw(ctx); } catch (_) {}
    }

    // Weather on top of everything
    for (let i = 0; i < currentWeather.length; i++) {
        try { currentWeather[i].draw(ctx); } catch (_) {}
    }
}

// ═════════════════════════════════════════════════════════════════
//  FOOTPRINT TRACKER
// ═════════════════════════════════════════════════════════════════
let _lastFootX = 0;
let _lastFootY = 0;

function trackFootprints(x, y, angle, moving) {
    if (!moving) return;
    x = _f(x, 0); y = _f(y, 0);

    const dist = Math.hypot(x - _lastFootX, y - _lastFootY);
    if (dist > 25) {
        const g      = _safeGame();
        const fpType = (g && g.currentRoom === "ritual_chamber") ? "bloody" : "normal";
        addFootprint(x, y, angle, fpType);
        _lastFootX = x;
        _lastFootY = y;
    }
}

// ═════════════════════════════════════════════════════════════════
//  SCREEN SHAKE
// ═════════════════════════════════════════════════════════════════
let _shakeIntensity = 0;
let _shakeDuration  = 0;

function triggerShake(intensity, duration) {
    // Allow stacking — take the stronger value
    _shakeIntensity = Math.max(_shakeIntensity, _f(intensity, 0));
    _shakeDuration  = Math.max(_shakeDuration,  _f(duration,  0) | 0);
}

function getShakeOffset() {
    if (_shakeDuration <= 0) return { x: 0, y: 0 };
    _shakeDuration--;
    const decay = Math.min(1, _shakeDuration / 30);
    return {
        x: (Math.random() - 0.5) * _shakeIntensity * decay,
        y: (Math.random() - 0.5) * _shakeIntensity * decay,
    };
}

// ─── LEGACY ALIASES (keep old call-sites working) ────────────────
// shakeIntensity / shakeDuration were previously global lets;
// expose them as getters so any code reading them still works.
Object.defineProperty(window, "shakeIntensity", {
    get: () => _shakeIntensity,
    set: v  => { _shakeIntensity = _f(v, 0); },
    configurable: true,
});
Object.defineProperty(window, "shakeDuration", {
    get: () => _shakeDuration,
    set: v  => { _shakeDuration = _f(v, 0) | 0; },
    configurable: true,
});
Object.defineProperty(window, "footprintCounter", {
    get: () => footprints.length,
    configurable: true,
});