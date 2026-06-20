// ═══════════════════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Echoes of Midnight  v3.2.0
//  Fixed: only files that actually exist on server are listed.
//  Removed: 100 ghost audio files that caused 404 warnings.
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

const SW_VERSION    = "eom-v3.3.0";
const CACHE_CORE    = SW_VERSION + "-core";
const CACHE_AUDIO   = SW_VERSION + "-audio";
const CACHE_ASSETS  = SW_VERSION + "-assets";
const CACHE_DYNAMIC = SW_VERSION + "-dynamic";

const FETCH_TIMEOUT_MS = 45000;
const AUDIO_BATCH_SIZE = 4;

// ── CRITICAL — install aborts if any missing ──────────────────────────────────
const CRITICAL_FILES = [
    "/",
    "/index.html",
    "/manifest.json",
    "/style.css",
    "/game.js",
    "/rooms.js",
    "/audio_engine.js",
    "/audio_manager.js",
    "/audio_triggers.js",
    "/audio_wiring.js",
    "/balance.js",
    "/cinema.js",
    "/combat.js",
    "/controls.js",
    "/events.js",
    "/missions.js",
    "/state.js",
    "/state.json",
    "/mobile.js",
    "/npcs.js",
    "/particles.js",
    "/story_engine.js",
    "/subtitle_system.js",
    "/achievements.js",
];

// ── ASSETS — icons + screenshots, best-effort ─────────────────────────────────
const ALL_ASSET_FILES = [
    "/icons/og-image.jpg",
    "/icons/favicon.ico",
    "/icons/icon-16.png",
    "/icons/icon-32.png",
    "/icons/icon-48.png",
    "/icons/icon-57.png",
    "/icons/icon-60.png",
    "/icons/icon-70.png",
    "/icons/icon-70x70.png",
    "/icons/icon-72.png",
    "/icons/icon-76.png",
    "/icons/icon-96.png",
    "/icons/icon-114.png",
    "/icons/icon-120.png",
    "/icons/icon-128.png",
    "/icons/icon-144.png",
    "/icons/icon-150.png",
    "/icons/icon-150x150.png",
    "/icons/icon-152.png",
    "/icons/icon-167.png",
    "/icons/icon-180.png",
    "/icons/icon-192.png",
    "/icons/icon-256.png",
    "/icons/icon-310.png",
    "/icons/icon-310x150.png",
    "/icons/icon-310x310.png",
    "/icons/icon-384.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-192.png",
    "/icons/icon-maskable-512.png",
    "/icons/apple-touch-icon.png",
    "/icons/apple-touch-icon-57x57.png",
    "/icons/apple-touch-icon-60x60.png",
    "/icons/apple-touch-icon-72x72.png",
    "/icons/apple-touch-icon-76x76.png",
    "/icons/apple-touch-icon-114x114.png",
    "/icons/apple-touch-icon-120x120.png",
    "/icons/apple-touch-icon-144x144.png",
    "/icons/apple-touch-icon-152x152.png",
    "/icons/apple-touch-icon-167x167.png",
    "/icons/apple-touch-icon-180x180.png",
    "/screenshots/gameplay-narrow.png",
    "/screenshots/gameplay-wide.png",
];

// ── AUDIO — ONLY files confirmed to exist on your server ─────────────────────
// Source: your file tree scan. 80 real files. Zero ghosts.
const ALL_AUDIO_FILES = [
    // Root duplicate
    "/menu_theme.mp3",

    // Ambience (16 files)
    "/sounds/ambience/choir_distant.mp3",
    "/sounds/ambience/clock_ticking.mp3",
    "/sounds/ambience/crickets_night.mp3",
    "/sounds/ambience/deep_hum.mp3",
    "/sounds/ambience/fire_crackling.mp3",
    "/sounds/ambience/heartbeat_slow.mp3",
    "/sounds/ambience/music_box.mp3",
    "/sounds/ambience/owl_distant.mp3",
    "/sounds/ambience/piano_distant.mp3",
    "/sounds/ambience/rain_light.mp3",
    "/sounds/ambience/void_pulse.mp3",
    "/sounds/ambience/water_dripping.mp3",
    "/sounds/ambience/water_lapping.mp3",
    "/sounds/ambience/wind_howling.mp3",
    "/sounds/ambience/wind_inside.mp3",
    "/sounds/ambience/wind_outside.mp3",

    // Music (14 files)
    "/sounds/music/basement_drone.mp3",
    "/sounds/music/chapel_organ.mp3",
    "/sounds/music/combat_tension.mp3",
    "/sounds/music/ending_dark.mp3",
    "/sounds/music/ending_dawn.mp3",
    "/sounds/music/ending_liberation.mp3",
    "/sounds/music/ending_sacrifice.mp3",
    "/sounds/music/foyer_piano.mp3",
    "/sounds/music/garden_melancholy.mp3",
    "/sounds/music/library_piano.mp3",
    "/sounds/music/menu_theme.mp3",
    "/sounds/music/ritual_chants.mp3",
    "/sounds/music/upstairs_strings.mp3",
    "/sounds/music/void_ambience.mp3",

    // SFX (33 files)
    "/sounds/sfx/achievement_unlock.mp3",
    "/sounds/sfx/attack_swing.mp3",
    "/sounds/sfx/bell_toll.mp3",
    "/sounds/sfx/book_open.mp3",
    "/sounds/sfx/boss_appear.mp3",
    "/sounds/sfx/candle_light.mp3",
    "/sounds/sfx/chain_rattle.mp3",
    "/sounds/sfx/clock_chime.mp3",
    "/sounds/sfx/door_creak.mp3",
    "/sounds/sfx/door_lock.mp3",
    "/sounds/sfx/door_open.mp3",
    "/sounds/sfx/door_slam.mp3",
    "/sounds/sfx/enemy_death.mp3",
    "/sounds/sfx/flashlight_click.mp3",
    "/sounds/sfx/flashlight_flicker.mp3",
    "/sounds/sfx/footstep_grass.mp3",
    "/sounds/sfx/footstep_stone.mp3",
    "/sounds/sfx/footstep_wood.mp3",
    "/sounds/sfx/glass_break.mp3",
    "/sounds/sfx/gramophone_static.mp3",
    "/sounds/sfx/hit_enemy.mp3",
    "/sounds/sfx/hit_player.mp3",
    "/sounds/sfx/item_pickup.mp3",
    "/sounds/sfx/item_use.mp3",
    "/sounds/sfx/level_up.mp3",
    "/sounds/sfx/lock_unlock.mp3",
    "/sounds/sfx/match_strike.mp3",
    "/sounds/sfx/piano_key_single.mp3",
    "/sounds/sfx/rocking_horse.mp3",
    "/sounds/sfx/seal_found.mp3",
    "/sounds/sfx/seal_restore.mp3",
    "/sounds/sfx/thunder_distant.mp3",
    "/sounds/sfx/time_reset.mp3",

    // Voices (16 files)
    "/sounds/voices/breathing_close.mp3",
    "/sounds/voices/breathing_distant.mp3",
    "/sounds/voices/child_crying.mp3",
    "/sounds/voices/child_giggle.mp3",
    "/sounds/voices/child_laugh.mp3",
    "/sounds/voices/entity_growl.mp3",
    "/sounds/voices/entity_roar.mp3",
    "/sounds/voices/ghost_footsteps.mp3",
    "/sounds/voices/man_groan.mp3",
    "/sounds/voices/scare_stab.mp3",
    "/sounds/voices/whisper_find_me.mp3",
    "/sounds/voices/whisper_help.m4a",
    "/sounds/voices/whisper_leave.mp3",
    "/sounds/voices/whisper_run.mp3",
    "/sounds/voices/woman_moan.mp3",
    "/sounds/voices/woman_scream_distant.mp3",
];

// ═══════════════════════════════════════════════════════════════════════════════
//  INSTALL
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
    console.log("[SW] Installing " + SW_VERSION);
    event.waitUntil(runInstall());
});

async function runInstall() {
    const t0 = Date.now();

    console.log("[SW] Phase 1/3 — Critical files (" + CRITICAL_FILES.length + ")");
    const coreCache = await caches.open(CACHE_CORE);
    await cacheStrict(coreCache, CRITICAL_FILES);
    console.log("[SW] Phase 1 done");

    console.log("[SW] Phase 2/3 — Assets (" + ALL_ASSET_FILES.length + ")");
    const assetCache = await caches.open(CACHE_ASSETS);
    await cacheBestEffort(assetCache, ALL_ASSET_FILES, "ASSETS");

    console.log("[SW] Phase 3/3 — Audio (" + ALL_AUDIO_FILES.length + " real files)");
    const audioCache = await caches.open(CACHE_AUDIO);
    await cacheAudioBatched(audioCache, ALL_AUDIO_FILES);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("[SW] Install done in " + elapsed + "s");

    broadcastToClients({
        type: "sw-install-complete",
        version: SW_VERSION,
        elapsed: elapsed,
    });

    await self.skipWaiting();
}

async function cacheStrict(cache, files) {
    const results = await Promise.allSettled(
        files.map((url) => fetchAndCache(cache, url))
    );
    const failed = [];
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            failed.push(files[i] + " — " + (r.reason && r.reason.message ? r.reason.message : r.reason));
        }
    });
    if (failed.length > 0) {
        failed.forEach((f) => console.error("[SW][CRITICAL] MISSING: " + f));
        throw new Error(failed.length + " critical file(s) missing");
    }
}

async function cacheBestEffort(cache, files, label) {
    const results = await Promise.allSettled(
        files.map((url) => fetchAndCache(cache, url))
    );
    let ok = 0, fail = 0;
    results.forEach((r, i) => {
        if (r.status === "fulfilled") { ok++; }
        else { fail++; }
    });
    console.log("[SW][" + label + "] " + ok + " cached, " + fail + " skipped");
}

async function cacheAudioBatched(cache, files) {
    const total = files.length;
    let cached = 0, failed = 0;

    for (let i = 0; i < files.length; i += AUDIO_BATCH_SIZE) {
        const batch   = files.slice(i, i + AUDIO_BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((url) => fetchAndCache(cache, url))
        );
        results.forEach((r, j) => {
            if (r.status === "fulfilled") { cached++; }
            else {
                failed++;
                console.warn("[SW][AUDIO] not found: " + batch[j]);
            }
        });

        const pct     = Math.round(((i + batch.length) / total) * 100);
        const prevPct = Math.round((i / total) * 100);
        if (Math.floor(pct / 10) > Math.floor(prevPct / 10) || pct >= 100) {
            console.log("[SW][AUDIO] " + pct + "% — " + cached + "/" + total);
            broadcastToClients({
                type: "sw-audio-progress",
                percent: pct, cached, total, failed,
            });
        }
    }
    console.log("[SW][AUDIO] Done: " + cached + " cached, " + failed + " not on server");
}

async function fetchAndCache(cache, url) {
    const existing = await cache.match(url);
    if (existing) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url, {
            signal: controller.signal,
            cache:  "no-cache",
        });
        clearTimeout(timer);
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }

    // Skip non-OK and partial responses (206 breaks Cache API)
    if (!response.ok || response.status === 206) {
        if (response.status === 206) {
            console.warn("[SW] Skipping partial response: " + url);
            return;
        }
        throw new Error("HTTP " + response.status + " for " + url);
    }

    try {
        await cache.put(url, response.clone());
    } catch (e) {
        console.warn("[SW] Cache put failed for " + url + ": " + e.message);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ACTIVATE
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating " + SW_VERSION);
    const keep = new Set([CACHE_CORE, CACHE_AUDIO, CACHE_ASSETS, CACHE_DYNAMIC]);
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k.startsWith("eom-") && !keep.has(k))
                    .map((k) => { console.log("[SW] Deleting old cache: " + k); return caches.delete(k); })
            ))
            .then(() => self.clients.claim())
            .then(() => {
                detectAndBroadcastPerfMode();
                broadcastToClients({ type: "sw-activated", version: SW_VERSION });
            })
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FETCH
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;

    const path = url.pathname;

    if (isAudio(path))      event.respondWith(cacheFirst(req, CACHE_AUDIO));
    else if (isImage(path)) event.respondWith(cacheFirst(req, CACHE_ASSETS));
    else if (isHTMLReq(req))event.respondWith(staleWhileRevalidate(req));
    else if (isCore(path))  event.respondWith(cacheFirst(req, CACHE_CORE));
    else                    event.respondWith(networkFirst(req));
});

function isAudio(p)  { return /\.(mp3|m4a|ogg|wav|aac|webm|flac|opus)$/i.test(p) || p.startsWith("/sounds/"); }
function isImage(p)  { return /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(p) || p.startsWith("/icons/") || p.startsWith("/screenshots/"); }
function isCore(p)   { return p.endsWith(".js") || p.endsWith(".css") || p === "/manifest.json" || CRITICAL_FILES.includes(p); }
function isHTMLReq(r){ return (r.headers.get("Accept")||"").includes("text/html"); }

async function cacheFirst(req, cacheName) {
    const cached = await caches.match(req);
    if (cached) {
        if (!isAudio(new URL(req.url).pathname)) revalidateBg(req, cacheName);
        return cached;
    }
    try {
        const res = await fetch(req);
        if (res.ok && res.status !== 206) { const c = await caches.open(cacheName); c.put(req, res.clone()); }
        return res;
    } catch (e) { return offlineFallback(req); }
}

async function staleWhileRevalidate(req) {
    const cached = await caches.match(req);
    const netP = fetch(req).then(async (res) => {
        if (res.ok) { const c = await caches.open(CACHE_CORE); await c.put(req, res.clone()); }
        return res;
    }).catch(() => null);
    return cached || await netP || offlineFallback(req);
}

async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(CACHE_DYNAMIC); c.put(req, res.clone()); }
        return res;
    } catch (e) {
        const cached = await caches.match(req);
        return cached || offlineFallback(req);
    }
}

function revalidateBg(req, cacheName) {
    fetch(req).then(async (res) => {
        if (res.ok) { const c = await caches.open(cacheName); await c.put(req, res); }
    }).catch(() => {});
}

function offlineFallback(req) {
    const path = new URL(req.url).pathname;
    if (isAudio(path)) return new Response(null, { status: 204 });
    if (isImage(path)) {
        const px = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        return new Response(Uint8Array.from(atob(px),(c)=>c.charCodeAt(0)),
            { status:200, headers:{"Content-Type":"image/png"} });
    }
    if (isHTMLReq(req)) return new Response(OFFLINE_HTML, { status:503, headers:{"Content-Type":"text/html;charset=utf-8"} });
    return new Response("Offline", { status:503 });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("message", async (event) => {
    const data = event.data;
    const cmd  = typeof data === "string" ? data : (data && data.type ? data.type : "");
    const src  = event.source;

    switch (cmd) {
        case "precache-audio":
        case "refresh-audio-cache": {
            await caches.delete(CACHE_AUDIO);
            const ac = await caches.open(CACHE_AUDIO);
            await cacheAudioBatched(ac, ALL_AUDIO_FILES);
            if (src) src.postMessage({ type: "audio-cache-refreshed" });
            break;
        }
        case "clear-audio-cache": {
            await caches.delete(CACHE_AUDIO);
            if (src) src.postMessage({ type: "audio-cache-cleared" });
            break;
        }
        case "get-cache-info": {
            const info = await getCacheInfo();
            if (src) src.postMessage({ type: "cache-info", ...info });
            break;
        }
        case "integrity-check": {
            const report = await integrityCheck();
            if (src) src.postMessage({ type: "integrity-report", ...report });
            break;
        }
        case "force-update": {
            await Promise.all([
                caches.delete(CACHE_CORE), caches.delete(CACHE_AUDIO),
                caches.delete(CACHE_ASSETS), caches.delete(CACHE_DYNAMIC),
            ]);
            if (src) src.postMessage({ type: "update-initiated" });
            break;
        }
        case "skip-waiting": { await self.skipWaiting(); break; }
        case "get-performance-hints": {
            if (src) src.postMessage({ type:"performance-hints", mode:currentPerfMode, hints:PERF_HINTS[currentPerfMode] });
            break;
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PERFORMANCE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
let currentPerfMode = "medium";

const PERF_HINTS = {
    low:    { audioPolyphony:4,  particleCount:20,  ambientLayers:1, preloadRooms:1, renderScale:0.75, shadows:false },
    medium: { audioPolyphony:8,  particleCount:60,  ambientLayers:2, preloadRooms:2, renderScale:1.0,  shadows:true  },
    high:   { audioPolyphony:16, particleCount:150, ambientLayers:4, preloadRooms:5, renderScale:1.0,  shadows:true  },
};

function detectAndBroadcastPerfMode() {
    let mode = "medium";
    const mem   = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;
    if (mem !== undefined) {
        if (mem <= 1) mode = "low";
        else if (mem >= 6) mode = "high";
    }
    if (cores !== undefined) {
        if (cores <= 2 && mode !== "low") mode = "low";
        else if (cores >= 8 && mode === "medium") mode = "high";
    }
    currentPerfMode = mode;
    console.log("[SW] Perf: " + mode + " (RAM:" + (mem||"?") + "GB cores:" + (cores||"?") + ")");
    broadcastToClients({ type:"performance-mode", mode, hints:PERF_HINTS[mode] });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INTEGRITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════
async function integrityCheck() {
    const cache   = await caches.open(CACHE_CORE);
    const missing = [];
    const present = [];
    for (const url of CRITICAL_FILES) {
        const hit = await cache.match(url);
        if (hit) present.push(url);
        else     missing.push(url);
    }
    if (missing.length > 0) {
        console.warn("[SW] Repairing " + missing.length + " missing files...");
        await cacheBestEffort(cache, missing, "REPAIR");
    }
    return { healthy: missing.length===0, ok:present.length, missing:missing.length, missingFiles:missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CACHE INFO
// ═══════════════════════════════════════════════════════════════════════════════
async function getCacheInfo() {
    const buckets = {
        core:    { name:CACHE_CORE,    files:0, bytes:0, human:"0 B" },
        audio:   { name:CACHE_AUDIO,   files:0, bytes:0, human:"0 B" },
        assets:  { name:CACHE_ASSETS,  files:0, bytes:0, human:"0 B" },
        dynamic: { name:CACHE_DYNAMIC, files:0, bytes:0, human:"0 B" },
    };
    let totalBytes=0, totalFiles=0;
    for (const key of Object.keys(buckets)) {
        const b=buckets[key];
        try {
            const c=await caches.open(b.name);
            const reqs=await c.keys();
            b.files=reqs.length; totalFiles+=reqs.length;
            for (const r of reqs) {
                const res=await c.match(r);
                if (res) { const blob=await res.clone().blob(); b.bytes+=blob.size; totalBytes+=blob.size; }
            }
            b.human=formatBytes(b.bytes);
        } catch(e) {}
    }
    let quota=null;
    if (navigator.storage&&navigator.storage.estimate) {
        try { const e=await navigator.storage.estimate();
            quota={usage:e.usage,usageHuman:formatBytes(e.usage),quota:e.quota,quotaHuman:formatBytes(e.quota),
                percent:e.quota?((e.usage/e.quota)*100).toFixed(1):"?"}; }
        catch(e) {}
    }
    return { version:SW_VERSION, totalFiles, totalBytes, totalHuman:formatBytes(totalBytes), buckets, quota, perfMode:currentPerfMode };
}

async function broadcastToClients(message) {
    try {
        const clients = await self.clients.matchAll({ includeUncontrolled:true });
        clients.forEach((c) => c.postMessage(message));
    } catch(e) {}
}

function formatBytes(bytes) {
    if (!bytes||bytes<1024) return (bytes||0)+" B";
    if (bytes<1048576) return (bytes/1024).toFixed(1)+" KB";
    if (bytes<1073741824) return (bytes/1048576).toFixed(1)+" MB";
    return (bytes/1073741824).toFixed(2)+" GB";
}

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Echoes of Midnight — Offline</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0608;color:#c8b8a2;font-family:Georgia,serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;
min-height:100vh;padding:2rem;text-align:center}
.clock{font-size:4rem;margin-bottom:1rem;animation:p 2s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-size:2rem;color:#d4a853;margin-bottom:.5rem;letter-spacing:.1em}
.sub{font-size:.9rem;color:#6b5a47;font-style:italic;margin-bottom:2rem}
.card{background:#130f0b;border:1px solid #3a2d1f;border-radius:8px;
padding:2rem;max-width:400px;width:100%}
p{line-height:1.7;margin-bottom:1rem}
.tip{color:#8a7560;font-size:.85rem}
button{background:#d4a853;color:#0a0608;border:none;padding:.75rem 2rem;
font-size:1rem;font-family:inherit;border-radius:4px;cursor:pointer;
margin-top:1rem;font-weight:bold}
button:hover{background:#e8c06a}
</style></head>
<body>
<div class="clock">&#9200;</div>
<h1>Echoes of Midnight</h1>
<p class="sub">The clock has stopped.</p>
<div class="card">
<p>You are offline and the game has not been fully cached yet.</p>
<p class="tip">Connect to the internet and reload once — everything downloads automatically.</p>
<button onclick="location.reload()">Try Again</button>
</div></body></html>`;

console.log("[SW] Parsed — " + SW_VERSION);