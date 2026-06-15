// ═════════════════════════════════════════════════════════════════
//  STORY_ENGINE.JS — Dynamic Story, House Decay, Inner Monologue
//  Features: 4 (story branching), 10 (house decay), 11 (monologue)
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ─── SAFE ACCESSORS ─────────────────────────────────────────────
function _sg()  { return (typeof game  !== "undefined" && game)  ? game  : null; }
function _sRooms() { return (typeof ROOMS !== "undefined" && ROOMS) ? ROOMS : null; }
function _sRoomDim(id) {
    const R = _sRooms();
    if (!R || !R[id]) return { width: 800, height: 600 };
    return { width: R[id].width || 800, height: R[id].height || 600 };
}
function _sSay(speaker, text) {
    try {
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show) {
            SubtitleSystem.show(speaker, text, 260);
        } else if (typeof showDialog === "function") {
            showDialog(speaker, text);
        }
    } catch (_) {}
}

// ═════════════════════════════════════════════════════════════════
//  STORY ENGINE
// ═════════════════════════════════════════════════════════════════
const StoryEngine = {

    actions:      [],   // every meaningful player action recorded
    consequences: {
        helpedGhosts:          null,   // Set — populated lazily
        dangerRooms:           null,   // Set — populated lazily
        entityStrengthened:    false,
        mercyPath:             false,
        holyProtection:        false,
        musicBond:             false,
        fullKnowledge:         false,
        speedBonus:            false,
    },

    _MAX_ACTIONS: 200,  // cap to prevent unbounded growth

    // ─── ACTION TRACKING ────────────────────────────────────────
    recordAction(actionId, data) {
        const g = _sg();
        if (!g) return;

        this.actions.push({
            id:        actionId,
            loop:      g.loop      ?? 0,
            time:      g.loopTime  ?? 0,
            room:      g.currentRoom || "",
            data:      data || {},
        });

        // Keep array bounded — drop oldest
        if (this.actions.length > this._MAX_ACTIONS) {
            this.actions.shift();
        }

        this._evaluateConsequences(actionId, data);
    },

    hasAction(actionId) {
        return this.actions.some(a => a.id === actionId);
    },

    actionCount(actionId) {
        return this.actions.filter(a => a.id === actionId).length;
    },

    // ─── CONSEQUENCE RULES ───────────────────────────────────────
    // Each rule: { trigger, check(data), consequence(data) }
    // check()       — returns true when the consequence should fire
    // consequence() — fires at most once (guarded by consequences flags)
    _RULES: [

        // Helping ghosts → alliance
        {
            trigger: "helped_ghost",
            check(data) { return true; },
            consequence(data) {
                const C = StoryEngine.consequences;
                if (!C.helpedGhosts) C.helpedGhosts = new Set();
                if (data && data.ghostId) C.helpedGhosts.add(data.ghostId);

                const g = _sg();
                if (C.helpedGhosts.size >= 3 && g && g.permanentFlags) {
                    g.permanentFlags.ghostAlliance = true;
                }
            },
        },

        // Ignoring clues → danger rooms
        {
            trigger: "ignored_clue",
            check()  { return StoryEngine.actionCount("ignored_clue") >= 3; },
            consequence() {
                const C = StoryEngine.consequences;
                const R = _sRooms();
                if (!R) return;
                if (!C.dangerRooms) C.dangerRooms = new Set();
                const keys  = Object.keys(R);
                const room  = keys[Math.floor(Math.random() * keys.length)];
                C.dangerRooms.add(room);
                _sSay("NARRATOR", "You feel the house shift. Something is angry that you're ignoring its warnings.");
            },
        },

        // Killing enemies → Entity grows stronger (fires once)
        {
            trigger: "enemy_killed",
            check()  { return StoryEngine.actionCount("enemy_killed") >= 20; },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.entityStrengthened) return;
                C.entityStrengthened = true;
                const g = _sg();
                if (g && g.permanentFlags) g.permanentFlags.entityPowered = true;
                _sSay("NARRATOR", "The Entity feeds on violence. Every creature you destroy makes it stronger. Perhaps there's a better way...");
            },
        },

        // Sparing enemies → Mercy path (fires once)
        {
            trigger: "enemy_spared",
            check()  { return StoryEngine.actionCount("enemy_spared") >= 5; },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.mercyPath) return;
                C.mercyPath = true;
                const g = _sg();
                if (g) {
                    if (g.permanentFlags) g.permanentFlags.mercyBonus = true;
                    g.maxSanity = (g.maxSanity ?? 100) + 15;
                    g.sanity    = Math.min(g.maxSanity, (g.sanity ?? 0) + 15);
                }
                _sSay("ELEANORA", "Your mercy strengthens me. The chains hold tighter when hearts are gentle.");
            },
        },

        // Chapel visits → holy protection (fires once)
        {
            trigger: "chapel_visit",
            check()  { return StoryEngine.actionCount("chapel_visit") >= 3; },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.holyProtection) return;
                C.holyProtection = true;
                const g = _sg();
                if (g && g.permanentFlags) g.permanentFlags.holyShield = true;
                _sSay("FATHER HARMON", "Your faith grows. The chapel's protection extends beyond these walls now.");
            },
        },

        // Piano playing → music bond (fires once)
        {
            trigger: "played_piano",
            check()  { return StoryEngine.actionCount("played_piano") >= 2; },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.musicBond) return;
                C.musicBond = true;
                const g = _sg();
                if (g && g.permanentFlags) g.permanentFlags.musicBond = true;
                _sSay("NARRATOR", "The music connects you to the family. Their ghosts no longer drain your sanity.");
            },
        },

        // Reading journals → scholar bonus (fires once)
        {
            trigger: "journal_read",
            check()  { return StoryEngine.actionCount("journal_read") >= 5; },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.fullKnowledge) return;
                C.fullKnowledge = true;
                const g = _sg();
                if (g && g.permanentFlags) g.permanentFlags.scholarBonus = true;
                try { if (typeof giveXP === "function") giveXP(50); } catch (_) {}
                _sSay("NARRATOR", "You understand the full story now. Every piece connects. The house recognizes your comprehension.");
            },
        },

        // Fast exploration → time bonus (fires once)
        {
            trigger: "room_entered",
            check() {
                const g = _sg();
                if (!g) return false;
                const now     = g.loopTime ?? 0;
                const recent  = StoryEngine.actions.filter(
                    a => a.id === "room_entered" && (now - a.time) < 60
                );
                return recent.length >= 8;
            },
            consequence() {
                const C = StoryEngine.consequences;
                if (C.speedBonus) return;
                C.speedBonus = true;
                const g = _sg();
                if (g) g.maxLoopTime = (g.maxLoopTime ?? 600) + 30;
                _sSay("NARRATOR", "Your speed impresses even the house itself. Time seems to slow for you.");
            },
        },
    ],

    _evaluateConsequences(actionId, data) {
        for (const rule of this._RULES) {
            if (rule.trigger !== actionId) continue;
            try {
                if (rule.check(data)) rule.consequence(data);
            } catch (_) {}
        }
    },

    // ─── STORY PATH ─────────────────────────────────────────────
    getStoryPath() {
        const mercy    = this.actionCount("enemy_spared");
        const violence = this.actionCount("enemy_killed");
        const knowledge= this.actionCount("journal_read");
        const faith    = this.actionCount("chapel_visit");

        if (mercy > violence * 2 && faith >= 3)  return "saint";
        if (violence > mercy * 3)                 return "warrior";
        if (knowledge >= 5)                       return "scholar";
        return "explorer";
    },

    // ─── SAVE / LOAD / RESET ────────────────────────────────────
    save() {
        const C = this.consequences;
        return {
            actions: this.actions.slice(-100),
            consequences: {
                ...C,
                helpedGhosts: C.helpedGhosts ? [...C.helpedGhosts] : [],
                dangerRooms:  C.dangerRooms  ? [...C.dangerRooms]  : [],
            },
        };
    },

    load(data) {
        if (!data) return;
        this.actions      = Array.isArray(data.actions) ? data.actions : [];
        this.consequences = data.consequences || {};

        // Re-hydrate Sets
        if (Array.isArray(this.consequences.helpedGhosts)) {
            this.consequences.helpedGhosts = new Set(this.consequences.helpedGhosts);
        }
        if (Array.isArray(this.consequences.dangerRooms)) {
            this.consequences.dangerRooms = new Set(this.consequences.dangerRooms);
        }
    },

    reset() {
        // Actions intentionally persist across loops — they tell the whole story.
    },

    update() {
        // Currently event-driven only.
        // Could run periodic consequence checks here if needed.
    },
};

// ═════════════════════════════════════════════════════════════════
//  HOUSE DECAY
// ═════════════════════════════════════════════════════════════════
const HouseDecay = {
    decayLevel:      0,
    roomDecay:       {},
    cracks:          [],
    movedFurniture:  {},

    // Internal tick — no dependency on global `frame`
    _tick: 0,

    _ENTITY_ROOMS: new Set([
        "basement","ritual_chamber","void_chamber","catacombs","underground_lake"
    ]),

    // ─── UPDATE ─────────────────────────────────────────────────
    update() {
        const g = _sg();
        if (!g) return;

        this._tick++;

        // Decay scales with loops
        this.decayLevel = Math.min(1, (g.loop ?? 0) * 0.08);

        // Per-room decay (only update every 2 s to save work)
        if (this._tick % 120 === 0) {
            const R = _sRooms();
            if (R) {
                for (const roomId of Object.keys(R)) {
                    if (!this.roomDecay[roomId]) this.roomDecay[roomId] = 0;
                    const factor = this._ENTITY_ROOMS.has(roomId) ? 1.5 : 0.8;
                    this.roomDecay[roomId] = Math.min(1, this.decayLevel * factor);
                }
            }
        }

        // Spawn a new crack every ~10 s (capped at 50)
        if (this._tick % 600 === 0 && this.cracks.length < 50) {
            const dim = _sRoomDim(g.currentRoom);
            this.cracks.push({
                room:     g.currentRoom,
                x:        Math.random() * dim.width,
                y:        Math.random() * dim.height,
                length:   10 + Math.random() * 40,
                angle:    Math.random() * Math.PI * 2,
                branches: Math.floor(Math.random() * 3),
            });
        }
    },

    // ─── COLOUR HELPERS ─────────────────────────────────────────
    getDecayColor(baseColor, roomId) {
        const decay = this.roomDecay[roomId] || 0;
        if (decay < 0.1) return baseColor;

        // Expect a 6-digit hex string
        if (!/^#[0-9a-fA-F]{6}$/.test(baseColor)) return baseColor;

        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        const dr = Math.max(0, Math.min(255, Math.floor(r * (1 - decay * 0.3))));
        const dg = Math.max(0, Math.min(255, Math.floor(g * (1 - decay * 0.1) + decay * 5)));
        const db = Math.max(0, Math.min(255, Math.floor(b * (1 - decay * 0.4))));

        return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
    },

    // ─── DRAW CRACKS ────────────────────────────────────────────
    drawCracks(ctx, roomId) {
        const roomCracks = this.cracks.filter(c => c.room === roomId);
        if (!roomCracks.length) return;

        ctx.save();
        ctx.strokeStyle = `rgba(30,20,10,${(0.3 + this.decayLevel * 0.4).toFixed(3)})`;
        ctx.lineWidth   = 1;

        for (const crack of roomCracks) {
            ctx.beginPath();
            ctx.moveTo(crack.x, crack.y);

            let cx = crack.x, cy = crack.y;
            const segments = 3 + Math.floor(crack.length / 10);
            const segLen   = crack.length / Math.max(1, segments);

            for (let i = 0; i < segments; i++) {
                // Use deterministic jitter so cracks don't wriggle each frame
                const angle = crack.angle + Math.sin(i * 3.7 + crack.x) * 0.4;
                cx += Math.cos(angle) * segLen;
                cy += Math.sin(angle) * segLen;
                ctx.lineTo(cx, cy);

                if (crack.branches > 0 && i === Math.floor(segments / 2)) {
                    const bAngle = angle + (Math.sin(crack.y + i) > 0 ? 0.8 : -0.8);
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(
                        cx + Math.cos(bAngle) * segLen * 0.6,
                        cy + Math.sin(bAngle) * segLen * 0.6
                    );
                    ctx.moveTo(cx, cy);
                }
            }
            ctx.stroke();
        }

        ctx.restore();
    },

    // ─── DRAW DECAY OVERLAY ─────────────────────────────────────
    drawDecayOverlay(ctx, room, roomId) {
        const decay = this.roomDecay[roomId] || 0;
        if (decay < 0.15) return;

        ctx.save();

        // Base tint
        ctx.fillStyle = `rgba(10,15,5,${(decay * 0.15).toFixed(3)})`;
        ctx.fillRect(0, 0, room.width, room.height);

        // Mold / dust spots
        if (decay > 0.3) {
            ctx.fillStyle = `rgba(40,50,30,${(decay * 0.10).toFixed(3)})`;
            const spots = Math.floor(decay * 20);
            for (let i = 0; i < spots; i++) {
                // Deterministic positions — no per-frame random so they don't flicker
                const x = (Math.sin(i * 7.3) * 0.5 + 0.5) * room.width;
                const y = (Math.cos(i * 5.1) * 0.5 + 0.5) * room.height;
                ctx.beginPath();
                ctx.arc(x, y, 1 + decay * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Entity veins at high decay (slow, tick-based animation)
        if (decay > 0.6) {
            ctx.strokeStyle = `rgba(60,0,80,${((decay - 0.6) * 0.3).toFixed(3)})`;
            ctx.lineWidth   = 1;
            const t = this._tick * 0.002;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                let vx = (Math.sin(i * 3.7) * 0.5 + 0.5) * room.width;
                let vy = room.height;
                ctx.moveTo(vx, vy);
                for (let j = 0; j < 8; j++) {
                    vx += Math.sin(j * 2.3 + i + t) * 20;
                    vy -= room.height / 8;
                    ctx.lineTo(vx, vy);
                }
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    // ─── FURNITURE SHIFTING ─────────────────────────────────────
    shiftFurniture(roomId) {
        const R = _sRooms();
        if (!R || !R[roomId]) return;
        const room = R[roomId];

        if (!this.movedFurniture[roomId]) this.movedFurniture[roomId] = {};

        const SKIP = new Set(["rug","runner_rug","pentagram","candle_circle","stairs"]);
        const shift = this.decayLevel * 5;

        if (!Array.isArray(room.furniture)) return;

        for (let i = 0; i < room.furniture.length; i++) {
            if (SKIP.has(room.furniture[i].type)) continue;
            if (this.movedFurniture[roomId][i]) continue;   // already shifted
            this.movedFurniture[roomId][i] = {
                dx: (Math.random() - 0.5) * shift,
                dy: (Math.random() - 0.5) * shift,
            };
        }
    },

    getFurnitureOffset(roomId, index) {
        const r = this.movedFurniture[roomId];
        return (r && r[index]) ? r[index] : { dx: 0, dy: 0 };
    },

    // ─── SAVE / LOAD / RESET ────────────────────────────────────
    save() {
        return {
            decayLevel: this.decayLevel,
            roomDecay:  { ...this.roomDecay },
            cracks:     this.cracks.slice(-30),
        };
    },

    load(data) {
        if (!data) return;
        this.decayLevel = data.decayLevel || 0;
        this.roomDecay  = data.roomDecay  || {};
        this.cracks     = Array.isArray(data.cracks) ? data.cracks : [];
    },

    reset() {
        // Decay persists — house gets worse each loop
        const g = _sg();
        if (g) this.shiftFurniture(g.currentRoom);
    },
};

// ═════════════════════════════════════════════════════════════════
//  INNER MONOLOGUE
// ═════════════════════════════════════════════════════════════════
const Monologue = {
    thoughts:    [],
    maxThoughts: 1,
    cooldown:    0,
    minCooldown: 300,   // ~5 s at 60 fps

    // Internal tick — no global `frame` dependency
    _tick: 0,

    // ── Thought bank ─────────────────────────────────────────────
    THOUGHTS: {
        new_room: [
            "Never been here before. What secrets does this room hold?",
            "Another room. This house is larger than it looks from outside.",
            "I should search this place carefully.",
            "Something about this room feels... wrong.",
            "The air is different here. Thicker.",
        ],
        sanity_low: [
            "I can't think straight. The walls are breathing.",
            "Is that shadow moving or am I imagining things?",
            "Focus. Stay focused. Don't let it win.",
            "My hands are shaking. How long have they been shaking?",
            "I hear whispers. Or is that my own voice?",
            "The darkness has teeth. I can feel them.",
        ],
        sanity_high: [
            "I can do this. I'm getting closer to the truth.",
            "Stay calm. Think logically. What do I know?",
            "The house can't break me. Not today.",
        ],
        found_clue: [
            "Another piece of the puzzle. It's coming together.",
            "This changes everything. Or does it?",
            "Victor... what did you do to your family?",
            "Eleanora tried to warn everyone. Nobody listened.",
            "The seals are the key. I need to find them all.",
        ],
        near_ghost: [
            "I can feel them watching me. The dead remember.",
            "They're trapped too. Maybe I can free them.",
            "The ghost doesn't seem hostile. Just... sad.",
            "Is it trying to tell me something?",
        ],
        combat_start: [
            "They're coming. Stay ready.",
            "I didn't survive this many loops to die now.",
            "Fight or flight? Today I fight.",
        ],
        time_low: [
            "The clock is ticking. Not much time left.",
            "I can feel midnight approaching. Every cell in my body knows.",
            "Hurry. The loop resets soon.",
            "Seconds feel like hours, hours like seconds.",
        ],
        loop_start: [
            "Again. I'm here again. But I remember more this time.",
            "The clock resets but my mind doesn't. Small victory.",
            "This loop will be different. I know what to do now.",
            "How many times have I stood in this foyer? Too many.",
        ],
        near_entity: [
            "It's here. I can feel it pressing against reality.",
            "The Entity watches. It knows I'm getting closer.",
            "Azathiel. Even thinking the name makes my skin crawl.",
            "This darkness isn't natural. It's alive. It's hungry.",
        ],
        found_seal: [
            "A seal fragment. The power in it is palpable.",
            "One step closer. The seals resonate when I hold them.",
            "These fragments want to be together. I can feel it.",
        ],
        dark_room: [
            "I can barely see. The darkness here is almost physical.",
            "My flashlight struggles against this darkness.",
            "Something doesn't want me to see what's in here.",
        ],
        beauty: [
            "Even in this nightmare, there's a strange beauty.",
            "Eleanora's love touches everything. Even the darkness can't erase it.",
            "The moonlight through the window... for a moment, peace.",
        ],
        near_death_ghost: [
            "That's... me. From a previous loop. I died here.",
            "My past self left a warning. I should listen.",
            "How many versions of me have walked these halls?",
        ],
        found_item: [
            "This could be useful. Better hold onto it.",
            "Another piece of the puzzle, or just junk?",
            "The previous residents left this behind. Or was it left for me?",
        ],
        door_locked: [
            "Locked. There's always another way in this house.",
            "Not ready for what's behind there. Not yet.",
            "I'll find the key. I always do.",
        ],
        idle: [
            "I shouldn't stand still for too long.",
            "The house watches those who hesitate.",
            "Keep moving. The clock doesn't stop for doubt.",
            "What am I missing? Think...",
        ],
        music: [
            "The music cuts through the horror like a knife.",
            "Eleanora's melody. Even death couldn't silence it.",
            "For a moment, the house feels almost... peaceful.",
        ],
        sacred: [
            "This is the only truly safe place in the house.",
            "Holy ground. The Entity can't touch me here.",
            "Father Harmon's faith is a beacon in the darkness.",
        ],
    },

    // ── Trigger a thought ────────────────────────────────────────
    think(category, force) {
        if (!force && (this.cooldown > 0 || this.thoughts.length >= this.maxThoughts)) return;

        const options = this.THOUGHTS[category];
        if (!Array.isArray(options) || options.length === 0) return;

        const text = options[Math.floor(Math.random() * options.length)];

        // Don't repeat an identical thought that's currently on screen
        if (this.thoughts.some(t => t.text === text)) return;

        this.thoughts.push({
            text,
            alpha:       0,
            state:       "fadeIn",
            duration:    240,
            maxDuration: 240,
        });

        this.cooldown = this.minCooldown;
    },

    // ── Per-frame update ─────────────────────────────────────────
    update() {
        const g = _sg();
        if (!g) return;
        if (typeof gameState !== "undefined" && gameState !== "playing") return;
        if (typeof dialogActive !== "undefined" && dialogActive) return;
        if (typeof journalOpen  !== "undefined" && journalOpen)  return;

        this._tick++;
        if (this.cooldown > 0) this.cooldown--;

        // Age existing thoughts
        for (let i = this.thoughts.length - 1; i >= 0; i--) {
            const t = this.thoughts[i];
            switch (t.state) {
                case "fadeIn":
                    t.alpha = Math.min(0.7, t.alpha + 0.03);
                    if (t.alpha >= 0.7) t.state = "visible";
                    break;
                case "visible":
                    t.duration--;
                    if (t.duration <= 40) t.state = "fadeOut";
                    break;
                case "fadeOut":
                    t.alpha    = Math.max(0, t.alpha - 0.02);
                    t.duration = Math.max(0, t.duration - 1);
                    if (t.alpha <= 0 || t.duration <= 0) {
                        this.thoughts.splice(i, 1);
                        continue;
                    }
                    break;
                default:
                    this.thoughts.splice(i, 1);
                    continue;
            }
        }

        if (this.cooldown > 0) return;

        // ── Auto-trigger conditions ───────────────────────────────
        const sanity    = g.sanity    ?? 100;
        const maxSanity = g.maxSanity ?? 100;
        const timeLeft  = (g.maxLoopTime ?? 600) - (g.loopTime ?? 0);

        if (sanity < 30 && Math.random() < 0.003) {
            this.think("sanity_low");
            return;
        }
        if (timeLeft < 60 && Math.random() < 0.005) {
            this.think("time_low");
            return;
        }

        const room = (typeof getCurrentRoom === "function")
            ? (function(){ try { return getCurrentRoom(); } catch(_){ return null; } })()
            : null;

        if (room && (room.ambientLight ?? 1) < 0.08 && Math.random() < 0.002) {
            this.think("dark_room");
            return;
        }
        if (g.currentRoom === "chapel" && Math.random() < 0.003) {
            this.think("sacred");
            return;
        }
        if (["void_chamber","ritual_chamber","catacombs"].includes(g.currentRoom) &&
            Math.random() < 0.003) {
            this.think("near_entity");
            return;
        }
        if (["secret_garden","sanctuary","chapel"].includes(g.currentRoom) &&
            Math.random() < 0.002) {
            this.think("beauty");
            return;
        }

        // Idle detection
        if (typeof keys !== "undefined") {
            const moving = keys["KeyW"]  || keys["KeyA"]  || keys["KeyS"]  || keys["KeyD"] ||
                           keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
            if (!moving && Math.random() < 0.001) {
                this.think("idle");
                return;
            }
        }

        // Death memory proximity
        if (typeof DeathMemories !== "undefined" &&
            typeof DeathMemories.getNearestGhost === "function") {
            try {
                const nearGhost = DeathMemories.getNearestGhost(
                    g.playerX ?? 0, g.playerY ?? 0, g.currentRoom
                );
                if (nearGhost && Math.random() < 0.01) {
                    this.think("near_death_ghost");
                    return;
                }
            } catch (_) {}
        }
    },

    // ── Draw ─────────────────────────────────────────────────────
    draw(ctx, cw, ch) {
        if (!this.thoughts.length || !ctx) return;

        ctx.save();

        for (let i = 0; i < this.thoughts.length; i++) {
            const t = this.thoughts[i];
            if (t.alpha <= 0) continue;

            const y = ch * 0.25 + i * 34;

            ctx.globalAlpha     = Math.max(0, Math.min(1, t.alpha));
            ctx.fillStyle       = "rgba(190,210,230,0.95)";
            ctx.font            = "italic 14px Georgia, 'Times New Roman', serif";
            ctx.textAlign       = "center";
            ctx.textBaseline    = "middle";
            ctx.shadowColor     = "rgba(0,0,0,0.55)";
            ctx.shadowBlur      = 5;
            ctx.shadowOffsetX   = 1;
            ctx.shadowOffsetY   = 1;

            ctx.fillText(`"${t.text}"`, cw / 2, y);
        }

        ctx.restore();
    },

    // ─── RESET ──────────────────────────────────────────────────
    reset() {
        this.thoughts = [];
        this.cooldown = 120;    // brief cooldown so no thought fires mid-transition
    },
};

// ═════════════════════════════════════════════════════════════════
//  PUBLIC HELPERS
// ═════════════════════════════════════════════════════════════════

/**
 * Record a story action from anywhere in the codebase.
 * @param {string} id   - Action identifier
 * @param {object} data - Optional contextual data
 */
function storyAction(id, data) {
    try {
        if (typeof StoryEngine !== "undefined") StoryEngine.recordAction(id, data);
    } catch (_) {}
}

/**
 * Trigger an inner monologue thought from anywhere in the codebase.
 * @param {string}  category - Key from Monologue.THOUGHTS
 * @param {boolean} force    - Bypass cooldown if true
 */
function triggerMonologue(category, force) {
    try {
        if (typeof Monologue !== "undefined") Monologue.think(category, !!force);
    } catch (_) {}
}