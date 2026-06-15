// ═════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Echoes of Midnight  v2.0
//  Full offline support with smart caching strategy:
//  • Core game files — pre-cached on install (play offline)
//  • Audio files    — cached on first play (too large to preload all)
//  • Dynamic assets — cache-on-fly with network fallback
//  Version bump forces full cache refresh for all players.
// ═════════════════════════════════════════════════════════════════

const CACHE_VERSION = "eom-v2";

// ── Separate cache buckets ───────────────────────────────────────
// Core = must be cached on install or game won't load
// Audio = cached lazily on first request (hundreds of MP3s)
// Dynamic = anything else fetched at runtime
const CACHE_CORE    = CACHE_VERSION + "-core";
const CACHE_AUDIO   = CACHE_VERSION + "-audio";
const CACHE_DYNAMIC = CACHE_VERSION + "-dynamic";

// ═════════════════════════════════════════════════════════════════
//  CORE FILES — pre-cached on install
//  Every file your game needs to boot and run.
//  If ANY file here fails to fetch, install fails — so only
//  list files that definitely exist on your server.
// ═════════════════════════════════════════════════════════════════
const CORE_FILES = [

    // ── Shell ────────────────────────────────────────────────────
    "/",
    "/index.html",
    "/manifest.json",

    // ── Icons (only list sizes you actually have) ────────────────
    "/icons/icon-192.png",
    "/icons/icon-512.png",

    // ── DATA ─────────────────────────────────────────────────────
    "/rooms.js",

    // ── AUDIO CORE ───────────────────────────────────────────────
    "/audio_engine.js",
    "/audio_manager.js",
    "/audio_triggers.js",

    // ── VISUAL / UI ──────────────────────────────────────────────
    "/subtitle_system.js",
    "/particles.js",
    "/cinema.js",

    // ── GAMEPLAY ─────────────────────────────────────────────────
    "/story_engine.js",
    "/combat.js",
    "/events.js",
    "/npcs.js",
    "/missions.js",
    "/achievements.js",

    // ── INTEGRATION / BALANCE ────────────────────────────────────
    "/audio_wiring.js",
    "/balance.js",

    // ── MAIN ─────────────────────────────────────────────────────
    "/game.js",

    // ── MOBILE ───────────────────────────────────────────────────
    "/mobile.js",
];


// ═════════════════════════════════════════════════════════════════
//  INSTALL
//  Pre-cache all core files. If even one fails, the entire
//  install fails — this guarantees the game is fully playable
//  offline or not cached at all (no half-broken states).
// ═════════════════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
    console.log("[SW] Installing:", CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_CORE)
            .then((cache) => cache.addAll(CORE_FILES))
            .then(() => {
                console.log("[SW] Core files cached ✓");
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error("[SW] Install failed — a core file is missing:", err);
                // Don't skip waiting — let old SW keep running
                // so the game doesn't break mid-session
            })
    );
});


// ═════════════════════════════════════════════════════════════════
//  ACTIVATE
//  Delete ALL old cache versions. This runs when the new SW
//  takes over from the old one.
// ═════════════════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating:", CACHE_VERSION);

    // All valid cache names for this version
    const keepCaches = new Set([CACHE_CORE, CACHE_AUDIO, CACHE_DYNAMIC]);

    event.waitUntil(
        caches.keys()
            .then((allKeys) => {
                return Promise.all(
                    allKeys
                        .filter((key) => !keepCaches.has(key))
                        .map((oldKey) => {
                            console.log("[SW] Deleting old cache:", oldKey);
                            return caches.delete(oldKey);
                        })
                );
            })
            .then(() => {
                console.log("[SW] Old caches cleared ✓");
                return self.clients.claim();
            })
    );
});


// ═════════════════════════════════════════════════════════════════
//  FETCH — Smart routing based on request type
//
//  Strategy:
//  ┌────────────────┬───────────────────────────────────────────┐
//  │ Request type   │ Strategy                                  │
//  ├────────────────┼───────────────────────────────────────────┤
//  │ Core JS/HTML   │ Cache-first → network fallback            │
//  │ Audio (MP3)    │ Cache-first → network → cache on success  │
//  │ Images         │ Cache-first → network → cache on success  │
//  │ Everything else│ Network-first → cache fallback            │
//  │ Cross-origin   │ Network only (never cache)                │
//  │ Non-GET        │ Pass through (never cache)                │
//  └────────────────┴───────────────────────────────────────────┘
// ═════════════════════════════════════════════════════════════════
self.addEventListener("fetch", (event) => {

    const req = event.request;

    // ── Skip non-GET ─────────────────────────────────────────────
    if (req.method !== "GET") return;

    // ── Skip cross-origin ────────────────────────────────────────
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    const path = url.pathname;

    // ── Route by file type ───────────────────────────────────────
    if (isAudioFile(path)) {
        event.respondWith(audioCacheFirst(req));
    } else if (isCoreFile(path)) {
        event.respondWith(coreCacheFirst(req));
    } else if (isImageFile(path)) {
        event.respondWith(dynamicCacheFirst(req));
    } else {
        event.respondWith(networkFirstFallback(req));
    }
});


// ═════════════════════════════════════════════════════════════════
//  FILE TYPE DETECTION
// ═════════════════════════════════════════════════════════════════
function isAudioFile(path) {
    return /\.(mp3|ogg|wav|m4a|aac|webm|flac)$/i.test(path) ||
           path.startsWith("/sounds/");
}

function isCoreFile(path) {
    return CORE_FILES.includes(path) ||
           path.endsWith(".js") ||
           path.endsWith(".html") ||
           path === "/manifest.json";
}

function isImageFile(path) {
    return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(path) ||
           path.startsWith("/icons/") ||
           path.startsWith("/screenshots/");
}


// ═════════════════════════════════════════════════════════════════
//  CACHE STRATEGIES
// ═════════════════════════════════════════════════════════════════

// ── Core files: cache-first, network fallback ────────────────────
// These were pre-cached on install. If somehow missing, fetch
// from network and re-cache for next time.
async function coreCacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
        const response = await fetch(req);
        if (response.ok) {
            const cache = await caches.open(CACHE_CORE);
            cache.put(req, response.clone());
        }
        return response;
    } catch (err) {
        console.error("[SW] Core fetch failed:", req.url, err);
        // Return a basic offline error for HTML requests
        if (req.headers.get("Accept")?.includes("text/html")) {
            return new Response(
                "<html><body style='background:#130f0f;color:#ccc;font-family:monospace;padding:40px;text-align:center'>" +
                "<h1>⏰ Echoes of Midnight</h1>" +
                "<p>You are offline and the game hasn't been cached yet.</p>" +
                "<p>Connect to the internet and reload to cache the game for offline play.</p>" +
                "</body></html>",
                { status: 503, headers: { "Content-Type": "text/html" } }
            );
        }
        return new Response("Offline", { status: 503 });
    }
}


// ── Audio files: cache-first, lazy cache on first play ───────────
// Audio files are large. We don't pre-cache them. Instead:
// 1. Check cache → return if found
// 2. Fetch from network → cache a copy → return
// 3. If network fails → return nothing (game handles missing audio)
async function audioCacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
        const response = await fetch(req);
        if (response.ok) {
            const cache = await caches.open(CACHE_AUDIO);
            cache.put(req, response.clone());
        }
        return response;
    } catch (err) {
        // Audio missing offline = silent. Game handles this gracefully
        // via AudioManager.failed set and synth fallbacks.
        return new Response("", { status: 408 });
    }
}


// ── Images: cache-first, lazy cache ──────────────────────────────
async function dynamicCacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
        const response = await fetch(req);
        if (response.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            cache.put(req, response.clone());
        }
        return response;
    } catch (err) {
        return new Response("", { status: 408 });
    }
}


// ── Everything else: network-first, cache fallback ───────────────
// For unknown file types: try network first (freshest data).
// If offline, fall back to cache. Cache successful responses.
async function networkFirstFallback(req) {
    try {
        const response = await fetch(req);
        if (response.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            cache.put(req, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response("Offline", { status: 503 });
    }
}


// ═════════════════════════════════════════════════════════════════
//  BACKGROUND AUDIO PRE-CACHE (optional)
//  When the player is idle on wifi, pre-cache priority audio
//  files so they don't stutter on first play.
//  Triggered by a message from the game: postMessage("precache-audio")
// ═════════════════════════════════════════════════════════════════
const PRIORITY_AUDIO = [
    "/sounds/music/menu_theme.mp3",
    "/sounds/music/foyer_piano.mp3",
    "/sounds/sfx/footstep_wood.mp3",
    "/sounds/sfx/door_open.mp3",
    "/sounds/sfx/item_pickup.mp3",
    "/sounds/sfx/clock_chime.mp3",
    "/sounds/sfx/time_reset.mp3",
    "/sounds/sfx/level_up.mp3",
    "/sounds/sfx/flashlight_click.mp3",
    "/sounds/voices/whisper_help.mp3",
    "/sounds/ambience/wind_inside.mp3",
    "/sounds/ambience/clock_ticking.mp3",
];

self.addEventListener("message", (event) => {
    if (event.data === "precache-audio") {
        console.log("[SW] Pre-caching priority audio...");
        caches.open(CACHE_AUDIO).then((cache) => {
            // Cache each file individually — don't fail-all if one is missing
            for (const url of PRIORITY_AUDIO) {
                fetch(url)
                    .then((res) => {
                        if (res.ok) cache.put(url, res);
                    })
                    .catch(() => {
                        // Missing audio file — not critical
                    });
            }
        });
    }

    if (event.data === "clear-audio-cache") {
        console.log("[SW] Clearing audio cache...");
        caches.delete(CACHE_AUDIO);
    }

    if (event.data === "get-cache-size") {
        getCacheSize().then((size) => {
            event.source.postMessage({
                type: "cache-size",
                bytes: size,
                human: formatBytes(size),
            });
        });
    }
});


// ═════════════════════════════════════════════════════════════════
//  CACHE SIZE REPORTING
//  Game can ask "how much space am I using?" for a settings screen.
// ═════════════════════════════════════════════════════════════════
async function getCacheSize() {
    let total = 0;
    const keys = await caches.keys();
    for (const key of keys) {
        if (!key.startsWith("eom-")) continue; // only our caches
        const cache    = await caches.open(key);
        const requests = await cache.keys();
        for (const req of requests) {
            const res = await cache.match(req);
            if (res) {
                const blob = await res.clone().blob();
                total += blob.size;
            }
        }
    }
    return total;
}

function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + " B";
    if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
}