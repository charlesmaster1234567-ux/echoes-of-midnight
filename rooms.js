// ═════════════════════════════════════════════════════════════════
//  ROOMS.JS — Echoes of Midnight
//  All room definitions, spawns, interactables, ghosts
//  30 rooms for deep exploration
// ═════════════════════════════════════════════════════════════════

const ROOM_SPAWNS = {};

function defSpawn(roomId, fromId, x, y) {
    if (!ROOM_SPAWNS[roomId]) ROOM_SPAWNS[roomId] = {};
    ROOM_SPAWNS[roomId][fromId] = { x, y };
}

function getSpawnForRoom(targetId, fromId) {
    const s = ROOM_SPAWNS[targetId];
    if (!s) return { x: 200, y: 200 };
    return s[fromId] || s["default"] || { x: 200, y: 200 };
}

// ═══════════════════════════
//  ROOM BUILDER HELPER
// ═══════════════════════════
function makeRoom(cfg) {
    return {
        name: cfg.name || "Unknown Room",
        description: cfg.description || "",
        width: cfg.width || 600,
        height: cfg.height || 500,
        bgColor: cfg.bgColor || "#0a0808",
        wallColor: cfg.wallColor || "#1a1210",
        floorColor: cfg.floorColor || "#0d0a08",
        ambientLight: cfg.ambientLight ?? 0.12,
        furniture: cfg.furniture || [],
        interactables: cfg.interactables || [],
        doors: cfg.doors || [],
        ghosts: cfg.ghosts || [],
        floorType: cfg.floorType || "tile",
    };
}

// ═══════════════════════════════════════
//  FLOOR 1 — GROUND FLOOR (12 rooms)
// ═══════════════════════════════════════

const ROOMS = {};

// ── 1. FOYER ────────────────────────────
ROOMS.foyer = makeRoom({
    name: "Grand Foyer",
    description: "A vast entrance hall. A chandelier hangs ominously above.",
    width: 800, height: 600,
    bgColor: "#0a0808", wallColor: "#1a1210", floorColor: "#0d0a08",
    ambientLight: 0.15,
    furniture: [
        { type: "chandelier", x: 400, y: 180, w: 80, h: 40 },
        { type: "table", x: 200, y: 350, w: 60, h: 40 },
        { type: "mirror", x: 650, y: 150, w: 40, h: 80 },
        { type: "rug", x: 400, y: 420, w: 200, h: 120 },
        { type: "stairs", x: 400, y: 70, w: 160, h: 60 },
    ],
    interactables: [
        {
            id: "foyer_letter", x: 200, y: 350, w: 30, h: 20, icon: "📜",
            label: "Dusty Letter",
            condition: () => true,
            action: () => {
                addClue("letter", "A letter dated 1923: 'Eleanora, the ritual must be completed at midnight. The five seals must be broken. — V'");
                showDialog("NARRATOR", "You find a faded letter on the table. It speaks of a ritual... and five seals.");
                game.flags.readLetter = true;
                giveXP(10);
            }
        },
        {
            id: "foyer_mirror", x: 650, y: 150, w: 40, h: 80, icon: "🪞",
            label: "Ornate Mirror",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.mirrorClue) {
                    showDialog("???", "Your reflection doesn't move when you do. It mouths: 'The clock... wind it backwards...'");
                    addClue("mirror_hint", "Mirror message: 'Wind the clock backwards.'");
                    game.flags.mirrorClue = true;
                    game.sanity -= 10;
                    playSound("ghost");
                    giveXP(20);
                } else if (game.flags.mirrorClue) {
                    showDialog("NARRATOR", "Your reflection stares back. It seems... sad.");
                } else {
                    showDialog("NARRATOR", "An antique mirror. Your reflection looks more tired than you feel.");
                }
            }
        },
        {
            id: "foyer_stairs", x: 400, y: 70, w: 140, h: 50, icon: "🔼",
            label: "Grand Staircase",
            condition: () => true,
            action: () => {
                if (game.flags.stairsUnlocked || game.loop >= 3 || game.level >= 3) {
                    changeRoom("upstairs_hall");
                } else {
                    showDialog("NARRATOR", "The staircase groans dangerously. You need more experience before venturing up. [Level 3 or Loop 3 required]");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "library",      x: 30, y: 280, w: 20, h: 60, side: "left",   label: "Library" },
        { targetRoom: "dining_room",  x: 750, y: 280, w: 20, h: 60, side: "right",  label: "Dining Room" },
        { targetRoom: "kitchen",      x: 370, y: 570, w: 60, h: 20, side: "bottom", label: "Kitchen" },
        { targetRoom: "parlor",       x: 600, y: 570, w: 60, h: 20, side: "bottom", label: "Parlor" },
    ],
    ghosts: [
        { id: "foyer_ghost", type: "watcher", x: 300, y: 200, appearsAfterLoop: 1, message: "She watches you from the shadows..." }
    ],
});
defSpawn("foyer", "default", 400, 480);
defSpawn("foyer", "library", 90, 300);
defSpawn("foyer", "dining_room", 710, 300);
defSpawn("foyer", "kitchen", 400, 530);
defSpawn("foyer", "parlor", 620, 530);
defSpawn("foyer", "upstairs_hall", 400, 140);

// ── 2. LIBRARY ──────────────────────────
ROOMS.library = makeRoom({
    name: "Library",
    description: "Floor-to-ceiling bookshelves. The smell of old paper fills the air.",
    width: 600, height: 500,
    wallColor: "#1a1510", floorColor: "#0e0b07",
    ambientLight: 0.1,
    furniture: [
        { type: "bookshelf", x: 80, y: 150, w: 40, h: 250 },
        { type: "bookshelf", x: 520, y: 150, w: 40, h: 250 },
        { type: "desk", x: 300, y: 250, w: 80, h: 50 },
        { type: "chair", x: 300, y: 310, w: 30, h: 30 },
        { type: "fireplace", x: 300, y: 50, w: 100, h: 50 },
    ],
    interactables: [
        {
            id: "lib_diary", x: 300, y: 250, w: 40, h: 30, icon: "📔",
            label: "Eleanora's Diary",
            condition: () => game.loop >= 1,
            action: () => {
                if (!game.flags.readDiary) {
                    showDialog("NARRATOR", "'Oct 13, 1923 — Victor says the house is alive. He says it feeds on us. The five seals keep it dormant. He wants to break them. I won't let him.'");
                    addClue("diary", "Eleanora's diary: Victor wanted to break the seals.");
                    game.flags.readDiary = true;
                    game.flags.stairsUnlocked = true;
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "You've already read the diary. 'Victor' echoes in your mind.");
                }
            }
        },
        {
            id: "lib_bookshelf_secret", x: 80, y: 280, w: 40, h: 40, icon: "📚",
            label: "Suspicious Books",
            condition: () => game.loop >= 2,
            action: () => {
                if (game.permanentFlags.knowSecretShelf && !game.flags.foundSecretRoom) {
                    showDialog("NARRATOR", "You pull the red book. The shelf swings open!");
                    game.flags.foundSecretRoom = true;
                    addClue("secret_passage", "Hidden passage behind the bookshelf.");
                    playSound("unlock");
                    giveXP(30);
                    changeRoom("secret_room");
                } else if (!game.permanentFlags.knowSecretShelf) {
                    showDialog("NARRATOR", "Hundreds of old books...");
                    if (game.loop >= 3) {
                        showDialog("NARRATOR", "Wait... one red leather book is protruding. No title.");
                        game.permanentFlags.knowSecretShelf = true;
                        addClue("red_book", "A suspicious red book — might be a lever.");
                        giveXP(15);
                    }
                } else {
                    changeRoom("secret_room");
                }
            }
        },
        {
            id: "lib_fireplace", x: 300, y: 50, w: 80, h: 40, icon: "🔥",
            label: "Cold Fireplace",
            condition: () => true,
            action: () => {
                if (hasItem("matches")) {
                    showDialog("NARRATOR", "You light the fireplace. Symbols on the mantle glow: ☽ ★ ☀ ♦ ☽");
                    addClue("fireplace_symbols", "Symbols: ☽ ★ ☀ ♦ ☽ — a sequence.");
                    game.flags.fireLit = true;
                    game.sanity = Math.min(game.maxSanity, game.sanity + 15);
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "A cold, dead fireplace. You need matches.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer", x: 560, y: 250, w: 20, h: 60, side: "right", label: "Foyer" },
        { targetRoom: "conservatory", x: 300, y: 470, w: 60, h: 20, side: "bottom", label: "Conservatory" },
    ],
    ghosts: [
        { id: "lib_ghost", type: "reader", x: 300, y: 300, appearsAfterLoop: 2, message: "A translucent woman reads a book that isn't there..." }
    ],
});
defSpawn("library", "default", 480, 250);
defSpawn("library", "foyer", 480, 250);
defSpawn("library", "secret_room", 120, 300);
defSpawn("library", "conservatory", 300, 430);

// ── 3. DINING ROOM ──────────────────────
ROOMS.dining_room = makeRoom({
    name: "Dining Room",
    description: "A long table set for a dinner that never happened.",
    width: 700, height: 500,
    wallColor: "#1a1012", floorColor: "#0c0908",
    ambientLight: 0.12,
    furniture: [
        { type: "longtable", x: 350, y: 250, w: 280, h: 55 },
        { type: "chair", x: 200, y: 220, w: 25, h: 25 },
        { type: "chair", x: 300, y: 290, w: 25, h: 25 },
        { type: "chair", x: 400, y: 220, w: 25, h: 25 },
        { type: "chair", x: 500, y: 290, w: 25, h: 25 },
        { type: "cabinet", x: 620, y: 90, w: 55, h: 40 },
        { type: "painting", x: 350, y: 55, w: 80, h: 50 },
    ],
    interactables: [
        {
            id: "dining_painting", x: 350, y: 55, w: 80, h: 50, icon: "🖼️",
            label: "Family Portrait",
            condition: () => true,
            action: () => {
                if (game.loop >= 2) {
                    showDialog("NARRATOR", "Victor, Eleanora, and two children. Five seal symbols glow behind them.");
                    addClue("portrait", "Portrait: Victor, Eleanora, two children. Five seals.");
                    game.permanentFlags.knowFamily = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "A family portrait. Faces obscured by grime.");
                }
            }
        },
        {
            id: "dining_cabinet", x: 620, y: 90, w: 50, h: 30, icon: "🗄️",
            label: "China Cabinet",
            condition: () => true,
            action: () => {
                if (!game.flags.cabinetSearched) {
                    showDialog("NARRATOR", "Behind the china: matches and a rusted key.");
                    addItem("matches", "🔥", "Box of Matches");
                    addItem("rusty_key", "🗝️", "Rusty Key");
                    game.flags.cabinetSearched = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Nothing else in the cabinet.");
                }
            }
        },
        {
            id: "dining_candles", x: 350, y: 250, w: 60, h: 30, icon: "🕯️",
            label: "Table Candles",
            condition: () => true,
            action: () => {
                if (hasItem("matches") && !game.flags.candlesLit) {
                    showDialog("NARRATOR", "Candles lit. Ghostly figures appear — a family eating in silence. Then they vanish.");
                    game.flags.candlesLit = true;
                    game.sanity -= 5;
                    playSound("ghost");
                    addClue("dinner_vision", "Vision: The family ate in total silence.");
                    giveXP(20);
                } else if (game.flags.candlesLit) {
                    showDialog("NARRATOR", "The candles flicker steadily.");
                } else {
                    showDialog("NARRATOR", "Unlit candelabras covered in dust.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer",   x: 30,  y: 250, w: 20, h: 60, side: "left",   label: "Foyer" },
        { targetRoom: "kitchen", x: 350, y: 470, w: 60, h: 20, side: "bottom", label: "Kitchen" },
        { targetRoom: "ballroom", x: 660, y: 250, w: 20, h: 60, side: "right", label: "Ballroom" },
    ],
    ghosts: [],
});
defSpawn("dining_room", "default", 80, 250);
defSpawn("dining_room", "foyer", 80, 250);
defSpawn("dining_room", "kitchen", 350, 430);
defSpawn("dining_room", "ballroom", 620, 250);

// ── 4. KITCHEN ──────────────────────────
ROOMS.kitchen = makeRoom({
    name: "Kitchen",
    description: "A decrepit kitchen. Something drips in the darkness.",
    width: 600, height: 500,
    bgColor: "#080808", wallColor: "#151210", floorColor: "#0a0908",
    ambientLight: 0.08,
    furniture: [
        { type: "counter", x: 300, y: 80, w: 350, h: 35 },
        { type: "stove", x: 130, y: 80, w: 55, h: 35 },
        { type: "table", x: 300, y: 300, w: 70, h: 50 },
        { type: "sink", x: 460, y: 80, w: 45, h: 30 },
    ],
    interactables: [
        {
            id: "kitchen_basement", x: 300, y: 465, w: 60, h: 20, icon: "🚪",
            label: "Basement Door",
            condition: () => true,
            action: () => {
                if (hasItem("rusty_key") || game.permanentFlags.basementUnlocked) {
                    showDialog("NARRATOR", "The key turns with a screech. Cold stale air rushes out.");
                    game.permanentFlags.basementUnlocked = true;
                    removeItem("rusty_key");
                    changeRoom("basement");
                    playSound("door");
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Heavy door. Locked. You need a key.");
                }
            }
        },
        {
            id: "kitchen_sink", x: 460, y: 80, w: 40, h: 25, icon: "🚰",
            label: "Old Sink",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.sinkClue) {
                    showDialog("NARRATOR", "Dark red liquid instead of water. In condensation: 'SHE KNOWS'");
                    game.sanity -= 15;
                    game.flags.sinkClue = true;
                    playSound("scare");
                    addClue("sink_blood", "'SHE KNOWS' — kitchen sink.");
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Stained, cracked porcelain sink.");
                }
            }
        },
        {
            id: "kitchen_pantry", x: 80, y: 300, w: 40, h: 50, icon: "🗄️",
            label: "Pantry",
            condition: () => true,
            action: () => {
                if (!game.flags.pantrySearched) {
                    showDialog("NARRATOR", "Old cans and herbs. A flashlight battery behind the flour.");
                    addItem("battery", "🔋", "Flashlight Battery");
                    game.flags.pantrySearched = true;
                    giveXP(10);
                } else {
                    showDialog("NARRATOR", "Pantry is empty.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer",       x: 270, y: 30, w: 60, h: 20, side: "top",    label: "Foyer" },
        { targetRoom: "dining_room", x: 560, y: 250, w: 20, h: 60, side: "right", label: "Dining Room" },
        { targetRoom: "servants_quarters", x: 30, y: 250, w: 20, h: 60, side: "left", label: "Servants' Quarters" },
    ],
    ghosts: [
        { id: "kitchen_ghost", type: "dripping", x: 300, y: 200, appearsAfterLoop: 3, message: "Drip... drip... drip..." }
    ],
});
defSpawn("kitchen", "default", 300, 200);
defSpawn("kitchen", "foyer", 300, 80);
defSpawn("kitchen", "dining_room", 520, 250);
defSpawn("kitchen", "basement", 300, 420);
defSpawn("kitchen", "servants_quarters", 80, 250);

// ── 5. PARLOR ───────────────────────────
ROOMS.parlor = makeRoom({
    name: "Parlor",
    description: "A once-elegant sitting room. Faded velvet and broken porcelain.",
    width: 550, height: 450,
    wallColor: "#1a1218", floorColor: "#0c0a0e",
    ambientLight: 0.13,
    furniture: [
        { type: "sofa", x: 275, y: 200, w: 120, h: 50 },
        { type: "table", x: 275, y: 280, w: 60, h: 40 },
        { type: "cabinet", x: 480, y: 100, w: 50, h: 40 },
        { type: "rug", x: 275, y: 250, w: 180, h: 120 },
    ],
    interactables: [
        {
            id: "parlor_photo", x: 275, y: 280, w: 40, h: 30, icon: "📸",
            label: "Faded Photograph",
            condition: () => true,
            action: () => {
                if (!game.flags.parlorPhoto) {
                    showDialog("NARRATOR", "A photograph of a garden party, 1921. Everyone is smiling except Victor. His eyes are pitch black in the photo.");
                    addClue("garden_photo", "1921 photo: Victor's eyes appear completely black.");
                    game.flags.parlorPhoto = true;
                    giveXP(10);
                } else {
                    showDialog("NARRATOR", "The photograph. Those black eyes...");
                }
            }
        },
        {
            id: "parlor_gramophone", x: 480, y: 100, w: 45, h: 35, icon: "📻",
            label: "Gramophone",
            condition: () => true,
            action: () => {
                if (!game.flags.gramophonePlayed) {
                    showDialog("NARRATOR", "You crank the gramophone. A waltz plays — then a woman's voice whispers between the notes: 'Five rooms, five seals, five sacrifices.'");
                    game.flags.gramophonePlayed = true;
                    addClue("gramophone_msg", "Gramophone whisper: 'Five rooms, five seals, five sacrifices.'");
                    playSound("whisper");
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "The gramophone crackles softly.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer", x: 275, y: 30, w: 60, h: 20, side: "top", label: "Foyer" },
        { targetRoom: "greenhouse", x: 510, y: 225, w: 20, h: 60, side: "right", label: "Greenhouse" },
    ],
    ghosts: [
        { id: "parlor_ghost", type: "sitter", x: 275, y: 200, appearsAfterLoop: 2, message: "A man sits on the sofa, staring at nothing. He doesn't blink." }
    ],
});
defSpawn("parlor", "default", 275, 350);
defSpawn("parlor", "foyer", 275, 80);
defSpawn("parlor", "greenhouse", 470, 250);

// ── 6. BALLROOM ─────────────────────────
ROOMS.ballroom = makeRoom({
    name: "Ballroom",
    description: "A grand ballroom. The chandelier sways though there is no wind.",
    width: 900, height: 600,
    wallColor: "#181018", floorColor: "#0a080c",
    ambientLight: 0.09,
    floorType: "marble",
    furniture: [
        { type: "chandelier", x: 450, y: 150, w: 100, h: 50 },
        { type: "pillar", x: 200, y: 200, w: 35, h: 35 },
        { type: "pillar", x: 700, y: 200, w: 35, h: 35 },
        { type: "pillar", x: 200, y: 400, w: 35, h: 35 },
        { type: "pillar", x: 700, y: 400, w: 35, h: 35 },
        { type: "rug", x: 450, y: 350, w: 350, h: 200 },
    ],
    interactables: [
        {
            id: "ballroom_center", x: 450, y: 350, w: 80, h: 60, icon: "💃",
            label: "Dance Floor Center",
            condition: () => game.loop >= 2,
            action: () => {
                if (!game.flags.ballroomVision) {
                    showDialog("NARRATOR", "You step onto the dance floor. Ghostly couples waltz around you. The music is beautiful and terrible. One couple stops — the woman whispers: 'He killed us during the dance.'");
                    game.flags.ballroomVision = true;
                    game.sanity -= 12;
                    addClue("ballroom_murder", "Ghosts say Victor killed them during a dance.");
                    playSound("ghost");
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "The dance floor is silent now. Scuff marks in the dust.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "dining_room", x: 30, y: 300, w: 20, h: 60, side: "left", label: "Dining Room" },
        { targetRoom: "gallery", x: 450, y: 30, w: 60, h: 20, side: "top", label: "Gallery" },
    ],
    ghosts: [
        { id: "ballroom_dancers", type: "dancers", x: 450, y: 350, appearsAfterLoop: 2, message: "Ghostly dancers waltz in eternal silence..." }
    ],
});
defSpawn("ballroom", "default", 100, 300);
defSpawn("ballroom", "dining_room", 100, 300);
defSpawn("ballroom", "gallery", 450, 100);

// ── 7. CONSERVATORY ─────────────────────
ROOMS.conservatory = makeRoom({
    name: "Conservatory",
    description: "Glass walls and ceiling, now cracked. Dead plants everywhere.",
    width: 550, height: 500,
    bgColor: "#060a06", wallColor: "#102010", floorColor: "#080c08",
    ambientLight: 0.18,
    furniture: [
        { type: "planter", x: 150, y: 150, w: 60, h: 40 },
        { type: "planter", x: 400, y: 150, w: 60, h: 40 },
        { type: "bench", x: 275, y: 300, w: 80, h: 30 },
        { type: "fountain", x: 275, y: 420, w: 50, h: 50 },
    ],
    interactables: [
        {
            id: "conserv_fountain", x: 275, y: 420, w: 45, h: 45, icon: "⛲",
            label: "Dry Fountain",
            condition: () => true,
            action: () => {
                if (!game.flags.fountainSearched) {
                    showDialog("NARRATOR", "The fountain basin has a seal fragment lodged in the drain.");
                    addItem("seal_3", "🔮", "Seal Fragment #3");
                    game.permanentFlags.hasThirdSeal = true;
                    game.flags.fountainSearched = true;
                    giveXP(30);
                    playSound("pickup");
                } else {
                    showDialog("NARRATOR", "Empty basin. Water stains suggest it hasn't run in decades.");
                }
            }
        },
        {
            id: "conserv_plant", x: 150, y: 150, w: 50, h: 35, icon: "🌿",
            label: "Strange Plant",
            condition: () => game.loop >= 2,
            action: () => {
                showDialog("NARRATOR", "This plant is alive. In a house where everything is dead. Its leaves form a pattern — the same symbols from the fireplace.");
                addClue("living_plant", "A living plant in the conservatory. Its leaves match the seal symbols.");
                giveXP(15);
            }
        },
    ],
    doors: [
        { targetRoom: "library", x: 275, y: 30, w: 60, h: 20, side: "top", label: "Library" },
    ],
    ghosts: [],
});
defSpawn("conservatory", "default", 275, 250);
defSpawn("conservatory", "library", 275, 80);

// ── 8. GREENHOUSE ───────────────────────
ROOMS.greenhouse = makeRoom({
    name: "Greenhouse",
    description: "Overgrown with thorny vines. Moonlight filters through broken glass.",
    width: 500, height: 450,
    bgColor: "#060806", wallColor: "#0e150e", floorColor: "#080a08",
    ambientLight: 0.2,
    furniture: [
        { type: "planter", x: 130, y: 150, w: 50, h: 40 },
        { type: "planter", x: 370, y: 150, w: 50, h: 40 },
        { type: "table", x: 250, y: 300, w: 60, h: 40 },
    ],
    interactables: [
        {
            id: "greenhouse_journal", x: 250, y: 300, w: 40, h: 30, icon: "📗",
            label: "Gardener's Journal",
            condition: () => true,
            action: () => {
                if (!game.flags.gardenerJournal) {
                    showDialog("NARRATOR", "'The roses died the night Victor opened the book. Everything dies near that book. Even the children look pale now.' — Thomas, Groundskeeper");
                    addClue("gardener_journal", "Gardener Thomas noticed: roses died when Victor opened 'the book'. Children grew pale.");
                    game.flags.gardenerJournal = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Thomas's journal. Poor man.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "parlor", x: 30, y: 225, w: 20, h: 60, side: "left", label: "Parlor" },
        { targetRoom: "garden_path", x: 250, y: 420, w: 60, h: 20, side: "bottom", label: "Garden Path" },
    ],
    ghosts: [
        { id: "greenhouse_ghost", type: "gardener", x: 130, y: 250, appearsAfterLoop: 3, message: "A hunched figure tends dead plants with invisible shears..." }
    ],
});
defSpawn("greenhouse", "default", 250, 250);
defSpawn("greenhouse", "parlor", 80, 250);
defSpawn("greenhouse", "garden_path", 250, 380);

// ── 9. GARDEN PATH ──────────────────────
ROOMS.garden_path = makeRoom({
    name: "Garden Path",
    description: "A moonlit path through dead hedges. Fog clings to the ground.",
    width: 700, height: 350,
    bgColor: "#050708", wallColor: "#0a100a", floorColor: "#070907",
    ambientLight: 0.22,
    floorType: "gravel",
    furniture: [
        { type: "hedge", x: 150, y: 80, w: 200, h: 30 },
        { type: "hedge", x: 550, y: 80, w: 200, h: 30 },
        { type: "hedge", x: 150, y: 270, w: 200, h: 30 },
        { type: "hedge", x: 550, y: 270, w: 200, h: 30 },
        { type: "statue", x: 350, y: 175, w: 30, h: 30 },
    ],
    interactables: [
        {
            id: "garden_statue", x: 350, y: 175, w: 30, h: 30, icon: "🗿",
            label: "Angel Statue",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.statueExamined) {
                    showDialog("NARRATOR", "The angel statue weeps real tears. Inscribed at the base: 'For James and Mary, taken too soon.' These were the children.");
                    addClue("statue_tears", "Weeping angel statue: 'For James and Mary, taken too soon.'");
                    game.flags.statueExamined = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "A stone angel, weathered by decades.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "greenhouse", x: 350, y: 30, w: 60, h: 20, side: "top", label: "Greenhouse" },
        { targetRoom: "graveyard", x: 660, y: 175, w: 20, h: 60, side: "right", label: "Graveyard", condition: () => game.loop >= 2 || game.level >= 4 },
        { targetRoom: "well", x: 30, y: 175, w: 20, h: 60, side: "left", label: "Old Well", condition: () => game.loop >= 3 || game.level >= 5 },
    ],
    ghosts: [],
});
defSpawn("garden_path", "default", 350, 175);
defSpawn("garden_path", "greenhouse", 350, 80);
defSpawn("garden_path", "graveyard", 620, 175);
defSpawn("garden_path", "well", 80, 175);

// ── 10. SERVANTS' QUARTERS ──────────────
ROOMS.servants_quarters = makeRoom({
    name: "Servants' Quarters",
    description: "Cramped rooms for the staff. Personal belongings still here.",
    width: 500, height: 400,
    wallColor: "#141210", floorColor: "#0a0908",
    ambientLight: 0.1,
    furniture: [
        { type: "bed", x: 130, y: 150, w: 70, h: 50 },
        { type: "bed", x: 370, y: 150, w: 70, h: 50 },
        { type: "table", x: 250, y: 300, w: 50, h: 35 },
        { type: "wardrobe", x: 450, y: 300, w: 40, h: 60 },
    ],
    interactables: [
        {
            id: "servant_note", x: 250, y: 300, w: 40, h: 25, icon: "📝",
            label: "Servant's Note",
            condition: () => true,
            action: () => {
                if (!game.flags.servantNote) {
                    showDialog("NARRATOR", "'We hear screaming from the basement every night now. Cook says we should leave. But the doors won't open after midnight. We are trapped.' — Unsigned");
                    addClue("servant_note", "Servants were trapped after midnight. Screaming from basement.");
                    game.flags.servantNote = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "The desperate note. They couldn't escape either.");
                }
            }
        },
        {
            id: "servant_wardrobe", x: 450, y: 300, w: 40, h: 50, icon: "🚪",
            label: "Wardrobe",
            condition: () => true,
            action: () => {
                if (!game.flags.servantWardrobe) {
                    showDialog("NARRATOR", "Old uniforms. In a pocket: a small brass key labeled 'WINE CELLAR'.");
                    addItem("wine_key", "🔑", "Wine Cellar Key");
                    game.flags.servantWardrobe = true;
                    giveXP(10);
                } else {
                    showDialog("NARRATOR", "Empty uniforms hanging like ghosts.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "kitchen", x: 460, y: 200, w: 20, h: 60, side: "right", label: "Kitchen" },
        { targetRoom: "wine_cellar", x: 250, y: 370, w: 60, h: 20, side: "bottom", label: "Wine Cellar", condition: () => hasItem("wine_key") || game.permanentFlags.wineCellarOpen },
    ],
    ghosts: [
        { id: "servant_ghost", type: "worker", x: 130, y: 200, appearsAfterLoop: 2, message: "A maid scrubs a floor that will never be clean..." }
    ],
});
defSpawn("servants_quarters", "default", 250, 250);
defSpawn("servants_quarters", "kitchen", 410, 200);
defSpawn("servants_quarters", "wine_cellar", 250, 330);

// ── 11. GALLERY ─────────────────────────
ROOMS.gallery = makeRoom({
    name: "Art Gallery",
    description: "Paintings line both walls. Their subjects seem to move when you look away.",
    width: 800, height: 350,
    wallColor: "#181420", floorColor: "#0a0810",
    ambientLight: 0.08,
    furniture: [
        { type: "painting", x: 150, y: 70, w: 50, h: 60 },
        { type: "painting", x: 300, y: 70, w: 50, h: 60 },
        { type: "painting", x: 450, y: 70, w: 50, h: 60 },
        { type: "painting", x: 600, y: 70, w: 50, h: 60 },
        { type: "bench", x: 400, y: 220, w: 80, h: 30 },
    ],
    interactables: [
        {
            id: "gallery_final_painting", x: 600, y: 70, w: 50, h: 60, icon: "🖼️",
            label: "The Final Painting",
            condition: () => true,
            action: () => {
                if (game.loop >= 3 && !game.flags.finalPainting) {
                    showDialog("NARRATOR", "The last painting shows this very house — engulfed in darkness. A figure stands at the door, holding five glowing fragments. Below: 'THE CHOICE'");
                    addClue("final_painting", "A painting of the house shows someone with five seal fragments making 'THE CHOICE'.");
                    game.flags.finalPainting = true;
                    game.sanity -= 8;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "A dark, unsettling painting. It feels like a warning.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "ballroom", x: 400, y: 320, w: 60, h: 20, side: "bottom", label: "Ballroom" },
    ],
    ghosts: [],
});
defSpawn("gallery", "default", 400, 250);
defSpawn("gallery", "ballroom", 400, 280);

// ── 12. WINE CELLAR ─────────────────────
ROOMS.wine_cellar = makeRoom({
    name: "Wine Cellar",
    description: "Rows of dusty bottles. The air is cold and damp.",
    width: 500, height: 400,
    bgColor: "#050505", wallColor: "#0e0c08", floorColor: "#080806",
    ambientLight: 0.05,
    furniture: [
        { type: "wine_rack", x: 100, y: 150, w: 50, h: 180 },
        { type: "wine_rack", x: 400, y: 150, w: 50, h: 180 },
        { type: "barrel", x: 250, y: 120, w: 50, h: 40 },
        { type: "barrel", x: 250, y: 300, w: 50, h: 40 },
    ],
    interactables: [
        {
            id: "wine_barrel", x: 250, y: 300, w: 50, h: 40, icon: "🛢️",
            label: "Suspicious Barrel",
            condition: () => true,
            action: () => {
                if (!game.flags.barrelOpened) {
                    showDialog("NARRATOR", "The barrel is hollow. Inside: a journal page and a silver crucifix.");
                    addItem("crucifix", "✝️", "Silver Crucifix");
                    addClue("barrel_journal", "Hidden journal page: 'The crucifix weakens the Entity. Eleanora blessed it.'");
                    game.flags.barrelOpened = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "The empty barrel.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "servants_quarters", x: 250, y: 30, w: 60, h: 20, side: "top", label: "Servants' Quarters" },
        { targetRoom: "basement", x: 250, y: 370, w: 60, h: 20, side: "bottom", label: "Basement Tunnel", condition: () => game.loop >= 3 || game.permanentFlags.basementUnlocked },
    ],
    ghosts: [],
});
defSpawn("wine_cellar", "default", 250, 200);
defSpawn("wine_cellar", "servants_quarters", 250, 80);
defSpawn("wine_cellar", "basement", 250, 330);

// ═══════════════════════════════════════
//  FLOOR 2 — UPSTAIRS (8 rooms)
// ═══════════════════════════════════════

// ── 13. UPSTAIRS HALL ───────────────────
ROOMS.upstairs_hall = makeRoom({
    name: "Upstairs Hallway",
    description: "A long dark corridor. Doors line both sides. Wallpaper peeling.",
    width: 800, height: 400,
    bgColor: "#080608", wallColor: "#151015", floorColor: "#0b090a",
    ambientLight: 0.08,
    furniture: [
        { type: "runner_rug", x: 400, y: 200, w: 600, h: 60 },
        { type: "painting", x: 200, y: 70, w: 40, h: 50 },
        { type: "painting", x: 400, y: 70, w: 40, h: 50 },
        { type: "painting", x: 600, y: 70, w: 40, h: 50 },
        { type: "clock", x: 720, y: 90, w: 40, h: 80 },
    ],
    interactables: [
        {
            id: "hall_clock", x: 720, y: 90, w: 40, h: 80, icon: "🕰️",
            label: "Grandfather Clock",
            condition: () => true,
            action: () => {
                if (game.flags.mirrorClue || game.permanentFlags.knowClockSecret) {
                    showDialogWithChoices("NARRATOR", "Wind the clock backwards?", [
                        { text: "Wind backwards", action: () => {
                            showDialog("NARRATOR", "Thirteen chimes. A compartment opens — Seal Fragment #1!");
                            addItem("seal_1", "🔮", "Seal Fragment #1");
                            game.permanentFlags.hasFirstSeal = true;
                            game.flags.clockOpened = true;
                            addClue("first_seal", "Seal Fragment #1 from the grandfather clock.");
                            playSound("unlock");
                            giveXP(30);
                        }},
                        { text: "Wind normally", action: () => {
                            showDialog("NARRATOR", "Nothing happens.");
                        }},
                        { text: "Leave it", action: () => {} },
                    ]);
                } else {
                    showDialog("NARRATOR", "Always midnight. There's a winding mechanism.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer",           x: 400, y: 370, w: 60, h: 20, side: "bottom", label: "Foyer (Downstairs)" },
        { targetRoom: "master_bedroom",  x: 30,  y: 200, w: 20, h: 60, side: "left",   label: "Master Bedroom" },
        { targetRoom: "childrens_room",  x: 750, y: 200, w: 20, h: 60, side: "right",  label: "Children's Room" },
        { targetRoom: "study",           x: 400, y: 30,  w: 60, h: 20, side: "top",    label: "Victor's Study",
          condition: () => game.loop >= 3 || game.permanentFlags.studyDiscovered || game.level >= 5 },
        { targetRoom: "nursery",         x: 200, y: 30,  w: 60, h: 20, side: "top",    label: "Nursery",
          condition: () => game.loop >= 2 },
        { targetRoom: "attic_stairs",    x: 600, y: 30,  w: 60, h: 20, side: "top",    label: "Attic Stairs",
          condition: () => game.level >= 6 || game.loop >= 4 },
    ],
    ghosts: [
        { id: "hall_ghost", type: "walker", x: 100, y: 200, appearsAfterLoop: 2, message: "Footsteps echo but no one is there..." }
    ],
});
defSpawn("upstairs_hall", "default", 400, 320);
defSpawn("upstairs_hall", "foyer", 400, 330);
defSpawn("upstairs_hall", "master_bedroom", 80, 200);
defSpawn("upstairs_hall", "childrens_room", 710, 200);
defSpawn("upstairs_hall", "study", 400, 80);
defSpawn("upstairs_hall", "nursery", 200, 80);
defSpawn("upstairs_hall", "attic_stairs", 600, 80);

// ── 14. MASTER BEDROOM ─────────────────
ROOMS.master_bedroom = makeRoom({
    name: "Master Bedroom",
    description: "Lavish but decayed. The bed is made, waiting for someone.",
    width: 600, height: 500,
    wallColor: "#181012", floorColor: "#0c0a08",
    ambientLight: 0.1,
    furniture: [
        { type: "bed", x: 300, y: 180, w: 140, h: 90 },
        { type: "dresser", x: 100, y: 140, w: 50, h: 40 },
        { type: "wardrobe", x: 520, y: 140, w: 55, h: 80 },
        { type: "nightstand", x: 170, y: 190, w: 28, h: 22 },
    ],
    interactables: [
        {
            id: "bed_under", x: 300, y: 230, w: 100, h: 35, icon: "🛏️",
            label: "Look Under Bed",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.underBed) {
                    showDialog("NARRATOR", "A child's drawing: 'DADDY IS SCARY NOW'");
                    game.flags.underBed = true;
                    addClue("child_drawing", "Drawing: 'DADDY IS SCARY NOW' — Victor changed.");
                    addItem("drawing", "🖍️", "Child's Drawing");
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Dust and cobwebs.");
                }
            }
        },
        {
            id: "bedroom_dresser", x: 100, y: 140, w: 50, h: 40, icon: "🗄️",
            label: "Dresser",
            condition: () => true,
            action: () => {
                if (!game.flags.dresserSearched) {
                    showDialog("NARRATOR", "A locket: 'To my darlings. Love breaks all chains.'");
                    addItem("locket", "📿", "Eleanora's Locket");
                    game.flags.dresserSearched = true;
                    addClue("locket_clue", "Locket: 'Love breaks all chains.'");
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Empty dresser.");
                }
            }
        },
        {
            id: "bedroom_wardrobe", x: 520, y: 140, w: 55, h: 80, icon: "🚪",
            label: "Wardrobe",
            condition: () => game.loop >= 3,
            action: () => {
                if (!game.flags.wardrobeOpened) {
                    showDialog("NARRATOR", "Hidden passage to Victor's Study! Scratch marks inside — someone was locked in.");
                    game.flags.wardrobeOpened = true;
                    game.permanentFlags.studyDiscovered = true;
                    addClue("wardrobe_passage", "Hidden passage to study. Someone was imprisoned.");
                    playSound("door");
                    giveXP(25);
                    changeRoom("study");
                } else {
                    changeRoom("study");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 560, y: 250, w: 20, h: 60, side: "right", label: "Hallway" },
    ],
    ghosts: [
        { id: "bedroom_ghost", type: "sleeper", x: 300, y: 180, appearsAfterLoop: 3, message: "A woman lies in bed. Translucent. Weeping silently." }
    ],
});
defSpawn("master_bedroom", "default", 500, 350);
defSpawn("master_bedroom", "upstairs_hall", 520, 260);
defSpawn("master_bedroom", "study", 480, 170);

// ── 15. CHILDREN'S ROOM ────────────────
ROOMS.childrens_room = makeRoom({
    name: "Children's Room",
    description: "Two small beds. Toys scattered. A music box plays faintly.",
    width: 500, height: 450,
    bgColor: "#080a0a", wallColor: "#121518", floorColor: "#0a0c0c",
    ambientLight: 0.12,
    furniture: [
        { type: "bed", x: 140, y: 180, w: 75, h: 55 },
        { type: "bed", x: 360, y: 180, w: 75, h: 55 },
        { type: "toybox", x: 250, y: 350, w: 55, h: 35 },
        { type: "rocking_horse", x: 410, y: 350, w: 35, h: 35 },
    ],
    interactables: [
        {
            id: "music_box", x: 250, y: 350, w: 50, h: 30, icon: "🎵",
            label: "Music Box",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.musicBoxOpened) {
                    showDialog("NARRATOR", "'When five become one, the door opens. When love speaks, the chain breaks.'");
                    addClue("music_box_riddle", "Music box: 'When five become one... when love speaks, the chain breaks.'");
                    game.flags.musicBoxOpened = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "A sad, tinkling melody.");
                }
            }
        },
        {
            id: "rocking_horse", x: 410, y: 350, w: 35, h: 35, icon: "🐴",
            label: "Rocking Horse",
            condition: () => true,
            action: () => {
                if (!game.flags.horseExamined) {
                    showDialog("NARRATOR", "It rocks on its own. Something carved on the base.");
                    game.flags.horseExamined = true;
                    game.sanity -= 5;
                    playSound("whisper");
                    if (game.loop >= 3) {
                        showDialog("NARRATOR", "'Father's study. Third drawer. The truth.'");
                        addClue("horse_clue", "Horse: 'Father's study. Third drawer. The truth.'");
                        giveXP(15);
                    }
                } else {
                    showDialog("NARRATOR", "The horse rocks silently.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 30, y: 200, w: 20, h: 60, side: "left", label: "Hallway" },
    ],
    ghosts: [
        { id: "children_ghost", type: "playing", x: 250, y: 280, appearsAfterLoop: 1, message: "Two ghostly children giggle..." }
    ],
});
defSpawn("childrens_room", "default", 80, 300);
defSpawn("childrens_room", "upstairs_hall", 80, 200);

// ── 16. VICTOR'S STUDY ─────────────────
ROOMS.study = makeRoom({
    name: "Victor's Study",
    description: "Dark study filled with occult symbols and instruments.",
    width: 600, height: 500,
    bgColor: "#0a0608", wallColor: "#18101a", floorColor: "#0c0810",
    ambientLight: 0.07,
    furniture: [
        { type: "desk", x: 300, y: 180, w: 100, h: 55 },
        { type: "bookshelf", x: 50, y: 140, w: 40, h: 180 },
        { type: "cabinet", x: 550, y: 140, w: 38, h: 55 },
        { type: "pentagram", x: 300, y: 380, w: 120, h: 120 },
    ],
    interactables: [
        {
            id: "study_desk", x: 300, y: 180, w: 80, h: 40, icon: "📋",
            label: "Victor's Desk",
            condition: () => true,
            action: () => {
                showDialogWithChoices("NARRATOR", "Which drawer?", [
                    { text: "First — Letters", action: () => {
                        showDialog("NARRATOR", "Letters about 'The Entity' trapped beneath the house.");
                        addClue("entity_letters", "Victor corresponded about an Entity under the house.");
                        giveXP(15);
                    }},
                    { text: "Second — Research", action: () => {
                        showDialog("NARRATOR", "Each seal bound to a family member. Breaking all five frees the Entity.");
                        addClue("seal_research", "Each seal = a family member. Breaking all = Entity freed.");
                        addItem("seal_2", "🔮", "Seal Fragment #2");
                        game.permanentFlags.hasSecondSeal = true;
                        giveXP(25);
                    }},
                    { text: "Third — The Truth", action: () => {
                        if (game.permanentFlags.knowThirdDrawer || game.cluesFound.includes("horse_clue")) {
                            showDialog("NARRATOR", "'I killed them. I broke the seals with their blood. But Eleanora's love was stronger — she bound the Entity again, trapping us all in this loop.'");
                            addClue("confession", "Victor's confession. Eleanora created the loop to contain the Entity.");
                            game.permanentFlags.knowTruth = true;
                            game.sanity -= 15;
                            playSound("scare");
                            giveXP(40);
                        } else {
                            showDialog("NARRATOR", "Stuck. You need more info.");
                            game.permanentFlags.knowThirdDrawer = true;
                        }
                    }},
                ]);
            }
        },
        {
            id: "study_pentagram", x: 300, y: 380, w: 100, h: 100, icon: "⭐",
            label: "Ritual Circle",
            condition: () => true,
            action: () => {
                const sc = countSeals();
                if (sc >= 5 && game.permanentFlags.knowTruth && hasItem("locket")) {
                    showDialog("NARRATOR", "You place all five seals. Hold the locket. 'Love breaks all chains.'");
                    startEnding("good");
                } else if (sc >= 5 && game.permanentFlags.knowTruth) {
                    showDialog("NARRATOR", "Seals glow, but something's missing. Proof of love...");
                } else if (sc >= 5) {
                    showDialogWithChoices("NARRATOR", `All five seals. The circle pulses.`, [
                        { text: "Break the seals (free Entity)", action: () => {
                            showDialog("NARRATOR", "The Entity screams with joy. Darkness consumes everything.");
                            startEnding("bad");
                        }},
                        { text: "Wait — need more info", action: () => {
                            showDialog("NARRATOR", "Something tells you there's more to learn.");
                        }},
                    ]);
                } else {
                    showDialog("NARRATOR", `Ritual circle in blood. ${sc}/5 seal fragments.`);
                }
            }
        },
        {
            id: "study_cabinet", x: 550, y: 140, w: 38, h: 50, icon: "🗄️",
            label: "Locked Cabinet",
            condition: () => true,
            action: () => {
                if (hasItem("study_key") || game.flags.cabinetOpen) {
                    showDialog("NARRATOR", "Seal Fragment #4 and a map showing a hidden room in the basement.");
                    addItem("seal_4", "🔮", "Seal Fragment #4");
                    game.permanentFlags.hasFourthSeal = true;
                    game.permanentFlags.knowBasementRoom = true;
                    addClue("basement_map", "Map: hidden room behind wine rack in basement.");
                    game.flags.cabinetOpen = true;
                    removeItem("study_key");
                    giveXP(30);
                } else {
                    showDialog("NARRATOR", "Ornate lock. Need a special key.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 300, y: 470, w: 60, h: 20, side: "bottom", label: "Hallway" },
    ],
    ghosts: [
        { id: "study_ghost", type: "victor", x: 300, y: 200, appearsAfterLoop: 4, message: "Victor's ghost writes endlessly..." }
    ],
});
defSpawn("study", "default", 300, 420);
defSpawn("study", "upstairs_hall", 300, 430);
defSpawn("study", "master_bedroom", 120, 250);

// ── 17. NURSERY ─────────────────────────
ROOMS.nursery = makeRoom({
    name: "Nursery",
    description: "A baby's room. The crib rocks by itself.",
    width: 450, height: 400,
    wallColor: "#141418", floorColor: "#0a0a0e",
    ambientLight: 0.1,
    furniture: [
        { type: "crib", x: 225, y: 180, w: 60, h: 45 },
        { type: "rocking_chair", x: 100, y: 280, w: 40, h: 40 },
        { type: "dresser", x: 380, y: 150, w: 45, h: 35 },
    ],
    interactables: [
        {
            id: "nursery_crib", x: 225, y: 180, w: 55, h: 40, icon: "🍼",
            label: "Self-Rocking Crib",
            condition: () => true,
            action: () => {
                if (!game.flags.cribExamined) {
                    showDialog("NARRATOR", "The crib rocks on its own. Inside: a tiny blanket with embroidered initials 'M.T.' — Mary Thornwood. And beneath it, a Seal Fragment.");
                    addItem("seal_5", "🔮", "Seal Fragment #5");
                    game.permanentFlags.hasFifthSeal = true;
                    game.flags.cribExamined = true;
                    addClue("nursery_seal", "Seal #5 hidden in baby Mary's crib.");
                    game.sanity -= 8;
                    playSound("ghost");
                    giveXP(35);
                } else {
                    showDialog("NARRATOR", "The empty crib still rocks.");
                }
            }
        },
        {
            id: "nursery_chair", x: 100, y: 280, w: 40, h: 40, icon: "🪑",
            label: "Rocking Chair",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "The chair is warm. As if someone just stood up.");
                game.sanity -= 3;
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 225, y: 370, w: 60, h: 20, side: "bottom", label: "Hallway" },
    ],
    ghosts: [
        { id: "nursery_ghost", type: "mother", x: 100, y: 280, appearsAfterLoop: 2, message: "A woman hums a lullaby to an empty crib..." }
    ],
});
defSpawn("nursery", "default", 225, 320);
defSpawn("nursery", "upstairs_hall", 225, 330);

// ── 18. ATTIC STAIRS ────────────────────
ROOMS.attic_stairs = makeRoom({
    name: "Attic Stairs",
    description: "Narrow stairs leading up into darkness. Cobwebs thick as curtains.",
    width: 300, height: 500,
    bgColor: "#060606", wallColor: "#101010", floorColor: "#080808",
    ambientLight: 0.04,
    furniture: [
        { type: "stairs", x: 150, y: 250, w: 100, h: 300 },
    ],
    interactables: [],
    doors: [
        { targetRoom: "upstairs_hall", x: 150, y: 470, w: 60, h: 20, side: "bottom", label: "Hallway" },
        { targetRoom: "attic", x: 150, y: 30, w: 60, h: 20, side: "top", label: "Attic" },
    ],
    ghosts: [],
});
defSpawn("attic_stairs", "default", 150, 400);
defSpawn("attic_stairs", "upstairs_hall", 150, 420);
defSpawn("attic_stairs", "attic", 150, 80);

// ── 19. ATTIC ───────────────────────────
ROOMS.attic = makeRoom({
    name: "Attic",
    description: "Dusty storage. Crates and old furniture. Something moves in the rafters.",
    width: 650, height: 450,
    bgColor: "#060504", wallColor: "#121008", floorColor: "#0a0906",
    ambientLight: 0.05,
    furniture: [
        { type: "crates", x: 150, y: 150, w: 60, h: 45 },
        { type: "crates", x: 500, y: 150, w: 60, h: 45 },
        { type: "trunk", x: 325, y: 300, w: 70, h: 45 },
        { type: "dresser", x: 150, y: 350, w: 50, h: 40 },
    ],
    interactables: [
        {
            id: "attic_trunk", x: 325, y: 300, w: 65, h: 40, icon: "📦",
            label: "Old Trunk",
            condition: () => true,
            action: () => {
                if (!game.flags.trunkOpened) {
                    showDialog("NARRATOR", "The trunk contains old photographs, a wedding dress... and a revolver with one bullet fired. Victor's confession was true.");
                    addClue("attic_evidence", "Trunk: wedding dress, photos, revolver with one bullet fired. Evidence of murder.");
                    game.flags.trunkOpened = true;
                    game.sanity -= 10;
                    playSound("scare");
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "The trunk and its horrible contents.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "attic_stairs", x: 325, y: 420, w: 60, h: 20, side: "bottom", label: "Stairs Down" },
        { targetRoom: "bell_tower", x: 325, y: 30, w: 60, h: 20, side: "top", label: "Bell Tower", condition: () => game.level >= 8 || game.loop >= 5 },
    ],
    ghosts: [
        { id: "attic_ghost", type: "hiding", x: 500, y: 200, appearsAfterLoop: 3, message: "Something watches from behind the crates..." }
    ],
});
defSpawn("attic", "default", 325, 380);
defSpawn("attic", "attic_stairs", 325, 380);
defSpawn("attic", "bell_tower", 325, 80);

// ── 20. BELL TOWER ──────────────────────
ROOMS.bell_tower = makeRoom({
    name: "Bell Tower",
    description: "The highest point. A massive bell hangs above. You can see the entire estate.",
    width: 350, height: 400,
    bgColor: "#080810", wallColor: "#101020", floorColor: "#0a0a14",
    ambientLight: 0.25,
    furniture: [
        { type: "bell", x: 175, y: 100, w: 80, h: 70 },
    ],
    interactables: [
        {
            id: "tower_bell", x: 175, y: 100, w: 75, h: 65, icon: "🔔",
            label: "The Midnight Bell",
            condition: () => true,
            action: () => {
                if (hasItem("crucifix") && countSeals() >= 3) {
                    showDialog("NARRATOR", "You ring the bell while holding the crucifix. The sound shatters the night. Below, you see every ghost in the house look upward. For a moment, the loop stutters.");
                    game.sanity += 20;
                    game.loopTime = Math.max(0, game.loopTime - 60);
                    addClue("bell_power", "The bell + crucifix weakened the loop. Gained time.");
                    playSound("unlock");
                    giveXP(40);
                } else {
                    showDialog("NARRATOR", "A massive bell. It doesn't ring — the clapper is missing. Or is it? You feel you need something holy.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "attic", x: 175, y: 370, w: 60, h: 20, side: "bottom", label: "Attic" },
    ],
    ghosts: [],
});
defSpawn("bell_tower", "default", 175, 300);
defSpawn("bell_tower", "attic", 175, 320);

// ═══════════════════════════════════════
//  UNDERGROUND (6 rooms)
// ═══════════════════════════════════════

// ── 21. BASEMENT ────────────────────────
ROOMS.basement = makeRoom({
    name: "Basement",
    description: "Damp stone walls. Something moves in the dark.",
    width: 600, height: 500,
    bgColor: "#050505", wallColor: "#101010", floorColor: "#080808",
    ambientLight: 0.04,
    furniture: [
        { type: "crates", x: 150, y: 180, w: 55, h: 40 },
        { type: "wine_rack", x: 500, y: 140, w: 50, h: 90 },
        { type: "furnace", x: 300, y: 90, w: 75, h: 55 },
        { type: "pillar", x: 200, y: 300, w: 28, h: 28 },
        { type: "pillar", x: 400, y: 300, w: 28, h: 28 },
    ],
    interactables: [
        {
            id: "basement_crates", x: 150, y: 180, w: 50, h: 30, icon: "📦",
            label: "Old Crates",
            condition: () => true,
            action: () => {
                if (!game.flags.cratesSearched) {
                    showDialog("NARRATOR", "'PROMINENT FAMILY VANISHES FROM THORNWOOD MANOR — POLICE BAFFLED' — 1923 headline.");
                    game.flags.cratesSearched = true;
                    addClue("newspaper", "1923: Family vanished. No bodies.");
                    addItem("study_key", "🔑", "Study Cabinet Key");
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Nothing else.");
                }
            }
        },
        {
            id: "basement_wine_rack", x: 500, y: 140, w: 50, h: 80, icon: "🍷",
            label: "Wine Rack",
            condition: () => true,
            action: () => {
                if (game.permanentFlags.knowBasementRoom) {
                    showDialog("NARRATOR", "You push the rack aside. A hidden ritual chamber!");
                    changeRoom("ritual_chamber");
                    playSound("door");
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "Dusty wine bottles. The rack seems oddly sturdy.");
                }
            }
        },
        {
            id: "basement_furnace", x: 300, y: 90, w: 65, h: 45, icon: "🔥",
            label: "Old Furnace",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "Charred remains of photos and documents. Someone destroyed evidence.");
                if (game.loop >= 3) {
                    addClue("burned_evidence", "Victor burned evidence.");
                    giveXP(10);
                }
            }
        },
    ],
    doors: [
        { targetRoom: "kitchen",       x: 300, y: 30,  w: 60, h: 20, side: "top",    label: "Kitchen" },
        { targetRoom: "catacombs",     x: 30,  y: 300, w: 20, h: 60, side: "left",   label: "Catacombs",
          condition: () => game.level >= 7 || game.loop >= 4 },
        { targetRoom: "wine_cellar",   x: 560, y: 300, w: 20, h: 60, side: "right",  label: "Wine Cellar Tunnel",
          condition: () => game.loop >= 3 || game.permanentFlags.basementUnlocked },
    ],
    ghosts: [
        { id: "basement_entity", type: "entity", x: 300, y: 420, appearsAfterLoop: 3, message: "Something massive breathes in the deepest shadow. It knows you." }
    ],
});
defSpawn("basement", "default", 300, 250);
defSpawn("basement", "kitchen", 300, 80);
defSpawn("basement", "ritual_chamber", 460, 170);
defSpawn("basement", "catacombs", 80, 300);
defSpawn("basement", "wine_cellar", 520, 300);

// ── 22. RITUAL CHAMBER ─────────────────
ROOMS.ritual_chamber = makeRoom({
    name: "Hidden Ritual Chamber",
    description: "The heart of the house. Ancient symbols. Power thrums in the walls.",
    width: 500, height: 500,
    bgColor: "#050008", wallColor: "#100018", floorColor: "#080010",
    ambientLight: 0.05,
    furniture: [
        { type: "altar", x: 250, y: 180, w: 80, h: 50 },
        { type: "candle_circle", x: 250, y: 350, w: 150, h: 150 },
        { type: "chains", x: 80, y: 140, w: 28, h: 90 },
        { type: "chains", x: 420, y: 140, w: 28, h: 90 },
    ],
    interactables: [
        {
            id: "chamber_altar", x: 250, y: 180, w: 70, h: 40, icon: "⛩️",
            label: "Blood Altar",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "Names carved: Victor. Eleanora. James. Mary. And — AZATHIEL.");
                addClue("entity_name", "Entity name: AZATHIEL.");
                game.sanity -= 20;
                playSound("scare");
                giveXP(30);
            }
        },
        {
            id: "chamber_chains", x: 80, y: 140, w: 28, h: 80, icon: "⛓️",
            label: "Binding Chains",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "Chains with protective runes. Some broken by Victor. New ones added by Eleanora — runes of love.");
                addClue("chain_runes", "Eleanora reinforced chains with love runes.");
                giveXP(15);
            }
        },
    ],
    doors: [
        { targetRoom: "basement", x: 250, y: 470, w: 60, h: 20, side: "bottom", label: "Basement" },
        { targetRoom: "void_chamber", x: 250, y: 30, w: 60, h: 20, side: "top", label: "The Void",
          condition: () => countSeals() >= 5 && game.permanentFlags.knowTruth },
    ],
    ghosts: [
        { id: "eleanora_ghost", type: "eleanora", x: 250, y: 300, appearsAfterLoop: 0, message: "Eleanora stands in the candle circle. She looks at you with hope." }
    ],
});
defSpawn("ritual_chamber", "default", 250, 420);
defSpawn("ritual_chamber", "basement", 250, 420);
defSpawn("ritual_chamber", "void_chamber", 250, 80);

// ── 23. SECRET ROOM ─────────────────────
ROOMS.secret_room = makeRoom({
    name: "Hidden Room",
    description: "A tiny room behind the bookshelf. Someone lived here in secret.",
    width: 400, height: 350,
    wallColor: "#141010", floorColor: "#0a0808",
    ambientLight: 0.1,
    furniture: [
        { type: "cot", x: 200, y: 200, w: 75, h: 45 },
        { type: "table", x: 200, y: 100, w: 50, h: 28 },
    ],
    interactables: [
        {
            id: "secret_journal", x: 200, y: 100, w: 40, h: 25, icon: "📓",
            label: "Eleanora's Hidden Journal",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "'Gather all five seals. Bring to ritual chamber. DO NOT break them. RESTORE them. Use my locket to channel love.' — Eleanora, Oct 30, 1923");
                addClue("eleanora_plan", "Eleanora's plan: gather seals, restore (not break), use locket.");
                game.permanentFlags.knowTruth = true;
                game.permanentFlags.knowEleanoraPlan = true;
                giveXP(50);
            }
        },
    ],
    doors: [
        { targetRoom: "library", x: 200, y: 320, w: 60, h: 20, side: "bottom", label: "Library" },
    ],
    ghosts: [],
});
defSpawn("secret_room", "default", 200, 270);
defSpawn("secret_room", "library", 200, 280);

// ── 24. CATACOMBS ───────────────────────
ROOMS.catacombs = makeRoom({
    name: "Catacombs",
    description: "Bone-lined tunnels stretching into darkness. Ancient beyond the house itself.",
    width: 700, height: 400,
    bgColor: "#040404", wallColor: "#0c0c0a", floorColor: "#060604",
    ambientLight: 0.03,
    furniture: [
        { type: "bones", x: 150, y: 80, w: 100, h: 25 },
        { type: "bones", x: 550, y: 80, w: 100, h: 25 },
        { type: "bones", x: 150, y: 320, w: 100, h: 25 },
        { type: "bones", x: 550, y: 320, w: 100, h: 25 },
        { type: "pillar", x: 350, y: 200, w: 30, h: 30 },
    ],
    interactables: [
        {
            id: "catacombs_inscription", x: 350, y: 200, w: 30, h: 30, icon: "🪦",
            label: "Ancient Inscription",
            condition: () => true,
            action: () => {
                if (!game.flags.catacombsRead) {
                    showDialog("NARRATOR", "Pre-dates the house by centuries: 'AZATHIEL sleeps. Disturb not the five bindings. The price of freedom is all souls within.'");
                    addClue("ancient_warning", "Ancient warning: Azathiel sleeps. Five bindings. Price = all souls.");
                    game.flags.catacombsRead = true;
                    game.sanity -= 12;
                    playSound("whisper");
                    giveXP(30);
                } else {
                    showDialog("NARRATOR", "The ancient words seem to pulse.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "basement", x: 660, y: 200, w: 20, h: 60, side: "right", label: "Basement" },
        { targetRoom: "underground_lake", x: 30, y: 200, w: 20, h: 60, side: "left", label: "Underground Lake",
          condition: () => game.level >= 8 },
    ],
    ghosts: [
        { id: "catacomb_spirits", type: "ancient", x: 350, y: 150, appearsAfterLoop: 3, message: "Ancient spirits older than the house itself watch silently..." }
    ],
});
defSpawn("catacombs", "default", 600, 200);
defSpawn("catacombs", "basement", 610, 200);
defSpawn("catacombs", "underground_lake", 80, 200);

// ── 25. UNDERGROUND LAKE ────────────────
ROOMS.underground_lake = makeRoom({
    name: "Underground Lake",
    description: "A vast underground cavern. Black water stretches into infinity.",
    width: 800, height: 500,
    bgColor: "#020206", wallColor: "#080810", floorColor: "#040408",
    ambientLight: 0.06,
    floorType: "water",
    furniture: [
        { type: "dock", x: 400, y: 400, w: 100, h: 40 },
        { type: "pillar", x: 200, y: 200, w: 40, h: 40 },
        { type: "pillar", x: 600, y: 200, w: 40, h: 40 },
    ],
    interactables: [
        {
            id: "lake_water", x: 400, y: 250, w: 80, h: 60, icon: "🌊",
            label: "Black Water",
            condition: () => true,
            action: () => {
                if (hasItem("locket")) {
                    showDialog("NARRATOR", "You hold the locket over the water. It glows. The water parts, revealing a staircase leading down to the Void Chamber. Eleanora's love lights the way.");
                    game.permanentFlags.voidAccess = true;
                    addClue("locket_power", "The locket parted the underground lake. Love lights the way.");
                    giveXP(40);
                } else {
                    showDialog("NARRATOR", "Black water. Bottomless. You see a faint glow deep below but cannot reach it.");
                    game.sanity -= 5;
                }
            }
        },
    ],
    doors: [
        { targetRoom: "catacombs", x: 760, y: 250, w: 20, h: 60, side: "right", label: "Catacombs" },
        { targetRoom: "void_chamber", x: 400, y: 30, w: 60, h: 20, side: "top", label: "The Void",
          condition: () => game.permanentFlags.voidAccess },
    ],
    ghosts: [
        { id: "lake_entity", type: "deep_one", x: 400, y: 200, appearsAfterLoop: 4, message: "Something impossibly large moves beneath the surface..." }
    ],
});
defSpawn("underground_lake", "default", 400, 420);
defSpawn("underground_lake", "catacombs", 720, 250);
defSpawn("underground_lake", "void_chamber", 400, 80);

// ── 26. VOID CHAMBER ────────────────────
ROOMS.void_chamber = makeRoom({
    name: "The Void Chamber",
    description: "The space between. Neither alive nor dead. This is where Azathiel is bound.",
    width: 600, height: 600,
    bgColor: "#000005", wallColor: "#050010", floorColor: "#020008",
    ambientLight: 0.02,
    furniture: [
        { type: "pentagram", x: 300, y: 300, w: 200, h: 200 },
        { type: "candle_circle", x: 300, y: 300, w: 250, h: 250 },
    ],
    interactables: [
        {
            id: "void_center", x: 300, y: 300, w: 80, h: 80, icon: "🌀",
            label: "The Binding Point",
            condition: () => true,
            action: () => {
                const sc = countSeals();
                if (sc >= 5 && hasItem("locket") && game.permanentFlags.knowEleanoraPlan) {
                    showDialogWithChoices("NARRATOR", "This is the true binding point. Azathiel writhes in chains of love and blood. You hold all five seals and Eleanora's locket. What do you do?", [
                        { text: "RESTORE the seals — honor Eleanora's sacrifice", action: () => {
                            showDialog("NARRATOR", "You press the locket to each seal. 'Love breaks all chains — but love also FORGES them.' The seals shine with golden light. Azathiel screams as the bindings strengthen. The loop shatters. Dawn breaks for the first time in a century.");
                            startEnding("perfect");
                        }},
                        { text: "BREAK the seals — free Azathiel", action: () => {
                            showDialog("NARRATOR", "You shatter the seals. Azathiel rises. The world ends. You made Victor's choice.");
                            startEnding("bad");
                        }},
                        { text: "SACRIFICE yourself — replace Eleanora as the anchor", action: () => {
                            showDialog("NARRATOR", "You bind yourself to the seals. The loop continues, but the family is finally free. You are the new guardian. Eternal. Alone. But at peace.");
                            startEnding("sacrifice");
                        }},
                    ]);
                } else {
                    showDialog("NARRATOR", `The void pulses. You have ${sc}/5 seals. ${hasItem("locket") ? "The locket glows." : "You need something personal."} ${game.permanentFlags.knowEleanoraPlan ? "" : "You need to understand the plan."}`);
                    game.sanity -= 10;
                    playSound("heartbeat");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "ritual_chamber", x: 300, y: 570, w: 60, h: 20, side: "bottom", label: "Ritual Chamber" },
    ],
    ghosts: [
        { id: "void_azathiel", type: "entity", x: 300, y: 300, appearsAfterLoop: 0, message: "AZATHIEL. It has no form. It is the darkness itself. It speaks without words: 'FREE ME OR BE CONSUMED.'" }
    ],
});
defSpawn("void_chamber", "default", 300, 520);
defSpawn("void_chamber", "ritual_chamber", 300, 530);

// ═══════════════════════════════════════
//  OUTDOOR / SPECIAL (4 rooms)
// ═══════════════════════════════════════

// ── 27. GRAVEYARD ───────────────────────
ROOMS.graveyard = makeRoom({
    name: "Family Graveyard",
    description: "Four headstones. Fresh flowers that never wilt. Moonlight bright as bone.",
    width: 600, height: 450,
    bgColor: "#040608", wallColor: "#0a100a", floorColor: "#060806",
    ambientLight: 0.2,
    floorType: "grass",
    furniture: [
        { type: "headstone", x: 150, y: 200, w: 30, h: 40 },
        { type: "headstone", x: 270, y: 200, w: 30, h: 40 },
        { type: "headstone", x: 390, y: 200, w: 30, h: 40 },
        { type: "headstone", x: 510, y: 200, w: 30, h: 40 },
        { type: "tree", x: 100, y: 100, w: 40, h: 40 },
        { type: "tree", x: 500, y: 100, w: 40, h: 40 },
        { type: "fence", x: 300, y: 420, w: 500, h: 15 },
    ],
    interactables: [
        {
            id: "grave_victor", x: 150, y: 200, w: 30, h: 40, icon: "🪦",
            label: "Victor's Grave",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "'Victor Thornwood, 1880-1923. MAY GOD HAVE MERCY.' The earth is disturbed.");
                addClue("victor_grave", "Victor's grave: 'May God have mercy.' Earth disturbed.");
                giveXP(10);
            }
        },
        {
            id: "grave_eleanora", x: 270, y: 200, w: 30, h: 40, icon: "🪦",
            label: "Eleanora's Grave",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "'Eleanora Thornwood, 1885-1923. HER LOVE ENDURES.' Fresh roses grow from the stone itself.");
                addClue("eleanora_grave", "Eleanora's grave: 'Her love endures.' Roses grow from stone.");
                giveXP(10);
            }
        },
        {
            id: "grave_children", x: 390, y: 200, w: 30, h: 40, icon: "🪦",
            label: "James's Grave",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "'James Thornwood, 1915-1923' and 'Mary Thornwood, 1919-1923.' So young. Toys left at the headstones.");
                addClue("children_graves", "Children's graves: James (8) and Mary (4). Toys at headstones.");
                game.sanity -= 8;
                giveXP(10);
            }
        },
    ],
    doors: [
        { targetRoom: "garden_path", x: 30, y: 250, w: 20, h: 60, side: "left", label: "Garden Path" },
        { targetRoom: "chapel", x: 560, y: 250, w: 20, h: 60, side: "right", label: "Chapel",
          condition: () => game.level >= 5 || game.loop >= 3 },
    ],
    ghosts: [
        { id: "grave_children_ghost", type: "playing", x: 440, y: 280, appearsAfterLoop: 2, message: "The children play among their own graves. They don't understand." }
    ],
});
defSpawn("graveyard", "default", 80, 300);
defSpawn("graveyard", "garden_path", 80, 250);
defSpawn("graveyard", "chapel", 520, 250);

// ── 28. CHAPEL ──────────────────────────
ROOMS.chapel = makeRoom({
    name: "Estate Chapel",
    description: "A small stone chapel. Stained glass bathes everything in colored moonlight.",
    width: 450, height: 500,
    bgColor: "#060608", wallColor: "#101018", floorColor: "#080810",
    ambientLight: 0.15,
    furniture: [
        { type: "pew", x: 150, y: 250, w: 100, h: 30 },
        { type: "pew", x: 300, y: 250, w: 100, h: 30 },
        { type: "pew", x: 150, y: 320, w: 100, h: 30 },
        { type: "pew", x: 300, y: 320, w: 100, h: 30 },
        { type: "altar", x: 225, y: 80, w: 70, h: 40 },
    ],
    interactables: [
        {
            id: "chapel_altar", x: 225, y: 80, w: 65, h: 35, icon: "✝️",
            label: "Chapel Altar",
            condition: () => true,
            action: () => {
                if (hasItem("crucifix")) {
                    showDialog("NARRATOR", "You place the crucifix on the altar. It begins to glow. Your sanity is restored. A voice: 'Bless you, child. You carry our hope.'");
                    game.sanity = game.maxSanity;
                    addClue("chapel_blessing", "The chapel altar blessed you. Full sanity restored.");
                    giveXP(30);
                } else {
                    showDialog("NARRATOR", "A humble altar. A place for the crucifix, perhaps?");
                }
            }
        },
        {
            id: "chapel_confession", x: 400, y: 400, w: 35, h: 50, icon: "🚪",
            label: "Confessional",
            condition: () => game.loop >= 3,
            action: () => {
                if (!game.flags.confessionHeard) {
                    showDialog("VICTOR", "You sit in the confessional. Victor's voice whispers: 'I was weak. The Entity promised me knowledge, power. I didn't know the price. My family. My soul. If you can hear this... do what I could not. Choose love.'");
                    game.flags.confessionHeard = true;
                    addClue("victor_confession", "Victor's ghost confesses in the chapel: 'Choose love.'");
                    game.permanentFlags.knowTruth = true;
                    giveXP(35);
                    playSound("ghost");
                } else {
                    showDialog("NARRATOR", "Silence in the confessional now.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "graveyard", x: 30, y: 300, w: 20, h: 60, side: "left", label: "Graveyard" },
    ],
    ghosts: [],
});
defSpawn("chapel", "default", 80, 300);
defSpawn("chapel", "graveyard", 80, 300);

// ── 29. WELL ────────────────────────────
ROOMS.well = makeRoom({
    name: "The Old Well",
    description: "A stone well in a clearing. Chains descend into darkness. Something echoes from below.",
    width: 400, height: 400,
    bgColor: "#040606", wallColor: "#0a0e0a", floorColor: "#060808",
    ambientLight: 0.18,
    furniture: [
        { type: "well", x: 200, y: 200, w: 50, h: 50 },
        { type: "tree", x: 350, y: 100, w: 40, h: 40 },
    ],
    interactables: [
        {
            id: "well_look", x: 200, y: 200, w: 45, h: 45, icon: "🕳️",
            label: "Look Down the Well",
            condition: () => true,
            action: () => {
                if (game.loop >= 4 && !game.flags.wellExamined) {
                    showDialog("NARRATOR", "You look down. Far below, you see... yourself. Looking up. It waves. You didn't wave. Then it mouths: 'We are all trapped. Every version. Every loop. Break it for ALL of us.'");
                    game.flags.wellExamined = true;
                    game.sanity -= 20;
                    addClue("well_paradox", "The well showed another version of you. Multiple loops running simultaneously.");
                    playSound("scare");
                    giveXP(40);
                } else {
                    showDialog("NARRATOR", "Darkness. The chain descends forever. Your flashlight can't reach the bottom.");
                    game.sanity -= 3;
                }
            }
        },
    ],
    doors: [
        { targetRoom: "garden_path", x: 360, y: 200, w: 20, h: 60, side: "right", label: "Garden Path" },
    ],
    ghosts: [
        { id: "well_ghost", type: "doppelganger", x: 200, y: 150, appearsAfterLoop: 4, message: "Your own face stares up from the darkness..." }
    ],
});
defSpawn("well", "default", 300, 200);
defSpawn("well", "garden_path", 320, 200);

// ── 30. CLOCK TOWER INTERIOR ────────────
ROOMS.clock_tower = makeRoom({
    name: "Clock Tower Mechanism",
    description: "Massive gears and pendulums. This is what controls time in the house.",
    width: 500, height: 500,
    bgColor: "#080604", wallColor: "#141008", floorColor: "#0a0804",
    ambientLight: 0.06,
    furniture: [
        { type: "gear", x: 250, y: 150, w: 100, h: 100 },
        { type: "gear", x: 150, y: 300, w: 60, h: 60 },
        { type: "gear", x: 350, y: 300, w: 60, h: 60 },
        { type: "pendulum", x: 250, y: 400, w: 20, h: 80 },
    ],
    interactables: [
        {
            id: "clock_mechanism", x: 250, y: 150, w: 90, h: 90, icon: "⚙️",
            label: "Central Mechanism",
            condition: () => true,
            action: () => {
                if (countSeals() >= 3 && game.permanentFlags.knowTruth) {
                    showDialogWithChoices("NARRATOR", "The central gear controls the time loop itself. With your knowledge and seals, you could alter it.", [
                        { text: "Slow the loop (gain 2 extra minutes)", action: () => {
                            game.maxLoopTime += 120;
                            showDialog("NARRATOR", "The gears grind. Time stretches. You've bought more time per loop.");
                            addClue("time_extended", "Extended the loop duration using the clock mechanism.");
                            giveXP(30);
                        }},
                        { text: "Observe only", action: () => {
                            showDialog("NARRATOR", "You study the mechanism. Each gear represents a soul bound to the loop.");
                        }},
                    ]);
                } else {
                    showDialog("NARRATOR", "Massive interlocking gears. They tick in rhythm with your heartbeat. You need more knowledge and power to interact with them.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 250, y: 470, w: 60, h: 20, side: "bottom", label: "Hallway" },
    ],
    ghosts: [],
});
defSpawn("clock_tower", "default", 250, 420);
defSpawn("clock_tower", "upstairs_hall", 250, 430);

// ═════════════════════════════════════════
// TOTAL: 30 rooms defined
// ═════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════
//  ROOMS_EXPANDED.JS — 20 Additional Rooms
//  Load AFTER rooms.js, BEFORE game.js
//  Adds: maze, tower, crypt, laboratory, balcony, secret garden,
//        servants tunnel, wine tasting, music room, observatory,
//        trophy room, laundry, coal room, ice house, dovecote,
//        potting shed, root cellar, clock mechanism, tower peak,
//        mirror gallery
// ═════════════════════════════════════════════════════════════════

// ── 31. HEDGE MAZE ──────────────────────────────────────────────
ROOMS.hedge_maze = makeRoom({
    name: "Hedge Maze",
    description: "Towering dead hedges form a labyrinth. The moonlight barely penetrates.",
    width: 1000, height: 800,
    bgColor: "#040604", wallColor: "#0a120a", floorColor: "#060806",
    ambientLight: 0.18,
    floorType: "grass",
    furniture: [
        // Maze walls
        { type: "hedge", x: 200, y: 100, w: 300, h: 25 },
        { type: "hedge", x: 200, y: 200, w: 25, h: 250 },
        { type: "hedge", x: 400, y: 200, w: 25, h: 150 },
        { type: "hedge", x: 300, y: 350, w: 200, h: 25 },
        { type: "hedge", x: 600, y: 100, w: 25, h: 300 },
        { type: "hedge", x: 600, y: 400, w: 300, h: 25 },
        { type: "hedge", x: 800, y: 200, w: 25, h: 200 },
        { type: "hedge", x: 700, y: 200, w: 100, h: 25 },
        { type: "hedge", x: 200, y: 500, w: 400, h: 25 },
        { type: "hedge", x: 400, y: 500, w: 25, h: 200 },
        { type: "hedge", x: 600, y: 600, w: 25, h: 150 },
        { type: "hedge", x: 700, y: 550, w: 200, h: 25 },
        { type: "hedge", x: 800, y: 550, w: 25, h: 200 },
        { type: "hedge", x: 150, y: 650, w: 250, h: 25 },
        // Center feature
        { type: "fountain", x: 500, y: 300, w: 40, h: 40 },
        { type: "statue", x: 500, y: 600, w: 30, h: 40 },
    ],
    interactables: [
        {
            id: "maze_fountain", x: 500, y: 300, w: 40, h: 40, icon: "⛲",
            label: "Maze Fountain",
            condition: () => true,
            action: () => {
                if (!game.flags.mazeFountain) {
                    showDialog("NARRATOR", "The fountain still flows with clear water. In the basin you see a golden compass. It points not north, but toward the ritual chamber.");
                    addItem("golden_compass", "🧭", "Golden Compass");
                    addClue("compass_clue", "Golden compass always points toward the ritual chamber.");
                    game.flags.mazeFountain = true;
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "The fountain flows endlessly.");
                }
            }
        },
        {
            id: "maze_statue", x: 500, y: 600, w: 30, h: 40, icon: "🗿",
            label: "Weeping Gargoyle",
            condition: () => game.loop >= 2,
            action: () => {
                if (!game.flags.mazeGargoyle) {
                    showDialog("NARRATOR", "The gargoyle's tears are real. Each drop burns the stone beneath it. Carved on its back: 'I GUARD THE PATH BELOW.' A trapdoor is revealed beneath it.");
                    game.flags.mazeGargoyle = true;
                    game.permanentFlags.mazeTrapdoor = true;
                    addClue("gargoyle_path", "Gargoyle guards a trapdoor leading underground.");
                    giveXP(30);
                    playSound("unlock");
                } else {
                    showDialog("NARRATOR", "The gargoyle weeps silently.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "garden_path", x: 30, y: 400, w: 20, h: 60, side: "left", label: "Garden Path" },
        { targetRoom: "secret_garden", x: 960, y: 400, w: 20, h: 60, side: "right", label: "Secret Garden",
          condition: () => game.loop >= 3 || game.level >= 6 },
        { targetRoom: "root_cellar", x: 500, y: 770, w: 60, h: 20, side: "bottom", label: "Trapdoor Down",
          condition: () => game.permanentFlags.mazeTrapdoor },
    ],
    ghosts: [
        { id: "maze_ghost", type: "walker", x: 700, y: 300, appearsAfterLoop: 2, message: "Something moves through the hedges, always one turn ahead of you..." }
    ],
});
defSpawn("hedge_maze", "default", 100, 400);
defSpawn("hedge_maze", "garden_path", 80, 400);
defSpawn("hedge_maze", "secret_garden", 920, 400);
defSpawn("hedge_maze", "root_cellar", 500, 720);

// ── 32. SECRET GARDEN ───────────────────────────────────────────
ROOMS.secret_garden = makeRoom({
    name: "Secret Garden",
    description: "A walled garden untouched by decay. Flowers bloom in moonlight. Impossible.",
    width: 600, height: 500,
    bgColor: "#060a06", wallColor: "#102010", floorColor: "#081008",
    ambientLight: 0.25,
    floorType: "grass",
    furniture: [
        { type: "planter", x: 150, y: 150, w: 60, h: 40 },
        { type: "planter", x: 450, y: 150, w: 60, h: 40 },
        { type: "planter", x: 150, y: 350, w: 60, h: 40 },
        { type: "planter", x: 450, y: 350, w: 60, h: 40 },
        { type: "bench", x: 300, y: 250, w: 80, h: 30 },
        { type: "fountain", x: 300, y: 400, w: 50, h: 50 },
        { type: "tree", x: 100, y: 100, w: 40, h: 40 },
        { type: "tree", x: 500, y: 100, w: 40, h: 40 },
    ],
    interactables: [
        {
            id: "garden_roses", x: 300, y: 250, w: 70, h: 30, icon: "🌹",
            label: "Eleanora's Roses",
            condition: () => true,
            action: () => {
                if (!game.flags.gardenRoses) {
                    showDialog("NARRATOR", "These roses are alive and blooming — the only living things in this dead estate. Each petal glows faintly with Eleanora's love. You feel your sanity strengthen just being near them.");
                    game.sanity = Math.min(game.maxSanity, game.sanity + 30);
                    addClue("living_roses", "Eleanora's roses still bloom. Her love sustains them even in death.");
                    game.flags.gardenRoses = true;
                    giveXP(20);
                    if (typeof emitSpirit === "function") emitSpirit(300, 250, 10, {r:255,g:100,b:150});
                } else {
                    game.sanity = Math.min(game.maxSanity, game.sanity + 10);
                    showDialog("NARRATOR", "The roses' warmth soothes your mind. (+10 sanity)");
                }
            }
        },
        {
            id: "garden_tree", x: 100, y: 100, w: 40, h: 40, icon: "🌳",
            label: "Ancient Oak",
            condition: () => game.loop >= 3,
            action: () => {
                if (!game.flags.gardenOak) {
                    showDialog("NARRATOR", "Carved into the oak: two hearts — 'V + E 1910'. Victor and Eleanora. Before the darkness. Before everything went wrong. A small key hangs from a branch.");
                    addItem("oak_key", "🔑", "Oak Tree Key");
                    addClue("oak_carving", "V + E 1910 carved in the oak. They were in love once.");
                    game.flags.gardenOak = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "The old oak stands eternal.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "hedge_maze", x: 30, y: 250, w: 20, h: 60, side: "left", label: "Hedge Maze" },
    ],
    ghosts: [
        { id: "garden_eleanora", type: "eleanora", x: 300, y: 400, appearsAfterLoop: 2, message: "Eleanora tends her roses. She hums a lullaby. She doesn't notice you — or pretends not to." }
    ],
});
defSpawn("secret_garden", "default", 80, 250);
defSpawn("secret_garden", "hedge_maze", 80, 250);

// ── 33. TOWER STAIRCASE ─────────────────────────────────────────
ROOMS.tower_stairs = makeRoom({
    name: "Tower Staircase",
    description: "A spiral stone staircase ascending into darkness. Each step echoes forever.",
    width: 350, height: 600,
    bgColor: "#060606", wallColor: "#101010", floorColor: "#080808",
    ambientLight: 0.06,
    furniture: [
        { type: "stairs", x: 175, y: 300, w: 120, h: 400 },
        { type: "pillar", x: 175, y: 300, w: 25, h: 25 },
    ],
    interactables: [
        {
            id: "tower_window", x: 300, y: 200, w: 30, h: 50, icon: "🪟",
            label: "Tower Window",
            condition: () => true,
            action: () => {
                showDialog("NARRATOR", "Through the narrow window you see the entire estate. The hedge maze, the graveyard, the garden. Everything is bathed in permanent moonlight. The moon hasn't moved since you arrived.");
                addClue("frozen_moon", "The moon never moves. Time is frozen outside the loop too.");
                giveXP(10);
            }
        },
    ],
    doors: [
        { targetRoom: "upstairs_hall", x: 175, y: 570, w: 60, h: 20, side: "bottom", label: "Hallway" },
        { targetRoom: "observatory", x: 175, y: 30, w: 60, h: 20, side: "top", label: "Observatory",
          condition: () => game.level >= 5 || game.loop >= 3 },
    ],
    ghosts: [],
});
defSpawn("tower_stairs", "default", 175, 500);
defSpawn("tower_stairs", "upstairs_hall", 175, 520);
defSpawn("tower_stairs", "observatory", 175, 80);

// ── 34. OBSERVATORY ─────────────────────────────────────────────
ROOMS.observatory = makeRoom({
    name: "Observatory",
    description: "A domed room with a massive telescope. Star charts cover every surface.",
    width: 500, height: 500,
    bgColor: "#040408", wallColor: "#0a0a18", floorColor: "#060610",
    ambientLight: 0.12,
    furniture: [
        { type: "desk", x: 250, y: 250, w: 80, h: 50 },
        { type: "chair", x: 250, y: 310, w: 30, h: 30 },
        { type: "cabinet", x: 430, y: 150, w: 50, h: 40 },
    ],
    interactables: [
        {
            id: "telescope", x: 250, y: 120, w: 60, h: 50, icon: "🔭",
            label: "Telescope",
            condition: () => true,
            action: () => {
                if (game.loop >= 3 && !game.flags.telescopeUsed) {
                    showDialog("NARRATOR", "You look through the telescope. Instead of stars, you see... other loops. Other versions of yourself, in other timelines, all trapped in the same house. Hundreds of you. All searching for the same answer.");
                    game.flags.telescopeUsed = true;
                    addClue("multiverse", "The telescope shows other loops — hundreds of parallel timelines, all trapped.");
                    game.sanity -= 15;
                    giveXP(40);
                    playSound("scare");
                } else {
                    showDialog("NARRATOR", "The telescope points at a sky that never changes.");
                }
            }
        },
        {
            id: "star_charts", x: 250, y: 250, w: 60, h: 40, icon: "📊",
            label: "Star Charts",
            condition: () => true,
            action: () => {
                if (!game.flags.starCharts) {
                    showDialog("NARRATOR", "Victor's star charts. He mapped constellations that don't exist — symbols that match the five seals. He was trying to find Azathiel's home dimension.");
                    addClue("star_maps", "Victor mapped impossible constellations matching the seal symbols.");
                    game.flags.starCharts = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Impossible constellations. Beautiful and terrifying.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "tower_stairs", x: 250, y: 470, w: 60, h: 20, side: "bottom", label: "Tower Stairs" },
    ],
    ghosts: [
        { id: "obs_ghost", type: "victor", x: 250, y: 120, appearsAfterLoop: 3, message: "Victor peers through the telescope, whispering coordinates to something that listens from the other side..." }
    ],
});
defSpawn("observatory", "default", 250, 400);
defSpawn("observatory", "tower_stairs", 250, 420);

// ── 35. LABORATORY ──────────────────────────────────────────────
ROOMS.laboratory = makeRoom({
    name: "Victor's Laboratory",
    description: "A hidden laboratory behind the study. Alchemical equipment and dark experiments.",
    width: 600, height: 450,
    bgColor: "#080608", wallColor: "#141018", floorColor: "#0a080c",
    ambientLight: 0.08,
    furniture: [
        { type: "counter", x: 300, y: 80, w: 400, h: 35 },
        { type: "desk", x: 150, y: 250, w: 70, h: 45 },
        { type: "cabinet", x: 530, y: 250, w: 50, h: 60 },
        { type: "table", x: 350, y: 350, w: 80, h: 50 },
    ],
    interactables: [
        {
            id: "lab_equipment", x: 300, y: 80, w: 80, h: 30, icon: "⚗️",
            label: "Alchemical Equipment",
            condition: () => true,
            action: () => {
                if (!game.flags.labEquipment) {
                    showDialog("NARRATOR", "Distillation equipment, rare minerals, and jars of... organic material. Victor was trying to create a physical vessel for Azathiel. The experiments failed — violently.");
                    addClue("vessel_experiments", "Victor tried to create a body for the Entity. Failed experiments everywhere.");
                    game.flags.labEquipment = true;
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "Failed experiments. Shattered glass and stains.");
                }
            }
        },
        {
            id: "lab_journal", x: 150, y: 250, w: 50, h: 35, icon: "📕",
            label: "Experiment Journal",
            condition: () => true,
            action: () => {
                if (!game.flags.labJournal) {
                    showDialog("NARRATOR", "'Subject 7 rejected the binding. Subject 8 expired during transfer. The Entity says I need living vessels — family. My family. No. There must be another way.' — Victor, Oct 1923");
                    addClue("experiment_journal", "Victor's journal: Entity demanded living family members as vessels. He resisted at first.");
                    game.flags.labJournal = true;
                    game.permanentFlags.knowTruth = true;
                    giveXP(35);
                } else {
                    showDialog("NARRATOR", "The journal of a man losing his soul, one experiment at a time.");
                }
            }
        },
        {
            id: "lab_cabinet", x: 530, y: 250, w: 45, h: 50, icon: "🧪",
            label: "Chemical Cabinet",
            condition: () => true,
            action: () => {
                if (!game.flags.labCabinet) {
                    showDialog("NARRATOR", "Bottles of strange liquids. One is labeled 'PURIFICATION ESSENCE'. It glows faintly blue.");
                    addItem("purification_essence", "🧪", "Purification Essence");
                    game.flags.labCabinet = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Empty shelves. Broken glass.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "study", x: 300, y: 420, w: 60, h: 20, side: "bottom", label: "Victor's Study" },
    ],
    ghosts: [
        { id: "lab_ghost", type: "victor", x: 300, y: 200, appearsAfterLoop: 3, message: "Victor's ghost mixes invisible chemicals, muttering equations that hurt to hear..." }
    ],
});
defSpawn("laboratory", "default", 300, 370);
defSpawn("laboratory", "study", 300, 380);

// ── 36. BALLROOM BALCONY ────────────────────────────────────────
ROOMS.balcony = makeRoom({
    name: "Ballroom Balcony",
    description: "An upper balcony overlooking the ballroom. Moonlight streams through broken windows.",
    width: 700, height: 300,
    bgColor: "#060608", wallColor: "#101018", floorColor: "#08080c",
    ambientLight: 0.2,
    furniture: [
        { type: "railing", x: 350, y: 270, w: 600, h: 15 },
        { type: "chair", x: 150, y: 150, w: 30, h: 30 },
        { type: "chair", x: 550, y: 150, w: 30, h: 30 },
        { type: "table", x: 350, y: 100, w: 50, h: 35 },
    ],
    interactables: [
        {
            id: "balcony_view", x: 350, y: 260, w: 80, h: 20, icon: "👀",
            label: "Look Down at Ballroom",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.balconyView) {
                    showDialog("NARRATOR", "From above, you see the ballroom floor. The ghostly dancers form a pattern — a pentagram. They've been drawing it with their dance for a century. In the center, a faint glow.");
                    addClue("dance_pentagram", "The ghost dancers trace a pentagram on the ballroom floor.");
                    game.flags.balconyView = true;
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "The empty ballroom stretches below. Dust motes float in moonlight.");
                }
            }
        },
        {
            id: "balcony_binoculars", x: 600, y: 100, w: 30, h: 25, icon: "🔍",
            label: "Old Binoculars",
            condition: () => true,
            action: () => {
                if (!game.flags.binoculars) {
                    showDialog("NARRATOR", "Through the binoculars you spot something in the garden — a hidden cellar entrance behind the well. And in the graveyard, one grave is glowing faintly.");
                    game.permanentFlags.knowWellCellar = true;
                    addClue("binoculars_sight", "Binoculars reveal: hidden cellar behind well, glowing grave in graveyard.");
                    game.flags.binoculars = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "The view hasn't changed. The moon never moves.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "ballroom", x: 350, y: 30, w: 60, h: 20, side: "top", label: "Ballroom (via stairs)" },
        { targetRoom: "gallery", x: 660, y: 150, w: 20, h: 60, side: "right", label: "Gallery" },
    ],
    ghosts: [],
});
defSpawn("balcony", "default", 350, 150);
defSpawn("balcony", "ballroom", 350, 80);
defSpawn("balcony", "gallery", 620, 150);

// ── 37. MUSIC ROOM ──────────────────────────────────────────────
ROOMS.music_room = makeRoom({
    name: "Music Room",
    description: "A grand piano sits center stage. Sheet music scattered everywhere.",
    width: 550, height: 450,
    bgColor: "#0a0808", wallColor: "#1a1215", floorColor: "#0c0a0a",
    ambientLight: 0.12,
    furniture: [
        { type: "desk", x: 275, y: 200, w: 120, h: 70 }, // piano
        { type: "chair", x: 275, y: 270, w: 30, h: 30 },
        { type: "bookshelf", x: 500, y: 200, w: 35, h: 200 },
        { type: "rug", x: 275, y: 250, w: 200, h: 120 },
    ],
    interactables: [
        {
            id: "grand_piano", x: 275, y: 200, w: 100, h: 60, icon: "🎹",
            label: "Grand Piano",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.pianoPlayed) {
                    showDialogWithChoices("NARRATOR", "The piano keys are dusty but functional. Sheet music is open to a piece called 'Eleanora's Lament'. Play it?", [
                        { text: "Play the music", action: () => {
                            showDialog("NARRATOR", "You play. The melody is heartbreakingly beautiful. As the last note fades, every ghost in the house stops moving. For one moment, peace. Then Eleanora's voice whispers: 'Thank you. Keep playing and I can hold the loop longer.'");
                            game.maxLoopTime += 60; // bonus minute
                            game.sanity = Math.min(game.maxSanity, game.sanity + 25);
                            addClue("eleanora_lament", "Playing Eleanora's Lament grants +1 minute per loop and restores sanity.");
                            game.flags.pianoPlayed = true;
                            giveXP(40);
                            playSound("piano_note");
                        }},
                        { text: "Don't touch it", action: () => {
                            showDialog("NARRATOR", "You step away. The piano seems disappointed.");
                        }},
                    ]);
                } else if (game.flags.pianoPlayed) {
                    showDialog("NARRATOR", "You play the lament again. Sanity restored.");
                    game.sanity = Math.min(game.maxSanity, game.sanity + 15);
                    playSound("piano_note");
                } else {
                    showDialog("NARRATOR", "A beautiful grand piano. The keys are stiff but playable.");
                }
            }
        },
        {
            id: "sheet_music", x: 500, y: 200, w: 30, h: 40, icon: "🎵",
            label: "Sheet Music Collection",
            condition: () => true,
            action: () => {
                if (!game.flags.sheetMusic) {
                    showDialog("NARRATOR", "Hundreds of compositions. Some by famous composers. Some by 'E. Thornwood'. One piece is titled 'Lullaby for James and Mary' — it's stained with tears.");
                    addClue("eleanora_composer", "Eleanora was a composer. She wrote lullabies for her children.");
                    game.flags.sheetMusic = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Eleanora's music. Every note carries love and grief.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "parlor", x: 30, y: 225, w: 20, h: 60, side: "left", label: "Parlor" },
    ],
    ghosts: [
        { id: "music_ghost", type: "eleanora", x: 275, y: 270, appearsAfterLoop: 2, message: "Eleanora sits at the piano, playing a melody only the dead can hear..." }
    ],
});
defSpawn("music_room", "default", 80, 300);
defSpawn("music_room", "parlor", 80, 250);

// ── 38. TROPHY ROOM ────────────────────────────────────────────
ROOMS.trophy_room = makeRoom({
    name: "Trophy Room",
    description: "Mounted heads and hunting trophies. Their glass eyes follow you.",
    width: 500, height: 400,
    bgColor: "#0a0806", wallColor: "#1a1510", floorColor: "#0c0a08",
    ambientLight: 0.1,
    furniture: [
        { type: "cabinet", x: 100, y: 100, w: 50, h: 40 },
        { type: "cabinet", x: 400, y: 100, w: 50, h: 40 },
        { type: "table", x: 250, y: 250, w: 60, h: 40 },
        { type: "rug", x: 250, y: 200, w: 200, h: 150 },
    ],
    interactables: [
        {
            id: "trophy_heads", x: 250, y: 70, w: 100, h: 40, icon: "🦌",
            label: "Trophy Heads",
            condition: () => true,
            action: () => {
                if (game.loop >= 2 && !game.flags.trophyHeads) {
                    showDialog("NARRATOR", "The mounted heads slowly turn to look at you. Their glass eyes blink. One opens its mouth and speaks in Victor's voice: 'I hunted greater game than beasts. I hunted GODS.'");
                    game.sanity -= 12;
                    game.flags.trophyHeads = true;
                    addClue("trophy_speak", "Trophy heads spoke in Victor's voice about hunting gods.");
                    playSound("scare");
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Glass eyes watch. Always watching.");
                }
            }
        },
        {
            id: "trophy_gun_case", x: 100, y: 100, w: 45, h: 35, icon: "🗄️",
            label: "Gun Case",
            condition: () => true,
            action: () => {
                if (!game.flags.gunCase) {
                    showDialog("NARRATOR", "A locked gun case. One rifle is missing — the same one found in the attic trunk. Victor's hunting rifle. Used for his final, terrible hunt.");
                    addClue("missing_rifle", "Victor's hunting rifle is missing from the trophy room. Found later in attic with one bullet fired.");
                    game.flags.gunCase = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "An empty space where a rifle should be.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "foyer", x: 250, y: 370, w: 60, h: 20, side: "bottom", label: "Foyer" },
    ],
    ghosts: [],
});
defSpawn("trophy_room", "default", 250, 320);
defSpawn("trophy_room", "foyer", 250, 330);

// ── 39. SERVANTS TUNNEL ─────────────────────────────────────────
ROOMS.servants_tunnel = makeRoom({
    name: "Servants' Tunnel",
    description: "A narrow passage used by servants to move unseen between rooms.",
    width: 800, height: 250,
    bgColor: "#050505", wallColor: "#0c0c0a", floorColor: "#080806",
    ambientLight: 0.04,
    furniture: [
        { type: "pillar", x: 200, y: 125, w: 20, h: 20 },
        { type: "pillar", x: 400, y: 125, w: 20, h: 20 },
        { type: "pillar", x: 600, y: 125, w: 20, h: 20 },
        { type: "crates", x: 700, y: 80, w: 50, h: 35 },
    ],
    interactables: [
        {
            id: "tunnel_scratch", x: 400, y: 60, w: 60, h: 30, icon: "✍️",
            label: "Scratched Message",
            condition: () => true,
            action: () => {
                if (!game.flags.tunnelScratch) {
                    showDialog("NARRATOR", "Scratched into the stone by fingernails: 'THE SERVANTS KNEW FIRST. WE SAW THE BLOOD. WE TRIED TO WARN HER. NOBODY LISTENED.' — Counted tally marks: 47 loops before this one.");
                    addClue("servants_warning", "Servants witnessed blood. Tried to warn Eleanora. 47 loops counted before someone stopped.");
                    game.flags.tunnelScratch = true;
                    giveXP(25);
                } else {
                    showDialog("NARRATOR", "47 tally marks. 47 loops of silence.");
                }
            }
        },
        {
            id: "tunnel_crates", x: 700, y: 80, w: 45, h: 30, icon: "📦",
            label: "Hidden Supplies",
            condition: () => true,
            action: () => {
                if (!game.flags.tunnelCrates) {
                    showDialog("NARRATOR", "Emergency supplies hidden by the servants. A battery, dried herbs, and a hand-drawn map of all servant passages.");
                    addItem("battery", "🔋", "Flashlight Battery");
                    game.flags.tunnelCrates = true;
                    game.permanentFlags.knowAllTunnels = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Empty crates.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "servants_quarters", x: 30, y: 125, w: 20, h: 60, side: "left", label: "Servants' Quarters" },
        { targetRoom: "kitchen", x: 400, y: 220, w: 60, h: 20, side: "bottom", label: "Kitchen" },
        { targetRoom: "dining_room", x: 760, y: 125, w: 20, h: 60, side: "right", label: "Dining Room" },
    ],
    ghosts: [
        { id: "tunnel_ghost", type: "worker", x: 300, y: 125, appearsAfterLoop: 2, message: "A maid runs through the tunnel, panic on her ghostly face, carrying a warning that came too late..." }
    ],
});
defSpawn("servants_tunnel", "default", 80, 125);
defSpawn("servants_tunnel", "servants_quarters", 80, 125);
defSpawn("servants_tunnel", "kitchen", 400, 180);
defSpawn("servants_tunnel", "dining_room", 720, 125);

// ── 40. MIRROR GALLERY ──────────────────────────────────────────
ROOMS.mirror_gallery = makeRoom({
    name: "Mirror Gallery",
    description: "A corridor lined with mirrors. Your reflection doesn't always match your movements.",
    width: 700, height: 300,
    bgColor: "#080810", wallColor: "#101020", floorColor: "#0a0a14",
    ambientLight: 0.1,
    furniture: [
        { type: "mirror", x: 100, y: 60, w: 30, h: 70 },
        { type: "mirror", x: 250, y: 60, w: 30, h: 70 },
        { type: "mirror", x: 400, y: 60, w: 30, h: 70 },
        { type: "mirror", x: 550, y: 60, w: 30, h: 70 },
        { type: "mirror", x: 100, y: 220, w: 30, h: 70 },
        { type: "mirror", x: 250, y: 220, w: 30, h: 70 },
        { type: "mirror", x: 400, y: 220, w: 30, h: 70 },
        { type: "mirror", x: 550, y: 220, w: 30, h: 70 },
        { type: "runner_rug", x: 350, y: 150, w: 600, h: 40 },
    ],
    interactables: [
        {
            id: "mirror_wrong", x: 400, y: 60, w: 30, h: 70, icon: "🪞",
            label: "The Wrong Mirror",
            condition: () => game.loop >= 2,
            action: () => {
                if (!game.flags.wrongMirror) {
                    showDialogWithChoices("NARRATOR", "This mirror shows you — but wrong. Your reflection is standing in a different room. It reaches toward you. Its hand begins to push through the glass surface.", [
                        { text: "Take its hand", action: () => {
                            showDialog("NARRATOR", "Your reflection pulls you partially through. For a split second you see the house from the OTHER side — the Entity's dimension. It's beautiful and terrible. A lattice of souls. You pull back with knowledge you didn't have before.");
                            game.permanentFlags.mirrorVision = true;
                            addClue("entity_dimension", "Glimpsed the Entity's dimension through a mirror. A lattice of trapped souls.");
                            game.sanity -= 20;
                            giveXP(50);
                            playSound("scare");
                        }},
                        { text: "Step back", action: () => {
                            showDialog("NARRATOR", "You pull away. The reflection looks disappointed. It mouths: 'COWARD.' Then it smiles and walks away, leaving the mirror empty.");
                            game.sanity -= 5;
                        }},
                    ]);
                    game.flags.wrongMirror = true;
                } else {
                    showDialog("NARRATOR", "The mirror is empty now. No reflection at all.");
                    game.sanity -= 3;
                }
            }
        },
    ],
    doors: [
        { targetRoom: "gallery", x: 30, y: 150, w: 20, h: 60, side: "left", label: "Art Gallery" },
        { targetRoom: "upstairs_hall", x: 660, y: 150, w: 20, h: 60, side: "right", label: "Hallway" },
    ],
    ghosts: [
        { id: "mirror_doppel", type: "doppelganger", x: 350, y: 150, appearsAfterLoop: 3, message: "Your reflection walks independently between the mirrors, watching you from every angle..." }
    ],
});
defSpawn("mirror_gallery", "default", 80, 150);
defSpawn("mirror_gallery", "gallery", 80, 150);
defSpawn("mirror_gallery", "upstairs_hall", 620, 150);

// ── 41. COAL ROOM ───────────────────────────────────────────────
ROOMS.coal_room = makeRoom({
    name: "Coal Room",
    description: "Black walls of coal. The air is thick and choking.",
    width: 400, height: 350,
    bgColor: "#030303", wallColor: "#0a0a0a", floorColor: "#050505",
    ambientLight: 0.03,
    furniture: [
        { type: "crates", x: 100, y: 150, w: 60, h: 45 },
        { type: "crates", x: 300, y: 150, w: 60, h: 45 },
        { type: "barrel", x: 200, y: 280, w: 45, h: 35 },
    ],
    interactables: [
        {
            id: "coal_pile", x: 200, y: 150, w: 60, h: 40, icon: "⬛",
            label: "Coal Pile",
            condition: () => true,
            action: () => {
                if (!game.flags.coalPile) {
                    showDialog("NARRATOR", "You dig through the coal. Your hands find something hard — a metal box. Inside: three flashlight batteries and a note: 'For whoever comes after. You'll need the light. — Margaret, Head Maid, 1923'");
                    addItem("battery", "🔋", "Flashlight Battery");
                    addItem("battery2", "🔋", "Flashlight Battery");
                    addClue("margaret_note", "Head maid Margaret left batteries for future explorers. She knew someone would come.");
                    game.flags.coalPile = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Just coal now. Black and dead.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "basement", x: 200, y: 30, w: 60, h: 20, side: "top", label: "Basement" },
    ],
    ghosts: [],
});
defSpawn("coal_room", "default", 200, 250);
defSpawn("coal_room", "basement", 200, 80);

// ── 42. ROOT CELLAR ─────────────────────────────────────────────
ROOMS.root_cellar = makeRoom({
    name: "Root Cellar",
    description: "An earthen cellar beneath the garden. Roots push through the walls like fingers.",
    width: 450, height: 400,
    bgColor: "#060504", wallColor: "#100e08", floorColor: "#080706",
    ambientLight: 0.05,
    furniture: [
        { type: "barrel", x: 120, y: 150, w: 45, h: 35 },
        { type: "barrel", x: 330, y: 150, w: 45, h: 35 },
        { type: "table", x: 225, y: 280, w: 60, h: 40 },
    ],
    interactables: [
        {
            id: "root_wall", x: 225, y: 80, w: 80, h: 40, icon: "🌿",
            label: "Living Roots",
            condition: () => true,
            action: () => {
                if (game.loop >= 3 && !game.flags.livingRoots) {
                    showDialog("NARRATOR", "The roots are moving. Slowly. They spell words: 'THE OAK REMEMBERS. THE OAK PROTECTS. ASK THE OAK.' The roots are connected to the ancient oak in the secret garden.");
                    addClue("oak_roots", "Living roots spell messages. Connected to the oak in the secret garden.");
                    game.flags.livingRoots = true;
                    giveXP(20);
                } else {
                    showDialog("NARRATOR", "Roots push through earthen walls. The smell of damp soil.");
                }
            }
        },
        {
            id: "root_jar", x: 225, y: 280, w: 50, h: 30, icon: "🫙",
            label: "Sealed Jar",
            condition: () => true,
            action: () => {
                if (!game.flags.rootJar) {
                    showDialog("NARRATOR", "A sealed glass jar containing preserved herbs and a folded note: 'Rosemary for remembrance. Sage for protection. Lavender for peace. Mix and burn to ward off evil.' — Eleanora");
                    addItem("herb_mix", "🌿", "Eleanora's Herb Mix");
                    game.flags.rootJar = true;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "Empty jar. It still smells of lavender.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "hedge_maze", x: 225, y: 30, w: 60, h: 20, side: "top", label: "Hedge Maze (up)" },
        { targetRoom: "catacombs", x: 225, y: 370, w: 60, h: 20, side: "bottom", label: "Catacombs",
          condition: () => game.level >= 6 || game.loop >= 4 },
    ],
    ghosts: [],
});
defSpawn("root_cellar", "default", 225, 250);
defSpawn("root_cellar", "hedge_maze", 225, 80);
defSpawn("root_cellar", "catacombs", 225, 330);

// ── 43. LAUNDRY ROOM ────────────────────────────────────────────
ROOMS.laundry = makeRoom({
    name: "Laundry Room",
    description: "Stone basins and drying racks. Clothes still hang, waiting to be folded by hands that dissolved a century ago.",
    width: 450, height: 350,
    bgColor: "#080808", wallColor: "#121010", floorColor: "#0a0908",
    ambientLight: 0.08,
    furniture: [
        { type: "sink", x: 150, y: 100, w: 60, h: 35 },
        { type: "sink", x: 300, y: 100, w: 60, h: 35 },
        { type: "table", x: 225, y: 250, w: 100, h: 40 },
    ],
    interactables: [
        {
            id: "bloody_sheets", x: 225, y: 250, w: 80, h: 35, icon: "🩸",
            label: "Stained Sheets",
            condition: () => game.loop >= 2,
            action: () => {
                if (!game.flags.bloodySheets) {
                    showDialog("NARRATOR", "The sheets are stained dark red. Someone tried to wash them — the water in the basin is still crimson. These are from the night of the ritual. The night Victor murdered his family.");
                    addClue("bloody_laundry", "Blood-stained sheets from the ritual night. Someone tried to clean up.");
                    game.flags.bloodySheets = true;
                    game.sanity -= 8;
                    giveXP(15);
                } else {
                    showDialog("NARRATOR", "The stains will never come out.");
                }
            }
        },
    ],
    doors: [
        { targetRoom: "servants_quarters", x: 225, y: 30, w: 60, h: 20, side: "top", label: "Servants' Quarters" },
    ],
    ghosts: [
        { id: "laundry_ghost", type: "worker", x: 150, y: 200, appearsAfterLoop: 2, message: "A maid endlessly scrubs sheets that will never be clean..." }
    ],
});
defSpawn("laundry", "default", 225, 250);
defSpawn("laundry", "servants_quarters", 225, 80);

// ── 44. ICE HOUSE ───────────────────────────────────────────────
ROOMS.ice_house = makeRoom({
    name: "Ice House",
    description: "A stone structure for storing ice. Unnaturally cold. Your breath fogs instantly.",
    width: 350, height: 350,
    bgColor: "#060810", wallColor: "#0c1020", floorColor: "#081018",
    ambientLight: 0.06,
    furniture: [
        { type: "crates", x: 175, y: 150, w: 80, h: 50 },
        { type: "barrel", x: 100, y: 270, w: 40, h: 35 },
        { type: "barrel", x: 250, y: 270, w: 40, h: 35 },
    ],
    interactables: [
        {
            id: "frozen_body", x: 175, y: 150, w: 70, h: 45, icon: "🧊",
            label: "Frozen Mass",
            condition: () => game.loop >= 3,
            action: () => {
                if (!game.flags.frozenBody) {
                    showDialog("NARRATOR", "Inside the ice... a body. Perfectly preserved. It's wearing Victor's clothes but the face is wrong — elongated, inhuman. This isn't Victor. This is what Victor was BECOMING. The Entity was transforming him.");
                    addClue("frozen_vessel", "A frozen body in Victor's clothes but with an inhuman face. Victor was becoming a vessel for the Entity.");
                    game.flags.frozenBody = true;
                    game.sanity -= 15;
                    giveXP(35);
                    playSound("scare");
                } else {
                    showDialog("NARRATOR", "The frozen body. The wrong face. You can't look at it for long.");
                    game.sanity -= 3;
                }
            }
        },
    ],
    doors: [
        { targetRoom: "garden_path", x: 175, y: 30, w: 60, h: 20, side: "top", label: "Garden Path" },
    ],
    ghosts: [],
});
defSpawn("ice_house", "default", 175, 280);
defSpawn("ice_house", "garden_path", 175, 80);

// ── 45-50: QUICK ROOMS ──────────────────────────────────────────

// 45. Dovecote
ROOMS.dovecote = makeRoom({
    name: "Dovecote",
    description: "A tower for carrier pigeons. Feathers and old messages everywhere.",
    width: 300, height: 300,
    wallColor: "#141210", floorColor: "#0a0908", ambientLight: 0.15,
    furniture: [{ type: "crates", x: 150, y: 100, w: 50, h: 40 }],
    interactables: [{
        id: "dove_message", x: 150, y: 100, w: 45, h: 35, icon: "🕊️",
        label: "Pigeon Messages",
        condition: () => true,
        action: () => {
            if (!game.flags.doveMsg) {
                showDialog("NARRATOR", "Unsent messages from 1923: 'SEND HELP TO THORNWOOD MANOR. PEOPLE ARE DYING. THE MASTER HAS GONE MAD.' None were ever sent. The pigeons died with everyone else.");
                addClue("unsent_pleas", "Unsent pigeon messages begging for help. Never delivered.");
                game.flags.doveMsg = true; giveXP(15);
            } else { showDialog("NARRATOR", "Desperate messages that never flew."); }
        }
    }],
    doors: [{ targetRoom: "garden_path", x: 150, y: 270, w: 60, h: 20, side: "bottom", label: "Garden Path" }],
    ghosts: [],
});
defSpawn("dovecote", "default", 150, 220);
defSpawn("dovecote", "garden_path", 150, 230);

// 46. Potting Shed
ROOMS.potting_shed = makeRoom({
    name: "Potting Shed",
    description: "A small shed with gardening tools. Smells of earth and decay.",
    width: 350, height: 300,
    wallColor: "#121008", floorColor: "#0a0806", ambientLight: 0.12,
    furniture: [
        { type: "table", x: 175, y: 150, w: 60, h: 40 },
        { type: "cabinet", x: 300, y: 100, w: 35, h: 50 },
    ],
    interactables: [{
        id: "shed_tools", x: 175, y: 150, w: 50, h: 35, icon: "🪴",
        label: "Gardening Tools",
        condition: () => true,
        action: () => {
            if (!game.flags.shedTools) {
                showDialog("NARRATOR", "Thomas's tools. Well-maintained even in death. Under the workbench: another flashlight battery and a trowel with 'T.H.' engraved on it.");
                addItem("battery", "🔋", "Flashlight Battery");
                game.flags.shedTools = true; giveXP(10);
            } else { showDialog("NARRATOR", "Thomas kept good tools."); }
        }
    }],
    doors: [{ targetRoom: "greenhouse", x: 175, y: 270, w: 60, h: 20, side: "bottom", label: "Greenhouse" }],
    ghosts: [],
});
defSpawn("potting_shed", "default", 175, 220);
defSpawn("potting_shed", "greenhouse", 175, 230);

// 47. Wine Tasting Room
ROOMS.wine_tasting = makeRoom({
    name: "Wine Tasting Room",
    description: "Elegant room adjoining the cellar. Crystal glasses catch phantom light.",
    width: 450, height: 350,
    wallColor: "#1a1012", floorColor: "#0c0908", ambientLight: 0.1,
    furniture: [
        { type: "longtable", x: 225, y: 175, w: 200, h: 45 },
        { type: "chair", x: 130, y: 165, w: 25, h: 25 },
        { type: "chair", x: 225, y: 220, w: 25, h: 25 },
        { type: "chair", x: 320, y: 165, w: 25, h: 25 },
        { type: "cabinet", x: 400, y: 80, w: 40, h: 40 },
    ],
    interactables: [{
        id: "wine_glass", x: 225, y: 175, w: 60, h: 35, icon: "🍷",
        label: "Crystal Glasses",
        condition: () => true,
        action: () => {
            if (!game.flags.wineGlass) {
                showDialog("NARRATOR", "Six glasses set. Five are filled with red wine that hasn't aged. The sixth holds something darker — blood. It's still warm.");
                game.sanity -= 10; game.flags.wineGlass = true;
                addClue("blood_glass", "Five wine glasses, one blood glass. The blood is still warm after 100 years.");
                giveXP(15); playSound("scare");
            } else { showDialog("NARRATOR", "The glasses haven't been touched. The blood hasn't cooled."); }
        }
    }],
    doors: [{ targetRoom: "wine_cellar", x: 225, y: 320, w: 60, h: 20, side: "bottom", label: "Wine Cellar" }],
    ghosts: [],
});
defSpawn("wine_tasting", "default", 225, 280);
defSpawn("wine_tasting", "wine_cellar", 225, 280);

// 48. Clock Mechanism Room (connects to existing clock_tower)
ROOMS.clock_gears = makeRoom({
    name: "Clock Gear Room",
    description: "The internal mechanism of the great clock. Gears the size of people turn endlessly.",
    width: 400, height: 400,
    bgColor: "#080604", wallColor: "#141008", floorColor: "#0a0804",
    ambientLight: 0.05,
    furniture: [
        { type: "gear", x: 200, y: 120, w: 80, h: 80 },
        { type: "gear", x: 120, y: 280, w: 55, h: 55 },
        { type: "gear", x: 280, y: 280, w: 55, h: 55 },
        { type: "pendulum", x: 200, y: 350, w: 15, h: 70 },
    ],
    interactables: [{
        id: "gear_center", x: 200, y: 200, w: 60, h: 40, icon: "⚙️",
        label: "Central Mechanism",
        condition: () => true,
        action: () => {
            if (countSeals() >= 3 && !game.flags.gearAltered) {
                showDialogWithChoices("NARRATOR", "With seal energy, you could alter the clock mechanism.", [
                    { text: "Slow time (+2 minutes per loop)", action: () => {
                        game.maxLoopTime += 120;
                        showDialog("NARRATOR", "Time stretches. More time per loop now.");
                        game.flags.gearAltered = true; giveXP(30);
                    }},
                    { text: "Don't touch it", action: () => {
                        showDialog("NARRATOR", "Wise. Some mechanisms shouldn't be tampered with.");
                    }},
                ]);
            } else {
                showDialog("NARRATOR", "Massive gears tick in perfect time. You need more power to interact.");
            }
        }
    }],
    doors: [{ targetRoom: "clock_tower", x: 200, y: 30, w: 60, h: 20, side: "top", label: "Clock Tower" },
            { targetRoom: "upstairs_hall", x: 200, y: 370, w: 60, h: 20, side: "bottom", label: "Hallway" }],
    ghosts: [],
});
defSpawn("clock_gears", "default", 200, 320);
defSpawn("clock_gears", "clock_tower", 200, 80);
defSpawn("clock_gears", "upstairs_hall", 200, 330);

// 49. Tower Peak
ROOMS.tower_peak = makeRoom({
    name: "Tower Peak",
    description: "The absolute highest point. Open to the sky. Stars that shouldn't exist swirl above.",
    width: 300, height: 300,
    bgColor: "#020208", wallColor: "#080818", floorColor: "#040410",
    ambientLight: 0.3,
    furniture: [],
    interactables: [{
        id: "peak_sky", x: 150, y: 150, w: 80, h: 80, icon: "⭐",
        label: "Look at the Sky",
        condition: () => true,
        action: () => {
            if (!game.flags.peakSky) {
                showDialog("NARRATOR", "The sky is wrong. Constellations from Victor's charts swirl above — alien geometries, impossible colors. In the center: an eye. Azathiel's eye. It sees you. It KNOWS you. And for a terrible moment, you understand it too.");
                game.sanity -= 20;
                addClue("azathiel_eye", "Azathiel's eye visible from the tower peak. It is aware. It watches all loops simultaneously.");
                game.flags.peakSky = true;
                giveXP(50);
                playSound("scare");
                if (typeof triggerShake === "function") triggerShake(15, 40);
            } else {
                showDialog("NARRATOR", "The eye watches. Always.");
                game.sanity -= 5;
            }
        }
    }],
    doors: [{ targetRoom: "bell_tower", x: 150, y: 270, w: 60, h: 20, side: "bottom", label: "Bell Tower" }],
    ghosts: [
        { id: "peak_entity", type: "entity", x: 150, y: 100, appearsAfterLoop: 4, message: "The Entity's presence is overwhelming here. Reality bends. You can feel it trying to pull you into the sky." }
    ],
});
defSpawn("tower_peak", "default", 150, 220);
defSpawn("tower_peak", "bell_tower", 150, 230);

// 50. Eleanora's Sanctuary
ROOMS.sanctuary = makeRoom({
    name: "Eleanora's Sanctuary",
    description: "A hidden room of pure light. Eleanora's last refuge. Love radiates from every surface.",
    width: 400, height: 400,
    bgColor: "#0a0a14", wallColor: "#141428", floorColor: "#0c0c1c",
    ambientLight: 0.35,
    furniture: [
        { type: "altar", x: 200, y: 150, w: 60, h: 40 },
        { type: "candle_circle", x: 200, y: 280, w: 120, h: 120 },
        { type: "rug", x: 200, y: 200, w: 160, h: 160 },
    ],
    interactables: [{
        id: "sanctuary_altar", x: 200, y: 150, w: 55, h: 35, icon: "💖",
        label: "Altar of Love",
        condition: () => true,
        action: () => {
            showDialog("NARRATOR", "This altar is warm. Photographs of the children, pressed flowers, Victor's love letters from before the corruption. This is where Eleanora's power comes from — pure love, preserved against the darkness.");
            game.sanity = game.maxSanity;
            if (typeof combat !== "undefined") combat.playerHP = combat.maxHP;
            addClue("sanctuary_power", "Eleanora's sanctuary fully restores sanity and health. Love is the strongest force.");
            giveXP(30);
            if (typeof emitSpirit === "function") {
                for (let i = 0; i < 20; i++) emitSpirit(200, 200, 2, {r:200,g:200,b:255});
            }
        }
    }],
    doors: [{ targetRoom: "secret_room", x: 200, y: 370, w: 60, h: 20, side: "bottom", label: "Hidden Room" }],
    ghosts: [
        { id: "sanctuary_eleanora", type: "eleanora", x: 200, y: 280, appearsAfterLoop: 0, message: "Eleanora kneels in the circle of candles, praying. Her light holds back an ocean of darkness." }
    ],
});
defSpawn("sanctuary", "default", 200, 320);
defSpawn("sanctuary", "secret_room", 200, 330);

// ─── ADD NEW DOORS TO EXISTING ROOMS ────────────────────────────
// These connect the new rooms to the existing map

if (ROOMS.garden_path) {
    ROOMS.garden_path.doors.push(
        { targetRoom: "hedge_maze", x: 350, y: 320, w: 60, h: 20, side: "bottom", label: "Hedge Maze",
          condition: () => game.loop >= 2 || game.level >= 4 },
        { targetRoom: "ice_house", x: 150, y: 320, w: 60, h: 20, side: "bottom", label: "Ice House",
          condition: () => game.loop >= 3 },
        { targetRoom: "dovecote", x: 550, y: 30, w: 60, h: 20, side: "top", label: "Dovecote" }
    );
    defSpawn("garden_path", "hedge_maze", 350, 280);
    defSpawn("garden_path", "ice_house", 150, 280);
    defSpawn("garden_path", "dovecote", 550, 80);
}

if (ROOMS.parlor) {
    ROOMS.parlor.doors.push(
        { targetRoom: "music_room", x: 510, y: 125, w: 20, h: 60, side: "right", label: "Music Room" }
    );
    defSpawn("parlor", "music_room", 470, 150);
}

if (ROOMS.foyer) {
    ROOMS.foyer.doors.push(
        { targetRoom: "trophy_room", x: 200, y: 30, w: 60, h: 20, side: "top", label: "Trophy Room" }
    );
    defSpawn("foyer", "trophy_room", 200, 80);
}

if (ROOMS.ballroom) {
    ROOMS.ballroom.doors.push(
        { targetRoom: "balcony", x: 450, y: 570, w: 60, h: 20, side: "bottom", label: "Balcony Stairs" }
    );
    defSpawn("ballroom", "balcony", 450, 530);
}

if (ROOMS.gallery) {
    ROOMS.gallery.doors.push(
        { targetRoom: "mirror_gallery", x: 760, y: 175, w: 20, h: 60, side: "right", label: "Mirror Gallery" }
    );
    defSpawn("gallery", "mirror_gallery", 720, 175);
}

if (ROOMS.upstairs_hall) {
    ROOMS.upstairs_hall.doors.push(
        { targetRoom: "tower_stairs", x: 100, y: 30, w: 60, h: 20, side: "top", label: "Tower Stairs",
          condition: () => game.level >= 4 || game.loop >= 3 },
        { targetRoom: "mirror_gallery", x: 700, y: 30, w: 60, h: 20, side: "top", label: "Mirror Gallery",
          condition: () => game.loop >= 2 },
        { targetRoom: "clock_gears", x: 300, y: 30, w: 60, h: 20, side: "top", label: "Clock Gears",
          condition: () => game.level >= 5 }
    );
    defSpawn("upstairs_hall", "tower_stairs", 100, 80);
    defSpawn("upstairs_hall", "mirror_gallery", 700, 80);
    defSpawn("upstairs_hall", "clock_gears", 300, 80);
}

if (ROOMS.servants_quarters) {
    ROOMS.servants_quarters.doors.push(
        { targetRoom: "servants_tunnel", x: 30, y: 200, w: 20, h: 60, side: "left", label: "Servants' Tunnel" },
        { targetRoom: "laundry", x: 250, y: 370, w: 60, h: 20, side: "bottom", label: "Laundry" }
    );
    defSpawn("servants_quarters", "servants_tunnel", 80, 200);
    defSpawn("servants_quarters", "laundry", 250, 330);
}

if (ROOMS.greenhouse) {
    ROOMS.greenhouse.doors.push(
        { targetRoom: "potting_shed", x: 250, y: 30, w: 60, h: 20, side: "top", label: "Potting Shed" }
    );
    defSpawn("greenhouse", "potting_shed", 250, 80);
}

if (ROOMS.wine_cellar) {
    ROOMS.wine_cellar.doors.push(
        { targetRoom: "wine_tasting", x: 250, y: 30, w: 60, h: 20, side: "top", label: "Wine Tasting Room" }
    );
    defSpawn("wine_cellar", "wine_tasting", 250, 80);
}

if (ROOMS.bell_tower) {
    ROOMS.bell_tower.doors.push(
        { targetRoom: "tower_peak", x: 175, y: 30, w: 60, h: 20, side: "top", label: "Tower Peak",
          condition: () => game.level >= 9 || game.loop >= 5 }
    );
    defSpawn("bell_tower", "tower_peak", 175, 80);
}

if (ROOMS.secret_room) {
    ROOMS.secret_room.doors.push(
        { targetRoom: "sanctuary", x: 200, y: 30, w: 60, h: 20, side: "top", label: "Sanctuary",
          condition: () => hasItem("locket") && game.permanentFlags.knowEleanoraPlan }
    );
    defSpawn("secret_room", "sanctuary", 200, 80);
}

if (ROOMS.study) {
    ROOMS.study.doors.push(
        { targetRoom: "laboratory", x: 300, y: 30, w: 60, h: 20, side: "top", label: "Laboratory",
          condition: () => game.loop >= 3 || game.permanentFlags.studyDiscovered }
    );
    defSpawn("study", "laboratory", 300, 80);
}

if (ROOMS.basement) {
    ROOMS.basement.doors.push(
        { targetRoom: "coal_room", x: 100, y: 470, w: 60, h: 20, side: "bottom", label: "Coal Room" }
    );
    defSpawn("basement", "coal_room", 100, 430);
}

console.log(`Rooms expanded: ${Object.keys(ROOMS).length} total rooms loaded`);