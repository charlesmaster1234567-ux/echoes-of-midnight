// ═════════════════════════════════════════════════════════════════
//  ECHOES OF MIDNIGHT — Clean Engine v5.2 "AI Integration Patch"
//  PATCH ONLY — original v5.1 preserved, 3 surgical AI changes:
//  1. AI.update() in main loop (ambient + whisper + prefetch)
//  2. AI.reset() in loop reset (preserves cache across loops)
//  3. AI pre-menu horror dialogue (intercepts first menu input)
// ═════════════════════════════════════════════════════════════════

"use strict";

// ─── CONSTANTS ──────────────────────────────────────────────────
const LOOP_DURATION            = 600;
const MAX_DIALOG_QUEUE         = 8;
const INTERACT_COOLDOWN_FRAMES = 30;
const MEMORY_CLEAN_INTERVAL    = 600;
const MAX_PARTICLES_ALLOWED    = 200;
const MAX_FOOTPRINTS_ALLOWED   = 30;
const MAX_WEATHER_ALLOWED      = 150;
const MAX_JOURNAL_ENTRIES      = 200;

// ─── DOM ────────────────────────────────────────────────────────
const canvas         = document.getElementById("gameCanvas");
const ctx            = canvas.getContext("2d");
const minimapCanvas  = document.getElementById("minimap");
const minimapCtx     = minimapCanvas ? minimapCanvas.getContext("2d") : null;
const dialogBox      = document.getElementById("dialogBox");
const dialogSpeaker  = document.getElementById("dialogSpeaker");
const dialogText     = document.getElementById("dialogText");
const dialogChoices  = document.getElementById("dialogChoices");
const dialogContinue = document.getElementById("dialogContinue");
const inventoryEl    = document.getElementById("inventory");
const journalEl      = document.getElementById("journal");
const journalContent = document.getElementById("journalContent");
const journalClose   = document.getElementById("journalClose");
const levelUpNotice  = document.getElementById("levelUpNotice");

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (minimapCanvas) { minimapCanvas.width = 160; minimapCanvas.height = 120; }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ─── SAFE CALL HELPER ───────────────────────────────────────────
function _safe(fn, ...args) {
    if (typeof fn !== "function") return undefined;
    try { return fn(...args); } catch (_) { return undefined; }
}

// ─── AUDIO BRIDGE ───────────────────────────────────────────────
let audioCtx = null;
let _audioInitDone = false;

function _ensureAudio() {
    if (_audioInitDone) return;
    _audioInitDone = true;
    try {
        if (typeof initAudio === "function") {
            initAudio();
            if (typeof AudioManager !== "undefined" && AudioManager.ctx) {
                audioCtx = AudioManager.ctx;
            }
        }
    } catch (_) {}
}

if (typeof window.playSound !== "function") window.playSound = function() {};

// ─── INPUT ──────────────────────────────────────────────────────
const keys            = {};
const keysJustPressed = {};

const PREVENTED_KEYS = new Set([
    "Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "Tab","ShiftLeft","ShiftRight","Escape","Backquote"
]);

window.addEventListener("keydown", e => {
    if (!keys[e.code]) keysJustPressed[e.code] = true;
    keys[e.code] = true;
    if (PREVENTED_KEYS.has(e.code)) e.preventDefault();
    _ensureAudio();
});

window.addEventListener("keyup", e => { keys[e.code] = false; });

// ═════════════════════════════════════════════════════════════════
//  CANVAS CLICK HANDLER — UPDATED FOR AI MENU DIALOGUE
// ═════════════════════════════════════════════════════════════════
canvas.addEventListener("click", () => {
    _ensureAudio();

    if (gameState === "menu") {
        // AI horror dialogue intercept — active dialogue
        if (typeof AI !== "undefined" && AI.isMenuDialogueActive &&
            AI.isMenuDialogueActive()) {
            try {
                const done = AI.advanceMenuDialogue();
                if (done) window._menuDialogueDone = true;
            } catch (_) {}
            return;
        }

        // First click triggers AI dialogue
        if (!window._menuDialogueStarted && !window._menuDialogueDone &&
            typeof AI !== "undefined" && AI.startMenuDialogue) {
            try {
                window._menuDialogueStarted = true;
                AI.startMenuDialogue();
                AI.advanceMenuDialogue();
                return;
            } catch (_) {
                window._menuDialogueDone = true;
            }
        }

        // Normal click → start game
        startNewGame();
        window._menuDialogueStarted = false;
        window._menuDialogueDone    = false;
    }
    else if (gameState === "playing" && dialogActive) {
        advanceDialog();
    }
    else if (gameState === "ending") {
        gameState = "menu";
        window._menuDialogueStarted = false;
        window._menuDialogueDone    = false;
    }
});

if (journalClose) {
    journalClose.addEventListener("click", () => {
        journalEl.classList.add("hidden");
        journalOpen = false;
    });
}

function consumeKey(code)  { keysJustPressed[code] = false; }
function clearJustPressed() {
    for (const k in keysJustPressed) keysJustPressed[k] = false;
}

// ─── GAME STATE ─────────────────────────────────────────────────
let gameState        = "menu";
let frame            = 0;
let dialogActive     = false;
let journalOpen      = false;
let currentDialog    = null;
let dialogQueue      = [];
let dialogCallback   = null;
let transitionAlpha  = 0;
let transitionState  = "none";
let transitionCallback = null;
let stepTimer        = 0;
let roomsVisited     = new Set();
let debugOverlay     = false;

let _checkingMissions   = false;
let _levelingUp         = false;
let _levelUpTimeout     = null;
let _lastInteractFrame  = -100;
let _interactInProgress = false;

let _lightingCanvas = null;
let _lightingCtx    = null;

// ═════════════════════════════════════════════════════════════════
//  SMOOTH MOTION SYSTEM — PATCH #1
//  Visual position is separate from logical position.
//  Logical position: collision-correct, integer steps.
//  Visual position: sub-pixel smoothed, never jumps.
// ═════════════════════════════════════════════════════════════════

let _visX = 400;
let _visY = 480;

const VIS_SMOOTH = 0.25;

function _updateVisualPosition() {
    _visX += (game.playerX - _visX) * VIS_SMOOTH;
    _visY += (game.playerY - _visY) * VIS_SMOOTH;

    if (Math.abs(game.playerX - _visX) < 0.08) _visX = game.playerX;
    if (Math.abs(game.playerY - _visY) < 0.08) _visY = game.playerY;
}

function _snapVisualPosition() {
    _visX = game.playerX;
    _visY = game.playerY;
}

const game = {
    loop: 0, loopTime: 0, maxLoopTime: LOOP_DURATION,
    sanity: 100, maxSanity: 100,
    inventory: [], cluesFound: [], journalEntries: [],
    flags: {}, permanentFlags: {},
    currentRoom: "foyer",
    playerX: 400, playerY: 480, playerAngle: -Math.PI / 2,
    flashlightBattery: 100, flashlightOn: true,
    interactTarget: null, endingReached: null,
    ghostsActive: [],
    xp: 0, level: 1, xpToNext: 50, totalXP: 0,
    roomsExplored: 0, itemsFound: 0, ghostsSeen: 0,
    missionsComplete: 0, activeMissions: [], completedMissions: [],
};

// ═════════════════════════════════════════════════════════════════
//  XP / LEVEL
// ═════════════════════════════════════════════════════════════════
function giveXP(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    game.xp     += amount;
    game.totalXP += amount;
    _safe(window.trackStat, "xp", amount);

    let ups = 0;
    while (game.xp >= game.xpToNext && ups < 5) {
        game.xp -= game.xpToNext;
        game.level++;
        game.xpToNext = Math.floor(game.xpToNext * 1.4);
        _onLevelUp();
        ups++;
    }
}

function _onLevelUp() {
    if (_levelingUp) return;
    _levelingUp = true;
    try {
        _safe(window.playSound, "levelup");
        _safe(window.trackStat, "level", game.level);

        game.maxSanity += 10;
        game.sanity = Math.min(game.sanity + 20, game.maxSanity);

        if (levelUpNotice) {
            levelUpNotice.textContent = `⬆ LEVEL ${game.level}`;
            levelUpNotice.style.opacity = "1";
            if (_levelUpTimeout) clearTimeout(_levelUpTimeout);
            _levelUpTimeout = setTimeout(() => {
                levelUpNotice.style.opacity = "0";
                _levelUpTimeout = null;
            }, 2500);
        }

        _safe(window.emitLevelUpParticles, game.playerX, game.playerY);

        if      (game.level === 3)  { showDialog("SYSTEM", "Level 3 — Upstairs unlocked."); game.flags.stairsUnlocked = true; }
        else if (game.level === 5)   showDialog("SYSTEM", "Level 5 — Senses sharpen.");
        else if (game.level === 8)   showDialog("SYSTEM", "Level 8 — Deep areas unlocked.");
        else if (game.level === 10)  showDialog("SYSTEM", "Level 10 — MASTER INVESTIGATOR.");

        addClue(`level_${game.level}`, `Reached Level ${game.level}.`);
    } finally {
        _levelingUp = false;
    }
    setTimeout(checkMissions, 0);
}

// ═════════════════════════════════════════════════════════════════
//  MISSIONS
// ═════════════════════════════════════════════════════════════════
const ALL_MISSIONS = [
    { id: "m_explore5",  name: "Explorer",       desc: "Visit 5 rooms",      check: () => roomsVisited.size >= 5,  xp: 30 },
    { id: "m_explore15", name: "Cartographer",   desc: "Visit 15 rooms",     check: () => roomsVisited.size >= 15, xp: 60 },
    { id: "m_explore25", name: "Every Corner",   desc: "Visit 25 rooms",     check: () => roomsVisited.size >= 25, xp: 100 },
    { id: "m_explore40", name: "Mansion Master", desc: "Visit 40 rooms",     check: () => roomsVisited.size >= 40, xp: 150 },
    { id: "m_clue5",     name: "Curious Mind",   desc: "Find 5 clues",       check: () => game.cluesFound.length >= 5,  xp: 25 },
    { id: "m_clue15",    name: "Detective",      desc: "Find 15 clues",      check: () => game.cluesFound.length >= 15, xp: 50 },
    { id: "m_clue30",    name: "Master Sleuth",  desc: "Find 30 clues",      check: () => game.cluesFound.length >= 30, xp: 100 },
    { id: "m_seal1",     name: "First Fragment", desc: "Find 1 seal",        check: () => countSeals() >= 1, xp: 20 },
    { id: "m_seal5",     name: "All Seals",      desc: "All 5 seals",        check: () => countSeals() >= 5, xp: 80 },
    { id: "m_loop2",     name: "Déjà Vu",        desc: "2 loops",            check: () => game.loop >= 2,    xp: 20 },
    { id: "m_loop5",     name: "Time Veteran",   desc: "5 loops",            check: () => game.loop >= 5,    xp: 50 },
    { id: "m_level5",    name: "Rising Power",   desc: "Level 5",            check: () => game.level >= 5,   xp: 30 },
    { id: "m_level10",   name: "Master",         desc: "Level 10",           check: () => game.level >= 10,  xp: 60 },
    { id: "m_truth",     name: "The Truth",      desc: "Discover truth",     check: () => !!game.permanentFlags.knowTruth, xp: 50 },
    { id: "m_plan",      name: "Eleanora's Plan",desc: "Find the plan",      check: () => !!game.permanentFlags.knowEleanoraPlan, xp: 50 },
    { id: "m_void",      name: "Face the Void",  desc: "Enter Void Chamber", check: () => roomsVisited.has("void_chamber"), xp: 60 },
];

function checkMissions() {
    if (_checkingMissions) return;
    _checkingMissions = true;
    const completed = [];
    try {
        for (const m of ALL_MISSIONS) {
            if (game.completedMissions.includes(m.id)) continue;
            try { if (m.check()) completed.push(m); } catch (_) {}
        }
        for (const m of completed) {
            game.completedMissions.push(m.id);
            game.missionsComplete++;
        }
    } finally { _checkingMissions = false; }

    for (const m of completed) {
        showDialog("🏆 MISSION", `${m.name}: ${m.desc} (+${m.xp} XP)`);
        giveXP(m.xp);
    }
}

// ═════════════════════════════════════════════════════════════════
//  INVENTORY / ITEMS / CLUES
// ═════════════════════════════════════════════════════════════════
function hasItem(id) { return game.inventory.some(i => i.id === id); }

function addItem(id, icon, name) {
    if (hasItem(id)) return;
    game.inventory.push({ id, icon, name });
    game.itemsFound++;
    _safe(window.triggerMonologue, "found_item");
    _safe(window.trackStat, "item_found", id);
    _safe(window.playSound, "pickup");
    updateInventoryUI();
}

function removeItem(id) {
    game.inventory = game.inventory.filter(i => i.id !== id);
    updateInventoryUI();
}

function countSeals() {
    const pf = game.permanentFlags;
    return [
        pf.hasFirstSeal, pf.hasSecondSeal, pf.hasThirdSeal,
        pf.hasFourthSeal, pf.hasFifthSeal,
    ].filter(Boolean).length;
}

function addClue(id, text) {
    if (game.cluesFound.includes(id)) return;
    game.cluesFound.push(id);
    game.journalEntries.push({ loop: game.loop, text, id });
    if (game.journalEntries.length > MAX_JOURNAL_ENTRIES) {
        game.journalEntries.shift();
    }
    _safe(window.triggerMonologue, "found_clue");
    setTimeout(checkMissions, 0);
}

function updateInventoryUI() {
    if (!inventoryEl) return;
    inventoryEl.innerHTML = "";
    inventoryEl.classList.remove("hidden");
    for (const item of game.inventory) {
        const div = document.createElement("div");
        div.className = "inv-item";
        div.innerHTML = `${item.icon}<span class="tooltip">${item.name}</span>`;
        inventoryEl.appendChild(div);
    }
}

// ═════════════════════════════════════════════════════════════════
//  DIALOG SYSTEM
// ═════════════════════════════════════════════════════════════════
window._gameShowDialog = null;
window._gameShowDialogWithChoices = null;

function showDialog(speaker, text, callback) {
    if (!window._gameShowDialog) window._gameShowDialog = showDialog;
    if (dialogQueue.length >= MAX_DIALOG_QUEUE) {
        if (typeof callback === "function") try { callback(); } catch (_) {}
        return;
    }
    const last = dialogQueue[dialogQueue.length - 1];
    if (last && last.speaker === speaker && last.text === text) return;

    dialogQueue.push({ speaker, text, callback, choices: null });
    if (!dialogActive) _nextDialog();
}

function showDialogWithChoices(speaker, text, choices) {
    if (!window._gameShowDialogWithChoices) {
        window._gameShowDialogWithChoices = showDialogWithChoices;
    }
    if (dialogQueue.length >= MAX_DIALOG_QUEUE) return;
    dialogQueue.push({ speaker, text, choices });
    if (!dialogActive) _nextDialog();
}

function _nextDialog() {
    if (dialogQueue.length === 0) {
        dialogActive = false;
        dialogBox.classList.add("hidden");
        if (dialogCallback) {
            const cb = dialogCallback;
            dialogCallback = null;
            try { cb(); } catch (_) {}
        }
        return;
    }

    dialogActive  = true;
    currentDialog = dialogQueue.shift();
    dialogBox.classList.remove("hidden");
    dialogSpeaker.textContent = currentDialog.speaker || "";
    dialogText.textContent    = "";
    dialogChoices.innerHTML   = "";
    dialogContinue.style.display = "none";

    const text = currentDialog.text || "";
    let i = 0;

    const typeInterval = setInterval(() => {
        if (i < text.length) {
            dialogText.textContent += text[i];
            i++;
        } else {
            clearInterval(typeInterval);
            currentDialog._typeInterval = null;
            if (currentDialog.choices) {
                _showChoiceButtons(currentDialog.choices);
            } else {
                dialogContinue.style.display = "block";
                dialogCallback = currentDialog.callback || null;
            }
        }
    }, 18);

    currentDialog._typeInterval = typeInterval;
    currentDialog._fullText     = text;
}

function _showChoiceButtons(choices) {
    dialogChoices.innerHTML = "";
    if (!Array.isArray(choices)) return;

    choices.forEach((c, idx) => {
        const div = document.createElement("div");
        div.textContent = `${idx + 1}. ${c.text}`;
        div.addEventListener("click", e => {
            e.stopPropagation();
            dialogActive = false;
            dialogBox.classList.add("hidden");
            dialogQueue = [];
            try { if (typeof c.action === "function") c.action(); } catch (_) {}
        });
        dialogChoices.appendChild(div);
    });
}

function advanceDialog() {
    if (!dialogActive || !currentDialog) return;

    if (currentDialog._typeInterval) {
        clearInterval(currentDialog._typeInterval);
        currentDialog._typeInterval = null;
        dialogText.textContent = currentDialog._fullText || "";
        if (currentDialog.choices) _showChoiceButtons(currentDialog.choices);
        else dialogContinue.style.display = "block";
        return;
    }

    if (!currentDialog.choices) _nextDialog();
}

function _handleDialogKeys() {
    if (!dialogActive) return false;

    if (keysJustPressed["Space"] || keysJustPressed["Enter"] || keysJustPressed["KeyE"]) {
        advanceDialog();
        consumeKey("Space"); consumeKey("Enter"); consumeKey("KeyE");
        return true;
    }

    if (currentDialog && Array.isArray(currentDialog.choices) && !currentDialog._typeInterval) {
        for (let i = 0; i < currentDialog.choices.length; i++) {
            if (keysJustPressed[`Digit${i + 1}`]) {
                consumeKey(`Digit${i + 1}`);
                dialogActive = false;
                dialogBox.classList.add("hidden");
                dialogQueue = [];
                try { currentDialog.choices[i].action(); } catch (_) {}
                return true;
            }
        }
    }

    if (keysJustPressed["Escape"]) {
        consumeKey("Escape");
        dialogActive = false;
        dialogBox.classList.add("hidden");
        dialogQueue = [];
    }

    return true;
}

// ═════════════════════════════════════════════════════════════════
//  ROOMS
// ═════════════════════════════════════════════════════════════════
function changeRoom(roomId) {
    if (typeof ROOMS === "undefined" || !ROOMS[roomId]) return;
    if (transitionState !== "none") return;

    const room     = ROOMS[roomId];
    const fromRoom = game.currentRoom;

    transitionState = "fadeOut";
    transitionAlpha = 0;

    transitionCallback = () => {
        game.currentRoom = roomId;

        const spawn = (typeof getSpawnForRoom === "function")
            ? getSpawnForRoom(roomId, fromRoom)
            : { x: room.width / 2, y: room.height / 2 };

        game.playerX = spawn.x;
        game.playerY = spawn.y;

        _snapVisualPosition();

        if (!roomsVisited.has(roomId)) {
            roomsVisited.add(roomId);
            game.roomsExplored++;
            giveXP(5);
            _safe(window.triggerMonologue, "new_room");
            _safe(window.trackStat, "room_visit", roomId);
            _safe(window.storyAction, "room_entered", { room: roomId });
            setTimeout(checkMissions, 0);
        }

        _safe(window.playSound, "door");
        _safe(window.setupWeatherForRoom, roomId);

        if (typeof AudioManager !== "undefined" && AudioManager.initialized) {
            try { AudioManager.update(roomId); } catch (_) {}
        }
    };
}

function getCurrentRoom() {
    return (typeof ROOMS !== "undefined" && ROOMS) ? (ROOMS[game.currentRoom] || null) : null;
}

// ═════════════════════════════════════════════════════════════════
//  PLAYER UPDATE
// ═════════════════════════════════════════════════════════════════
function updatePlayer() {
    if (_handleDialogKeys()) return;
    if (dialogActive) return;

    if (keysJustPressed["KeyJ"] || keysJustPressed["Tab"]) {
        _toggleJournal();
        consumeKey("KeyJ"); consumeKey("Tab");
        return;
    }

    if (journalOpen) {
        if (keysJustPressed["Escape"]) {
            journalEl.classList.add("hidden");
            journalOpen = false;
            consumeKey("Escape");
        }
        return;
    }

    if (transitionState !== "none") return;
    if (typeof combat !== "undefined" && combat.dodgeActive) return;

    if (keysJustPressed["Backquote"]) {
        debugOverlay = !debugOverlay;
        consumeKey("Backquote");
    }

    if (keysJustPressed["KeyU"]) {
        consumeKey("KeyU");
        const r = getCurrentRoom();
        if (r) {
            const pass = new Set(["rug","runner_rug","pentagram","candle_circle","bones","fence"]);
            let fx = r.width / 2, fy = r.height / 2;
            for (let attempts = 0; attempts < 15; attempts++) {
                const tx = 40 + Math.random() * (r.width - 80);
                const ty = 40 + Math.random() * (r.height - 80);
                let blocked = false;
                for (const f of r.furniture) {
                    if (pass.has(f.type)) continue;
                    if (tx > f.x - f.w/2 - 18 && tx < f.x + f.w/2 + 18 &&
                        ty > f.y - f.h/2 - 18 && ty < f.y + f.h/2 + 18) {
                        blocked = true;
                        break;
                    }
                }
                if (!blocked) { fx = tx; fy = ty; break; }
            }
            game.playerX = fx;
            game.playerY = fy;
            _snapVisualPosition();
        }
        return;
    }

    const room = getCurrentRoom();
    if (!room) return;

    const speed = 3;
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"]  || keys["KeyA"]) dx = -1;
    if (keys["ArrowRight"] || keys["KeyD"]) dx =  1;
    if (keys["ArrowUp"]    || keys["KeyW"]) dy = -1;
    if (keys["ArrowDown"]  || keys["KeyS"]) dy =  1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const nx = game.playerX + dx * speed;
    const ny = game.playerY + dy * speed;

    const passTypes = new Set(["rug","runner_rug","pentagram","candle_circle","bones","fence"]);
    let canX = true, canY = true;

    for (const f of room.furniture) {
        if (passTypes.has(f.type)) continue;
        const hw = f.w / 2 + 12, hh = f.h / 2 + 12;
        if (nx > f.x - hw && nx < f.x + hw &&
            game.playerY > f.y - hh && game.playerY < f.y + hh) canX = false;
        if (game.playerX > f.x - hw && game.playerX < f.x + hw &&
            ny > f.y - hh && ny < f.y + hh) canY = false;
    }

    if (canX) game.playerX = Math.max(30, Math.min(room.width  - 30, nx));
    if (canY) game.playerY = Math.max(30, Math.min(room.height - 30, ny));

    if (dx !== 0 || dy !== 0) {
        game.playerAngle = Math.atan2(dy, dx);
        stepTimer++;
        if (stepTimer % 20 === 0) {
            if (typeof AudioWiring !== "undefined" && typeof AudioWiring.playFootstep === "function") {
                try { AudioWiring.playFootstep(); } catch (_) {}
            } else {
                _safe(window.playSound, "step");
            }
        }
        _safe(window.trackFootprints, game.playerX, game.playerY, game.playerAngle, true);
    }

    if (game.flashlightBattery < 0) game.flashlightBattery = 0;

    if (keysJustPressed["KeyF"]) {
        game.flashlightOn = game.flashlightBattery > 0 ? !game.flashlightOn : false;
        _safe(window.playSound, "flashlight");
        consumeKey("KeyF");
    }

    if (keysJustPressed["KeyR"] && hasItem("battery")) {
        game.flashlightBattery = Math.min(100, game.flashlightBattery + 50);
        game.flashlightOn = true;
        removeItem("battery");
        _safe(window.playSound, "use");
        consumeKey("KeyR");
    }

    if (keysJustPressed["KeyE"] || keysJustPressed["Space"]) {
        consumeKey("KeyE"); consumeKey("Space");
        keys["KeyE"] = false; keys["Space"] = false;
        _interact();
    }

    if (keysJustPressed["KeyQ"]) {
        if (typeof combat !== "undefined" && combat.attackCooldown <= 0) {
            _safe(window.performAttack);
        }
        consumeKey("KeyQ");
    }

    if (keysJustPressed["KeyM"]) {
        _toggleJournal();
        consumeKey("KeyM");
    }

    game.interactTarget = null;
    let closestDist = 65;

    if (Array.isArray(room.interactables)) {
        for (const obj of room.interactables) {
            if (obj.condition && !obj.condition()) continue;
            const d = Math.hypot(game.playerX - obj.x, game.playerY - obj.y);
            if (d < closestDist) { closestDist = d; game.interactTarget = obj; }
        }
    }

    if (Array.isArray(room.doors)) {
        for (const door of room.doors) {
            if (door.condition && !door.condition()) continue;
            const cx = door.x + door.w / 2;
            const cy = door.y + door.h / 2;
            const d  = Math.hypot(game.playerX - cx, game.playerY - cy);
            if (d < closestDist) {
                closestDist = d;
                game.interactTarget = { ...door, isDoor: true };
            }
        }
    }
}

function _interact() {
    if (_interactInProgress) return;
    if (frame - _lastInteractFrame < INTERACT_COOLDOWN_FRAMES) return;
    _interactInProgress = true;
    _lastInteractFrame  = frame;
    try {
        if (typeof getNearestNPC === "function") {
            const npc = getNearestNPC();
            if (npc && npc.getInteractDistance() < 65) {
                try { npc.interact(); } catch (_) {}
                return;
            }
        }

        if (!game.interactTarget) return;

        if (game.interactTarget.isDoor) {
            const tr = game.interactTarget.targetRoom;
            game.interactTarget = null;
            changeRoom(tr);
        } else {
            const action = game.interactTarget.action;
            game.interactTarget = null;
            if (typeof action === "function") {
                try { action(); } catch (_) {}
            }
        }
    } finally {
        _interactInProgress = false;
    }
}

// ═════════════════════════════════════════════════════════════════
//  JOURNAL
// ═════════════════════════════════════════════════════════════════
function _toggleJournal() {
    journalOpen = !journalOpen;
    if (!journalOpen) { journalEl.classList.add("hidden"); return; }

    journalEl.classList.remove("hidden");
    journalContent.innerHTML = "";

    const stats = document.createElement("div");
    stats.className = "journal-entry";
    stats.innerHTML = `<div class="journal-clue">📊 Level ${game.level} | XP: ${game.xp}/${game.xpToNext} | Loop #${game.loop + 1}<br>🔮 Seals: ${countSeals()}/5 | 📍 Rooms: ${roomsVisited.size} | 🏆 ${game.completedMissions.length}</div>`;
    journalContent.appendChild(stats);

    const missDiv = document.createElement("div");
    missDiv.className = "journal-entry";
    const active = ALL_MISSIONS.filter(m => !game.completedMissions.includes(m.id));
    let mHTML = '<div class="journal-loop">ACTIVE MISSIONS</div>';
    if (!active.length) {
        mHTML += '<div class="journal-clue">All complete! 🎉</div>';
    } else {
        active.slice(0, 5).forEach(m => {
            mHTML += `<div class="journal-clue">• ${m.name}: ${m.desc}</div>`;
        });
    }
    missDiv.innerHTML = mHTML;
    journalContent.appendChild(missDiv);

    if (typeof getQuestLogHTML === "function") {
        try {
            const qd = document.createElement("div");
            qd.innerHTML = getQuestLogHTML();
            journalContent.appendChild(qd);
        } catch (_) {}
    }

    if (typeof getStatsHTML === "function") {
        try {
            const sd = document.createElement("div");
            sd.innerHTML = getStatsHTML();
            journalContent.appendChild(sd);
        } catch (_) {}
    }

    if (game.journalEntries.length === 0) {
        const e = document.createElement("div");
        e.className = "journal-entry";
        e.innerHTML = '<div class="journal-clue">No clues yet. Explore!</div>';
        journalContent.appendChild(e);
    } else {
        for (let i = game.journalEntries.length - 1; i >= 0; i--) {
            const entry = game.journalEntries[i];
            const div = document.createElement("div");
            div.className = "journal-entry";
            div.innerHTML = `<div class="journal-loop">Loop #${entry.loop + 1}</div><div class="journal-clue">${entry.text}</div>`;
            journalContent.appendChild(div);
        }
    }
}

// ═════════════════════════════════════════════════════════════════
//  RENDERING
// ═════════════════════════════════════════════════════════════════
function render() {
    const room = getCurrentRoom();
    if (!room) return;

    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    try {
        if (typeof updateCinema === "function") {
            updateCinema(_visX, _visY, game.currentRoom);
        }
    } catch (_) {}

    const camData = (typeof Camera !== "undefined" && typeof Camera.getTransform === "function")
        ? (function() { try { return Camera.getTransform(cw, ch, room.width, room.height); } catch (_) { return null; } })()
        : null;

    const scale = camData ? camData.scale : Math.min(cw / room.width, ch / room.height) * 0.82;
    const shake = (typeof getShakeOffset === "function") ? getShakeOffset() : { x: 0, y: 0 };
    const camX  = (camData ? camData.camX : cw / 2 - _visX * scale) + shake.x;
    const camY  = (camData ? camData.camY : ch / 2 - _visY * scale) + shake.y;

    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(scale, scale);

    if (camData && camData.angle) {
        ctx.translate(room.width / 2, room.height / 2);
        ctx.rotate(camData.angle);
        ctx.translate(-room.width / 2, -room.height / 2);
    }

    ctx.fillStyle = room.floorColor || "#111";
    ctx.fillRect(0, 0, room.width, room.height);

    if (typeof Camera !== "undefined" && typeof Camera.drawPerspectiveFloor === "function") {
        try { Camera.drawPerspectiveFloor(ctx, room.width, room.height); } catch (_) {}
    } else {
        ctx.strokeStyle = "rgba(255,255,255,0.02)";
        ctx.lineWidth = 1;
        for (let x = 0; x < room.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, room.height); ctx.stroke();
        }
        for (let y = 0; y < room.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(room.width, y); ctx.stroke();
        }
    }

    ctx.fillStyle = room.wallColor || "#222";
    ctx.fillRect(0, 0, room.width, 20);
    ctx.fillRect(0, 0, 20, room.height);
    ctx.fillRect(room.width - 20, 0, 20, room.height);
    ctx.fillRect(0, room.height - 20, room.width, 20);

    try { _drawFurniture(room); }     catch (_) {}
    try { _drawDoors(room); }         catch (_) {}
    try { _drawInteractables(room); } catch (_) {}
    try { _drawGhosts(room); }        catch (_) {}
    try { _drawPlayer(); }            catch (_) {}

    if (typeof DeathMemories !== "undefined" && DeathMemories.draw) {
        try { DeathMemories.draw(ctx, game.currentRoom); } catch (_) {}
    }
    if (typeof drawParticles === "function") try { drawParticles(ctx); } catch (_) {}
    if (typeof drawCombat    === "function") try { drawCombat(ctx); }    catch (_) {}
    if (typeof drawNPCs      === "function") try { drawNPCs(ctx); }      catch (_) {}
    if (typeof SetPieces !== "undefined" && SetPieces.draw) {
        try { SetPieces.draw(ctx); } catch (_) {}
    }

    if (typeof Camera !== "undefined" && typeof Camera.drawDepthFog === "function") {
        try { Camera.drawDepthFog(ctx, room.width, room.height); } catch (_) {}
    }

    if (typeof Camera !== "undefined" && typeof Camera.drawAmbientFlicker === "function") {
        try { Camera.drawAmbientFlicker(ctx, room.width, room.height); } catch (_) {}
    }

    try { _drawLighting(room); } catch (_) {}

    ctx.restore();

    try { _drawSanityEffects(); } catch (_) {}

    if (typeof Camera !== "undefined") {
        if (typeof Camera.drawVignette === "function") try { Camera.drawVignette(ctx, cw, ch); } catch (_) {}
        if (typeof Camera.drawGrain    === "function") try { Camera.drawGrain(ctx, cw, ch);    } catch (_) {}
        if (typeof Camera.drawChromaticAberration === "function") {
            try { Camera.drawChromaticAberration(ctx, cw, ch); } catch (_) {}
        }
    }

    if (typeof SetPieces !== "undefined" && SetPieces.drawOverlay) {
        try { SetPieces.drawOverlay(ctx, cw, ch); } catch (_) {}
    }

    try { _drawHUD(); }            catch (_) {}
    try { _drawInteractPrompt(); } catch (_) {}
    if (typeof drawCombatHUD === "function") try { drawCombatHUD(ctx, cw, ch); } catch (_) {}
    try { _drawTransition(); }     catch (_) {}

    if (typeof drawAchievementNotification === "function") {
        try { drawAchievementNotification(ctx, cw, ch); } catch (_) {}
    }
    if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.draw) {
        try { SubtitleSystem.draw(ctx, cw, ch); } catch (_) {}
    }
    if (typeof Monologue !== "undefined" && Monologue.draw) {
        try { Monologue.draw(ctx, cw, ch); } catch (_) {}
    }

    try { _drawMinimap(); } catch (_) {}
    if (debugOverlay) try { _drawDebugOverlay(); } catch (_) {}
}

// ─── FURNITURE ──────────────────────────────────────────────────
function _drawFurniture(room) {
    if (!Array.isArray(room.furniture)) return;
    for (const f of room.furniture) {
        ctx.save();
        ctx.translate(f.x, f.y);
        try { _drawFurniturePiece(f); } catch (_) {}
        ctx.restore();
    }
}

function _drawFurniturePiece(f) {
    switch (f.type) {
        case "chandelier":
            ctx.fillStyle = "#2a2018"; ctx.fillRect(-f.w/2, -5, f.w, 10);
            for (let i = -3; i <= 3; i++) {
                ctx.fillStyle = "#ffcc44";
                ctx.globalAlpha = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;
                ctx.beginPath(); ctx.arc(i * 12, 8, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            break;
        case "table": case "desk": case "longtable": case "nightstand": case "counter":
            ctx.fillStyle = "#2a1a10"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.strokeStyle = "#1a0e06"; ctx.lineWidth = 2;
            ctx.strokeRect(-f.w/2, -f.h/2, f.w, f.h);
            break;
        case "chair": case "bench": case "pew": case "rocking_chair":
            ctx.fillStyle = "#221510"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            break;
        case "bookshelf": case "wine_rack":
            ctx.fillStyle = "#1a1208"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            for (let y = -f.h/2 + 8; y < f.h/2 - 5; y += 18) {
                ctx.fillStyle = ["#3a1a10","#2a2a10","#1a2a1a","#2a1a2a"][(y * 7) & 3];
                ctx.fillRect(-f.w/2 + 3, y, f.w - 6, 13);
            }
            break;
        case "bed": case "cot": case "crib":
            ctx.fillStyle = "#1a1520"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = "#2a2030"; ctx.fillRect(-f.w/2 + 4, -f.h/2 + 4, f.w - 8, f.h - 8);
            break;
        case "mirror":
            ctx.fillStyle = "#1a2030"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = `rgba(100,150,200,${(0.1 + Math.sin(frame * 0.02) * 0.05).toFixed(3)})`;
            ctx.fillRect(-f.w/2 + 3, -f.h/2 + 3, f.w - 6, f.h - 6);
            break;
        case "rug": case "runner_rug":
            ctx.fillStyle = "rgba(60,20,20,0.3)";
            ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            break;
        case "stairs":
            ctx.fillStyle = "#1a1510"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = "#221a12";
                ctx.fillRect(-f.w/2, -f.h/2 + i * (f.h/5), f.w, f.h/5 - 2);
            }
            break;
        case "fireplace": case "furnace":
            ctx.fillStyle = "#1a1210"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = (game.flags.fireLit && f.type === "fireplace") ? "#442200" : "#0a0a0a";
            ctx.fillRect(-f.w/2 + 8, -f.h/2 + 8, f.w - 16, f.h - 8);
            if (game.flags.fireLit && f.type === "fireplace") {
                ctx.fillStyle = `rgba(255,150,30,${(0.3 + Math.sin(frame * 0.1) * 0.15).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
            }
            break;
        case "clock":
            ctx.fillStyle = "#1a1510"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = "#221a12"; ctx.beginPath(); ctx.arc(0, -f.h/4, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#aa9977"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, -f.h/4); ctx.lineTo(0, -f.h/4 - 8); ctx.stroke();
            break;
        case "pentagram":
            ctx.strokeStyle = `rgba(150,0,0,${(0.3 + Math.sin(frame * 0.03) * 0.15).toFixed(3)})`;
            ctx.lineWidth = 2; ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
                if (i === 0) ctx.moveTo(Math.cos(a) * f.w/2, Math.sin(a) * f.h/2);
                else         ctx.lineTo(Math.cos(a) * f.w/2, Math.sin(a) * f.h/2);
            }
            ctx.closePath(); ctx.stroke();
            break;
        case "altar":
            ctx.fillStyle = "#1a0a0a"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = `rgba(100,0,0,${(0.2 + Math.sin(frame * 0.04) * 0.1).toFixed(3)})`;
            ctx.fillRect(-f.w/2, -2, f.w, 4);
            break;
        case "candle_circle":
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.fillStyle = `rgba(255,200,100,${(0.2 + Math.sin(frame * 0.06 + i) * 0.15).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * f.w/2, Math.sin(a) * f.h/2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case "pillar":
            ctx.fillStyle = "#1a1a18"; ctx.beginPath();
            ctx.arc(0, 0, f.w/2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#222220"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, f.w/2, 0, Math.PI * 2); ctx.stroke();
            break;
        case "sofa":
            ctx.fillStyle = "#201520"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            ctx.fillStyle = "#2a1a2a"; ctx.fillRect(-f.w/2 + 4, -f.h/2 + 4, f.w - 8, f.h - 12);
            break;
        case "fountain": case "well":
            ctx.fillStyle = "#151520"; ctx.beginPath();
            ctx.arc(0, 0, f.w/2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#252530"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, f.w/2, 0, Math.PI * 2); ctx.stroke();
            break;
        case "tree":
            ctx.fillStyle = "#0a1a0a"; ctx.beginPath();
            ctx.arc(0, -10, f.w/2 + 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#1a1008"; ctx.fillRect(-4, -5, 8, f.h/2 + 5);
            break;
        case "hedge":
            ctx.fillStyle = "#0a1808"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
            break;
        case "chains":
            ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
            for (let yy = -f.h/2; yy < f.h/2; yy += 10) {
                ctx.beginPath();
                ctx.arc(Math.sin(yy * 0.5) * 5, yy, 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            break;
        case "gear":
            ctx.strokeStyle = "#2a2820"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, f.w/2, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 8; i++) {
                const ga = (i / 8) * Math.PI * 2 + frame * 0.01;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ga) * f.w/2 * 0.7, Math.sin(ga) * f.h/2 * 0.7);
                ctx.lineTo(Math.cos(ga) * f.w/2 * 1.2, Math.sin(ga) * f.h/2 * 1.2);
                ctx.stroke();
            }
            break;
        case "pendulum": {
            const pa = Math.sin(frame * 0.03) * 0.3;
            ctx.save(); ctx.rotate(pa);
            ctx.strokeStyle = "#2a2820"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -f.h/2); ctx.lineTo(0, f.h/2); ctx.stroke();
            ctx.fillStyle = "#3a3830"; ctx.beginPath();
            ctx.arc(0, f.h/2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
        }
        case "bell":
            ctx.fillStyle = "#2a2820"; ctx.beginPath();
            ctx.moveTo(-f.w/2, f.h/2);
            ctx.quadraticCurveTo(-f.w/2, -f.h/2, 0, -f.h/2);
            ctx.quadraticCurveTo(f.w/2, -f.h/2, f.w/2, f.h/2);
            ctx.closePath(); ctx.fill();
            break;
        default:
            ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
    }
}

// ─── DOORS ──────────────────────────────────────────────────────
function _drawDoors(room) {
    if (!Array.isArray(room.doors)) return;
    for (const d of room.doors) {
        if (d.condition && !d.condition()) continue;
        ctx.fillStyle = "#2a1a0a"; ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 2;
        ctx.strokeRect(d.x, d.y, d.w, d.h);

        const cx   = d.x + d.w / 2;
        const cy   = d.y + d.h / 2;
        const dist = Math.hypot(game.playerX - cx, game.playerY - cy);
        if (dist < 75) {
            ctx.fillStyle = `rgba(255,200,100,${(0.12 * (1 - dist / 75)).toFixed(3)})`;
            ctx.fillRect(d.x - 6, d.y - 6, d.w + 12, d.h + 12);
        }
    }
}

// ─── INTERACTABLES ──────────────────────────────────────────────
function _drawInteractables(room) {
    if (!Array.isArray(room.interactables)) return;
    for (const obj of room.interactables) {
        if (obj.condition && !obj.condition()) continue;
        const dist = Math.hypot(game.playerX - obj.x, game.playerY - obj.y);
        ctx.globalAlpha = (dist < 65 ? 0.9 : 0.45) + Math.sin(frame * 0.05) * 0.1;
        ctx.font = "20px Arial, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(obj.icon, obj.x, obj.y + 7);
        ctx.globalAlpha = 1;
    }
}

// ─── GHOSTS ─────────────────────────────────────────────────────
function _drawGhosts(room) {
    if (!Array.isArray(room.ghosts)) return;

    const GHOST_COLORS = {
        entity:       "#2a0040",
        victor:       "#402020",
        eleanora:     "#204060",
        ancient:      "#303020",
        deep_one:     "#102040",
        doppelganger: "#404040",
    };

    for (const g of room.ghosts) {
        if ((game.loop ?? 0) < (g.appearsAfterLoop ?? 0)) continue;

        const t     = frame * 0.02;
        const alpha = 0.15 + Math.sin(t + g.x) * 0.1;
        const bobY  = Math.sin(t * 1.5) * 5;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(g.x, g.y + bobY);

        ctx.fillStyle = GHOST_COLORS[g.type] || "#303050";
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 25, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = (g.type === "entity" || g.type === "deep_one") ? "#ff0000" : "#aaccff";
        ctx.beginPath(); ctx.arc(-5, -8, 2, 0, Math.PI * 2); ctx.arc(5, -8, 2, 0, Math.PI * 2); ctx.fill();

        for (let i = -2; i <= 2; i++) {
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(i * 6, 20);
            ctx.lineTo(i * 6 + Math.sin(t + i) * 5, 35);
            ctx.stroke();
        }

        ctx.restore();

        const dist = Math.hypot(game.playerX - g.x, game.playerY - g.y);
        if (dist < 80) {
            const drain = (typeof Balance !== "undefined" && typeof Balance.getGhostDrainRate === "function")
                ? Balance.getGhostDrainRate(g.type)
                : 0.02;
            game.sanity = Math.max(0, game.sanity - drain);

            if (dist < 50 && frame % 300 === 0) {
                _safe(window.playSound, "ghost");
            }
        }
    }
}

// ─── PLAYER DRAW ────────────────────────────────────────────────
function _drawPlayer() {
    ctx.save();
    ctx.translate(_visX, _visY);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 10, 10, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#445566";
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#ddc8a0";
    ctx.beginPath(); ctx.arc(0, -8, 6, 0, Math.PI * 2); ctx.fill();

    if (game.flashlightOn && game.flashlightBattery > 0) {
        ctx.strokeStyle = "#ffdd88"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(game.playerAngle) * 8, Math.sin(game.playerAngle) * 8);
        ctx.lineTo(Math.cos(game.playerAngle) * 16, Math.sin(game.playerAngle) * 16);
        ctx.stroke();
    }

    ctx.restore();
}

// ─── LIGHTING ───────────────────────────────────────────────────
function _drawLighting(room) {
    if (!_lightingCanvas) {
        _lightingCanvas = document.createElement("canvas");
        _lightingCtx    = _lightingCanvas.getContext("2d");
    }

    if (_lightingCanvas.width !== room.width || _lightingCanvas.height !== room.height) {
        _lightingCanvas.width  = room.width;
        _lightingCanvas.height = room.height;
    }

    const dCtx = _lightingCtx;
    dCtx.globalCompositeOperation = "source-over";
    dCtx.clearRect(0, 0, room.width, room.height);

    const candleBoost = hasItem("blessed_candle") ? 0.08 : 0;
    const baseAmbient = Math.min(0.6, (room.ambientLight || 0) + 0.15 + candleBoost);

    dCtx.fillStyle = `rgba(0,0,0,${(1 - baseAmbient).toFixed(3)})`;
    dCtx.fillRect(0, 0, room.width, room.height);

    dCtx.globalCompositeOperation = "destination-out";

    const lx = _visX;
    const ly = _visY;

    if (game.flashlightOn && game.flashlightBattery > 0) {
        const bf    = game.flashlightBattery / 100;
        const fm    = (game.flashlightBattery < 20) ? Math.sin(frame * 0.3) * 0.15 * (1 - bf) : 0;
        const range = 200 + bf * 350;
        const brightness = Math.max(0, 0.85 + bf * 0.15 - fm);
        const cone  = 0.25 + bf * 0.15;
        const flX   = lx + Math.cos(game.playerAngle) * 25;
        const flY   = ly + Math.sin(game.playerAngle) * 25;

        const grad = dCtx.createRadialGradient(flX, flY, 0, flX, flY, range);
        grad.addColorStop(0,   `rgba(0,0,0,${brightness.toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(0,0,0,${(brightness * 0.7).toFixed(3)})`);
        grad.addColorStop(0.7, `rgba(0,0,0,${(brightness * 0.3).toFixed(3)})`);
        grad.addColorStop(1,   "rgba(0,0,0,0)");
        dCtx.fillStyle = grad;
        dCtx.beginPath();
        dCtx.moveTo(lx, ly);
        dCtx.arc(lx, ly, range, game.playerAngle - cone, game.playerAngle + cone);
        dCtx.closePath();
        dCtx.fill();

        const pg = dCtx.createRadialGradient(lx, ly, 0, lx, ly, 55);
        pg.addColorStop(0, `rgba(0,0,0,${(0.5 + bf * 0.3).toFixed(3)})`);
        pg.addColorStop(1, "rgba(0,0,0,0)");
        dCtx.fillStyle = pg;
        dCtx.beginPath(); dCtx.arc(lx, ly, 55, 0, Math.PI * 2); dCtx.fill();
    } else {
        const pg = dCtx.createRadialGradient(lx, ly, 0, lx, ly, 50);
        pg.addColorStop(0, "rgba(0,0,0,0.6)");
        pg.addColorStop(1, "rgba(0,0,0,0)");
        dCtx.fillStyle = pg;
        dCtx.beginPath(); dCtx.arc(lx, ly, 50, 0, Math.PI * 2); dCtx.fill();
    }

    if (game.flags.fireLit && game.currentRoom === "library") {
        const fg = dCtx.createRadialGradient(300, 50, 0, 300, 50, 140);
        fg.addColorStop(0, "rgba(0,0,0,0.6)"); fg.addColorStop(1, "rgba(0,0,0,0)");
        dCtx.fillStyle = fg;
        dCtx.beginPath(); dCtx.arc(300, 50, 140, 0, Math.PI * 2); dCtx.fill();
    }
    if (game.flags.candlesLit && game.currentRoom === "dining_room") {
        const cg = dCtx.createRadialGradient(350, 250, 0, 350, 250, 120);
        cg.addColorStop(0, "rgba(0,0,0,0.5)"); cg.addColorStop(1, "rgba(0,0,0,0)");
        dCtx.fillStyle = cg;
        dCtx.beginPath(); dCtx.arc(350, 250, 120, 0, Math.PI * 2); dCtx.fill();
    }

    ctx.drawImage(_lightingCanvas, 0, 0);
}

// ─── SANITY EFFECTS ─────────────────────────────────────────────
function _drawSanityEffects() {
    const s   = game.sanity;
    const cw  = canvas.width, ch = canvas.height;

    if (s < 50) {
        ctx.fillStyle = `rgba(50,0,0,${((50 - s) / 500).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
    }
    if (s < 30 && Math.random() < 0.005) {
        ctx.fillStyle = "rgba(80,0,0,0.1)";
        ctx.font = `${20 + Math.random() * 20}px Georgia, serif`;
        ctx.textAlign = "center";
        const words = ["HELP","FIND ME","LOOP","TRAPPED","AZATHIEL"];
        ctx.fillText(
            words[Math.floor(Math.random() * words.length)],
            Math.random() * cw,
            Math.random() * ch
        );
    }
    if (s < 15) {
        ctx.fillStyle = `rgba(30,0,0,${(0.05 + Math.sin(frame * 0.1) * 0.03).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
    }
}

// ─── HUD ────────────────────────────────────────────────────────
function _drawHUD() {
    const cw = canvas.width, ch = canvas.height, p = 15;
    const room = getCurrentRoom();
    if (!room) return;

    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.font = "16px Georgia, serif"; ctx.textAlign = "left";
    ctx.fillText(room.name || game.currentRoom, p, p + 16);

    ctx.fillStyle = "rgba(150,100,100,0.6)";
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillText(`Loop #${game.loop + 1} | Lv.${game.level}`, p, p + 36);

    ctx.fillStyle = "rgba(30,30,30,0.6)";
    ctx.fillRect(p, p + 42, 100, 5);
    ctx.fillStyle = "rgba(100,150,255,0.6)";
    ctx.fillRect(p, p + 42, 100 * (game.xp / Math.max(1, game.xpToNext)), 5);
    ctx.fillStyle = "rgba(150,150,200,0.4)";
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillText(`XP ${game.xp}/${game.xpToNext}`, p, p + 56);

    const timeLeft = Math.max(0, game.maxLoopTime - game.loopTime);
    const min = Math.floor(timeLeft / 60);
    const sec = Math.floor(timeLeft % 60);
    ctx.fillStyle = timeLeft < 60
        ? `rgba(255,50,50,${(0.6 + Math.sin(frame * 0.1) * 0.3).toFixed(2)})`
        : "rgba(200,200,200,0.5)";
    ctx.font = "22px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText(`${min}:${sec.toString().padStart(2, "0")}`, cw / 2, p + 20);
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = "rgba(150,150,150,0.4)";
    ctx.fillText("TIME UNTIL RESET", cw / 2, p + 34);

    const sW = 120, sX = cw - sW - p, sY = p + 10;
    ctx.fillStyle = "rgba(30,30,30,0.6)"; ctx.fillRect(sX, sY, sW, 8);
    const sp = game.sanity / Math.max(1, game.maxSanity);
    ctx.fillStyle = sp > 0.5 ? "rgba(100,200,100,0.6)" : sp > 0.25 ? "rgba(200,200,50,0.6)" : "rgba(200,50,50,0.6)";
    ctx.fillRect(sX, sY, sW * sp, 8);
    ctx.fillStyle = "rgba(200,200,200,0.4)";
    ctx.font = "10px 'Courier New', monospace"; ctx.textAlign = "right";
    ctx.fillText(`SANITY ${Math.floor(game.sanity)}/${game.maxSanity}`, cw - p, sY - 2);

    const fX = cw - 80 - p, fY = sY + 22;
    ctx.fillStyle = "rgba(30,30,30,0.6)"; ctx.fillRect(fX, fY, 80, 6);
    ctx.fillStyle = game.flashlightOn ? "rgba(255,220,100,0.6)" : "rgba(100,100,100,0.4)";
    ctx.fillRect(fX, fY, 80 * (game.flashlightBattery / 100), 6);
    ctx.fillText(game.flashlightOn ? "🔦 ON [F]" : "🔦 OFF [F]", cw - p, fY - 2);

    if (typeof combat !== "undefined" && typeof WEAPONS !== "undefined") {
        const wpn = WEAPONS[combat.equippedWeapon] || WEAPONS.fists;
        if (wpn) {
            ctx.fillStyle = "rgba(200,180,100,0.5)";
            ctx.font = "11px 'Courier New', monospace"; ctx.textAlign = "left";
            ctx.fillText(`${wpn.icon} ${wpn.name} [Q]`, p, ch - p - 16);
        }
    }

    ctx.fillStyle = "rgba(150,120,80,0.5)";
    ctx.font = "11px 'Courier New', monospace"; ctx.textAlign = "left";
    ctx.fillText(
        `Clues:${game.cluesFound.length} Seals:${countSeals()}/5 Rooms:${roomsVisited.size} 🏆${game.completedMissions.length}`,
        p, ch - p
    );

    ctx.fillStyle = "rgba(100,100,100,0.3)";
    ctx.font = "10px 'Courier New', monospace"; ctx.textAlign = "right";
    ctx.fillText("WASD:Move E:Interact Q:Attack Shift:Dodge F:Flash J:Journal U:Unstuck", cw - p, ch - p);
}

// ─── INTERACT PROMPT ────────────────────────────────────────────
function _drawInteractPrompt() {
    if (dialogActive || journalOpen) return;

    if (typeof getNearestNPC === "function") {
        const npc = getNearestNPC();
        if (npc && npc.getInteractDistance() < 65) {
            const hasQ = (typeof npc._getCompletableQuest === "function" && npc._getCompletableQuest());
            const hasA = !hasQ && (typeof npc._getAvailableQuest === "function" && npc._getAvailableQuest());
            const icon = hasQ ? " ❓" : hasA ? " ❗" : "";
            ctx.fillStyle = "rgba(200,220,255,0.8)";
            ctx.font = "14px Georgia, serif"; ctx.textAlign = "center";
            ctx.fillText(`[E] Talk to ${npc.name}${icon}`, canvas.width / 2, canvas.height - 60);
            return;
        }
    }

    if (!game.interactTarget) return;
    const label = game.interactTarget.isDoor
        ? `→ ${game.interactTarget.label || "Door"}`
        : (game.interactTarget.label || "Interact");
    ctx.fillStyle = "rgba(200,200,200,0.75)";
    ctx.font = "14px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText(`[E] ${label}`, canvas.width / 2, canvas.height - 60);
}

// ─── TRANSITION ─────────────────────────────────────────────────
function _drawTransition() {
    if (transitionState === "none" && transitionAlpha <= 0) return;

    if (transitionState === "fadeOut") {
        transitionAlpha += 0.045;
        if (transitionAlpha >= 1) {
            transitionAlpha = 1;
            transitionState = "fadeIn";
            if (transitionCallback) {
                const cb = transitionCallback;
                transitionCallback = null;
                try { cb(); } catch (_) {}
            }
        }
    } else if (transitionState === "fadeIn") {
        transitionAlpha -= 0.035;
        if (transitionAlpha <= 0) {
            transitionAlpha = 0;
            transitionState = "none";
        }
    }

    ctx.fillStyle = `rgba(0,0,0,${transitionAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ─── MINIMAP ────────────────────────────────────────────────────
const MINIMAP_LAYOUT = {
    foyer:{x:80,y:55}, library:{x:40,y:55}, dining_room:{x:120,y:55},
    kitchen:{x:80,y:80}, parlor:{x:60,y:80}, ballroom:{x:140,y:40},
    conservatory:{x:25,y:75}, greenhouse:{x:50,y:95}, garden_path:{x:40,y:108},
    servants_quarters:{x:100,y:80}, gallery:{x:140,y:25}, wine_cellar:{x:110,y:95},
    upstairs_hall:{x:80,y:30}, master_bedroom:{x:50,y:25}, childrens_room:{x:110,y:25},
    study:{x:80,y:12}, nursery:{x:60,y:12}, attic_stairs:{x:100,y:12},
    attic:{x:120,y:8}, bell_tower:{x:140,y:8}, basement:{x:80,y:95},
    ritual_chamber:{x:70,y:108}, secret_room:{x:25,y:60}, catacombs:{x:60,y:108},
    underground_lake:{x:45,y:115}, void_chamber:{x:80,y:115}, graveyard:{x:25,y:115},
    chapel:{x:12,y:115}, well:{x:55,y:115}, clock_tower:{x:95,y:8},
};

function _drawMinimap() {
    if (!minimapCtx) return;
    const mc = minimapCtx, mw = 160, mh = 120;
    mc.fillStyle = "rgba(5,5,15,0.9)"; mc.fillRect(0, 0, mw, mh);

    for (const id of roomsVisited) {
        const pos = MINIMAP_LAYOUT[id];
        if (!pos) continue;
        mc.fillStyle = (id === game.currentRoom) ? "#ffdd44" : "rgba(100,140,200,0.5)";
        mc.fillRect(pos.x - 4, pos.y - 3, 8, 6);
        if (id === game.currentRoom) {
            mc.strokeStyle = "#ffdd44"; mc.lineWidth = 1;
            mc.strokeRect(pos.x - 6, pos.y - 5, 12, 10);
        }
    }

    for (const id in MINIMAP_LAYOUT) {
        if (roomsVisited.has(id)) continue;
        const pos = MINIMAP_LAYOUT[id];
        mc.fillStyle = "rgba(50,50,50,0.3)";
        mc.fillRect(pos.x - 2, pos.y - 1, 4, 2);
    }

    mc.fillStyle = "rgba(150,150,150,0.4)";
    mc.font = "8px 'Courier New', monospace"; mc.textAlign = "center";
    mc.fillText("MAP", mw / 2, mh - 3);
}

// ─── DEBUG ──────────────────────────────────────────────────────
function _drawDebugOverlay() {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(canvas.width - 260, 80, 250, 240);
    ctx.fillStyle = "#0f0"; ctx.font = "11px monospace"; ctx.textAlign = "left";

    const aiMode = (typeof AI !== "undefined" && AI.mode) ? AI.mode : "n/a";
    const aiCache = (typeof AI !== "undefined" && AI.runtimeCache)
        ? Object.keys(AI.runtimeCache).length : 0;

    const lines = [
        `Frame: ${frame}`,
        `Logical: ${Math.floor(game.playerX)}, ${Math.floor(game.playerY)}`,
        `Visual:  ${Math.floor(_visX)}, ${Math.floor(_visY)}`,
        `Room: ${game.currentRoom}`,
        `Sanity: ${game.sanity.toFixed(1)}/${game.maxSanity}`,
        `Battery: ${game.flashlightBattery.toFixed(1)}`,
        `Loop: ${game.loopTime.toFixed(1)}/${game.maxLoopTime}`,
        `Dialog Q: ${dialogQueue.length}`,
        `Subtitles: ${typeof SubtitleSystem !== "undefined" ? SubtitleSystem.messages.length : "-"}`,
        `Particles: ${typeof particles !== "undefined" ? particles.length : "-"}`,
        `XP: ${game.xp}/${game.xpToNext}`,
        `Trans: ${transitionState} α=${transitionAlpha.toFixed(2)}`,
        `AI Mode: ${aiMode}`,
        `AI Cache: ${aiCache} entries`,
    ];

    let y = 100;
    for (const line of lines) {
        ctx.fillText(line, canvas.width - 250, y);
        y += 14;
    }
}

// ═════════════════════════════════════════════════════════════════
//  LOOP TIMER
// ═════════════════════════════════════════════════════════════════
function updateLoopTimer() {
    if (dialogActive || journalOpen || transitionState !== "none") return;

    game.loopTime += 1 / 60;
    game.sanity = Math.max(0, game.sanity);

    if (game.loopTime >= game.maxLoopTime)  triggerLoopReset();
    else if (game.sanity <= 0)               triggerLoopReset("Your mind shatters. Darkness consumes. Time resets...");
}

// ═════════════════════════════════════════════════════════════════
//  LOOP RESET
// ═════════════════════════════════════════════════════════════════
function triggerLoopReset(customMessage) {
    if (typeof DeathMemories !== "undefined" && typeof DeathMemories.recordDeath === "function") {
        const cause = game.sanity <= 0 ? "sanity" : "time";
        try { DeathMemories.recordDeath(game.currentRoom, game.playerX, game.playerY, cause); } catch (_) {}
    }

    _safe(window.playSound, "timeReset");
    _safe(window.trackStat, "loop_complete");
    if (game.sanity <= 0) _safe(window.trackStat, "sanity_death");
    else                  _safe(window.trackStat, "death");

    game.loop++;

    const saved = {
        perm:      { ...game.permanentFlags },
        clues:     [ ...game.cluesFound ],
        journal:   [ ...game.journalEntries ],
        loop:      game.loop,
        level:     game.level,
        xp:        game.xp,
        xpToNext:  game.xpToNext,
        totalXP:   game.totalXP,
        maxSanity: game.maxSanity,
        missions:  [ ...game.completedMissions ],
        missCount: game.missionsComplete,
        maxLoop:   game.maxLoopTime,
    };

    Object.assign(game, {
        loopTime: 0,
        sanity: saved.maxSanity,
        inventory: [],
        flags: {},
        flashlightBattery: 100,
        flashlightOn: true,
        currentRoom: "foyer",
        playerX: 400, playerY: 480, playerAngle: -Math.PI / 2,
        permanentFlags: saved.perm,
        cluesFound: saved.clues,
        journalEntries: saved.journal,
        loop: saved.loop,
        level: saved.level,
        xp: saved.xp,
        xpToNext: saved.xpToNext,
        totalXP: saved.totalXP,
        maxSanity: saved.maxSanity,
        completedMissions: saved.missions,
        missionsComplete: saved.missCount,
        maxLoopTime: saved.maxLoop,
        ghostsActive: [],
        interactTarget: null,
    });

    _snapVisualPosition();

    if (saved.perm.hasFirstSeal)  addItem("seal_1", "🔮", "Seal Fragment #1");
    if (saved.perm.hasSecondSeal) addItem("seal_2", "🔮", "Seal Fragment #2");
    if (saved.perm.hasThirdSeal)  addItem("seal_3", "🔮", "Seal Fragment #3");
    if (saved.perm.hasFourthSeal) addItem("seal_4", "🔮", "Seal Fragment #4");
    if (saved.perm.hasFifthSeal)  addItem("seal_5", "🔮", "Seal Fragment #5");

    dialogQueue  = [];
    dialogActive = false;
    dialogBox.classList.add("hidden");
    updateInventoryUI();

    _safe(window.resetEventState);
    _safe(window.resetCombat);
    _safe(window.resetNPCs);
    if (typeof StoryEngine  !== "undefined" && StoryEngine.reset)   try { StoryEngine.reset(); }   catch (_) {}
    if (typeof Monologue    !== "undefined" && Monologue.reset)     try { Monologue.reset(); }     catch (_) {}
    if (typeof HouseDecay   !== "undefined" && HouseDecay.reset)    try { HouseDecay.reset(); }    catch (_) {}
    if (typeof SetPieces    !== "undefined" && SetPieces.reset)     try { SetPieces.reset(); }     catch (_) {}

    // ── Stop audio BEFORE resetting timers ──────────────────────
    if (typeof AudioWiring   !== "undefined" && AudioWiring.cancelPendingDelays) try { AudioWiring.cancelPendingDelays(); } catch (_) {}
    if (typeof AudioTriggers !== "undefined" && AudioTriggers.stopAllVoices)     try { AudioTriggers.stopAllVoices(); }     catch (_) {}

    if (typeof AudioWiring   !== "undefined" && AudioWiring.reset)   try { AudioWiring.reset(); }   catch (_) {}
    if (typeof Balance       !== "undefined" && Balance.reset)       try { Balance.reset(); }       catch (_) {}
    if (typeof AudioTriggers !== "undefined" && AudioTriggers.reset) try { AudioTriggers.reset(); } catch (_) {}

    // ── AI: reset timing state for new loop (preserves cache) ──
    if (typeof AI !== "undefined" && AI.reset) try { AI.reset(); } catch (_) {}

    _safe(window.setupWeatherForRoom, "foyer");
    _safe(window.saveGame);

    const msg = customMessage || "The clock strikes midnight. Time folds. You remember.";
    addClue(`loop_${game.loop}`, `— Loop #${game.loop + 1} begins —`);

    transitionState = "fadeOut";
    transitionAlpha = 0;
    transitionCallback = () => {
        showDialog("⏰ TIME RESET", msg);
        if      (game.loop === 1) showDialog("NARRATOR", "Déjà vu. The house feels different.");
        else if (game.loop === 2) showDialog("NARRATOR", "Third loop. Memories sharpen.");
        else if (game.loop === 3) showDialog("NARRATOR", "The house fights back.");
        else if (game.loop >= 4)  showDialog("NARRATOR", "Closer than ever.");

        setTimeout(checkMissions, 0);
        _safe(window.triggerMonologue, "loop_start", true);
    };
}

// ═════════════════════════════════════════════════════════════════
//  ENDINGS
// ═════════════════════════════════════════════════════════════════
function startEnding(type) {
    game.endingReached = type;
    if (typeof AudioWiring !== "undefined" && typeof AudioWiring.playEndingMusic === "function") {
        try { AudioWiring.playEndingMusic(type); } catch (_) {}
    }
    _safe(window.trackStat, "ending", type);
    _safe(window.saveGame);
    transitionState = "fadeOut";
    transitionAlpha = 0;
    transitionCallback = () => { gameState = "ending"; _safe(window.saveGame); };
}

function _drawEnding() {
    const cw = canvas.width, ch = canvas.height, t = frame * 0.01;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);

    const ENDINGS = {
        good:      { title: "THE CHAIN IS BROKEN",  color: "#4488cc", quote: '"Love breaks all chains."',         label: "GOOD ENDING" },
        perfect:   { title: "DAWN BREAKS",           color: "#ffcc44", quote: '"Love forges chains too."',         label: "PERFECT ENDING" },
        sacrifice: { title: "THE NEW GUARDIAN",      color: "#8866cc", quote: '"Some chains are worn willingly."', label: "SACRIFICE ENDING" },
        bad:       { title: "THE ENTITY IS FREE",    color: "#cc2200", quote: '"Some doors should stay closed."',  label: "BAD ENDING" },
    };
    const e = ENDINGS[game.endingReached] || ENDINGS.bad;

    for (let i = 0; i < 100; i++) {
        const a = Math.sin(t + i * 0.5) * 0.3 + 0.4;
        ctx.fillStyle = `${e.color}${Math.floor(a * 255).toString(16).padStart(2, "0")}`;
        ctx.fillRect(
            (Math.sin(i * 7.3 + t * 0.3) * 0.5 + 0.5) * cw,
            (Math.cos(i * 3.7 + t * 0.2) * 0.5 + 0.5) * ch,
            2, 2
        );
    }

    ctx.fillStyle = e.color;
    ctx.font = "bold 42px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText(e.title, cw / 2, ch / 2 - 80);

    ctx.fillStyle = e.color + "bb";
    ctx.font = "17px Georgia, serif";
    ctx.fillText(
        `Loops: ${game.loop + 1} | Level: ${game.level} | Clues: ${game.cluesFound.length} | Rooms: ${roomsVisited.size}`,
        cw / 2, ch / 2 - 20
    );

    ctx.fillStyle = e.color + "88";
    ctx.font = "italic 16px Georgia, serif";
    ctx.fillText(e.quote, cw / 2, ch / 2 + 30);

    ctx.fillStyle = e.color + "66";
    ctx.font = "14px Georgia, serif";
    ctx.fillText(e.label, cw / 2, ch / 2 + 70);

    if (Math.sin(frame * 0.06) > 0) {
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("Click or Enter to return to menu", cw / 2, ch - 50);
    }
}

// ═════════════════════════════════════════════════════════════════
//  MAIN MENU
// ═════════════════════════════════════════════════════════════════
function _drawMenu() {
    const cw = canvas.width, ch = canvas.height, t = frame * 0.005;
    const cx = cw / 2, cy = ch / 2;

    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);

    const miasma = ctx.createRadialGradient(cx, cy, 50, cx, cy, cw * 0.7);
    miasma.addColorStop(0,   `rgba(40,5,5,${(0.4 + Math.sin(t * 2) * 0.1).toFixed(3)})`);
    miasma.addColorStop(0.4, "rgba(15,0,5,0.6)");
    miasma.addColorStop(1,   "rgba(0,0,0,0.95)");
    ctx.fillStyle = miasma; ctx.fillRect(0, 0, cw, ch);

    for (let i = 0; i < 6; i++) {
        const fx = (Math.sin(t * 0.3 + i * 1.2) * 0.5 + 0.5) * cw;
        const fy = (Math.cos(t * 0.2 + i * 0.9) * 0.4 + 0.5) * ch;
        const fr = 120 + Math.sin(t + i) * 40;
        const fog = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        fog.addColorStop(0, "rgba(60,40,60,0.08)");
        fog.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fog;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = 0; i < 60; i++) {
        const px = ((Math.sin(i * 7.3 + t * 0.4) * 0.5 + 0.5) * cw + t * 20) % cw;
        const py = ((Math.cos(i * 3.7 + t * 0.3) * 0.5 + 0.5) * ch + Math.sin(t + i) * 30) % ch;
        const pa = Math.sin(t * 2 + i) * 0.15 + 0.2;
        ctx.fillStyle = `rgba(180,160,180,${pa.toFixed(3)})`;
        const sz = 1 + Math.sin(i) * 1.5;
        ctx.fillRect(px, py, sz, sz);
    }

    const vig = ctx.createRadialGradient(cx, cy, 100, cx, cy, cw * 0.65);
    vig.addColorStop(0,   "rgba(0,0,0,0)");
    vig.addColorStop(0.6, "rgba(0,0,0,0.3)");
    vig.addColorStop(1,   "rgba(0,0,0,0.95)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, cw, ch);

    const candleFlicker = 0.8 + Math.random() * 0.2;
    const candleY = cy - 100;
    for (const xOff of [-280, 280]) {
        const lc = ctx.createRadialGradient(cx + xOff, candleY, 0, cx + xOff, candleY, 80 * candleFlicker);
        lc.addColorStop(0, `rgba(255,160,60,${(0.3 * candleFlicker).toFixed(3)})`);
        lc.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lc;
        ctx.beginPath(); ctx.arc(cx + xOff, candleY, 80 * candleFlicker, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,200,100,${candleFlicker.toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(cx + xOff, candleY, 3, 8 * candleFlicker, 0, 0, Math.PI * 2); ctx.fill();
    }

    const titleY = cy - 130;
    ctx.fillStyle = "rgba(120,0,0,0.6)";
    ctx.font = "bold 64px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("ECHOES OF MIDNIGHT", cx + 3, titleY + 3);

    const titlePulse = 0.85 + Math.sin(t * 2) * 0.15;
    ctx.fillStyle = `rgba(${Math.floor(180 + Math.sin(t * 3) * 30)},${Math.floor(20 + Math.sin(t * 2) * 10)},20,${titlePulse.toFixed(3)})`;
    ctx.fillText("ECHOES OF MIDNIGHT", cx, titleY);

    ctx.strokeStyle = `rgba(120,0,0,${(0.6 + Math.sin(t * 1.5) * 0.2).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 280, titleY + 20); ctx.lineTo(cx + 280, titleY + 20); ctx.stroke();

    ctx.fillStyle = `rgba(150,100,100,${(0.7 + Math.sin(t * 1.5) * 0.2).toFixed(3)})`;
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillText("✦  A Time Loop Mystery  ✦", cx, cy - 80);

    const lines = [
        "You are trapped in a haunted mansion.",
        "Every ten minutes, time resets.",
        "Each loop, you remember more.",
        "50 rooms. 5 seals. 4 endings.",
        "Solve the mystery. Break the loop.",
    ];
    lines.forEach((line, i) => {
        ctx.fillStyle = `rgba(160,140,130,${(0.55 + Math.sin(t + i * 0.5) * 0.1).toFixed(3)})`;
        ctx.font = "16px Georgia, serif";
        ctx.fillText(line, cx, cy - 30 + i * 26);
    });

    ctx.fillStyle = "rgba(110,100,110,0.55)";
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillText("WASD: MOVE  ·  E: INTERACT  ·  Q: ATTACK  ·  F: FLASHLIGHT  ·  J: JOURNAL", cx, cy + 130);
    ctx.fillText("SHIFT: DODGE  ·  U: UNSTUCK  ·  ESC: CLOSE DIALOG", cx, cy + 150);

    const beginPulse = 0.5 + Math.sin(t * 4) * 0.5;
    if (beginPulse > 0.2) {
        ctx.shadowColor = "rgba(220,220,240,0.8)";
        ctx.shadowBlur  = 20 * beginPulse;
        ctx.fillStyle   = `rgba(240,240,250,${beginPulse.toFixed(3)})`;
        ctx.font = "bold 20px Georgia, serif";
        ctx.fillText("▸  CLICK OR PRESS ENTER TO BEGIN  ◂", cx, cy + 200);
        ctx.shadowBlur = 0;
    }

    if (typeof loadGame === "function") {
        try {
            const sd = loadGame();
            if (sd) {
                ctx.fillStyle = `rgba(120,180,130,${(0.5 + Math.sin(t * 1.5) * 0.2).toFixed(3)})`;
                ctx.font = "14px Georgia, serif";
                ctx.fillText("[ C ] — Continue Your Descent", cx, cy + 235);
            }
        } catch (_) {}
    }

    ctx.fillStyle = "rgba(70,60,70,0.4)";
    ctx.font = "italic 11px Georgia, serif";
    ctx.fillText("⚜  THORNWOOD MANOR  ·  EST. 1923  ⚜", cx, ch - 20);
}

// ═════════════════════════════════════════════════════════════════
//  START NEW GAME
// ═════════════════════════════════════════════════════════════════
function startNewGame() {
    gameState = "playing";

    Object.assign(game, {
        loop: 0, loopTime: 0, sanity: 100, maxSanity: 100,
        inventory: [], cluesFound: [], journalEntries: [],
        flags: {}, permanentFlags: {},
        currentRoom: "foyer", playerX: 400, playerY: 480,
        playerAngle: -Math.PI / 2,
        flashlightBattery: 100, flashlightOn: true,
        interactTarget: null, endingReached: null,
        xp: 0, level: 1, xpToNext: 50, totalXP: 0,
        maxLoopTime: LOOP_DURATION,
        roomsExplored: 0, itemsFound: 0, ghostsSeen: 0,
        missionsComplete: 0, completedMissions: [],
    });

    roomsVisited = new Set(["foyer"]);
    dialogQueue  = [];
    dialogActive = false;
    dialogBox.classList.add("hidden");
    journalEl.classList.add("hidden");
    journalOpen = false;
    _lastInteractFrame  = -100;
    _interactInProgress = false;

    _snapVisualPosition();

    updateInventoryUI();
    _safe(window.setupWeatherForRoom, "foyer");
    _safe(window.resetCombat);
    _safe(window.initNPCs);
    _safe(window.installSubtitleOverride);

    if (typeof gameStats !== "undefined") gameStats.gamesPlayed++;
    _safe(window.saveGame);

    addClue("start", "— Loop #1 begins — You awaken in Thornwood Manor.");
    showDialog("NARRATOR", "You wake in the grand foyer of an old mansion. The door is sealed. A grandfather clock chimes midnight.");
    showDialog("NARRATOR", "You have a flashlight. Ten minutes until something happens. Press E to interact, U if stuck, J for journal.");
}

// ═════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═════════════════════════════════════════════════════════════════
function gameLoop() {
    frame = (frame + 1) % 1000000;

    if (frame % MEMORY_CLEAN_INTERVAL === 0) {
        try {
            if (typeof particles   !== "undefined" && particles.length   > MAX_PARTICLES_ALLOWED)  particles.splice(0, particles.length   - MAX_PARTICLES_ALLOWED);
            if (typeof footprints  !== "undefined" && footprints.length  > MAX_FOOTPRINTS_ALLOWED)  footprints.splice(0, footprints.length  - MAX_FOOTPRINTS_ALLOWED);
            if (typeof currentWeather !== "undefined" && currentWeather.length > MAX_WEATHER_ALLOWED) currentWeather.splice(0, currentWeather.length - MAX_WEATHER_ALLOWED);
            if (dialogQueue.length > 5) dialogQueue.splice(0, dialogQueue.length - 5);
            if (game.journalEntries.length > MAX_JOURNAL_ENTRIES) game.journalEntries.splice(0, game.journalEntries.length - MAX_JOURNAL_ENTRIES);
        } catch (_) {}
    }

    try {
        switch (gameState) {

            case "menu":
                try { _drawMenu(); } catch (_) {}

                // ── AI PRE-MENU HORROR DIALOGUE ─────────────────
                // If AI dialogue is active, any key advances it.
                // Suppresses normal menu input until dialogue completes.
                if (typeof AI !== "undefined" && AI.isMenuDialogueActive &&
                    AI.isMenuDialogueActive()) {
                    if (keysJustPressed["Enter"] || keysJustPressed["Space"] ||
                        keysJustPressed["KeyE"]) {
                        _ensureAudio();
                        try {
                            const done = AI.advanceMenuDialogue();
                            if (done) window._menuDialogueDone = true;
                        } catch (_) {}
                        consumeKey("Enter");
                        consumeKey("Space");
                        consumeKey("KeyE");
                    }
                    break;
                }

                // First keypress starts AI horror dialogue
                if (!window._menuDialogueStarted && !window._menuDialogueDone &&
                    (keysJustPressed["Enter"] || keysJustPressed["Space"])) {
                    if (typeof AI !== "undefined" && AI.startMenuDialogue) {
                        try {
                            _ensureAudio();
                            window._menuDialogueStarted = true;
                            AI.startMenuDialogue();
                            AI.advanceMenuDialogue();
                            consumeKey("Enter");
                            consumeKey("Space");
                            break;
                        } catch (_) {
                            window._menuDialogueDone = true;
                        }
                    }
                }

                // Normal menu input (after dialogue done or AI unavailable)
                if (keysJustPressed["Enter"] || keysJustPressed["Space"]) {
                    _ensureAudio();
                    startNewGame();
                    window._menuDialogueStarted = false;
                    window._menuDialogueDone    = false;
                    consumeKey("Enter");
                    consumeKey("Space");
                }
                if (keysJustPressed["KeyC"] && typeof loadGame === "function") {
                    try {
                        const sd = loadGame();
                        if (sd) {
                            _ensureAudio();
                            gameState = "playing";
                            if (typeof applySaveData === "function") applySaveData(sd);
                            updateInventoryUI();
                            showDialog("SYSTEM", "Game loaded.");
                            window._menuDialogueStarted = false;
                            window._menuDialogueDone    = false;
                        }
                    } catch (_) {}
                    consumeKey("KeyC");
                }
                break;

            case "playing":
                try { updatePlayer(); }    catch (_) {}
                try { updateLoopTimer(); } catch (_) {}

                try { _updateVisualPosition(); } catch (_) {}

                try { if (typeof updateParticles === "function") updateParticles(); } catch (_) {}
                _safe(window.updateEvents);
                _safe(window.updateCombat);
                _safe(window.updateNPCs);
                _safe(window.updateAutoSave);

                // ── AI INTEGRATION — fire-and-forget, never blocks ──
                try { if (typeof AI !== "undefined" && AI.update) AI.update(); } catch (_) {}

                if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.update) { try { SubtitleSystem.update(); } catch (_) {} }
                if (typeof AudioManager   !== "undefined" && AudioManager.initialized) { try { AudioManager.update(game.currentRoom); } catch (_) {} }
                if (typeof AudioTriggers  !== "undefined" && typeof AudioTriggers.update === "function") { try { AudioTriggers.update(); } catch (_) {} }
                if (typeof checkAchievements === "function" && frame % 120 === 0) { try { checkAchievements(); } catch (_) {} }
                if (typeof Monologue  !== "undefined" && Monologue.update)  { try { Monologue.update(); }  catch (_) {} }
                if (typeof HouseDecay !== "undefined" && HouseDecay.update) { try { HouseDecay.update(); } catch (_) {} }
                if (typeof SetPieces  !== "undefined" && SetPieces.update)  { try { SetPieces.update(); }  catch (_) {} }
                if (typeof AudioWiring !== "undefined" && AudioWiring.update) { try { AudioWiring.update(); } catch (_) {} }
                if (typeof Balance    !== "undefined" && Balance.masterUpdate) { try { Balance.masterUpdate(); } catch (_) {} }

                try { render(); } catch (e) {
                    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = "#f88"; ctx.font = "14px monospace"; ctx.textAlign = "center";
                    ctx.fillText("Render error — game continues", canvas.width / 2, canvas.height / 2);
                }
                break;

            case "ending":
                try { _drawEnding(); } catch (_) {}
                if (keysJustPressed["Enter"] || keysJustPressed["Space"]) {
                    gameState = "menu";
                    window._menuDialogueStarted = false;
                    window._menuDialogueDone    = false;
                    consumeKey("Enter"); consumeKey("Space");
                }
                break;
        }
    } catch (_) {}

    clearJustPressed();
    requestAnimationFrame(gameLoop);
}

// ── BOOT ─────────────────────────────────────────────────────────
requestAnimationFrame(gameLoop);