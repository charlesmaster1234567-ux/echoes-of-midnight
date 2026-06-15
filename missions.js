// ═════════════════════════════════════════════════════════════════
//  MISSIONS.JS — Mission & Quest System, Level Progression
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ─── SAFE ACCESSORS ─────────────────────────────────────────────
function _mg()  { return (typeof game !== "undefined" && game) ? game : null; }
function _mHasItem(id) {
    try { return typeof hasItem === "function" && hasItem(id); } catch (_) { return false; }
}
function _mCountSeals() {
    try { return typeof countSeals === "function" ? countSeals() : 0; } catch (_) { return 0; }
}
function _mGiveXP(n) {
    try { if (typeof giveXP === "function") giveXP(n); } catch (_) {}
}
function _mSound(key) {
    try { if (typeof playSound === "function") playSound(key); } catch (_) {}
}
function _mNotify(speaker, text, dur) {
    try {
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show) {
            SubtitleSystem.show(speaker, text, dur ?? 200);
        } else if (typeof showDialog === "function") {
            showDialog(speaker, text);
        }
    } catch (_) {}
}

// ═════════════════════════════════════════════════════════════════
//  MISSION DEFINITIONS
//  Deep-cloned on activation so the template is never mutated.
// ═════════════════════════════════════════════════════════════════
const MISSIONS = {

    // ── MAIN STORY ───────────────────────────────────────────────
    main_discover_house: {
        id: "main_discover_house",
        title: "Welcome to Thornwood",
        description: "Explore the ground floor of Thornwood Manor",
        type: "main", loop: 0,
        objectives: [
            { id: "visit_foyer",   desc: "Explore the Foyer",       type: "visit_room", target: "foyer",        done: false },
            { id: "visit_library", desc: "Visit the Library",        type: "visit_room", target: "library",      done: false },
            { id: "visit_dining",  desc: "Visit the Dining Room",    type: "visit_room", target: "dining_room",  done: false },
            { id: "visit_kitchen", desc: "Visit the Kitchen",        type: "visit_room", target: "kitchen",      done: false },
        ],
        reward: { xp: 50, sanity: 5 },
        completed: false,
        unlocks: ["main_first_clues"],
    },

    main_first_clues: {
        id: "main_first_clues",
        title: "Echoes of the Past",
        description: "Find your first clues about what happened here",
        type: "main", loop: 0,
        objectives: [
            { id: "find_letter",  desc: "Read the dusty letter in the foyer", type: "find_clue", target: "letter",  done: false },
            { id: "find_matches", desc: "Find something useful",               type: "has_item",  target: "matches", done: false },
        ],
        reward: { xp: 75, sanity: 10 },
        completed: false,
        unlocks: ["main_first_loop"],
    },

    main_first_loop: {
        id: "main_first_loop",
        title: "Déjà Vu",
        description: "Experience your first time loop",
        type: "main", loop: 0,
        objectives: [
            { id: "survive_loop", desc: "Survive until time resets", type: "reach_loop", target: 1, done: false },
        ],
        reward: { xp: 100 },
        completed: false,
        unlocks: ["main_diary", "side_mirror"],
    },

    main_diary: {
        id: "main_diary",
        title: "Eleanora's Story",
        description: "Find and read Eleanora's diary in the library",
        type: "main", loop: 1,
        objectives: [
            { id: "find_diary",    desc: "Find Eleanora's diary", type: "find_clue",   target: "diary",           done: false },
            { id: "unlock_stairs", desc: "Unlock the upstairs",   type: "check_flag",  target: "stairsUnlocked",  done: false },
        ],
        reward: { xp: 100, sanity: 10 },
        completed: false,
        unlocks: ["main_upstairs", "side_fireplace"],
    },

    main_upstairs: {
        id: "main_upstairs",
        title: "The Upper Floors",
        description: "Explore the upstairs of Thornwood Manor",
        type: "main", loop: 1,
        objectives: [
            { id: "visit_hall",     desc: "Explore the upstairs hallway", type: "visit_room", target: "upstairs_hall",   done: false },
            { id: "visit_master",   desc: "Search the master bedroom",    type: "visit_room", target: "master_bedroom",  done: false },
            { id: "visit_children", desc: "Visit the children's room",    type: "visit_room", target: "childrens_room",  done: false },
        ],
        reward: { xp: 100, sanity: 5 },
        completed: false,
        unlocks: ["main_clock_puzzle", "side_children_toys"],
    },

    main_clock_puzzle: {
        id: "main_clock_puzzle",
        title: "The Midnight Clock",
        description: "Discover the secret of the grandfather clock",
        type: "main", loop: 2,
        objectives: [
            { id: "mirror_clue", desc: "Find the mirror's message",   type: "find_clue", target: "mirror_hint", done: false },
            { id: "wind_clock",  desc: "Wind the clock backwards",    type: "has_item",  target: "seal_1",      done: false },
        ],
        reward: { xp: 150 },
        completed: false,
        unlocks: ["main_five_seals"],
    },

    main_five_seals: {
        id: "main_five_seals",
        title: "The Five Seals",
        description: "Gather all five seal fragments scattered through the house",
        type: "main", loop: 2,
        objectives: [
            { id: "seal1", desc: "Seal Fragment #1 — Grandfather Clock", type: "check_permanent", target: "hasFirstSeal",  done: false },
            { id: "seal2", desc: "Seal Fragment #2 — Victor's Desk",     type: "check_permanent", target: "hasSecondSeal", done: false },
            { id: "seal3", desc: "Seal Fragment #3 — Music Box",         type: "check_permanent", target: "hasThirdSeal",  done: false },
            { id: "seal4", desc: "Seal Fragment #4 — Study Cabinet",     type: "check_permanent", target: "hasFourthSeal", done: false },
            { id: "seal5", desc: "Seal Fragment #5 — Blood Altar",       type: "check_permanent", target: "hasFifthSeal",  done: false },
        ],
        reward: { xp: 300, sanity: 20 },
        completed: false,
        unlocks: ["main_discover_truth"],
    },

    main_discover_truth: {
        id: "main_discover_truth",
        title: "The Truth of Thornwood",
        description: "Uncover the full truth of what happened to the family",
        type: "main", loop: 3,
        objectives: [
            { id: "find_study",      desc: "Find Victor's study",         type: "visit_room", target: "study",          done: false },
            { id: "find_confession", desc: "Read Victor's confession",    type: "find_clue",  target: "confession",     done: false },
            { id: "find_plan",       desc: "Discover Eleanora's plan",    type: "find_clue",  target: "eleanora_plan",  done: false },
        ],
        reward: { xp: 250 },
        completed: false,
        unlocks: ["main_break_loop"],
    },

    main_break_loop: {
        id: "main_break_loop",
        title: "Break the Loop",
        description: "End the cycle. Free the family. Escape the house.",
        type: "main", loop: 3,
        objectives: [
            { id: "all_seals",  desc: "Have all five seal fragments",  type: "check_seals",   target: 5,      done: false },
            { id: "have_locket",desc: "Carry Eleanora's locket",       type: "has_item",      target: "locket", done: false },
            { id: "know_truth", desc: "Know the full truth",           type: "check_permanent", target: "knowTruth", done: false },
            { id: "ritual",     desc: "Perform the liberation ritual", type: "check_ending",  target: "good", done: false },
        ],
        reward: { xp: 1000 },
        completed: false,
        unlocks: [],
    },

    // ── SIDE MISSIONS ────────────────────────────────────────────
    side_mirror: {
        id: "side_mirror",
        title: "Through the Looking Glass",
        description: "The mirror in the foyer holds a secret",
        type: "side", loop: 2,
        objectives: [
            { id: "examine_mirror", desc: "Examine the foyer mirror", type: "find_clue", target: "mirror_hint", done: false },
        ],
        reward: { xp: 50, sanity: 5 },
        completed: false, unlocks: [],
    },

    side_fireplace: {
        id: "side_fireplace",
        title: "Light in the Dark",
        description: "Light the library fireplace and discover hidden symbols",
        type: "side", loop: 1,
        objectives: [
            { id: "get_matches", desc: "Find matches",                    type: "has_item",  target: "matches",            done: false },
            { id: "light_fire",  desc: "Light the library fireplace",    type: "find_clue", target: "fireplace_symbols",  done: false },
        ],
        reward: { xp: 75, sanity: 15 },
        completed: false, unlocks: [],
    },

    side_children_toys: {
        id: "side_children_toys",
        title: "The Children's Secret",
        description: "The children left clues in their toys",
        type: "side", loop: 2,
        objectives: [
            { id: "music_box",     desc: "Open the music box",       type: "find_clue", target: "music_box_riddle", done: false },
            { id: "rocking_horse", desc: "Examine the rocking horse", type: "find_clue", target: "horse_clue",      done: false },
        ],
        reward: { xp: 100, sanity: 5 },
        completed: false, unlocks: [],
    },

    side_dining_ghosts: {
        id: "side_dining_ghosts",
        title: "The Last Supper",
        description: "Witness the ghostly dinner scene",
        type: "side", loop: 1,
        objectives: [
            { id: "light_candles",   desc: "Light the dining room candles", type: "find_clue", target: "dinner_vision", done: false },
            { id: "examine_portrait",desc: "Study the family portrait",      type: "find_clue", target: "portrait",      done: false },
        ],
        reward: { xp: 75, sanity: -5 },
        completed: false, unlocks: [],
    },

    side_basement_explorer: {
        id: "side_basement_explorer",
        title: "Beneath the House",
        description: "Explore the basement and what lies below",
        type: "side", loop: 2,
        objectives: [
            { id: "unlock_basement", desc: "Unlock the basement door",        type: "check_permanent", target: "basementUnlocked", done: false },
            { id: "search_crates",   desc: "Search the old crates",           type: "find_clue",       target: "newspaper",        done: false },
            { id: "find_hidden",     desc: "Find the hidden ritual chamber",  type: "visit_room",      target: "ritual_chamber",   done: false },
        ],
        reward: { xp: 150, sanity: -10 },
        completed: false, unlocks: [],
    },

    side_secret_bookshelf: {
        id: "side_secret_bookshelf",
        title: "The Red Book",
        description: "Find the secret behind the library bookshelf",
        type: "side", loop: 3,
        objectives: [
            { id: "find_red_book",  desc: "Notice the red book",             type: "find_clue", target: "red_book",       done: false },
            { id: "open_passage",   desc: "Open the secret passage",         type: "find_clue", target: "secret_passage", done: false },
            { id: "read_journal",   desc: "Read Eleanora's hidden journal",  type: "find_clue", target: "eleanora_plan",  done: false },
        ],
        reward: { xp: 200, sanity: 10 },
        completed: false, unlocks: [],
    },

    side_parlor_piano: {
        id: "side_parlor_piano",
        title: "The Phantom Melody",
        description: "The piano in the parlor plays by itself at certain times",
        type: "side", loop: 1,
        objectives: [
            { id: "visit_parlor", desc: "Visit the Parlor",               type: "visit_room", target: "parlor",       done: false },
            { id: "hear_piano",   desc: "Hear the ghostly piano melody",  type: "check_flag", target: "heardPiano",   done: false },
        ],
        reward: { xp: 50, sanity: -5 },
        completed: false, unlocks: [],
    },

    side_garden_explore: {
        id: "side_garden_explore",
        title: "The Overgrown Path",
        description: "Explore the manor's outdoor grounds",
        type: "side", loop: 2,
        objectives: [
            { id: "visit_garden",    desc: "Find the Garden Path",     type: "visit_room", target: "garden_path", done: false },
            { id: "visit_greenhouse",desc: "Explore the Greenhouse",   type: "visit_room", target: "greenhouse",  done: false },
            { id: "visit_cemetery",  desc: "Find the Family Graveyard",type: "visit_room", target: "graveyard",   done: false },
        ],
        reward: { xp: 125, sanity: 10 },
        completed: false,
        unlocks: ["side_maze_challenge"],
    },

    side_maze_challenge: {
        id: "side_maze_challenge",
        title: "Lost in the Labyrinth",
        description: "Navigate the hedge maze",
        type: "side", loop: 3,
        objectives: [
            { id: "enter_maze",  desc: "Enter the Hedge Maze",  type: "visit_room", target: "hedge_maze",    done: false },
        ],
        reward: { xp: 150, sanity: -10 },
        completed: false, unlocks: [],
    },

    side_tower_ascent: {
        id: "side_tower_ascent",
        title: "The View from Above",
        description: "Ascend the tower and gaze at the stars",
        type: "side", loop: 3,
        objectives: [
            { id: "find_tower",  desc: "Find the Tower Staircase", type: "visit_room", target: "tower_stairs",  done: false },
            { id: "observatory", desc: "Visit the Observatory",    type: "visit_room", target: "observatory",   done: false },
        ],
        reward: { xp: 150, sanity: 15 },
        completed: false, unlocks: [],
    },

    side_catacombs: {
        id: "side_catacombs",
        title: "Into the Depths",
        description: "Explore the ancient catacombs beneath the manor",
        type: "side", loop: 4,
        objectives: [
            { id: "enter_catacombs", desc: "Enter the Catacombs",          type: "visit_room", target: "catacombs",       done: false },
            { id: "find_lake",       desc: "Discover the Underground Lake", type: "visit_room", target: "underground_lake", done: false },
        ],
        reward: { xp: 250, sanity: -15 },
        completed: false, unlocks: [],
    },

    side_servants_tale: {
        id: "side_servants_tale",
        title: "The Forgotten Staff",
        description: "Learn about the servants who lived and died here",
        type: "side", loop: 2,
        objectives: [
            { id: "visit_servants", desc: "Visit Servants' Quarters",  type: "visit_room", target: "servants_quarters", done: false },
            { id: "find_bell",      desc: "Reach the Bell Tower",      type: "visit_room", target: "bell_tower",        done: false },
        ],
        reward: { xp: 125, sanity: 5 },
        completed: false, unlocks: [],
    },

    side_attic_mystery: {
        id: "side_attic_mystery",
        title: "What's in the Attic?",
        description: "Explore the attic and its dark secrets",
        type: "side", loop: 3,
        objectives: [
            { id: "reach_attic", desc: "Find the Attic",            type: "visit_room", target: "attic",           done: false },
        ],
        reward: { xp: 150, sanity: -10 },
        completed: false, unlocks: [],
    },

    side_mausoleum: {
        id: "side_mausoleum",
        title: "Among the Dead",
        description: "Enter the Thornwood family mausoleum",
        type: "side", loop: 3,
        objectives: [
            { id: "find_cemetery",    desc: "Find the Cemetery",    type: "visit_room", target: "graveyard",  done: false },
        ],
        reward: { xp: 100, sanity: -15 },
        completed: false, unlocks: [],
    },

    side_wine_tasting: {
        id: "side_wine_tasting",
        title: "Vintage Horrors",
        description: "Explore the wine cellar beneath the dining room",
        type: "side", loop: 1,
        objectives: [
            { id: "find_cellar", desc: "Find the Wine Cellar", type: "visit_room", target: "wine_cellar", done: false },
        ],
        reward: { xp: 50 },
        completed: false, unlocks: [],
    },

    // ── EXPLORATION MILESTONES ───────────────────────────────────
    explore_10_rooms: {
        id: "explore_10_rooms",
        title: "Explorer",
        description: "Visit 10 different rooms",
        type: "milestone", loop: 0,
        objectives: [
            { id: "rooms_10", desc: "Visit 10 rooms", type: "rooms_visited", target: 10, done: false },
        ],
        reward: { xp: 100 },
        completed: false, unlocks: [],
    },

    explore_25_rooms: {
        id: "explore_25_rooms",
        title: "Cartographer",
        description: "Visit 25 different rooms",
        type: "milestone", loop: 0,
        objectives: [
            { id: "rooms_25", desc: "Visit 25 rooms", type: "rooms_visited", target: 25, done: false },
        ],
        reward: { xp: 250 },
        completed: false, unlocks: [],
    },

    explore_all_rooms: {
        id: "explore_all_rooms",
        title: "Master Explorer",
        description: "Visit every room in Thornwood Manor",
        type: "milestone", loop: 0,
        objectives: [
            { id: "rooms_all", desc: "Visit all rooms", type: "rooms_visited", target: 45, done: false },
        ],
        reward: { xp: 500 },
        completed: false, unlocks: [],
    },

    survive_5_loops: {
        id: "survive_5_loops",
        title: "Time Traveler",
        description: "Survive 5 complete time loops",
        type: "milestone", loop: 0,
        objectives: [
            { id: "loops_5", desc: "Complete 5 loops", type: "reach_loop", target: 5, done: false },
        ],
        reward: { xp: 200, sanity: 20 },
        completed: false, unlocks: [],
    },

    find_10_clues: {
        id: "find_10_clues",
        title: "Detective",
        description: "Find 10 clues",
        type: "milestone", loop: 0,
        objectives: [
            { id: "clues_10", desc: "Discover 10 clues", type: "clues_found", target: 10, done: false },
        ],
        reward: { xp: 150 },
        completed: false, unlocks: [],
    },
};

// ═════════════════════════════════════════════════════════════════
//  LEVEL DEFINITIONS
// ═════════════════════════════════════════════════════════════════
const LEVELS = [
    { level:  1, xpRequired:    0, title: "Lost Soul",             perk: null },
    { level:  2, xpRequired:  100, title: "Curious Visitor",       perk: "sanity_regen_1" },
    { level:  3, xpRequired:  250, title: "Investigator",          perk: "interact_range_up" },
    { level:  4, xpRequired:  500, title: "Ghost Whisperer",       perk: "ghost_resistance_1" },
    { level:  5, xpRequired:  800, title: "Paranormal Detective",  perk: "flashlight_efficiency" },
    { level:  6, xpRequired: 1200, title: "Loop Walker",           perk: "sanity_regen_2" },
    { level:  7, xpRequired: 1700, title: "Seal Keeper",           perk: "ghost_resistance_2" },
    { level:  8, xpRequired: 2300, title: "Truth Seeker",          perk: "time_slow" },
    { level:  9, xpRequired: 3000, title: "House Master",          perk: "sanity_regen_3" },
    { level: 10, xpRequired: 4000, title: "Liberator",             perk: "all_seeing" },
];

// ═════════════════════════════════════════════════════════════════
//  MISSION TRACKER
// ═════════════════════════════════════════════════════════════════
const missionTracker = {
    active:        [],
    completed:     [],    // array of mission id strings
    roomsVisited:  new Set(),
    xp:            0,
    level:         1,
    perks:         [],
    notifications: [],

    // Guard — prevents re-entrant checkObjectives calls
    _checking: false,

    // ─── INIT ───────────────────────────────────────────────────
    init() {
        this.active        = [];
        this.completed     = [];
        this.roomsVisited  = new Set();
        this.xp            = 0;
        this.level         = 1;
        this.perks         = [];
        this.notifications = [];
        this._checking     = false;
        this._activateMission("main_discover_house");
        // Auto-activate all milestones immediately — they have no prereqs
        for (const id in MISSIONS) {
            if (MISSIONS[id].type === "milestone") this._activateMission(id);
        }
    },

    // ─── ACTIVATE ───────────────────────────────────────────────
    _activateMission(id) {
        if (!MISSIONS[id])                                    return;
        if (this.active.some(m => m.id === id))              return;
        if (this.completed.includes(id))                     return;

        // Deep-clone so the MISSIONS template is never mutated
        const mission = JSON.parse(JSON.stringify(MISSIONS[id]));
        this.active.push(mission);
        this._addNotification(`📋 New Mission: ${mission.title}`, "mission");
    },

    // ─── OBJECTIVE EVALUATION ───────────────────────────────────
    checkObjectives() {
        if (this._checking) return;
        this._checking = true;
        try {
            this._runObjectiveCheck();
        } finally {
            this._checking = false;
        }
    },

    _runObjectiveCheck() {
        const g = _mg();
        if (!g) return;

        const toComplete = [];

        for (const mission of this.active) {
            let allDone = true;

            for (const obj of mission.objectives) {
                if (obj.done) continue;

                let done = false;
                try {
                    done = this._evalObjective(obj, g);
                } catch (_) {}

                if (done) {
                    obj.done = true;
                    this._addNotification(`✅ ${obj.desc}`, "objective");
                }

                if (!obj.done) allDone = false;
            }

            if (allDone && !mission.completed) {
                toComplete.push(mission);
            }
        }

        // Complete outside the loop to avoid mutating active[] while iterating
        for (const m of toComplete) {
            this._completeMission(m);
        }
    },

    _evalObjective(obj, g) {
        switch (obj.type) {
            case "visit_room":
                return this.roomsVisited.has(obj.target);

            case "find_clue":
                return Array.isArray(g.cluesFound) && g.cluesFound.includes(obj.target);

            case "has_item":
                return _mHasItem(obj.target);

            case "check_flag":
                return !!(g.flags && g.flags[obj.target]);

            case "check_permanent":
                return !!(g.permanentFlags && g.permanentFlags[obj.target]);

            case "reach_loop":
                return (g.loop ?? 0) >= obj.target;

            case "check_seals":
                return _mCountSeals() >= obj.target;

            case "check_ending":
                return g.endingReached === obj.target;

            case "rooms_visited":
                return this.roomsVisited.size >= obj.target;

            case "clues_found":
                return Array.isArray(g.cluesFound) && g.cluesFound.length >= obj.target;

            default:
                return false;
        }
    },

    // ─── COMPLETE ───────────────────────────────────────────────
    _completeMission(mission) {
        mission.completed = true;
        this.completed.push(mission.id);
        this.active = this.active.filter(m => m.id !== mission.id);

        // Apply rewards
        const g = _mg();
        const r = mission.reward;
        if (r) {
            if (r.xp)                         this._addXP(r.xp);
            if (r.sanity && g) {
                g.sanity = Math.min(
                    g.maxSanity ?? 100,
                    (g.sanity ?? 0) + r.sanity
                );
            }
        }

        this._addNotification(`🏆 Mission Complete: ${mission.title}`, "complete");
        _mSound("achievement");

        // Unlock follow-on missions if loop requirement is met
        if (Array.isArray(mission.unlocks) && g) {
            for (const unlockId of mission.unlocks) {
                const def = MISSIONS[unlockId];
                if (def && (g.loop ?? 0) >= (def.loop ?? 0)) {
                    this._activateMission(unlockId);
                }
            }
        }
    },

    // ─── XP & LEVELS ────────────────────────────────────────────
    _addXP(amount) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        this.xp += amount;
        this._addNotification(`+${amount} XP`, "xp");
        _mGiveXP(amount);    // also credit the main game XP system
        this._checkLevelUp();
    },

    _checkLevelUp() {
        // Find the highest level the player qualifies for
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            const lvl = LEVELS[i];
            if (this.xp >= lvl.xpRequired && this.level < lvl.level) {
                this.level = lvl.level;
                if (lvl.perk && !this.perks.includes(lvl.perk)) {
                    this.perks.push(lvl.perk);
                }
                this._addNotification(`⬆️ Level ${this.level}: ${lvl.title}`, "levelup");
                _mSound("levelup");
                break;
            }
        }
    },

    hasPerk(perkName) {
        return this.perks.includes(perkName);
    },

    // ─── ROOM ENTER ─────────────────────────────────────────────
    onRoomEnter(roomId) {
        if (typeof roomId !== "string" || !roomId) return;
        this.roomsVisited.add(roomId);

        // Auto-activate loop-appropriate unlocked missions
        const g = _mg();
        if (g) {
            const loop = g.loop ?? 0;
            for (const id in MISSIONS) {
                if (this.active.some(m => m.id === id)) continue;
                if (this.completed.includes(id))         continue;

                const def = MISSIONS[id];
                if ((def.loop ?? 0) > loop)              continue;

                // Milestones always auto-activate
                if (def.type === "milestone") {
                    this._activateMission(id);
                    continue;
                }

                // Other missions need a completed unlock chain
                const isUnlocked = this.completed.some(cId => {
                    const cm = MISSIONS[cId];
                    return cm && Array.isArray(cm.unlocks) && cm.unlocks.includes(id);
                });
                if (isUnlocked) this._activateMission(id);
            }
        }

        // Defer objective check slightly so room state fully settles
        setTimeout(() => { try { this.checkObjectives(); } catch (_) {} }, 0);
    },

    // ─── NOTIFICATIONS ──────────────────────────────────────────
    _addNotification(text, type) {
        this.notifications.push({ text, type, time: 180, alpha: 1 });
        if (this.notifications.length > 6) this.notifications.shift();
    },

    updateNotifications() {
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            const n = this.notifications[i];
            n.time--;
            n.alpha = n.time < 30 ? n.time / 30 : 1;
            if (n.time <= 0) this.notifications.splice(i, 1);
        }
    },

    // ─── DRAW NOTIFICATIONS ─────────────────────────────────────
    drawNotifications(ctx, cw) {
        if (!ctx || !this.notifications.length) return;

        const COLORS = {
            mission:   "#4488ff",
            objective: "#44cc44",
            complete:  "#ffcc00",
            xp:        "#cc88ff",
            levelup:   "#ff8800",
        };

        ctx.save();
        ctx.font      = "13px 'Courier New', monospace";
        ctx.textAlign = "right";

        let y = 100;
        for (const n of this.notifications) {
            ctx.globalAlpha = Math.max(0, Math.min(1, n.alpha));

            const tw = ctx.measureText(n.text).width;
            ctx.fillStyle = `rgba(0,0,0,0.55)`;
            ctx.fillRect(cw - tw - 46, y - 13, tw + 32, 22);

            ctx.fillStyle = COLORS[n.type] || "#ffffff";
            ctx.fillText(n.text, cw - 15, y + 3);

            y += 28;
        }

        ctx.restore();
    },

    // ─── DRAW MISSION TRACKER (HUD) ─────────────────────────────
    drawMissionTracker(ctx, cw, ch) {
        if (!ctx || this.active.length === 0) return;

        const TX  = 10;
        let   TY  = 60;
        const W   = 225;

        // Level bar
        const lvlDef  = LEVELS[Math.min(this.level - 1, LEVELS.length - 1)];
        const nextDef = LEVELS[this.level] || null;

        ctx.save();

        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fillRect(TX, TY, W, 20);

        ctx.fillStyle    = "rgba(160,110,255,0.7)";
        ctx.font         = "11px 'Courier New', monospace";
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`Lv.${this.level} ${lvlDef.title}`, TX + 5, TY + 10);

        if (nextDef) {
            const prog = Math.min(1,
                (this.xp - lvlDef.xpRequired) /
                Math.max(1, nextDef.xpRequired - lvlDef.xpRequired)
            );
            ctx.fillStyle = "rgba(80,40,160,0.35)";
            ctx.fillRect(TX + 160, TY + 3, 55, 14);
            ctx.fillStyle = "rgba(160,110,255,0.65)";
            ctx.fillRect(TX + 160, TY + 3, 55 * prog, 14);
            ctx.fillStyle    = "rgba(220,220,220,0.55)";
            ctx.font         = "9px 'Courier New', monospace";
            ctx.textBaseline = "middle";
            ctx.fillText(`${this.xp}XP`, TX + 165, TY + 10);
        }

        TY += 25;

        // Show up to 3 active missions
        const shown = this.active.slice(0, 3);
        for (const mission of shown) {
            const isMain   = mission.type === "main";
            const objCount = mission.objectives.length;
            const barH     = 18 + objCount * 14;

            ctx.fillStyle = "rgba(0,0,0,0.33)";
            ctx.fillRect(TX, TY, W, barH);

            ctx.fillStyle    = isMain ? "rgba(255,200,100,0.75)" : "rgba(150,200,255,0.55)";
            ctx.font         = "bold 11px 'Courier New', monospace";
            ctx.textAlign    = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${isMain ? "▸" : "○"} ${mission.title}`, TX + 5, TY + 13);

            let oy = TY + 14;
            for (const obj of mission.objectives) {
                oy += 14;
                ctx.fillStyle = obj.done ? "rgba(100,200,100,0.55)" : "rgba(160,160,160,0.42)";
                ctx.font      = "10px 'Courier New', monospace";
                ctx.fillText(`  ${obj.done ? "✓" : "·"} ${obj.desc}`, TX + 8, oy);
            }

            TY += barH + 4;
        }

        if (this.active.length > 3) {
            ctx.fillStyle    = "rgba(120,120,120,0.45)";
            ctx.font         = "10px 'Courier New', monospace";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`  +${this.active.length - 3} more…`, TX + 8, TY + 12);
        }

        ctx.restore();
    },

    // ─── PERSISTENCE ────────────────────────────────────────────
    getLoopPersistData() {
        return {
            completed:    [ ...this.completed ],
            roomsVisited: [ ...this.roomsVisited ],
            xp:           this.xp,
            level:        this.level,
            perks:        [ ...this.perks ],
        };
    },

    restoreFromLoopData(data) {
        if (!data) return;
        this.completed    = Array.isArray(data.completed)    ? data.completed    : [];
        this.roomsVisited = new Set(Array.isArray(data.roomsVisited) ? data.roomsVisited : []);
        this.xp           = Number.isFinite(data.xp)         ? data.xp           : 0;
        this.level        = Number.isFinite(data.level)       ? data.level        : 1;
        this.perks        = Array.isArray(data.perks)         ? data.perks        : [];
        this.active       = [];
        this.notifications = [];
        this._checking    = false;

        // Re-activate missions that were unlocked but not yet completed
        const g = _mg();
        if (g) {
            const loop = g.loop ?? 0;
            for (const id in MISSIONS) {
                if (this.completed.includes(id)) continue;

                const def = MISSIONS[id];
                if ((def.loop ?? 0) > loop) continue;
                if (def.type === "milestone") { this._activateMission(id); continue; }

                const isUnlocked = this.completed.some(cId => {
                    const cm = MISSIONS[cId];
                    return cm && Array.isArray(cm.unlocks) && cm.unlocks.includes(id);
                });
                if (isUnlocked) this._activateMission(id);
            }
        }
    },
};