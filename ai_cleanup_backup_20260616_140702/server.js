// ═════════════════════════════════════════════════════════════════
//  SERVER.JS — Echoes of Midnight  v2.2
//  Static files + AI proxy with key rotation, failover,
//  rate limiting, and batch prefetch for predictive caching.
// ═════════════════════════════════════════════════════════════════

require("dotenv").config();
const express = require("express");
const path    = require("path");
const https   = require("https");

const app  = express();
const PORT = process.env.PORT || 3000;

// ═════════════════════════════════════════════════════════════════
//  API KEY ROTATION
// ═════════════════════════════════════════════════════════════════

const GROQ_KEYS = [];
for (let i = 1; i <= 20; i++) {
    const key = process.env[`GROQ_KEY_${i}`];
    if (key && key.startsWith("gsk_")) {
        GROQ_KEYS.push({
            key:         key,
            exhausted:   false,
            exhaustedAt: 0,
            requests:    0,
            failures:    0,
        });
    }
}

if (GROQ_KEYS.length === 0) {
    console.warn("[AI] ⚠ No GROQ_KEY_* found in environment variables.");
    console.warn("[AI] ⚠ AI features will be disabled. Game runs offline.");
    console.warn("[AI] ⚠ Add keys to .env file like: GROQ_KEY_1=gsk_xxxxx");
} else {
    console.log(`[AI] ✓ Loaded ${GROQ_KEYS.length} Groq API key(s)`);
}

let _keyIndex = 0;
const KEY_COOLDOWN_MS = 60000;

function getNextKey() {
    if (GROQ_KEYS.length === 0) return null;
    const now   = Date.now();
    const total = GROQ_KEYS.length;
    for (let i = 0; i < total; i++) {
        const idx   = (_keyIndex + i) % total;
        const entry = GROQ_KEYS[idx];
        if (entry.exhausted && (now - entry.exhaustedAt) > KEY_COOLDOWN_MS) {
            entry.exhausted   = false;
            entry.exhaustedAt = 0;
        }
        if (!entry.exhausted) {
            _keyIndex = (idx + 1) % total;
            return entry;
        }
    }
    return null;
}

function exhaustKey(entry) {
    entry.exhausted   = true;
    entry.exhaustedAt = Date.now();
    entry.failures++;
    console.warn(`[AI] Key ...${entry.key.slice(-6)} exhausted (will retry in 60s)`);
}

// ═════════════════════════════════════════════════════════════════
//  GROQ API CALL
// ═════════════════════════════════════════════════════════════════

const GROQ_HOST     = "api.groq.com";
const GROQ_PATH     = "/openai/v1/chat/completions";
const AI_TIMEOUT_MS = 12000;

function callGroq(apiKey, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = https.request({
            hostname: GROQ_HOST,
            port:     443,
            path:     GROQ_PATH,
            method:   "POST",
            headers: {
                "Content-Type":   "application/json",
                "Authorization":  `Bearer ${apiKey}`,
                "Content-Length": Buffer.byteLength(payload),
            },
            timeout: AI_TIMEOUT_MS,
        }, (res) => {
            let data = "";
            res.on("data",  (chunk) => { data += chunk; });
            res.on("end",   () => { resolve({ status: res.statusCode, body: data }); });
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("TIMEOUT")); });
        req.on("error",   (err) => { reject(err); });
        req.write(payload);
        req.end();
    });
}

// ═════════════════════════════════════════════════════════════════
//  CLIENT RATE LIMITING
// ═════════════════════════════════════════════════════════════════

const _clientRequests     = new Map();
const MAX_CLIENT_REQUESTS = 60;        // per minute
const CLIENT_WINDOW_MS    = 60000;

function checkClientRateLimit(ip) {
    const now   = Date.now();
    const entry = _clientRequests.get(ip);
    if (!entry || now > entry.resetAt) {
        _clientRequests.set(ip, { count: 1, resetAt: now + CLIENT_WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_CLIENT_REQUESTS) return false;
    entry.count++;
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of _clientRequests) {
        if (now > entry.resetAt) _clientRequests.delete(ip);
    }
}, 300000);

// ═════════════════════════════════════════════════════════════════
//  SYSTEM PROMPT BUILDER
// ═════════════════════════════════════════════════════════════════

function buildSystemPrompt(context, type) {
    const base = `You write atmospheric horror text for "Echoes of Midnight", a haunted mansion time-loop game. `
        + `STRICT RULES: `
        + `- MAXIMUM 2-3 sentences. NEVER exceed 4 sentences. `
        + `- Visceral, specific, deeply unsettling imagery. `
        + `- Reference player state when context given. `
        + `- Never break character. Never mention AI or being a model. `
        + `- Archaic, literary horror language. No modern slang. `
        + `- Never give gameplay hints unless asked. `
        + `- Use 2nd person ("you") for narrator. `;

    const ctx = context || {};
    const stateInfo = [
        ctx.room      ? `Room: ${ctx.room}.`                  : "",
        ctx.sanity    ? `Sanity: ${ctx.sanity}%.`             : "",
        ctx.loop      ? `Loop iteration: ${ctx.loop}.`        : "",
        ctx.seals     ? `Seals found: ${ctx.seals}/5.`        : "",
        ctx.timeLeft  ? `Time left: ${ctx.timeLeft}s.`        : "",
        ctx.combat    ? `In combat.`                          : "",
    ].filter(Boolean).join(" ");

    const typeInstructions = {
        ambient:  "Describe what the player senses in this room — sounds, smells, temperature, shadows, presences. Deeply unsettling. 2 sentences.",
        whisper:  "Generate a cryptic whisper from an unseen entity. Fragmented. Use ellipses. 1 sentence.",
        entity:   "Speak as AZATHIEL the eldritch entity. Use SPACED CAPITAL LETTERS. Existential dread. 1-2 sentences.",
        eleanora: "Speak as ELEANORA the fading ghost of a Victorian woman who died sealing the entity. Desperate. Loving. Brief. 1-2 sentences.",
        narrator: "Narrate as omniscient unsettling narrator. Second person ('you'). 2 sentences.",
        scare:    "One sharp terrifying observation that makes blood run cold. 1-2 sentences.",
        lore:     "A piece of house lore — historical detail or past event. Dark. 2 sentences.",
        menu:     "Atmospheric horror text for main menu. Unsettling. Inviting. 1-2 sentences.",
        death:    "Describe the loop resetting. Time folding. Memory fracturing. 2 sentences.",
        ending:   "Atmospheric ending text matching the ending type. 2-3 sentences.",
    };

    const typeInstruction = typeInstructions[type] || typeInstructions.ambient;
    return `${base}\n\nCurrent state: ${stateInfo || "Unknown."}\n\nTask: ${typeInstruction}`;
}

// ═════════════════════════════════════════════════════════════════
//  AI REQUEST PROCESSOR
// ═════════════════════════════════════════════════════════════════

async function processAIRequest(type, userMessage, context) {
    const systemPrompt = buildSystemPrompt(context, type);
    const groqBody = {
        model:       "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage || "Generate the requested text." },
        ],
        max_tokens:  220,
        temperature: 0.9,
        top_p:       0.95,
        stream:      false,
    };

    const MAX_RETRIES = Math.min(GROQ_KEYS.length, 3);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const keyEntry = getNextKey();
        if (!keyEntry) {
            return { error: "all_keys_exhausted" };
        }

        try {
            const result = await callGroq(keyEntry.key, groqBody);
            keyEntry.requests++;

            if (result.status === 200) {
                try {
                    const parsed  = JSON.parse(result.body);
                    const content = parsed.choices?.[0]?.message?.content || "";
                    return { text: content.trim() };
                } catch (parseErr) {
                    return { error: "parse_error" };
                }
            }

            if (result.status === 429 || result.status === 403 || result.status === 401) {
                exhaustKey(keyEntry);
                continue;
            }

            return { error: `groq_${result.status}` };

        } catch (err) {
            exhaustKey(keyEntry);
            continue;
        }
    }

    return { error: "all_retries_failed" };
}

// ═════════════════════════════════════════════════════════════════
//  EXPRESS SETUP
// ═════════════════════════════════════════════════════════════════

app.use(express.json({ limit: "32kb" }));

// CORS headers — allow local file:// and any origin during dev
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Log every API request (helpful for debugging)
app.use("/api", (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});

// ═════════════════════════════════════════════════════════════════
//  API ENDPOINTS — defined BEFORE static middleware
// ═════════════════════════════════════════════════════════════════

// ── Status endpoint ──────────────────────────────────────────────
app.get("/api/ai/status", (req, res) => {
    const activeKeys = GROQ_KEYS.filter(k => !k.exhausted).length;
    res.json({
        available:  activeKeys > 0,
        keysTotal:  GROQ_KEYS.length,
        keysActive: activeKeys,
        server:     "running",
    });
});

// ── Single request endpoint ──────────────────────────────────────
app.post("/api/ai", async (req, res) => {
    const clientIP = req.ip || "unknown";
    if (!checkClientRateLimit(clientIP)) {
        return res.status(429).json({ error: "rate_limited" });
    }

    const { type, context, message } = req.body || {};
    if (!type) return res.status(400).json({ error: "type_required" });

    const result = await processAIRequest(type, message, context);

    if (result.error) {
        return res.status(503).json({ error: result.error });
    }
    return res.json({ text: result.text });
});

// ── Batch endpoint ───────────────────────────────────────────────
app.post("/api/ai/batch", async (req, res) => {
    const clientIP = req.ip || "unknown";

    const { requests } = req.body || {};
    if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({ error: "requests_array_required" });
    }
    if (requests.length > 8) {
        return res.status(400).json({ error: "max_8_requests_per_batch" });
    }

    for (let i = 0; i < requests.length; i++) {
        if (!checkClientRateLimit(clientIP)) {
            return res.status(429).json({ error: "rate_limited" });
        }
    }

    const promises = requests.map(r =>
        processAIRequest(r.type, r.message, r.context)
            .catch(err => ({ error: err.message || "unknown" }))
    );

    const results = await Promise.all(promises);
    return res.json({ results });
});

// ═════════════════════════════════════════════════════════════════
//  STATIC FILES — defined AFTER API endpoints
// ═════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname), {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
        if (/\.(mp3|m4a|ogg|wav)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        }
        if (/\.(png|ico|jpg|jpeg|svg)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        }
        if (filePath.endsWith(".js")) {
            res.setHeader("Cache-Control", "public, max-age=3600");
        }
        if (filePath.endsWith("sw.js")) {
            res.setHeader("Service-Worker-Allowed", "/");
            res.setHeader("Cache-Control", "no-cache");
        }
    },
}));

// Fallback for SPA-style routes
app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "endpoint_not_found" });
    }
    res.sendFile(path.join(__dirname, "index.html"));
});

// ═════════════════════════════════════════════════════════════════
//  START SERVER
// ═════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  Echoes of Midnight — Server Active`);
    console.log(`  Port:      ${PORT}`);
    console.log(`  URL:       http://localhost:${PORT}`);
    console.log(`  AI Keys:   ${GROQ_KEYS.length} loaded`);
    console.log(`  Endpoints:`);
    console.log(`    GET  /api/ai/status`);
    console.log(`    POST /api/ai`);
    console.log(`    POST /api/ai/batch`);
    console.log(`═══════════════════════════════════════════════════\n`);
});