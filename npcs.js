// ═════════════════════════════════════════════════════════════════
//  NPCS.JS — NPC System with Dialog Trees, Quests, Shops, Allies
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ─── SAFE ACCESSORS ─────────────────────────────────────────────
function _ng()  { return (typeof game      !== "undefined" && game)  ? game  : null; }
function _nRooms(id) {
    if (typeof ROOMS === "undefined" || !ROOMS) return null;
    return ROOMS[id] || null;
}

function _nSay(speaker, text) {
    try {
        if (typeof SubtitleSystem !== "undefined" && SubtitleSystem?.show) {
            SubtitleSystem.show(speaker, text, 280);
        } else if (typeof showDialog === "function") {
            showDialog(speaker, text);
        }
    } catch (_) {}
}

function _nSayChoices(speaker, text, choices) {
    try {
        if (typeof showDialogWithChoices === "function") {
            showDialogWithChoices(speaker, text, choices);
        }
    } catch (_) {}
}

function _nSound(key) {
    try { if (typeof playSound === "function") playSound(key); } catch (_) {}
}

function _nXP(n) {
    try { if (typeof giveXP === "function") giveXP(n); } catch (_) {}
}

function _nClue(id, text) {
    try { if (typeof addClue === "function") addClue(id, text); } catch (_) {}
}

function _nItem(id, icon, name) {
    try { if (typeof addItem === "function") addItem(id, icon, name); } catch (_) {}
}

function _nHasItem(id) {
    try { return typeof hasItem === "function" && hasItem(id); } catch (_) { return false; }
}

// ─── MODULE STATE ────────────────────────────────────────────────
const npcs           = [];
const questLog       = [];
const completedQuests = new Set();

// ─── QUEST DEFINITIONS ──────────────────────────────────────────
const QUESTS = {
    q_first_clue: {
        id: "q_first_clue",
        name: "The First Thread",
        desc: "Find any clue in the house",
        icon: "🔍",
        xpReward: 30,
        giver: "eleanora_spirit",
        check() {
            const g = _ng();
            return g && Array.isArray(g.cluesFound) && g.cluesFound.length >= 1;
        },
        onComplete() {
            _nSay("ELEANORA", "You found something. Good. Keep searching. The truth is scattered throughout this house.");
        },
    },
    q_five_rooms: {
        id: "q_five_rooms",
        name: "Mapping the Mansion",
        desc: "Explore 5 different rooms",
        icon: "🗺️",
        xpReward: 40,
        giver: "thomas_ghost",
        check() {
            return typeof roomsVisited !== "undefined" &&
                   roomsVisited instanceof Set &&
                   roomsVisited.size >= 5;
        },
        onComplete() {
            _nSay("THOMAS", "You're braver than I was. I only ever saw the kitchen and the garden. Take this — I found it in the hedge maze years ago.");
            _nItem("garden_map", "🗺️", "Thomas's Garden Map");
        },
    },
    q_light_fire: {
        id: "q_light_fire",
        name: "Warmth in Darkness",
        desc: "Light the library fireplace",
        icon: "🔥",
        xpReward: 25,
        giver: "james_ghost",
        check() {
            const g = _ng();
            return g && g.flags && g.flags.fireLit === true;
        },
        onComplete() {
            _nSay("JAMES", "It's warm again! Mama always kept the fire going. She said the light keeps the bad things away.");
        },
    },
    q_find_locket: {
        id: "q_find_locket",
        name: "Mother's Keepsake",
        desc: "Find Eleanora's locket in the master bedroom",
        icon: "📿",
        xpReward: 50,
        giver: "mary_ghost",
        check() {
            const g = _ng();
            return _nHasItem("locket") ||
                   (g && typeof gameStats !== "undefined" &&
                    gameStats?.itemsEverFound instanceof Set &&
                    gameStats.itemsEverFound.has("locket"));
        },
        onComplete() {
            _nSay("MARY", "Mama's locket! She wore it every day. She said love was inside it. Real love, not pretend.");
            const g = _ng();
            if (g) g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + 20);
        },
    },
    q_find_all_seals: {
        id: "q_find_all_seals",
        name: "The Five Fragments",
        desc: "Collect all 5 seal fragments",
        icon: "🔮",
        xpReward: 100,
        giver: "eleanora_spirit",
        check() {
            return typeof countSeals === "function" && countSeals() >= 5;
        },
        onComplete() {
            _nSay("ELEANORA", "All five seals gathered. You hold the fate of this house in your hands. Remember — restore, do not break. Love is the key.");
            _nItem("eleanora_blessing", "✨", "Eleanora's Blessing");
        },
    },
    q_defeat_shadows: {
        id: "q_defeat_shadows",
        name: "Shadow Purge",
        desc: "Defeat 10 shadow enemies total",
        icon: "⚔️",
        xpReward: 60,
        giver: "thomas_ghost",
        check() {
            return typeof combat !== "undefined" && combat && (combat.totalKills ?? 0) >= 10;
        },
        onComplete() {
            _nSay("THOMAS", "The shadows fear you now. Here, I hid this for safekeeping.");
            _nItem("candelabra_item", "🕯️", "Brass Candelabra");
            const g = _ng();
            if (g && g.flags) g.flags.hasCandelabra = true;
        },
    },
    q_visit_graveyard: {
        id: "q_visit_graveyard",
        name: "Paying Respects",
        desc: "Visit the family graveyard",
        icon: "🪦",
        xpReward: 35,
        giver: "james_ghost",
        check() {
            return typeof roomsVisited !== "undefined" &&
                   roomsVisited instanceof Set &&
                   roomsVisited.has("graveyard");
        },
        onComplete() {
            _nSay("JAMES", "You visited our graves? That's... that's nice. Nobody has in a very long time. Mary left flowers once but they turned to dust.");
        },
    },
    q_chapel_blessing: {
        id: "q_chapel_blessing",
        name: "Sacred Ground",
        desc: "Place the crucifix on the chapel altar",
        icon: "✝️",
        xpReward: 45,
        giver: "eleanora_spirit",
        check() {
            const g = _ng();
            return g && Array.isArray(g.cluesFound) && g.cluesFound.includes("chapel_blessing");
        },
        onComplete() {
            _nSay("ELEANORA", "The chapel remembers. Its power can shield you from the Entity's influence. Return whenever you need strength.");
        },
    },
    q_beat_victor: {
        id: "q_beat_victor",
        name: "Father's Shadow",
        desc: "Defeat Victor's Shade in combat",
        icon: "👤",
        xpReward: 80,
        giver: "mary_ghost",
        check() {
            const g = _ng();
            return g && g.permanentFlags && g.permanentFlags.boss_victor_shade_defeated === true;
        },
        onComplete() {
            _nSay("MARY", "You stopped Daddy's monster? The scary Daddy isn't real Daddy. Real Daddy used to read us stories. Before the book.");
            _nClue("mary_memory", "Mary remembers: Victor was kind before the Entity's book corrupted him.");
        },
    },
    q_explorer_supreme: {
        id: "q_explorer_supreme",
        name: "Every Shadow",
        desc: "Visit 25 different rooms",
        icon: "🏆",
        xpReward: 100,
        giver: "thomas_ghost",
        check() {
            return typeof roomsVisited !== "undefined" &&
                   roomsVisited instanceof Set &&
                   roomsVisited.size >= 25;
        },
        onComplete() {
            _nSay("THOMAS", "You know this house better than anyone who ever lived here. Even the master didn't explore every corner. You've earned this.");
            _nItem("master_key", "🔑", "Master Key");
            const g = _ng();
            if (g && g.permanentFlags) g.permanentFlags.hasMasterKey = true;
        },
    },
    q_level_10: {
        id: "q_level_10",
        name: "Transcendence",
        desc: "Reach Level 10",
        icon: "👑",
        xpReward: 75,
        giver: "eleanora_spirit",
        check() {
            const g = _ng();
            return g && (g.level ?? 0) >= 10;
        },
        onComplete() {
            _nSay("ELEANORA", "Your spirit burns bright. The Entity cannot ignore you now. Be ready — it will test you.");
        },
    },
    q_ring_bell: {
        id: "q_ring_bell",
        name: "Midnight Toll",
        desc: "Ring the bell tower bell with the crucifix",
        icon: "🔔",
        xpReward: 60,
        giver: "thomas_ghost",
        check() {
            const g = _ng();
            return g && Array.isArray(g.cluesFound) && g.cluesFound.includes("bell_power");
        },
        onComplete() {
            _nSay("THOMAS", "The bell! I can hear it even in death. It pushed back the darkness, even if just for a moment. The house felt lighter.");
        },
    },
};

// ─── NPC DEFINITIONS ────────────────────────────────────────────
const NPC_DEFS = {

    eleanora_spirit: {
        name: "Eleanora's Spirit",
        icon: "👻",
        color: { r: 100, g: 180, b: 255 },
        size: 16,
        room: "ritual_chamber",
        x: 250, y: 300,
        appearsAfterLoop: 0,
        friendly: true,
        shopkeeper: false,
        dialogs: {
            first_meet: {
                speaker: "ELEANORA",
                text: "You can see me? After all these years... Please, you must help us. My husband Victor — he was corrupted by the Entity beneath this house. He killed us. I bound the Entity again, but it created this loop. You're our only hope.",
                choices: [
                    { text: "I'll help you. What do I need to do?", next: "help_explain", flag: "met_eleanora" },
                    { text: "What is this Entity?",                  next: "entity_explain" },
                    { text: "How did you bind it?",                  next: "binding_explain" },
                ],
            },
            help_explain: {
                speaker: "ELEANORA",
                text: "Five seals hold the Entity. Victor shattered them. You must gather the fragments and RESTORE them — not break them. My locket channels the love needed to reinforce the bindings. Find all five seals, find my locket, and come to the ritual circle.",
                choices: [
                    { text: "Where are the seal fragments?", next: "seal_locations" },
                    { text: "I understand. I'll find them.",  next: null },
                ],
            },
            entity_explain: {
                speaker: "ELEANORA",
                text: "Azathiel. An ancient being, older than humanity. It slumbered beneath this land for millennia. Victor found a book that told him how to communicate with it. It promised him knowledge... but it wanted freedom. It used him.",
                choices: [
                    { text: "How do I stop it?",  next: "help_explain" },
                    { text: "I'll be careful.",   next: null },
                ],
            },
            binding_explain: {
                speaker: "ELEANORA",
                text: "When Victor broke the seals, I used the only power stronger than the Entity — love. I bound my soul to the house, creating a loop that contains Azathiel. But I can't hold it forever. Each loop weakens me.",
                choices: [
                    { text: "Then I'll end this quickly.",        next: null, flag: "understands_urgency" },
                    { text: "What happens if you can't hold it?", next: "failure_explain" },
                ],
            },
            failure_explain: {
                speaker: "ELEANORA",
                text: "If I fail... the loop breaks. Azathiel is freed. Everything within the house — every soul, every spirit — will be consumed. And then it will spread beyond these walls. The world itself is at stake.",
                choices: [
                    { text: "I won't let that happen.", next: null, flag: "sworn_oath" },
                ],
            },
            seal_locations: {
                speaker: "ELEANORA",
                text: "I hid them where Victor wouldn't think to look. One in the grandfather clock. One in his own desk — ironic. One in the conservatory fountain. One in baby Mary's crib. The last... in Victor's study cabinet. You'll need keys for some.",
                choices: [{ text: "Thank you, Eleanora.", next: null }],
            },
        },
        getDefaultDialog() {
            const g = _ng();
            const seals = (typeof countSeals === "function") ? countSeals() : 0;

            if (seals >= 5 && _nHasItem("locket")) {
                return {
                    speaker: "ELEANORA",
                    text: "You have everything you need. Go to the ritual circle — or better yet, find the Void Chamber. There, you can face Azathiel directly and restore the seals. I believe in you.",
                    choices: [{ text: "I'm ready.", next: null }],
                };
            }
            if (seals >= 3) {
                return {
                    speaker: "ELEANORA",
                    text: `You have ${seals} seal fragments. ${5 - seals} more to find. Have you found my locket? It's in the master bedroom dresser. Without it, the seals cannot be restored.`,
                    choices: [
                        { text: "I'll keep searching.",        next: null },
                        { text: "Where should I look next?",   next: "seal_locations" },
                    ],
                };
            }
            const tips = [
                "The dining room cabinet holds useful items. Don't overlook it.",
                "My children's room... the music box holds secrets.",
                "Thomas the gardener hid things in the greenhouse. Poor faithful Thomas.",
                "The basement is dangerous but necessary. Be prepared.",
                "Victor's study has three drawers. Each holds different truths.",
            ];
            return {
                speaker: "ELEANORA",
                text: tips[Math.floor(Math.random() * tips.length)],
                choices: [{ text: "Thank you.", next: null }],
            };
        },
        quests: ["q_first_clue","q_find_all_seals","q_chapel_blessing","q_level_10"],
    },

    thomas_ghost: {
        name: "Thomas the Gardener",
        icon: "🧑‍🌾",
        color: { r: 80, g: 140, b: 80 },
        size: 14,
        room: "greenhouse",
        x: 130, y: 250,
        appearsAfterLoop: 1,
        friendly: true,
        shopkeeper: true,
        dialogs: {
            first_meet: {
                speaker: "THOMAS",
                text: "Bless my soul — a living person! I'm Thomas. Was the groundskeeper here for twenty years. Died the same night as the family, I reckon. The shadows got me in the garden.",
                choices: [
                    { text: "What happened that night?",     next: "that_night" },
                    { text: "Can you help me?",              next: "help_offer" },
                    { text: "Do you have anything useful?",  next: "shop", flag: "met_thomas" },
                ],
            },
            that_night: {
                speaker: "THOMAS",
                text: "Halloween, 1923. The master had been acting strange for weeks. Talking to himself. Drawing symbols everywhere. Then at midnight... screaming. Such screaming. The house sealed itself. None of us could leave.",
                choices: [
                    { text: "I'm sorry, Thomas.",    next: null },
                    { text: "Do you have supplies?", next: "shop" },
                ],
            },
            help_offer: {
                speaker: "THOMAS",
                text: "I know every inch of these grounds. The garden, the greenhouse, the paths. I also know where I hid some things over the years. Let me think on what might help you.",
                choices: [
                    { text: "Thank you, Thomas.",      next: null },
                    { text: "Show me what you have.", next: "shop" },
                ],
            },
            shop: {
                speaker: "THOMAS",
                text: "I've got a few things squirreled away. Take what you need — we're all in this together.",
                choices: null,
                isShop: true,
            },
        },
        getDefaultDialog() {
            const tips = [
                "Watch the garden at night. The statue of the angel... it moves. I swear it.",
                "The well is ancient. Older than the house. Maybe older than the town.",
                "I used to hear singing from the chapel on quiet nights. Beautiful and sad.",
                "Be careful in the catacombs. That place existed before we built the house.",
                "The hedge maze used to be beautiful. Now it's dead, like everything else here.",
            ];
            return {
                speaker: "THOMAS",
                text: tips[Math.floor(Math.random() * tips.length)],
                choices: [
                    { text: "Thanks, Thomas.",        next: null },
                    { text: "Got anything for me?",  next: "shop" },
                ],
            };
        },
        shopItems: [
            { id: "battery",      icon: "🔋", name: "Flashlight Battery", cost: 0, desc: "Recharges flashlight",         stock: 3 },
            { id: "salt_pouch",   icon: "⚪", name: "Salt Pouch",          cost: 0, desc: "Place protective salt circles", stock: 2 },
            { id: "herb_bundle",  icon: "🌿", name: "Herb Bundle",          cost: 0, desc: "Restores 20 sanity",           stock: 2 },
            { id: "old_map",      icon: "🗺️", name: "Old Map",              cost: 0, desc: "Reveals more of the minimap",  stock: 1 },
        ],
        quests: ["q_five_rooms","q_defeat_shadows","q_explorer_supreme","q_ring_bell"],
    },

    james_ghost: {
        name: "James (Ghost Child)",
        icon: "👦",
        color: { r: 150, g: 180, b: 220 },
        size: 10,
        room: "childrens_room",
        x: 140, y: 280,
        appearsAfterLoop: 1,
        friendly: true,
        shopkeeper: false,
        dialogs: {
            first_meet: {
                speaker: "JAMES",
                text: "Are you a ghost too? You don't look like one. I'm James. I'm eight. Well... I was eight. For a very long time now. Do you want to play?",
                choices: [
                    { text: "Hi James. I'm not a ghost. I'm here to help.", next: "help_response", flag: "met_james" },
                    { text: "What happened to you, James?",                  next: "what_happened" },
                    { text: "Where's your sister?",                          next: "about_mary" },
                ],
            },
            help_response: {
                speaker: "JAMES",
                text: "Help? Like... make the scary things go away? Daddy got really scary. He used to be nice but then he found the special book and everything changed. Mama tried to protect us but...",
                choices: [{ text: "I'll make things right. I promise.", next: null }],
            },
            what_happened: {
                speaker: "JAMES",
                text: "Daddy said we were going to play a special game. In the basement. But it wasn't a game. It hurt. Mama screamed. Then everything went bright and... now we're here. Forever.",
                choices: [{ text: "I'm so sorry, James.", next: null }],
            },
            about_mary: {
                speaker: "JAMES",
                text: "Mary's around! She likes the nursery best. She's only four so she doesn't understand everything. She thinks this is all a dream. Maybe that's better.",
                choices: [{ text: "I'll check on her.", next: null }],
            },
        },
        getDefaultDialog() {
            const lines = [
                "The rocking horse used to be mine. Daddy carved a secret on it. I don't know what it means.",
                "Sometimes I see Daddy's ghost in his study. He looks sad. But also scary.",
                "Mama says if someone brave comes, they can make the loop stop. Are you brave?",
                "I hear the clock ticking always. Tick tock tick tock. It never stops.",
                "There's a monster under the house. Daddy wanted to be friends with it. That was a bad idea.",
            ];
            return {
                speaker: "JAMES",
                text: lines[Math.floor(Math.random() * lines.length)],
                choices: [{ text: "Thanks, James.", next: null }],
            };
        },
        quests: ["q_light_fire","q_visit_graveyard"],
    },

    mary_ghost: {
        name: "Mary (Ghost Child)",
        icon: "👧",
        color: { r: 220, g: 180, b: 220 },
        size: 8,
        room: "nursery",
        x: 300, y: 280,
        appearsAfterLoop: 1,
        friendly: true,
        shopkeeper: false,
        dialogs: {
            first_meet: {
                speaker: "MARY",
                text: "Hello! Are you the one Mama talks about? She says someone nice is coming to wake us up from the dream. Is it you?",
                choices: [
                    { text: "Yes, Mary. I'm going to help you wake up.", next: "happy_response", flag: "met_mary" },
                    { text: "I hope so, sweetheart.",                    next: "sweet_response" },
                ],
            },
            happy_response: {
                speaker: "MARY",
                text: "Yay! I knew it! Mama is always right. She says love fixes everything. Do you have love?",
                choices: [{ text: "I do.", next: null }],
            },
            sweet_response: {
                speaker: "MARY",
                text: "You're nice. The shadows aren't nice. They try to scare me but James protects me. He's a good big brother even when he's a ghost.",
                choices: [{ text: "He sounds wonderful.", next: null }],
            },
        },
        getDefaultDialog() {
            const lines = [
                "My music box still plays! Want to hear? It's pretty but also sad.",
                "I hid Mama's blanket under my crib. It smells like her.",
                "Daddy used to read us stories about dragons. I miss that Daddy.",
                "The scary man under the house tries to talk to me sometimes. I don't listen.",
                "When the clock goes boom, everything starts over. It's like rewinding a music box!",
            ];
            return {
                speaker: "MARY",
                text: lines[Math.floor(Math.random() * lines.length)],
                choices: [{ text: "Thanks, Mary. Stay safe.", next: null }],
            };
        },
        quests: ["q_find_locket","q_beat_victor"],
    },

    old_priest: {
        name: "Father Harmon",
        icon: "⛪",
        color: { r: 200, g: 200, b: 180 },
        size: 15,
        room: "chapel",
        x: 225, y: 350,
        appearsAfterLoop: 2,
        friendly: true,
        shopkeeper: true,
        dialogs: {
            first_meet: {
                speaker: "FATHER HARMON",
                text: "Ah... another soul drawn to this cursed place. I was the parish priest when it happened. Came to perform an exorcism. Never left. The chapel still holds some power — holy ground resists the Entity.",
                choices: [
                    { text: "Can you help me fight the Entity?",    next: "fight_help", flag: "met_priest" },
                    { text: "What do you know about the seals?",    next: "seal_knowledge" },
                    { text: "Do you have holy items?",              next: "shop" },
                ],
            },
            fight_help: {
                speaker: "FATHER HARMON",
                text: "I'm bound to this chapel. Cannot leave. But I can bless items for you, restore your sanity, and tell you what I've learned in a century of watching. The crucifix is your strongest weapon against the unholy.",
                choices: [
                    { text: "Bless me, Father.",      next: "blessing" },
                    { text: "What have you learned?", next: "wisdom" },
                ],
            },
            seal_knowledge: {
                speaker: "FATHER HARMON",
                text: "The seals pre-date Christianity. Ancient bindings, powered by sacrifice. Victor perverted them with blood. Eleanora purified them with love. Both forces work. The question is which you choose.",
                choices: [
                    { text: "Love. Always love.", next: null },
                    { text: "Tell me more.",       next: "wisdom" },
                ],
            },
            blessing: {
                speaker: "FATHER HARMON",
                text: "In the name of all that is holy... I grant you peace of mind and strength of spirit.",
                choices: null,
                action() {
                    const g = _ng();
                    if (g) {
                        g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + 30);
                    }
                    if (typeof combat !== "undefined" && combat) {
                        combat.playerHP = Math.min(
                            combat.maxHP   ?? 100,
                            (combat.playerHP ?? 0) + 30
                        );
                    }
                },
            },
            wisdom: {
                speaker: "FATHER HARMON",
                text: "The Entity feeds on fear and despair. Keep your sanity high. The crucifix and holy water are its bane. The children's love weakens it too — they are innocent, and innocence is a form of holiness.",
                choices: [{ text: "Thank you, Father.", next: null }],
            },
            shop: {
                speaker: "FATHER HARMON",
                text: "Take what you need from the chapel stores. May they serve you well.",
                choices: null,
                isShop: true,
            },
        },
        getDefaultDialog() {
            const lines = [
                "Pray, child. Even in darkness, prayer has power.",
                "The confessional holds Victor's last words. Have you listened?",
                "Holy water can be found in the chapel font. Take some.",
                "The Entity cannot enter this chapel. You are safe here. Rest.",
                "I've watched a hundred years of loops. You are different. I have faith.",
            ];
            return {
                speaker: "FATHER HARMON",
                text: lines[Math.floor(Math.random() * lines.length)],
                choices: [
                    { text: "Thank you, Father.", next: null },
                    { text: "Can you bless me?",  next: "blessing" },
                    { text: "Any supplies?",       next: "shop" },
                ],
            };
        },
        shopItems: [
            { id: "holy_water_vial", icon: "💧", name: "Holy Water Vial", cost: 0, desc: "Ranged weapon vs undead",  stock: 2 },
            { id: "prayer_beads",    icon: "📿", name: "Prayer Beads",    cost: 0, desc: "Passive sanity regen",     stock: 1 },
            { id: "blessed_candle",  icon: "🕯️", name: "Blessed Candle",  cost: 0, desc: "Increases ambient light",  stock: 2 },
            { id: "herb_bundle",     icon: "🌿", name: "Herb Bundle",      cost: 0, desc: "Restores 20 sanity",       stock: 3 },
        ],
        quests: [],
    },

    mysterious_cat: {
        name: "Shadow Cat",
        icon: "🐈‍⬛",
        color: { r: 40, g: 40, b: 60 },
        size: 8,
        room: "attic",
        x: 500, y: 300,
        appearsAfterLoop: 2,
        friendly: true,
        shopkeeper: false,
        wanders: true,
        wanderRooms: ["attic","upstairs_hall","library","foyer","kitchen","garden_path"],
        dialogs: {
            first_meet: {
                speaker: "NARRATOR",
                text: "A black cat sits in the shadows, watching you with luminous yellow eyes. It seems... aware. More than an animal should be. It purrs when you approach.",
                choices: [
                    { text: "Pet the cat",   next: "pet",     flag: "met_cat" },
                    { text: "Observe it",    next: "observe" },
                ],
            },
            pet: {
                speaker: "NARRATOR",
                text: "The cat leans into your hand. Warmth flows through you. Your sanity steadies. The cat seems to know this house — it walks fearlessly where shadows gather.",
                choices: null,
                action() {
                    const g = _ng();
                    if (g) {
                        g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + 10);
                        if (g.permanentFlags) g.permanentFlags.catFriend = true;
                    }
                },
            },
            observe: {
                speaker: "NARRATOR",
                text: "The cat yawns, then walks to a specific spot and paws at the floor. There seems to be something hidden here. The cat looks at you expectantly.",
                choices: [
                    { text: "Investigate the spot", next: "hidden_item" },
                    { text: "Pet the cat first",    next: "pet" },
                ],
            },
            hidden_item: {
                speaker: "NARRATOR",
                text: "Under a loose floorboard, guided by the cat, you find a strange silver bell. The cat purrs approvingly.",
                choices: null,
                action() {
                    _nItem("silver_bell", "🔔", "Silver Bell");
                    _nClue("cat_bell", "A shadow cat led you to a hidden silver bell. It resonates with protective energy.");
                    _nXP(25);
                },
            },
        },
        getDefaultDialog() {
            const g = _ng();
            const actions = [
                "The cat rubs against your legs. Sanity restored slightly.",
                "The cat stares at a wall, then looks at you. Is it trying to show you something?",
                "The cat purrs. The sound is oddly comforting in this nightmare.",
                "The cat leads you a few steps in a direction, then stops and looks back.",
                "The cat hisses at the shadows. They seem to retreat slightly.",
            ];
            if (g) g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + 3);
            return {
                speaker: "NARRATOR",
                text: actions[Math.floor(Math.random() * actions.length)],
                choices: [{ text: "Good kitty.", next: null }],
            };
        },
        quests: [],
    },
};

// ═════════════════════════════════════════════════════════════════
//  NPC CLASS
// ═════════════════════════════════════════════════════════════════
class NPC {
    constructor(id) {
        const def = NPC_DEFS[id];
        if (!def) throw new Error(`[NPC] Unknown NPC id: ${id}`);

        this.id           = id;
        this.def          = def;
        this.name         = def.name;
        this.icon         = def.icon;
        this.x            = def.x;
        this.y            = def.y;
        this.room         = def.room;
        this.color        = { ...def.color };
        this.size         = def.size;
        this.friendly     = def.friendly;
        this.appearsAfterLoop = def.appearsAfterLoop ?? 0;
        this.hasMetPlayer = false;
        this.bobOffset    = Math.random() * Math.PI * 2;
        this.questsGiven  = new Set();
        this.wanders      = def.wanders  || false;
        this.wanderTimer  = 0;

        // Interaction cooldown — prevents dialog spam on key-hold
        this._interactCooldown = 0;
    }

    // ── Visibility ────────────────────────────────────────────────
    isInCurrentRoom() {
        const g = _ng();
        if (!g) return false;
        if ((g.loop ?? 0) < this.appearsAfterLoop) return false;

        if (this.wanders && Array.isArray(this.def.wanderRooms)) {
            this.wanderTimer++;
            if (this.wanderTimer > 600) {
                this.wanderTimer = 0;
                const rooms = this.def.wanderRooms;
                this.room   = rooms[Math.floor(Math.random() * rooms.length)];
                const rm    = _nRooms(this.room);
                if (rm) {
                    this.x = 50 + Math.random() * (Math.max(100, rm.width  - 100));
                    this.y = 50 + Math.random() * (Math.max(100, rm.height - 100));
                }
            }
        }

        return g.currentRoom === this.room;
    }

    getInteractDistance() {
        const g = _ng();
        if (!g) return Infinity;
        return Math.hypot((g.playerX ?? 0) - this.x, (g.playerY ?? 0) - this.y);
    }

    // ── Interaction ───────────────────────────────────────────────
    interact() {
        // Prevent dialog stacking from key-hold
        if (this._interactCooldown > 0) return;
        this._interactCooldown = 45;

        if (!this.hasMetPlayer) {
            this.hasMetPlayer = true;
            this._runDialog("first_meet");
            return;
        }

        const completable = this._getCompletableQuest();
        if (completable) { this._completeQuest(completable); return; }

        const available = this._getAvailableQuest();
        if (available)  { this._offerQuest(available); return; }

        // Default dialog
        try {
            const dialog = typeof this.def.getDefaultDialog === "function"
                ? this.def.getDefaultDialog()
                : null;
            if (dialog) {
                this._runDialogObj(dialog);
            } else {
                _nSay(this.name.toUpperCase(), "...");
            }
        } catch (e) {
            _nSay(this.name.toUpperCase(), "...");
        }
    }

    // ── Dialog runners ────────────────────────────────────────────
    _runDialog(dialogId) {
        const dialog = this.def.dialogs && this.def.dialogs[dialogId];
        if (!dialog) return;
        this._execDialog(dialog);
    }

    _runDialogObj(dialog) {
        if (!dialog) return;
        this._execDialog(dialog);
    }

    _execDialog(dialog) {
        // Execute any side-effect action
        if (typeof dialog.action === "function") {
            try { dialog.action(); } catch (_) {}
        }

        // Shop
        if (dialog.isShop && this.def.shopkeeper) {
            this._openShop();
            return;
        }

        const speaker = dialog.speaker || this.name.toUpperCase();
        const text    = dialog.text    || "...";

        if (Array.isArray(dialog.choices) && dialog.choices.length > 0) {
            const choices = dialog.choices.map(c => ({
                text:   c.text,
                action: () => {
                    const g = _ng();
                    if (c.flag && g && g.flags) g.flags[c.flag] = true;
                    if (c.next) this._runDialog(c.next);
                },
            }));
            _nSayChoices(speaker, text, choices);
        } else {
            _nSay(speaker, text);
        }
    }

    // ── Quest helpers ─────────────────────────────────────────────
    _getAvailableQuest() {
        if (!Array.isArray(this.def.quests)) return null;
        for (const qId of this.def.quests) {
            if (completedQuests.has(qId))                    continue;
            if (this.questsGiven.has(qId))                   continue;
            if (questLog.some(q => q.id === qId))            continue;
            if (QUESTS[qId])                                  return QUESTS[qId];
        }
        return null;
    }

    _getCompletableQuest() {
        for (const q of questLog) {
            if (q.giver !== this.id)        continue;
            if (completedQuests.has(q.id))  continue;
            try { if (q.check()) return q; } catch (_) {}
        }
        return null;
    }

    _offerQuest(quest) {
        _nSayChoices(
            this.name.toUpperCase(),
            `I have a task for you: "${quest.name}" — ${quest.desc}`,
            [
                {
                    text:   `Accept: ${quest.name}`,
                    action: () => {
                        questLog.push(quest);
                        this.questsGiven.add(quest.id);
                        _nSay("📋 QUEST ACCEPTED", `${quest.icon} ${quest.name}: ${quest.desc}`);
                        _nClue(`quest_${quest.id}`, `Quest: ${quest.name} — ${quest.desc}`);
                    },
                },
                { text: "Not right now", action: () => {} },
            ]
        );
    }

    _completeQuest(quest) {
        completedQuests.add(quest.id);
        const idx = questLog.findIndex(q => q.id === quest.id);
        if (idx >= 0) questLog.splice(idx, 1);

        try { if (typeof quest.onComplete === "function") quest.onComplete(); } catch (_) {}
        _nXP(quest.xpReward || 0);
        _nSay("🏆 QUEST COMPLETE", `${quest.icon} ${quest.name} — +${quest.xpReward} XP`);
        _nSound("unlock");
    }

    // ── Shop ──────────────────────────────────────────────────────
    _openShop() {
        const items = this.def.shopItems;
        if (!Array.isArray(items) || items.length === 0) {
            _nSay(this.name.toUpperCase(), "I don't have anything left. Sorry.");
            return;
        }

        const available = items.filter(item => (item.stock ?? 0) > 0);
        if (available.length === 0) {
            _nSay(this.name.toUpperCase(), "I've given you everything I have. Use it well.");
            return;
        }

        const choices = available.map(item => ({
            text:   `${item.icon} ${item.name} — ${item.desc} (${item.stock} left)`,
            action: () => {
                const g = _ng();
                try {
                    switch (item.id) {
                        case "herb_bundle":
                            if (g) g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + 20);
                            _nSay("SYSTEM", "Sanity restored +20");
                            break;
                        case "holy_water_vial":
                            if (g && g.permanentFlags) g.permanentFlags.hasHolyWater = true;
                            _nItem("holy_water_item", "💧", "Holy Water");
                            break;
                        case "prayer_beads":
                            _nItem("prayer_beads", "📿", "Prayer Beads");
                            if (g && g.permanentFlags) g.permanentFlags.hasPrayerBeads = true;
                            break;
                        case "blessed_candle":
                            _nItem("blessed_candle", "🕯️", "Blessed Candle");
                            break;
                        case "old_map":
                            _nItem("old_map", "🗺️", "Old Map");
                            if (g && g.permanentFlags) g.permanentFlags.hasOldMap = true;
                            break;
                        case "salt_pouch":
                            _nItem("salt_pouch", "⚪", "Salt Pouch");
                            break;
                        default:
                            _nItem(item.id, item.icon, item.name);
                    }
                } catch (_) {}
                item.stock = Math.max(0, item.stock - 1);
                _nXP(5);
            },
        }));

        choices.push({ text: "Nothing for now, thanks.", action: () => {} });
        _nSayChoices(this.name.toUpperCase(), "Here's what I have:", choices);
    }

    // ── Per-frame update ──────────────────────────────────────────
    update() {
        if (this._interactCooldown > 0) this._interactCooldown--;
        if (!this.isInCurrentRoom()) return;
        this.bobOffset += 0.03;
    }

    // ── Draw ──────────────────────────────────────────────────────
    draw(ctx) {
        if (!this.isInCurrentRoom()) return;

        const bobY = Math.sin(this.bobOffset) * 3;
        const { r, g: gc, b } = this.color;
        const sz = this.size;

        ctx.save();
        ctx.translate(this.x, this.y + bobY);

        // Glow aura
        const glowAlpha = 0.15 + Math.sin(this.bobOffset * 2) * 0.05;
        ctx.fillStyle = `rgba(${r},${gc},${b},${glowAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Ground shadow
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(0, sz * 0.7, sz * 0.6, sz * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const br = Math.min(255, r + 50);
        const bg = Math.min(255, gc + 50);
        const bb = Math.min(255, b + 50);
        ctx.fillStyle = `rgba(${br},${bg},${bb},0.75)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * 0.8, sz, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face
        const fr = Math.min(255, r + 100);
        const fg = Math.min(255, gc + 100);
        const fb = Math.min(255, b + 100);
        ctx.fillStyle = `rgba(${fr},${fg},${fb},0.85)`;
        ctx.beginPath();
        ctx.arc(0, -sz * 0.5, sz * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = this.friendly ? "#88ccff" : "#ff4444";
        ctx.beginPath();
        ctx.arc(-2, -sz * 0.55, 1.5, 0, Math.PI * 2);
        ctx.arc( 2, -sz * 0.55, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Wispy tendrils at bottom
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
            ctx.strokeStyle = `rgba(${r},${gc},${b},0.4)`;
            ctx.beginPath();
            ctx.moveTo(i * 4, sz * 0.6);
            ctx.lineTo(
                i * 4 + Math.sin(this.bobOffset + i) * 4,
                sz * 1.2
            );
            ctx.stroke();
        }

        // Icon above head
        ctx.font         = `${sz}px Arial, sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = "rgba(255,255,255,0.9)";
        ctx.fillText(this.icon, 0, -sz * 1.35);

        // Name + quest marker when close
        const dist = this.getInteractDistance();
        if (dist < 80) {
            ctx.font         = "10px Georgia, serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle    = "rgba(210,210,210,0.80)";
            ctx.fillText(this.name, 0, -sz * 1.85);

            // Quest indicator — completable (❓) takes priority over available (❗)
            const hasCompletable = !!this._getCompletableQuest();
            const hasAvailable   = !hasCompletable && !!this._getAvailableQuest();
            if (hasCompletable || hasAvailable) {
                ctx.font      = "bold 14px Arial, sans-serif";
                ctx.fillStyle = "#ffcc44";
                ctx.fillText(hasCompletable ? "❓" : "❗", 0, -sz * 2.4);
            }
        }

        ctx.restore();
    }
}

// ═════════════════════════════════════════════════════════════════
//  SYSTEM FUNCTIONS
// ═════════════════════════════════════════════════════════════════
function initNPCs() {
    npcs.length = 0;
    for (const id in NPC_DEFS) {
        try { npcs.push(new NPC(id)); } catch (e) {
            console.warn(`[NPC] Failed to create NPC "${id}":`, e);
        }
    }
}

function updateNPCs() {
    for (const npc of npcs) {
        try { npc.update(); } catch (_) {}
    }
    try { _checkQuestCompletion(); } catch (_) {}
}

function drawNPCs(ctx) {
    if (!ctx) return;
    for (const npc of npcs) {
        try { npc.draw(ctx); } catch (_) {}
    }
}

function getNearestNPC() {
    const g = _ng();
    if (!g) return null;

    let nearest     = null;
    let nearestDist = 65;

    for (const npc of npcs) {
        if (!npc.isInCurrentRoom()) continue;
        const d = npc.getInteractDistance();
        if (d < nearestDist) { nearestDist = d; nearest = npc; }
    }
    return nearest;
}

// Internal — not exported to avoid double calls
function _checkQuestCompletion() {
    if (!_ng()) return;
    for (const q of questLog) {
        if (completedQuests.has(q.id)) continue;
        try {
            if (q.check() && !q._notified) {
                q._notified = true;
                const giverName = NPC_DEFS[q.giver]?.name || "quest giver";
                _nSay(
                    "📋 QUEST",
                    `"${q.name}" — Objective complete! Return to ${giverName}.`
                );
            }
        } catch (_) {}
    }
}

function resetNPCs() {
    for (const npc of npcs) {
        // Preserve hasMetPlayer — NPCs remember the player across loops
        npc.room        = npc.def.room;
        npc.x           = npc.def.x;
        npc.y           = npc.def.y;
        npc.wanderTimer = 0;
        npc._interactCooldown = 0;
    }
    // questLog and completedQuests intentionally persist across loops
}

function getQuestLogHTML() {
    let html = '<div class="journal-entry">';
    html += '<div class="journal-loop">📋 ACTIVE QUESTS</div>';

    if (questLog.length === 0) {
        html += '<div class="journal-clue" style="color:#555">No active quests. Talk to NPCs!</div>';
    } else {
        for (const q of questLog) {
            let status = "";
            try { status = q.check() ? " ✅ Return to NPC!" : ""; } catch (_) {}
            html += `<div class="journal-clue" style="color:#ddaa55">${q.icon} ${q.name}: ${q.desc}${status}</div>`;
        }
    }

    if (completedQuests.size > 0) {
        html += '<div class="journal-loop" style="margin-top:8px">COMPLETED</div>';
        for (const qId of completedQuests) {
            const q = QUESTS[qId];
            if (q) html += `<div class="journal-clue" style="color:#444">${q.icon} ${q.name} ✓</div>`;
        }
    }

    html += '</div>';
    return html;
}

// ─── Auto-initialise ─────────────────────────────────────────────
initNPCs();