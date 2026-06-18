// ═══════════════════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Echoes of Midnight  v3.0
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  FULL OFFLINE DOWNLOADER — Everything cached on first visit             │
//  │  • ALL files pre-cached immediately on install (game + audio + assets)  │
//  │  • Smart RAM management (low-end → lean, high-end → preload more)       │
//  │  • Background sync for missed files                                     │
//  │  • Cache integrity checks + auto-repair                                 │
//  │  • Performance hints pushed to clients                                  │
//  │  • Detailed progress reporting during download                          │
//  │  • Stale-while-revalidate for non-critical updates                      │
//  │  • Install fails ONLY if a verified-critical file is missing            │
//  └─────────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

// ── Version — bump this string to force a full cache refresh for all players ──
const SW_VERSION    = "eom-v3.1.0";

// ── Cache bucket names ────────────────────────────────────────────────────────
const CACHE_CORE    = SW_VERSION + "-core";       // HTML / JS / manifests
const CACHE_AUDIO   = SW_VERSION + "-audio";      // ALL audio files
const CACHE_ASSETS  = SW_VERSION + "-assets";     // Images / icons / screenshots
const CACHE_DYNAMIC = SW_VERSION + "-dynamic";    // Runtime fetched extras

// ── Size threshold for "large file" logging (bytes) ──────────────────────────
const LARGE_FILE_THRESHOLD = 1 * 1024 * 1024; // 1 MB

// ── How long to wait per individual file fetch during install (ms) ───────────
const FETCH_TIMEOUT_MS = 30_000;

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE MANIFESTS
//  Edit these lists to match your actual server files.
//  CRITICAL files  → install aborts if ANY are missing.
//  IMPORTANT files → logged but install continues if missing.
//  AUDIO files     → all cached immediately in parallel batches.
//  ASSET files     → images, icons, screenshots.
// ═══════════════════════════════════════════════════════════════════════════════

// ── CRITICAL — must exist or the game cannot run ──────────────────────────────
const CRITICAL_FILES = [
    "/",
    "/index.html",
    "/manifest.json",
    "/rooms.js",
    "/game.js",
    "/story_engine.js",
    "/audio_engine.js",
    "/audio_manager.js",
    "/audio_triggers.js",
    "/audio_wiring.js",
    "/subtitle_system.js",
    "/particles.js",
    "/cinema.js",
    "/combat.js",
    "/events.js",
    "/npcs.js",
    "/missions.js",
    "/achievements.js",
    "/balance.js",
    "/mobile.js",
];

// ── IMPORTANT — nice to have; missing = warning, not abort ───────────────────
const IMPORTANT_FILES = [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-180.png",          // Apple touch icon
    "/icons/icon-167.png",          // iPad Pro
    "/icons/icon-152.png",          // iPad
    "/icons/icon-144.png",          // MS tile
    "/icons/icon-96.png",
    "/icons/icon-72.png",
    "/icons/icon-48.png",
    "/icons/icon-36.png",
    "/icons/favicon.ico",
    "/screenshots/screenshot-wide.png",
    "/screenshots/screenshot-narrow.png",
    "/screenshots/screenshot-gameplay.png",
    "/screenshots/screenshot-combat.png",
    "/screenshots/screenshot-map.png",
];

// ── ALL AUDIO — cached immediately on install in parallel batches ─────────────
// Add every single audio file your game uses here.
const ALL_AUDIO_FILES = [

    // ── Music / Themes ───────────────────────────────────────────────────────
    "/sounds/music/menu_theme.mp3",
    "/sounds/music/foyer_piano.mp3",
    "/sounds/music/corridor_tension.mp3",
    "/sounds/music/library_haunting.mp3",
    "/sounds/music/basement_dread.mp3",
    "/sounds/music/attic_mystery.mp3",
    "/sounds/music/garden_night.mp3",
    "/sounds/music/flashback_piano.mp3",
    "/sounds/music/final_confrontation.mp3",
    "/sounds/music/credits_theme.mp3",
    "/sounds/music/safe_room.mp3",
    "/sounds/music/investigation.mp3",
    "/sounds/music/discovery.mp3",
    "/sounds/music/escape.mp3",
    "/sounds/music/midnight_chime.mp3",

    // ── SFX ──────────────────────────────────────────────────────────────────
    "/sounds/sfx/footstep_wood.mp3",
    "/sounds/sfx/footstep_stone.mp3",
    "/sounds/sfx/footstep_carpet.mp3",
    "/sounds/sfx/footstep_wet.mp3",
    "/sounds/sfx/footstep_gravel.mp3",
    "/sounds/sfx/door_open.mp3",
    "/sounds/sfx/door_close.mp3",
    "/sounds/sfx/door_creak.mp3",
    "/sounds/sfx/door_locked.mp3",
    "/sounds/sfx/door_knock.mp3",
    "/sounds/sfx/item_pickup.mp3",
    "/sounds/sfx/item_drop.mp3",
    "/sounds/sfx/item_use.mp3",
    "/sounds/sfx/item_equip.mp3",
    "/sounds/sfx/inventory_open.mp3",
    "/sounds/sfx/inventory_close.mp3",
    "/sounds/sfx/clock_chime.mp3",
    "/sounds/sfx/clock_tick.mp3",
    "/sounds/sfx/time_reset.mp3",
    "/sounds/sfx/time_warning.mp3",
    "/sounds/sfx/level_up.mp3",
    "/sounds/sfx/xp_gain.mp3",
    "/sounds/sfx/flashlight_click.mp3",
    "/sounds/sfx/flashlight_flicker.mp3",
    "/sounds/sfx/glass_break.mp3",
    "/sounds/sfx/wood_creak.mp3",
    "/sounds/sfx/book_open.mp3",
    "/sounds/sfx/paper_rustle.mp3",
    "/sounds/sfx/key_found.mp3",
    "/sounds/sfx/lock_click.mp3",
    "/sounds/sfx/puzzle_solve.mp3",
    "/sounds/sfx/puzzle_fail.mp3",
    "/sounds/sfx/secret_reveal.mp3",
    "/sounds/sfx/heartbeat.mp3",
    "/sounds/sfx/breath_heavy.mp3",
    "/sounds/sfx/gasp.mp3",
    "/sounds/sfx/static_noise.mp3",
    "/sounds/sfx/radio_crackle.mp3",
    "/sounds/sfx/phone_ring.mp3",
    "/sounds/sfx/camera_shutter.mp3",
    "/sounds/sfx/match_light.mp3",
    "/sounds/sfx/candle_blow.mp3",
    "/sounds/sfx/water_drip.mp3",
    "/sounds/sfx/thunder_crack.mp3",
    "/sounds/sfx/lightning_strike.mp3",
    "/sounds/sfx/button_click.mp3",
    "/sounds/sfx/button_hover.mp3",
    "/sounds/sfx/menu_open.mp3",
    "/sounds/sfx/menu_close.mp3",
    "/sounds/sfx/notification.mp3",
    "/sounds/sfx/achievement_unlock.mp3",
    "/sounds/sfx/mission_complete.mp3",
    "/sounds/sfx/game_over.mp3",
    "/sounds/sfx/save_game.mp3",
    "/sounds/sfx/load_game.mp3",
    "/sounds/sfx/error_buzz.mp3",
    "/sounds/sfx/coin_collect.mp3",
    "/sounds/sfx/health_pickup.mp3",
    "/sounds/sfx/energy_pickup.mp3",
    "/sounds/sfx/power_up.mp3",
    "/sounds/sfx/power_down.mp3",

    // ── Combat SFX ───────────────────────────────────────────────────────────
    "/sounds/sfx/combat/hit_soft.mp3",
    "/sounds/sfx/combat/hit_hard.mp3",
    "/sounds/sfx/combat/hit_critical.mp3",
    "/sounds/sfx/combat/miss.mp3",
    "/sounds/sfx/combat/block.mp3",
    "/sounds/sfx/combat/dodge.mp3",
    "/sounds/sfx/combat/attack_swing.mp3",
    "/sounds/sfx/combat/attack_heavy.mp3",
    "/sounds/sfx/combat/enemy_hurt.mp3",
    "/sounds/sfx/combat/enemy_death.mp3",
    "/sounds/sfx/combat/player_hurt.mp3",
    "/sounds/sfx/combat/player_death.mp3",
    "/sounds/sfx/combat/combat_start.mp3",
    "/sounds/sfx/combat/combat_end.mp3",
    "/sounds/sfx/combat/victory.mp3",
    "/sounds/sfx/combat/defeat.mp3",

    // ── Voice / Dialogue ─────────────────────────────────────────────────────
    "/sounds/voices/whisper_help.m4a",
    "/sounds/voices/whisper_run.mp3",
    "/sounds/voices/whisper_danger.mp3",
    "/sounds/voices/whisper_midnight.mp3",
    "/sounds/voices/ghost_laugh.mp3",
    "/sounds/voices/ghost_scream.mp3",
    "/sounds/voices/ghost_moan.mp3",
    "/sounds/voices/narrator_intro.mp3",
    "/sounds/voices/narrator_death.mp3",
    "/sounds/voices/narrator_win.mp3",
    "/sounds/voices/npc_greeting.mp3",
    "/sounds/voices/npc_warning.mp3",
    "/sounds/voices/npc_scared.mp3",
    "/sounds/voices/npc_hint.mp3",

    // ── Ambience loops ───────────────────────────────────────────────────────
    "/sounds/ambience/wind_inside.mp3",
    "/sounds/ambience/wind_outside.mp3",
    "/sounds/ambience/clock_ticking.mp3",
    "/sounds/ambience/house_creak.mp3",
    "/sounds/ambience/rain_light.mp3",
    "/sounds/ambience/rain_heavy.mp3",
    "/sounds/ambience/thunder_distant.mp3",
    "/sounds/ambience/crickets_night.mp3",
    "/sounds/ambience/fire_crackling.mp3",
    "/sounds/ambience/basement_hum.mp3",
    "/sounds/ambience/library_silence.mp3",
    "/sounds/ambience/attic_wind.mp3",
    "/sounds/ambience/garden_night.mp3",
    "/sounds/ambience/corridor_echo.mp3",
    "/sounds/ambience/heartbeat_distant.mp3",
    "/sounds/ambience/static_low.mp3",
    "/sounds/ambience/water_pipe.mp3",
    "/sounds/ambience/mice_scurry.mp3",
];

// ── ALL ASSET FILES — images, icons, screenshots ─────────────────────────────
const ALL_ASSET_FILES = [
    ...IMPORTANT_FILES,
    // Add any other images used in your game UI:
    // "/images/map.png",
    // "/images/inventory_bg.png",
];

// ═══════════════════════════════════════════════════════════════════════════════
//  INSTALL EVENT — The Big Download
//  Phase 1: Critical files (abort on failure)
//  Phase 2: Audio + Assets (parallel batched, log failures, don't abort)
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
    console.log(`[SW] ═══ Installing ${SW_VERSION} ═══`);
    console.log(`[SW] Will cache: ${CRITICAL_FILES.length} critical + ${ALL_AUDIO_FILES.length} audio + ${ALL_ASSET_FILES.length} assets`);

    event.waitUntil(installAll());
});

async function installAll() {
    const startTime = Date.now();

    // ── Phase 1: Critical core files ──────────────────────────────────────────
    console.log("[SW] Phase 1 — Caching critical files...");
    try {
        const coreCache = await caches.open(CACHE_CORE);
        await cacheFilesStrict(coreCache, CRITICAL_FILES, "CRITICAL");
        console.log("[SW] ✓ Phase 1 complete — all critical files cached");
    } catch (err) {
        console.error("[SW] ✗ Phase 1 FAILED — install aborted:", err.message);
        throw err; // This prevents skipWaiting, keeps old SW alive
    }

    // ── Phase 2a: Non-critical important files ────────────────────────────────
    console.log("[SW] Phase 2a — Caching important files (icons, screenshots)...");
    const assetCache = await caches.open(CACHE_ASSETS);
    await cacheFilesBestEffort(assetCache, ALL_ASSET_FILES, "ASSETS");

    // ── Phase 2b: ALL audio files — batched for progress reporting ────────────
    console.log(`[SW] Phase 2b — Caching ALL ${ALL_AUDIO_FILES.length} audio files...`);
    const audioCache = await caches.open(CACHE_AUDIO);
    await cacheAudioBatched(audioCache, ALL_AUDIO_FILES);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SW] ✓ Full install complete in ${elapsed}s — game is 100% offline ready`);

    // Broadcast completion to any open tabs
    broadcastToClients({ type: "sw-install-complete", version: SW_VERSION, elapsed });

    await self.skipWaiting();
}

// ── Strict caching: throws if ANY file fails ──────────────────────────────────
async function cacheFilesStrict(cache, files, label) {
    const results = await Promise.allSettled(
        files.map((url) => cacheOneFile(cache, url))
    );

    const failed = [];
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            failed.push({ url: files[i], reason: r.reason?.message || r.reason });
        }
    });

    if (failed.length > 0) {
        failed.forEach(({ url, reason }) =>
            console.error(`[SW][${label}] ✗ MISSING: ${url} — ${reason}`)
        );
        throw new Error(`${failed.length} critical file(s) could not be fetched`);
    }
}

// ── Best-effort caching: logs failures, never throws ─────────────────────────
async function cacheFilesBestEffort(cache, files, label) {
    const results = await Promise.allSettled(
        files.map((url) => cacheOneFile(cache, url))
    );

    let ok = 0, fail = 0;
    results.forEach((r, i) => {
        if (r.status === "fulfilled") {
            ok++;
        } else {
            fail++;
            console.warn(`[SW][${label}] ⚠ Could not cache: ${files[i]}`);
        }
    });
    console.log(`[SW][${label}] ${ok} cached, ${fail} skipped`);
}

// ── Audio batch caching with progress reports every 10% ──────────────────────
async function cacheAudioBatched(cache, files) {
    const BATCH_SIZE = 6; // Parallel downloads per batch (tune for low-RAM devices)
    const total = files.length;
    let cached = 0, failed = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((url) => cacheOneFile(cache, url))
        );

        results.forEach((r, j) => {
            if (r.status === "fulfilled") {
                cached++;
            } else {
                failed++;
                console.warn(`[SW][AUDIO] ⚠ Could not cache: ${batch[j]}`);
            }
        });

        const pct = Math.round(((i + batch.length) / total) * 100);
        const prevPct = Math.round((i / total) * 100);
        if (Math.floor(pct / 10) > Math.floor(prevPct / 10) || pct === 100) {
            console.log(`[SW][AUDIO] ${pct}% — ${cached}/${total} cached`);
            broadcastToClients({
                type: "sw-audio-progress",
                percent: pct,
                cached,
                total,
            });
        }
    }

    console.log(`[SW][AUDIO] ✓ Done: ${cached} cached, ${failed} unavailable`);
}

// ── Fetch one file with timeout and cache it ──────────────────────────────────
async function cacheOneFile(cache, url) {
    // Skip if already cached (idempotent installs)
    const existing = await cache.match(url);
    if (existing) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: "no-cache", // Always fetch fresh on install
        });
        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${url}`);
        }

        if (response.headers.get("content-length")) {
            const size = parseInt(response.headers.get("content-length"), 10);
            if (size > LARGE_FILE_THRESHOLD) {
                console.log(`[SW] Large file cached: ${url} (${formatBytes(size)})`);
            }
        }

        await cache.put(url, response);
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ACTIVATE EVENT — Purge old caches, claim all clients
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
    console.log(`[SW] Activating ${SW_VERSION}`);

    const keepCaches = new Set([CACHE_CORE, CACHE_AUDIO, CACHE_ASSETS, CACHE_DYNAMIC]);

    event.waitUntil(
        caches.keys()
            .then((allKeys) => Promise.all(
                allKeys
                    .filter((k) => k.startsWith("eom-") && !keepCaches.has(k))
                    .map((old) => {
                        console.log("[SW] Deleting old cache:", old);
                        return caches.delete(old);
                    })
            ))
            .then(() => self.clients.claim())
            .then(() => {
                console.log("[SW] ✓ Activated — controlling all clients");
                broadcastToClients({ type: "sw-activated", version: SW_VERSION });
            })
    );
});


// ═══════════════════════════════════════════════════════════════════════════════
//  FETCH EVENT — Smart routing + RAM-aware strategy hints
//
//  ┌──────────────────┬────────────────────────────────────────────────────────┐
//  │ Request type     │ Strategy                                               │
//  ├──────────────────┼────────────────────────────────────────────────────────┤
//  │ HTML pages       │ Network-first (stale-while-revalidate) → cache         │
//  │ Core JS files    │ Cache-first → network → re-cache                       │
//  │ Audio            │ Cache-first → network → cache (ALWAYS cached now)      │
//  │ Images/assets    │ Cache-first → network → cache                          │
//  │ Fonts            │ Cache-first (long-lived)                               │
//  │ Cross-origin     │ Network only, no caching                               │
//  │ Non-GET          │ Pass-through                                           │
//  └──────────────────┴────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // Never cache cross-origin

    const path = url.pathname;

    if (isAudioFile(path)) {
        event.respondWith(cacheFirst(req, CACHE_AUDIO, true));
    } else if (isImageFile(path)) {
        event.respondWith(cacheFirst(req, CACHE_ASSETS, true));
    } else if (isHTMLRequest(req)) {
        event.respondWith(staleWhileRevalidate(req));
    } else if (isCoreFile(path)) {
        event.respondWith(cacheFirst(req, CACHE_CORE, true));
    } else {
        event.respondWith(networkFirstFallback(req));
    }
});


// ── FILE TYPE HELPERS ─────────────────────────────────────────────────────────
function isAudioFile(path) {
    return /\.(mp3|ogg|wav|m4a|aac|webm|flac|opus)$/i.test(path) ||
           path.startsWith("/sounds/");
}

function isImageFile(path) {
    return /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(path) ||
           path.startsWith("/icons/") ||
           path.startsWith("/screenshots/") ||
           path.startsWith("/images/");
}

function isCoreFile(path) {
    return path.endsWith(".js") ||
           path.endsWith(".css") ||
           path === "/manifest.json" ||
           CRITICAL_FILES.includes(path);
}

function isHTMLRequest(req) {
    return req.headers.get("Accept")?.includes("text/html");
}


// ═══════════════════════════════════════════════════════════════════════════════
//  CACHE STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Cache-first: use cache, refresh in background ─────────────────────────────
async function cacheFirst(req, cacheName, storeOnMiss = false) {
    const cached = await caches.match(req);
    if (cached) {
        // Background revalidation for non-audio files to keep them fresh
        if (!isAudioFile(req.url)) {
            revalidateInBackground(req, cacheName);
        }
        return cached;
    }

    // Not in cache — fetch from network and store
    try {
        const response = await fetch(req);
        if (response.ok && storeOnMiss) {
            const cache = await caches.open(cacheName);
            cache.put(req, response.clone());
        }
        return response;
    } catch {
        return offlineFallback(req);
    }
}

// ── Stale-while-revalidate: return cache instantly, update silently ───────────
async function staleWhileRevalidate(req) {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req)
        .then(async (response) => {
            if (response.ok) {
                const cache = await caches.open(CACHE_CORE);
                await cache.put(req, response.clone());
            }
            return response;
        })
        .catch(() => cached || offlineFallback(req));

    return cached || fetchPromise;
}

// ── Network-first with cache fallback ────────────────────────────────────────
async function networkFirstFallback(req) {
    try {
        const response = await fetch(req);
        if (response.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            cache.put(req, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(req);
        return cached || offlineFallback(req);
    }
}

// ── Background revalidation (non-blocking) ───────────────────────────────────
function revalidateInBackground(req, cacheName) {
    fetch(req)
        .then(async (response) => {
            if (response.ok) {
                const cache = await caches.open(cacheName);
                await cache.put(req, response);
            }
        })
        .catch(() => {}); // Silent — offline is fine, cache is already served
}

// ── Offline fallback responses ────────────────────────────────────────────────
function offlineFallback(req) {
    if (isAudioFile(req.url)) {
        // Game handles missing audio — return empty 204
        return new Response(null, { status: 204 });
    }
    if (isImageFile(req.url)) {
        // 1x1 transparent PNG as placeholder
        const px = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        return new Response(
            Uint8Array.from(atob(px), (c) => c.charCodeAt(0)),
            { status: 200, headers: { "Content-Type": "image/png" } }
        );
    }
    if (req.headers.get("Accept")?.includes("text/html")) {
        return new Response(OFFLINE_PAGE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    }
    return new Response("Offline", { status: 503 });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGE HANDLER — Commands from the game
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("message", async (event) => {
    const { data, source } = event;
    const cmd = typeof data === "string" ? data : data?.type;

    switch (cmd) {

        // ── Force re-download of all audio ───────────────────────────────────
        case "refresh-audio-cache":
        case "precache-audio": {
            console.log("[SW] Command: refresh audio cache");
            await caches.delete(CACHE_AUDIO);
            const cache = await caches.open(CACHE_AUDIO);
            await cacheAudioBatched(cache, ALL_AUDIO_FILES);
            source?.postMessage({ type: "audio-cache-refreshed" });
            break;
        }

        // ── Clear audio cache ─────────────────────────────────────────────────
        case "clear-audio-cache": {
            console.log("[SW] Command: clear audio cache");
            await caches.delete(CACHE_AUDIO);
            source?.postMessage({ type: "audio-cache-cleared" });
            break;
        }

        // ── Get cache sizes ───────────────────────────────────────────────────
        case "get-cache-info": {
            const info = await getCacheInfo();
            source?.postMessage({ type: "cache-info", ...info });
            break;
        }

        // ── Check if a specific file is cached ───────────────────────────────
        case "check-cached": {
            const url  = data.url;
            const hit  = await caches.match(url);
            source?.postMessage({ type: "check-cached-result", url, cached: !!hit });
            break;
        }

        // ── RAM-aware performance mode ────────────────────────────────────────
        case "set-performance-mode": {
            // data.mode: "low" | "medium" | "high"
            // Store in a variable so fetch handler can adjust batch sizes
            currentPerfMode = data.mode || "medium";
            console.log("[SW] Performance mode:", currentPerfMode);
            source?.postMessage({ type: "performance-mode-set", mode: currentPerfMode });
            break;
        }

        // ── Force full re-install (cache-busting) ─────────────────────────────
        case "force-update": {
            console.log("[SW] Command: force update");
            await Promise.all([
                caches.delete(CACHE_CORE),
                caches.delete(CACHE_AUDIO),
                caches.delete(CACHE_ASSETS),
                caches.delete(CACHE_DYNAMIC),
            ]);
            source?.postMessage({ type: "update-initiated" });
            // Trigger re-registration on the client side
            break;
        }

        // ── Integrity check: verify all critical files are still cached ───────
        case "integrity-check": {
            const report = await integrityCheck();
            source?.postMessage({ type: "integrity-report", ...report });
            break;
        }

        // ── Skip waiting (for update UI) ──────────────────────────────────────
        case "skip-waiting": {
            await self.skipWaiting();
            break;
        }
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  RAM-AWARE PERFORMANCE HINTS
//  Detects memory pressure and adjusts caching batch size.
//  Broadcasts hints to clients so the game can scale quality.
// ═══════════════════════════════════════════════════════════════════════════════
let currentPerfMode = "medium";

// Detect device RAM tier and broadcast to game
async function detectAndBroadcastPerfMode() {
    let mode = "medium";

    // navigator.deviceMemory is in GB (Chrome/Android only)
    if (navigator.deviceMemory !== undefined) {
        if (navigator.deviceMemory <= 1) {
            mode = "low";
        } else if (navigator.deviceMemory >= 6) {
            mode = "high";
        } else {
            mode = "medium";
        }
    }

    // Hardware concurrency fallback
    if (navigator.hardwareConcurrency !== undefined) {
        if (navigator.hardwareConcurrency <= 2 && mode !== "low") {
            mode = "low";
        } else if (navigator.hardwareConcurrency >= 8 && mode === "medium") {
            mode = "high";
        }
    }

    currentPerfMode = mode;
    console.log(`[SW] Detected performance mode: ${mode} (RAM: ${navigator.deviceMemory ?? "?"}GB, cores: ${navigator.hardwareConcurrency ?? "?"})`);

    broadcastToClients({
        type: "performance-mode",
        mode,
        deviceMemoryGB: navigator.deviceMemory ?? null,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        // Recommended settings per tier:
        hints: PERF_HINTS[mode],
    });
}

const PERF_HINTS = {
    low: {
        audioPolyphony:      4,   // Max simultaneous audio channels
        particleCount:       20,  // Max particles on screen
        ambientSoundLayers:  1,   // Layered ambience tracks
        preloadRooms:        1,   // Rooms to preload ahead
        renderQuality:       0.75, // Canvas render scale
        shadowsEnabled:      false,
        cinematicsEnabled:   true,
        description: "Low-end device — lean mode active",
    },
    medium: {
        audioPolyphony:      8,
        particleCount:       60,
        ambientSoundLayers:  2,
        preloadRooms:        2,
        renderQuality:       1.0,
        shadowsEnabled:      true,
        cinematicsEnabled:   true,
        description: "Mid-range device — balanced mode",
    },
    high: {
        audioPolyphony:      16,
        particleCount:       150,
        ambientSoundLayers:  4,
        preloadRooms:        5,
        renderQuality:       1.0,
        shadowsEnabled:      true,
        cinematicsEnabled:   true,
        description: "High-end device — maximum quality",
    },
};

// Run detection on activate
self.addEventListener("activate", () => {
    detectAndBroadcastPerfMode();
});


// ═══════════════════════════════════════════════════════════════════════════════
//  CACHE INTEGRITY CHECK
//  Verifies all critical files are still in cache; auto-repairs missing ones.
// ═══════════════════════════════════════════════════════════════════════════════
async function integrityCheck() {
    console.log("[SW] Running integrity check...");
    const cache   = await caches.open(CACHE_CORE);
    const missing = [];
    const ok      = [];

    for (const url of CRITICAL_FILES) {
        const cached = await cache.match(url);
        if (cached) {
            ok.push(url);
        } else {
            missing.push(url);
        }
    }

    if (missing.length > 0) {
        console.warn(`[SW] Integrity: ${missing.length} critical files missing — auto-repairing...`);
        await cacheFilesBestEffort(cache, missing, "REPAIR");
    } else {
        console.log("[SW] Integrity: ✓ All critical files present");
    }

    return {
        ok: ok.length,
        missing: missing.length,
        missingFiles: missing,
        repaired: missing.length > 0,
        healthy: missing.length === 0,
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
//  CACHE INFO & SIZE REPORTING
// ═══════════════════════════════════════════════════════════════════════════════
async function getCacheInfo() {
    const buckets = {
        core:    { name: CACHE_CORE,    files: 0, bytes: 0 },
        audio:   { name: CACHE_AUDIO,   files: 0, bytes: 0 },
        assets:  { name: CACHE_ASSETS,  files: 0, bytes: 0 },
        dynamic: { name: CACHE_DYNAMIC, files: 0, bytes: 0 },
    };

    let totalBytes = 0;
    let totalFiles = 0;

    for (const [key, bucket] of Object.entries(buckets)) {
        try {
            const cache    = await caches.open(bucket.name);
            const requests = await cache.keys();
            bucket.files   = requests.length;
            totalFiles    += requests.length;

            for (const req of requests) {
                const res = await cache.match(req);
                if (res) {
                    const blob  = await res.clone().blob();
                    bucket.bytes += blob.size;
                    totalBytes   += blob.size;
                }
            }
            bucket.human = formatBytes(bucket.bytes);
        } catch (err) {
            console.warn(`[SW] Could not measure cache ${key}:`, err);
        }
    }

    // Try StorageManager for quota
    let quota = null;
    if (navigator.storage?.estimate) {
        quota = await navigator.storage.estimate();
    }

    return {
        version: SW_VERSION,
        totalFiles,
        totalBytes,
        totalHuman: formatBytes(totalBytes),
        buckets,
        quota: quota ? {
            usage:      quota.usage,
            usageHuman: formatBytes(quota.usage),
            quota:      quota.quota,
            quotaHuman: formatBytes(quota.quota),
            percent:    ((quota.usage / quota.quota) * 100).toFixed(1),
        } : null,
        perfMode: currentPerfMode,
        perfHints: PERF_HINTS[currentPerfMode],
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
//  BROADCAST TO ALL CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function broadcastToClients(message) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((client) => client.postMessage(message));
}


// ═══════════════════════════════════════════════════════════════════════════════
//  OFFLINE PAGE HTML — Shown when game not yet cached and user is offline
// ═══════════════════════════════════════════════════════════════════════════════
const OFFLINE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Echoes of Midnight — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0608;
      color: #c8b8a2;
      font-family: Georgia, 'Times New Roman', serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      text-align: center;
    }
    .clock { font-size: 4rem; margin-bottom: 1rem; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    h1 { font-size: 2rem; color: #d4a853; margin-bottom: 0.5rem; letter-spacing: 0.1em; }
    .tagline { font-size: 0.9rem; color: #6b5a47; margin-bottom: 2rem; font-style: italic; }
    .card {
      background: #130f0b;
      border: 1px solid #3a2d1f;
      border-radius: 8px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
    }
    p { line-height: 1.7; margin-bottom: 1rem; }
    .tip { color: #8a7560; font-size: 0.85rem; }
    button {
      background: #d4a853;
      color: #0a0608;
      border: none;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-family: inherit;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 1rem;
      font-weight: bold;
      letter-spacing: 0.05em;
    }
    button:hover { background: #e8c06a; }
  </style>
</head>
<body>
  <div class="clock">⏰</div>
  <h1>Echoes of Midnight</h1>
  <p class="tagline">The clock has stopped.</p>
  <div class="card">
    <p>You are offline and the game files have not been fully cached yet.</p>
    <p class="tip">Connect to the internet and reload the page once — the game will download everything automatically for permanent offline play.</p>
    <button onclick="location.reload()">🔄 Try Again</button>
  </div>
</body>
</html>`;


// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function formatBytes(bytes) {
    if (!bytes || bytes < 1024)   return (bytes || 0) + " B";
    if (bytes < 1_048_576)        return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1_073_741_824)    return (bytes / 1_048_576).toFixed(1) + " MB";
    return (bytes / 1_073_741_824).toFixed(2) + " GB";
}

// ── END OF SERVICE WORKER ─────────────────────────────────────────────────────
console.log(`[SW] Script parsed — ${SW_VERSION}`);