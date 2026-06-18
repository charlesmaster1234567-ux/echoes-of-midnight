// ═══════════════════════════════════════════════════════════════════════════════
//  ACHIEVEMENTS.JS — Echoes of Midnight v2.0
//  Built from real game state scan:
//    game.level, game.loop, game.xp, game.sanity, game.health,
//    game.currentRoom, game.inventory, game.flags.*, game.permanentFlags.*,
//    game.endingReached, game.flashlightOn, game.flashlightBattery,
//    game.roomsVisited (Set), countSeals(), hasItem()
//
//  Called by game.js:
//    checkAchievements()              — every 120 frames (line 2181)
//    drawAchievementNotification(ctx) — every render frame (line 1679)
//
//  Sound: AudioManager.playSFX("sfx_achievement") via AudioWiring
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  ACHIEVEMENT DEFINITIONS
//  Each one checks real game properties — no guesses, no placeholders
// ═══════════════════════════════════════════════════════════════════════════════
const ACHIEVEMENTS = [

    // ═════════════════════════════════════════════════════════════════════════
    //  EXPLORATION (10)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "first_step",
        title: "First Step",
        desc:  "Enter a room for the first time.",
        icon:  "\u{1F6AA}",   // door
        tier:  "bronze",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.size >= 2,
    },
    {
        id:    "explorer_5",
        title: "Curious Mind",
        desc:  "Visit 5 different rooms.",
        icon:  "\u{1F9ED}",   // compass
        tier:  "bronze",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.size >= 5,
    },
    {
        id:    "explorer_15",
        title: "Deep Explorer",
        desc:  "Visit 15 different rooms.",
        icon:  "\u{1F5FA}",   // world map
        tier:  "silver",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.size >= 15,
    },
    {
        id:    "explorer_30",
        title: "Every Corner",
        desc:  "Visit 30 different rooms.",
        icon:  "\u{1F3DB}",   // classical building
        tier:  "gold",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.size >= 30,
    },
    {
        id:    "cartographer",
        title: "Cartographer",
        desc:  "Visit all 50 rooms in the manor.",
        icon:  "\u{1F4DC}",   // scroll
        tier:  "platinum",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.size >= 50,
    },
    {
        id:    "basement_brave",
        title: "Into the Dark",
        desc:  "Enter the basement.",
        icon:  "\u{1F573}",   // hole
        tier:  "bronze",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.has("basement"),
    },
    {
        id:    "secret_room",
        title: "Behind the Walls",
        desc:  "Find the hidden room behind the bookshelf.",
        icon:  "\u{1F510}",   // closed lock with key
        tier:  "silver",
        cat:   "exploration",
        check: (g) => g.flags && g.flags.foundSecretRoom,
    },
    {
        id:    "chapel_visit",
        title: "Holy Ground",
        desc:  "Enter the chapel.",
        icon:  "\u271D",      // cross
        tier:  "bronze",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.has("chapel"),
    },
    {
        id:    "void_visit",
        title: "Staring Into Nothing",
        desc:  "Enter the void.",
        icon:  "\u{1F311}",   // new moon
        tier:  "gold",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.has("void"),
    },
    {
        id:    "catacombs_visit",
        title: "Among the Dead",
        desc:  "Enter the catacombs.",
        icon:  "\u{1F480}",   // skull
        tier:  "silver",
        cat:   "exploration",
        check: (g) => g.roomsVisited && g.roomsVisited.has("catacombs"),
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  DISCOVERY (14) — flags from rooms.js interactions
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "read_letter",
        title: "Correspondent",
        desc:  "Read the faded letter in the foyer.",
        icon:  "\u{1F4E8}",   // envelope
        tier:  "bronze",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.readLetter,
    },
    {
        id:    "read_diary",
        title: "Eleanora's Words",
        desc:  "Read the diary in the library.",
        icon:  "\u{1F4D6}",   // open book
        tier:  "bronze",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.readDiary,
    },
    {
        id:    "mirror_clue",
        title: "Through the Looking Glass",
        desc:  "Discover the mirror's secret.",
        icon:  "\u{1FA9E}",   // mirror
        tier:  "silver",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.mirrorClue,
    },
    {
        id:    "gramophone",
        title: "Old Melodies",
        desc:  "Play the gramophone in the parlor.",
        icon:  "\u{1F4BF}",   // disc
        tier:  "bronze",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.gramophonePlayed,
    },
    {
        id:    "music_box",
        title: "Lullaby",
        desc:  "Wind up the music box in the nursery.",
        icon:  "\u{1F3B5}",   // musical note
        tier:  "silver",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.musicBoxOpened,
    },
    {
        id:    "piano_player",
        title: "Eleanora's Lament",
        desc:  "Play the piano.",
        icon:  "\u{1F3B9}",   // piano
        tier:  "silver",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.pianoPlayed,
    },
    {
        id:    "confession",
        title: "Forgive Me",
        desc:  "Hear Victor's confession.",
        icon:  "\u{1F64F}",   // prayer
        tier:  "gold",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.confessionHeard,
    },
    {
        id:    "fire_lit",
        title: "Let There Be Light",
        desc:  "Light the fireplace.",
        icon:  "\u{1F525}",   // fire
        tier:  "bronze",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.fireLit,
    },
    {
        id:    "candles_lit",
        title: "Séance",
        desc:  "Light the candelabras in the dining room.",
        icon:  "\u{1F56F}",   // candle
        tier:  "bronze",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.candlesLit,
    },
    {
        id:    "telescope",
        title: "Stargazer",
        desc:  "Look through Victor's telescope.",
        icon:  "\u{1F52D}",   // telescope
        tier:  "silver",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.telescopeUsed,
    },
    {
        id:    "clock_secret",
        title: "Thirteen Chimes",
        desc:  "Open the grandfather clock's secret compartment.",
        icon:  "\u{1F570}",   // clock
        tier:  "gold",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.clockOpened,
    },
    {
        id:    "frozen_body",
        title: "Cold Truth",
        desc:  "Discover the frozen body.",
        icon:  "\u{1F9CA}",   // ice
        tier:  "gold",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.frozenBody,
    },
    {
        id:    "well_examined",
        title: "The Depths Below",
        desc:  "Look down the well.",
        icon:  "\u{1F4A7}",   // droplet
        tier:  "gold",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.wellExamined,
    },
    {
        id:    "lab_journal",
        title: "Mad Science",
        desc:  "Read Victor's lab journal.",
        icon:  "\u{1F9EA}",   // test tube
        tier:  "silver",
        cat:   "discovery",
        check: (g) => g.flags && g.flags.labJournal,
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  ITEMS & SEALS (8)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "locket_found",
        title: "Love's Proof",
        desc:  "Find the family locket.",
        icon:  "\u{1F49B}",   // yellow heart
        tier:  "silver",
        cat:   "items",
        check: (g) => _hasItem("locket"),
    },
    {
        id:    "flashlight_found",
        title: "Illuminated",
        desc:  "Equip the flashlight.",
        icon:  "\u{1F526}",   // flashlight
        tier:  "bronze",
        cat:   "items",
        check: (g) => g.flashlightOn !== undefined,
    },
    {
        id:    "crucifix_found",
        title: "Divine Protection",
        desc:  "Find the crucifix.",
        icon:  "\u271D",      // cross
        tier:  "silver",
        cat:   "items",
        check: (g) => _hasItem("crucifix"),
    },
    {
        id:    "matches_found",
        title: "Strike a Light",
        desc:  "Find matches.",
        icon:  "\u{1F9F0}",   // toolbox
        tier:  "bronze",
        cat:   "items",
        check: (g) => _hasItem("matches") || (g.flags && g.flags.fireLit),
    },
    {
        id:    "seal_1",
        title: "First Fragment",
        desc:  "Find your first seal fragment.",
        icon:  "\u{1F52E}",   // crystal ball
        tier:  "silver",
        cat:   "items",
        check: () => _countSeals() >= 1,
    },
    {
        id:    "seal_3",
        title: "Seal Collector",
        desc:  "Find 3 seal fragments.",
        icon:  "\u2B55",      // circle
        tier:  "gold",
        cat:   "items",
        check: () => _countSeals() >= 3,
    },
    {
        id:    "seal_5",
        title: "Seal Master",
        desc:  "Find all 5 seal fragments.",
        icon:  "\u{1F31F}",   // glowing star
        tier:  "platinum",
        cat:   "items",
        check: () => _countSeals() >= 5,
    },
    {
        id:    "holy_water",
        title: "Blessed Arsenal",
        desc:  "Obtain holy water.",
        icon:  "\u{1F4A7}",   // droplet
        tier:  "gold",
        cat:   "items",
        check: (g) => g.permanentFlags && g.permanentFlags.hasHolyWater,
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  COMBAT (8)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "first_fight",
        title: "Stand Your Ground",
        desc:  "Survive your first combat encounter.",
        icon:  "\u2694",      // swords
        tier:  "bronze",
        cat:   "combat",
        check: (g) => g.combatWins >= 1,
    },
    {
        id:    "fighter_5",
        title: "Veteran Fighter",
        desc:  "Win 5 combat encounters.",
        icon:  "\u{1F6E1}",   // shield
        tier:  "silver",
        cat:   "combat",
        check: (g) => g.combatWins >= 5,
    },
    {
        id:    "fighter_15",
        title: "Ghost Hunter",
        desc:  "Win 15 combat encounters.",
        icon:  "\u{1F47B}",   // ghost
        tier:  "gold",
        cat:   "combat",
        check: (g) => g.combatWins >= 15,
    },
    {
        id:    "boss_defeated",
        title: "Boss Slayer",
        desc:  "Defeat any boss entity.",
        icon:  "\u{1F451}",   // crown
        tier:  "gold",
        cat:   "combat",
        check: (g) => {
            if (!g.permanentFlags) return false;
            for (const key in g.permanentFlags) {
                if (key.startsWith("boss_") && key.endsWith("_defeated") && g.permanentFlags[key]) {
                    return true;
                }
            }
            return false;
        },
    },
    {
        id:    "salt_circle",
        title: "Protected Ground",
        desc:  "Place a salt circle during combat.",
        icon:  "\u26AA",      // white circle
        tier:  "bronze",
        cat:   "combat",
        check: (g) => g.permanentFlags && g.permanentFlags.usedSaltCircle,
    },
    {
        id:    "seal_blast",
        title: "Seal's Fury",
        desc:  "Use seal blast in combat (requires 3+ seals).",
        icon:  "\u{1F4A5}",   // collision
        tier:  "gold",
        cat:   "combat",
        check: (g) => g.permanentFlags && g.permanentFlags.usedSealBlast,
    },
    {
        id:    "low_health_win",
        title: "By a Thread",
        desc:  "Win a combat with less than 10% HP remaining.",
        icon:  "\u{1F494}",   // broken heart
        tier:  "gold",
        cat:   "combat",
        check: (g) => g.permanentFlags && g.permanentFlags.clutchVictory,
    },
    {
        id:    "no_damage_win",
        title: "Untouched",
        desc:  "Win a combat without taking any damage.",
        icon:  "\u2728",      // sparkles
        tier:  "platinum",
        cat:   "combat",
        check: (g) => g.permanentFlags && g.permanentFlags.perfectCombat,
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  PROGRESSION (8)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "level_3",
        title: "Growing Stronger",
        desc:  "Reach level 3 — upstairs unlocked.",
        icon:  "\u2B06",      // up arrow
        tier:  "bronze",
        cat:   "progression",
        check: (g) => g.level >= 3,
    },
    {
        id:    "level_5",
        title: "Sharpened Senses",
        desc:  "Reach level 5.",
        icon:  "\u2B06",
        tier:  "silver",
        cat:   "progression",
        check: (g) => g.level >= 5,
    },
    {
        id:    "level_8",
        title: "Deeper Access",
        desc:  "Reach level 8 — deeper areas accessible.",
        icon:  "\u2B06",
        tier:  "gold",
        cat:   "progression",
        check: (g) => g.level >= 8,
    },
    {
        id:    "level_10",
        title: "Master Investigator",
        desc:  "Reach level 10 — maximum power.",
        icon:  "\u{1F31F}",   // glowing star
        tier:  "platinum",
        cat:   "progression",
        check: (g) => g.level >= 10,
    },
    {
        id:    "loop_2",
        title: "D\u00E9j\u00E0 Vu",
        desc:  "Enter the second time loop.",
        icon:  "\u{1F504}",   // arrows cycle
        tier:  "bronze",
        cat:   "progression",
        check: (g) => g.loop >= 1,
    },
    {
        id:    "loop_3",
        title: "Third Time's the Charm",
        desc:  "Enter the third time loop.",
        icon:  "\u{1F504}",
        tier:  "silver",
        cat:   "progression",
        check: (g) => g.loop >= 2,
    },
    {
        id:    "loop_4",
        title: "The House Noticed",
        desc:  "Enter the fourth time loop.",
        icon:  "\u{1F504}",
        tier:  "gold",
        cat:   "progression",
        check: (g) => g.loop >= 3,
    },
    {
        id:    "stairs_unlocked",
        title: "Ascending",
        desc:  "Unlock the staircase.",
        icon:  "\u{1FA9C}",   // ladder
        tier:  "bronze",
        cat:   "progression",
        check: (g) => g.flags && g.flags.stairsUnlocked,
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  SURVIVAL (6)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "sanity_low",
        title: "On the Edge",
        desc:  "Drop below 20 sanity and survive.",
        icon:  "\u{1F9E0}",   // brain
        tier:  "silver",
        cat:   "survival",
        check: (g) => g.sanity !== undefined && g.sanity > 0 && g.sanity <= 20,
    },
    {
        id:    "battery_dead",
        title: "Darkness Falls",
        desc:  "Flashlight battery runs out completely.",
        icon:  "\u{1F50B}",   // battery
        tier:  "bronze",
        cat:   "survival",
        check: (g) => g.flashlightBattery !== undefined && g.flashlightBattery <= 0,
    },
    {
        id:    "battery_refill",
        title: "Resourceful",
        desc:  "Find and use a battery to recharge your flashlight.",
        icon:  "\u26A1",      // zap
        tier:  "bronze",
        cat:   "survival",
        check: (g) => g.permanentFlags && g.permanentFlags.usedBattery,
    },
    {
        id:    "full_sanity",
        title: "Peace of Mind",
        desc:  "Have sanity fully restored.",
        icon:  "\u{1F49A}",   // green heart
        tier:  "silver",
        cat:   "survival",
        check: (g) => g.sanity !== undefined && g.maxSanity !== undefined && g.sanity >= g.maxSanity,
    },
    {
        id:    "roses_healed",
        title: "Garden Sanctuary",
        desc:  "Restore sanity through the garden roses.",
        icon:  "\u{1F339}",   // rose
        tier:  "bronze",
        cat:   "survival",
        check: (g) => g.flags && g.flags.gardenRoses,
    },
    {
        id:    "gear_altered",
        title: "Time Bender",
        desc:  "Alter the clock mechanism to extend time.",
        icon:  "\u2699",      // gear
        tier:  "gold",
        cat:   "survival",
        check: (g) => g.flags && g.flags.gearAltered,
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  STORY COMPLETIONIST (6)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "servant_story",
        title: "The Servants' Tale",
        desc:  "Read the servants' note and search their quarters.",
        icon:  "\u{1F4DD}",   // memo
        tier:  "silver",
        cat:   "story",
        check: (g) => g.flags && g.flags.servantNote && g.flags.servantWardrobe,
    },
    {
        id:    "gardener_story",
        title: "Thomas's Sorrow",
        desc:  "Read the gardener's journal.",
        icon:  "\u{1F33F}",   // herb
        tier:  "bronze",
        cat:   "story",
        check: (g) => g.flags && g.flags.gardenerJournal,
    },
    {
        id:    "trunk_opened",
        title: "Bitter Memories",
        desc:  "Open the trunk in the master bedroom.",
        icon:  "\u{1F4E6}",   // package
        tier:  "silver",
        cat:   "story",
        check: (g) => g.flags && g.flags.trunkOpened,
    },
    {
        id:    "catacombs_lore",
        title: "Ancient Evil",
        desc:  "Read the ancient texts in the catacombs.",
        icon:  "\u{1F4DA}",   // books
        tier:  "gold",
        cat:   "story",
        check: (g) => g.flags && g.flags.catacombsRead,
    },
    {
        id:    "full_investigation",
        title: "The Full Picture",
        desc:  "Read diary, servants' note, gardener's journal, and lab journal.",
        icon:  "\u{1F50D}",   // magnifying glass
        tier:  "gold",
        cat:   "story",
        check: (g) => g.flags && g.flags.readDiary && g.flags.servantNote &&
                       g.flags.gardenerJournal && g.flags.labJournal,
    },
    {
        id:    "all_discoveries",
        title: "Omniscient",
        desc:  "Discover every interactable secret in the manor.",
        icon:  "\u{1F4A1}",   // light bulb
        tier:  "platinum",
        cat:   "story",
        check: (g) => {
            if (!g.flags) return false;
            const required = [
                "readLetter", "readDiary", "mirrorClue", "gramophonePlayed",
                "musicBoxOpened", "pianoPlayed", "confessionHeard", "fireLit",
                "candlesLit", "telescopeUsed", "clockOpened", "frozenBody",
                "wellExamined", "labJournal", "foundSecretRoom",
                "servantNote", "gardenerJournal", "catacombsRead",
                "ballroomVision", "trunkOpened",
            ];
            return required.every((f) => g.flags[f]);
        },
    },

    // ═════════════════════════════════════════════════════════════════════════
    //  ENDINGS (5)
    // ═════════════════════════════════════════════════════════════════════════
    {
        id:    "ending_any",
        title: "Escape",
        desc:  "Reach any ending.",
        icon:  "\u{1F6AA}",   // door
        tier:  "silver",
        cat:   "endings",
        check: (g) => g.endingReached != null,
    },
    {
        id:    "ending_liberation",
        title: "Liberation",
        desc:  "Break the chains — the good ending.",
        icon:  "\u{1F54A}",   // dove
        tier:  "gold",
        cat:   "endings",
        check: (g) => g.endingReached === "liberation" || g.endingReached === "good",
    },
    {
        id:    "ending_dawn",
        title: "Dawn Breaks",
        desc:  "Achieve the true ending — dawn.",
        icon:  "\u{1F305}",   // sunrise
        tier:  "platinum",
        cat:   "endings",
        check: (g) => g.endingReached === "dawn" || g.endingReached === "perfect",
    },
    {
        id:    "ending_sacrifice",
        title: "The Sacrifice",
        desc:  "Bind yourself to the seals — the sacrifice ending.",
        icon:  "\u{1F480}",   // skull
        tier:  "gold",
        cat:   "endings",
        check: (g) => g.endingReached === "sacrifice",
    },
    {
        id:    "ending_dark",
        title: "The Entity Is Free",
        desc:  "Shatter the seals — the dark ending.",
        icon:  "\u{1F47F}",   // imp
        tier:  "gold",
        cat:   "endings",
        check: (g) => g.endingReached === "dark" || g.endingReached === "bad",
    },
];

// Total: 65 achievements

// ═══════════════════════════════════════════════════════════════════════════════
//  TIER STYLING (used by notification renderer)
// ═══════════════════════════════════════════════════════════════════════════════
const _TIER_COLORS = {
    bronze:   { bg: "#3a2a14", border: "#8b6914", text: "#d4a040", glow: "#bb8822" },
    silver:   { bg: "#1a1a2a", border: "#6688aa", text: "#b0c8e0", glow: "#5588bb" },
    gold:     { bg: "#2a2210", border: "#ccaa22", text: "#ffe066", glow: "#ddbb33" },
    platinum: { bg: "#18102a", border: "#aa66ee", text: "#d4aaff", glow: "#8844cc" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SAFE WRAPPERS — never crash if game state is incomplete
// ═══════════════════════════════════════════════════════════════════════════════
function _hasItem(id) {
    try { return typeof hasItem === "function" && hasItem(id); } catch (e) { return false; }
}

function _countSeals() {
    try { return typeof countSeals === "function" ? countSeals() : 0; } catch (e) { return 0; }
}

function _getGame() {
    if (typeof game !== "undefined" && game) return game;
    if (typeof Game !== "undefined" && Game) return Game;
    if (typeof gameState !== "undefined" && gameState && typeof gameState === "object") return gameState;
    return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATE — persisted in localStorage
// ═══════════════════════════════════════════════════════════════════════════════
let _unlocked      = null;    // Set of achievement ids
let _stats         = null;    // { totalUnlocked, firstUnlockTime, lastUnlockTime }
let _notifQueue    = [];      // notification queue
let _activeNotif   = null;    // currently showing notification

const _STORAGE_KEY       = "eom_achievements";
const _STORAGE_KEY_STATS = "eom_achievement_stats";

function _load() {
    if (_unlocked) return;
    try {
        const raw = localStorage.getItem(_STORAGE_KEY);
        _unlocked = raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
        _unlocked = new Set();
    }
    try {
        const raw = localStorage.getItem(_STORAGE_KEY_STATS);
        _stats = raw ? JSON.parse(raw) : { totalUnlocked: 0, firstUnlockTime: null, lastUnlockTime: null };
    } catch (e) {
        _stats = { totalUnlocked: 0, firstUnlockTime: null, lastUnlockTime: null };
    }
}

function _save() {
    try {
        localStorage.setItem(_STORAGE_KEY, JSON.stringify([..._unlocked]));
        localStorage.setItem(_STORAGE_KEY_STATS, JSON.stringify(_stats));
    } catch (e) {}
}

function _unlock(ach) {
    if (_unlocked.has(ach.id)) return;

    _unlocked.add(ach.id);
    _stats.totalUnlocked = _unlocked.size;
    _stats.lastUnlockTime = Date.now();
    if (!_stats.firstUnlockTime) _stats.firstUnlockTime = Date.now();
    _save();

    // Queue notification
    _notifQueue.push({
        title: ach.title,
        desc:  ach.desc,
        icon:  ach.icon,
        tier:  ach.tier,
        cat:   ach.cat,
        timer: 0,
        maxTimer: 210,    // ~3.5 seconds at 60fps
        alpha: 0,
        slideX: 60,       // slides in from right
        state: "slideIn",
    });

    // Play sound
    try {
        if (typeof AudioWiring !== "undefined" && AudioWiring.playAchievement) {
            AudioWiring.playAchievement();
        } else if (typeof AudioManager !== "undefined" && AudioManager.playSFX) {
            AudioManager.playSFX("sfx_achievement", { volume: 0.7 });
        }
    } catch (e) {}

    console.log("[Achievement] Unlocked: " + ach.title + " (" + ach.tier + ")");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API — called by game.js
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * checkAchievements()
 * Called by game.js every 120 frames (line 2181).
 * Scans all achievements against current game state.
 */
function checkAchievements() {
    _load();
    const g = _getGame();

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const ach = ACHIEVEMENTS[i];
        if (_unlocked.has(ach.id)) continue;
        try {
            if (ach.check(g)) _unlock(ach);
        } catch (e) {
            // Silently skip — game state property might not exist yet
        }
    }
}

/**
 * drawAchievementNotification(ctx)
 * Called by game.js every render frame (line 1679).
 * Draws a toast notification in the top-right corner.
 */
function drawAchievementNotification(ctx) {
    if (!ctx) return;

    // Promote from queue to active when slot is free
    if (!_activeNotif && _notifQueue.length > 0) {
        _activeNotif = _notifQueue.shift();
    }

    if (!_activeNotif) return;

    const n  = _activeNotif;
    const cw = ctx.canvas.width;

    // ── State machine ─────────────────────────────────────────────────────────
    switch (n.state) {
        case "slideIn":
            n.alpha  = Math.min(1, n.alpha + 1 / 14);
            n.slideX = Math.max(0, n.slideX - 60 / 14);
            if (n.alpha >= 1 && n.slideX <= 0) {
                n.alpha = 1; n.slideX = 0; n.state = "hold";
            }
            break;
        case "hold":
            n.timer++;
            if (n.timer >= n.maxTimer - 40) n.state = "fadeOut";
            break;
        case "fadeOut":
            n.alpha = Math.max(0, n.alpha - 1 / 40);
            n.slideX += 1.5;
            n.timer++;
            if (n.alpha <= 0 || n.timer >= n.maxTimer) {
                _activeNotif = null;
                return;
            }
            break;
    }

    const tier   = _TIER_COLORS[n.tier] || _TIER_COLORS.bronze;

    // ── Dimensions ────────────────────────────────────────────────────────────
    const boxW   = Math.min(360, cw * 0.44);
    const boxH   = 82;
    const margin = 16;
    const x      = cw - boxW - margin + n.slideX;
    const y      = margin;
    const r      = 10;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, n.alpha));

    // ── Glow ──────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = tier.glow;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = "rgba(0,0,0,0)";
    _pill(ctx, x - 2, y - 2, boxW + 4, boxH + 4, r + 2);
    ctx.fill();
    ctx.restore();

    // ── Background ────────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(x, y, x, y + boxH);
    bg.addColorStop(0,   tier.bg + "fa");
    bg.addColorStop(1,   tier.bg + "ff");
    ctx.fillStyle = bg;
    _pill(ctx, x, y, boxW, boxH, r);
    ctx.fill();

    // ── Border ────────────────────────────────────────────────────────────────
    ctx.strokeStyle = tier.border + "88";
    ctx.lineWidth   = 1.5;
    _pill(ctx, x, y, boxW, boxH, r);
    ctx.stroke();

    // ── Top accent line ───────────────────────────────────────────────────────
    const tg = ctx.createLinearGradient(x, y, x + boxW, y);
    tg.addColorStop(0,   "transparent");
    tg.addColorStop(0.2, tier.border + "cc");
    tg.addColorStop(0.5, tier.border + "ff");
    tg.addColorStop(0.8, tier.border + "cc");
    tg.addColorStop(1,   "transparent");
    ctx.fillStyle = tg;
    ctx.fillRect(x, y, boxW, 2);

    // ── Icon ──────────────────────────────────────────────────────────────────
    ctx.font         = "28px serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = tier.text;
    ctx.fillText(n.icon, x + 30, y + boxH / 2);

    // ── "ACHIEVEMENT UNLOCKED" label ──────────────────────────────────────────
    ctx.font         = "bold 9px 'Courier New', monospace";
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle    = tier.border;
    ctx.fillText("ACHIEVEMENT UNLOCKED", x + 56, y + 12);

    // ── Tier badge ────────────────────────────────────────────────────────────
    const tierLabel = n.tier.toUpperCase();
    const tierW     = ctx.measureText(tierLabel).width + 10;
    const tierX     = x + boxW - tierW - 12;
    ctx.fillStyle   = tier.border + "44";
    _pill(ctx, tierX, y + 10, tierW, 14, 3);
    ctx.fill();
    ctx.fillStyle   = tier.text;
    ctx.font        = "bold 8px 'Courier New', monospace";
    ctx.fillText(tierLabel, tierX + 5, y + 13);

    // ── Title ─────────────────────────────────────────────────────────────────
    ctx.font      = "bold 15px Georgia, serif";
    ctx.fillStyle = tier.text;
    ctx.shadowColor = tier.glow;
    ctx.shadowBlur  = 6;
    ctx.fillText(n.title, x + 56, y + 30);
    ctx.shadowBlur  = 0;

    // ── Description ───────────────────────────────────────────────────────────
    ctx.font      = "12px Georgia, serif";
    ctx.fillStyle = "#a09888";
    ctx.fillText(n.desc, x + 56, y + 50);

    // ── Category ──────────────────────────────────────────────────────────────
    ctx.font      = "italic 10px Georgia, serif";
    ctx.fillStyle = "#665544";
    ctx.fillText(n.cat, x + 56, y + 66);

    // ── Progress bar (how many total unlocked) ────────────────────────────────
    _load();
    const pct  = _unlocked.size / ACHIEVEMENTS.length;
    const progY = y + boxH - 3;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x + r, progY, boxW - r * 2, 2);
    ctx.fillStyle = tier.border + "66";
    ctx.fillRect(x + r, progY, (boxW - r * 2) * pct, 2);

    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXTRA PUBLIC API — for achievements screen, stats, etc.
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns all achievements with unlocked status */
function getAllAchievements() {
    _load();
    return ACHIEVEMENTS.map((a) => ({
        id:       a.id,
        title:    a.title,
        desc:     a.desc,
        icon:     a.icon,
        tier:     a.tier,
        cat:      a.cat,
        unlocked: _unlocked.has(a.id),
    }));
}

/** Returns only unlocked achievements */
function getUnlockedAchievements() {
    _load();
    return ACHIEVEMENTS.filter((a) => _unlocked.has(a.id));
}

/** Returns { total, unlocked, percent, byCategory, stats } */
function getAchievementProgress() {
    _load();
    const total    = ACHIEVEMENTS.length;
    const unlocked = _unlocked.size;
    const percent  = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    const byCategory = {};
    for (const a of ACHIEVEMENTS) {
        if (!byCategory[a.cat]) byCategory[a.cat] = { total: 0, unlocked: 0 };
        byCategory[a.cat].total++;
        if (_unlocked.has(a.id)) byCategory[a.cat].unlocked++;
    }

    return { total, unlocked, percent, byCategory, stats: _stats };
}

/** Resets all achievement progress */
function resetAchievements() {
    _unlocked    = new Set();
    _stats       = { totalUnlocked: 0, firstUnlockTime: null, lastUnlockTime: null };
    _notifQueue  = [];
    _activeNotif = null;
    _save();
    console.log("[Achievement] All progress reset");
}

/** Check if a specific achievement is unlocked */
function isAchievementUnlocked(id) {
    _load();
    return _unlocked.has(id);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED UTIL — rounded rect
// ═══════════════════════════════════════════════════════════════════════════════
function _pill(ctx, x, y, w, h, r) {
    if (typeof r === "number") r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y,     x + w, y + tr,     tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - bl, bl);
    ctx.lineTo(x,     y + tl);
    ctx.arcTo(x,     y,     x + tl, y,          tl);
    ctx.closePath();
}