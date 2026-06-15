// ═════════════════════════════════════════════════════════════════
//  EVENTS.JS — Advanced Horror Event System  v2.0
//  Escalating scares, staged entity encounters, environmental
//  horror, psychological events, multi-part sequences.
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════
//  SAFE HELPERS — never throw, never depend on load order
// ═════════════════════════════════════════════════════════════════
const _EV = {
    game()  { return (typeof game      !== "undefined") ? game      : null; },
    rooms() { return (typeof ROOMS     !== "undefined") ? ROOMS     : {};   },
    room()  {
        const g = this.game();
        if (!g) return null;
        const R = this.rooms();
        return R[g.currentRoom] || null;
    },
    sound(k)       { try { if (typeof playSound       === "function") playSound(k);            } catch(_){} },
    dialog(s, t)   { try { if (typeof showDialog      === "function") showDialog(s, t);        } catch(_){} },
    mono(k)        { try { if (typeof triggerMonologue === "function") triggerMonologue(k);     } catch(_){} },
    shake(i, d)    { try { if (typeof triggerShake    === "function") triggerShake(i, d);      } catch(_){} },
    subtitle(s, t, d) {
        try {
            if (typeof SubtitleSystem !== "undefined" && SubtitleSystem.show) {
                SubtitleSystem.show(s, t, d || 180);
            }
        } catch(_) {}
    },
    spirit(x, y, n, c) { try { if (typeof emitSpirit  === "function") emitSpirit(x, y, n, c); } catch(_){} },
    tendril(x, y, n)   { try { if (typeof emitTendril === "function") emitTendril(x, y, n);   } catch(_){} },
    blood(x, y, n)     { try { if (typeof emitBlood   === "function") emitBlood(x, y, n);     } catch(_){} },
    fog(x, y, n)       { try { if (typeof emitFog     === "function") emitFog(x, y, n);       } catch(_){} },
    sparks(x, y, n)    { try { if (typeof emitSparks  === "function") emitSparks(x, y, n);    } catch(_){} },
    embers(x, y, n)    { try { if (typeof emitEmbers  === "function") emitEmbers(x, y, n);    } catch(_){} },
    dust(x, y, n)      { try { if (typeof emitDust    === "function") emitDust(x, y, n);      } catch(_){} },
    cam(m, ...a)       {
        try {
            if (typeof Camera !== "undefined" && Camera &&
                typeof Camera[m] === "function") Camera[m](...a);
        } catch(_) {}
    },
    xp(n)   { try { if (typeof giveXP    === "function") giveXP(n);    } catch(_){} },
    item(n) { try { if (typeof addItem   === "function") addItem(n);   } catch(_){} },
    clue(t) { try { if (typeof addClue   === "function") addClue(t);   } catch(_){} },
    seals() { try { return (typeof countSeals === "function") ? countSeals() : 0; } catch(_){ return 0; } },

    // Sanity helpers — always clamped
    drainSanity(n) {
        const g = this.game(); if (!g) return;
        g.sanity = Math.max(0, (g.sanity ?? 100) - n);
    },
    restoreSanity(n) {
        const g = this.game(); if (!g) return;
        g.sanity = Math.min(g.maxSanity ?? 100, (g.sanity ?? 0) + n);
    },
    sanityRatio() {
        const g = this.game(); if (!g) return 1;
        return Math.max(0, Math.min(1, (g.sanity ?? 100) / (g.maxSanity ?? 100)));
    },
    loop()     { const g = this.game(); return g ? (g.loop  ?? 0)   : 0; },
    timeLeft() { const g = this.game(); return g ? (g.maxLoopTime ?? 600) - (g.loopTime ?? 0) : 600; },
    px()       { const g = this.game(); return g ? (g.playerX ?? 0) : 0; },
    py()       { const g = this.game(); return g ? (g.playerY ?? 0) : 0; },
};

// ═════════════════════════════════════════════════════════════════
//  SCARE EVENTS  — 40 events, staged escalation
// ═════════════════════════════════════════════════════════════════
const SCARE_EVENTS = [

    // ── ATMOSPHERIC ──────────────────────────────────────────────

    {
        id: "flickering_lights",
        weight: 10, minLoop: 0, cooldown: 300, rooms: null,
        action() {
            const g = _EV.game(); if (!g) return;
            const r = _EV.room(); if (!r) return;
            const orig       = r.ambientLight;
            const targetRoom = g.currentRoom;
            const fix = () => { if (g.currentRoom === targetRoom) r.ambientLight = orig; };
            const dim = () => { if (g.currentRoom === targetRoom) r.ambientLight = 0.01; };
            dim();
            setTimeout(() => { fix(); }, 180);
            setTimeout(() => { dim(); setTimeout(() => { fix(); }, 80); }, 450);
            setTimeout(() => { dim(); setTimeout(() => { fix(); }, 120); }, 750);
            _EV.sound("scare");
            _EV.drainSanity(3 + _EV.loop());
        }
    },

    {
        id: "cold_spot",
        weight: 8, minLoop: 1, cooldown: 350, rooms: null,
        _msgs: [
            "The temperature drops suddenly. Your breath frosts in the air. Something unseen passes through you.",
            "An icy hand trails across the back of your neck. There is no one there.",
            "The cold comes from inside the wall. Something is pressing against it from the other side.",
            "You step through a pocket of absolute zero. The cold has a shape. A silhouette. It steps away from you.",
            "The frost forms letters on the windowpane. They spell your name. Then melt.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(5 + _EV.loop());
            _EV.sound("ghost");
            _EV.fog(_EV.px(), _EV.py(), 10 + _EV.loop() * 2);
        }
    },

    {
        id: "shadow_run",
        weight: 9, minLoop: 1, cooldown: 400, rooms: null,
        _msgs: [
            "Something dark and fast moves at the edge of your flashlight beam.",
            "It is closer this time. You can almost make out a shape. Too many limbs.",
            "It stops. It turns. It looks back at you. You cannot move.",
            "It is standing directly behind your shadow. Mimicking your shape. Waiting.",
            "There are two shadows where there should be one. The second one does not match your movements.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(4 + _EV.loop() * 2);
            const a = Math.random() * Math.PI * 2;
            _EV.spirit(
                _EV.px() + Math.cos(a) * (80 + _EV.loop() * 10),
                _EV.py() + Math.sin(a) * (80 + _EV.loop() * 10),
                3 + _EV.loop(), { r: 20, g: 0, b: 40 }
            );
        }
    },

    {
        id: "whisper_name",
        weight: 8, minLoop: 1, cooldown: 600, rooms: null,
        _msgs: [
            "*whisper* ...you shouldn't be here...",
            "*whisper* ...leave before it finds you...",
            "*whisper* ...he never left...",
            "*whisper* ...the fifth loop... it knows your name now...",
            "*whisper* ...Eleanora is waiting... but so is he...",
            "*whisper* ...you have been here before. you will be here again...",
            "*whisper* ...the seals are not enough. nothing is enough...",
            "*whisper* ...it wears faces. it wore mine...",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("???", msg);
            _EV.sound("whisper");
            _EV.drainSanity(5);
        }
    },

    {
        id: "door_slam",
        weight: 7, minLoop: 0,
        rooms: ["foyer","upstairs_hall","dining_room","library","servants_quarters"],
        cooldown: 400,
        _msgs: [
            "A door SLAMS shut somewhere in the house. The echo reverberates through the walls.",
            "Every door on this floor slams simultaneously. The house is angry.",
            "A door opens by itself. Then slowly, deliberately, closes. The latch clicks.",
            "The door you just came through is gone. Smooth wall where it stood. When you turn back — it's there again.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("door");
            _EV.drainSanity(4 + _EV.loop());
            _EV.shake(5 + _EV.loop(), 15);
        }
    },

    {
        id: "writing_wall",
        weight: 5, minLoop: 2,
        rooms: ["upstairs_hall","basement","kitchen","study","servants_tunnel","coal_room"],
        cooldown: 800,
        _msgs: [
            "Words appear on the wall in blood: 'TIME IS A CIRCLE'",
            "Scratched into the wallpaper: 'HE WATCHES FROM THE WALLS'",
            "Written in dust on the floor: 'ELEANORA FORGIVE ME'",
            "Carved deep into the wood: 'THE FIFTH SEAL IS A LIE'",
            "Burnt into the ceiling: 'COUNT THE BELLS'",
            "Fresh blood on the mirror: 'YOU ARE THE SEVENTH'",
            "Scratched by fingernails into the door: 'IT HEARS YOU READ THIS'",
            "Spelled in ash: 'THE LOOP HAS NO EXIT. ONLY DEEPER.'",
            "Written in something dark across every wall simultaneously: 'STAY'",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(7 + _EV.loop());
            _EV.sound("scare");
            _EV.blood(
                _EV.px() + (Math.random() - 0.5) * 60,
                _EV.py() - 40, 5 + _EV.loop()
            );
        }
    },

    {
        id: "mirror_face",
        weight: 5, minLoop: 2,
        rooms: ["foyer","master_bedroom","mirror_gallery","upstairs_hall"],
        cooldown: 800,
        _msgs: [
            "You catch a glimpse of a face in a reflective surface. It's not yours. It's smiling.",
            "The face in the mirror mouths something. You read the words: 'STAY.'",
            "The reflection reaches toward the glass from the other side. Its fingers press through.",
            "Your reflection does not move when you move. It watches you. It has been watching for loops.",
            "There are two of you in the mirror. The second one is standing closer than you are.",
            "The face in the mirror screams. You hear nothing. But the glass cracks from inside.",
        ],
        _i: 0,
        action() {
            const loop = _EV.loop();
            const msg  = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("scare");
            _EV.drainSanity(10 + loop * 2);
            _EV.cam("scareZoom", 0.05 + loop * 0.01);
            _EV.spirit(_EV.px(), _EV.py() - 30, 5 + loop, { r: 200, g: 50, b: 50 });
        }
    },

    {
        id: "music_box_distant",
        weight: 6, minLoop: 1,
        rooms: ["upstairs_hall","master_bedroom","foyer","nursery","childrens_room"],
        cooldown: 500,
        _msgs: [
            "A music box plays somewhere distant. The melody is wrong. The notes are backwards.",
            "The music box is closer now. It plays the same wrong melody. Louder.",
            "The music box is in this room. You find it. The lid is open. The dancer inside has no head.",
            "The music box plays a lullaby you remember from childhood. You never owned a music box.",
            "The music box plays one note. Repeating. Getting slower. It stops. Then your heartbeat continues the rhythm.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("whisper");
            _EV.drainSanity(3 + _EV.loop());
        }
    },

    {
        id: "clock_chimes",
        weight: 9, minLoop: 0, cooldown: 400, rooms: null,
        action() {
            const g = _EV.game(); if (!g) return;
            const remaining = Math.max(0, Math.floor(g.maxLoopTime - g.loopTime));
            const mins      = Math.floor(remaining / 60);
            const secs      = remaining % 60;
            const msgs = [
                `The grandfather clock chimes. ${mins}m ${secs}s remain.`,
                `The clock strikes. The sound reverberates wrong — like it's inside your skull. ${mins}m ${secs}s.`,
                `The clock does not stop chiming. One. Two. Three. It reaches thirteen. ${mins}m ${secs}s remain.`,
            ];
            _EV.dialog("NARRATOR", msgs[Math.min(_EV.loop(), msgs.length - 1)]);
            _EV.sound("clock");
        }
    },

    {
        id: "child_laugh",
        weight: 6, minLoop: 1,
        rooms: ["childrens_room","nursery","upstairs_hall","foyer","attic"],
        cooldown: 500,
        _msgs: [
            "A child's laughter echoes through the room. Innocent. Terrible.",
            "The laugh is closer. It comes from under the floorboards.",
            "A child runs past the doorway. You see it clearly. It has no eyes.",
            "The child stands in the corner. It is counting. It says it will find you when it reaches zero.",
            "The child's laugh slows down like a record stopping. Then it says your name. Then it laughs again.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("ghost");
            _EV.drainSanity(4 + _EV.loop() * 2);
            if (this._i >= 3) _EV.cam("scareZoom", 0.04);
        }
    },

    {
        id: "breathing",
        weight: 6, minLoop: 2,
        rooms: ["master_bedroom","nursery","study","secret_room","servants_quarters"],
        cooldown: 500,
        _msgs: [
            "You hear breathing. Close. Behind you. When you turn — nothing.",
            "The breathing is in your ear now. Wet. Patient.",
            "It is not breathing. It is counting. Very slowly. You are at six.",
            "The breathing matches yours exactly. When you hold your breath — so does it. When you breathe — so does it.",
            "You realize the breathing has been there since you entered this loop. You simply stopped noticing.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("heartbeat");
            _EV.drainSanity(6 + _EV.loop() * 2);
        }
    },

    {
        id: "gravity_shift",
        weight: 3, minLoop: 4,
        rooms: ["void_chamber","ritual_chamber","bell_tower","tower_peak","observatory"],
        cooldown: 600,
        _msgs: [
            "Gravity shifts. For a moment you feel yourself falling upward.",
            "The room tilts 90 degrees. Objects slide across the floor — sideways. Then it snaps back.",
            "You are on the ceiling. The furniture hangs below you like stalactites. For three seconds. Then normal.",
            "Up and down cease to mean anything. You float. The Entity floats with you. Watching.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(10 + _EV.loop() * 3);
            _EV.shake(15 + _EV.loop() * 2, 25);
            _EV.cam("tilt", (Math.random() - 0.5) * 0.15);
            setTimeout(() => { _EV.cam("tilt", 0); }, 1500);
        }
    },

    {
        id: "piano",
        weight: 5, minLoop: 2,
        rooms: ["parlor","ballroom","foyer","music_room"],
        cooldown: 700,
        _msgs: [
            "A piano plays itself. A single note, held too long. Then silence.",
            "The piano plays a full chord. Minor. Unresolved. The sustain pedal holds it until you leave.",
            "You see the piano keys depressing one by one. Spelling something in sheet music. A warning.",
            "The piano plays the same melody Eleanora hummed when she was alive. How do you know that?",
            "The piano plays the theme from your earliest memory. You have never shared that memory with anyone.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.sound("piano_note");
            _EV.drainSanity(3 + _EV.loop());
        }
    },

    {
        id: "time_glitch",
        weight: 4, minLoop: 3, cooldown: 900, rooms: null,
        _msgs: [
            "For a split second you see yourself where you were 30 seconds ago. The loop destabilizes.",
            "You see three versions of yourself simultaneously. Past, present, future. The future one is screaming.",
            "The loop stutters. You relive the last 10 seconds twice. The second time, something is different.",
            "Time runs backwards for exactly 4 seconds. When it resumes, an object has moved. You did not move it.",
            "You have a memory of something that hasn't happened yet. You are in the void chamber. The Entity has your face.",
        ],
        _i: 0,
        action() {
            const g = _EV.game(); if (!g) return;
            const msg = this._msgs[Math.min(this._i++, this._msgs.length - 1)];
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(8 + _EV.loop() * 2);
            g.loopTime += 10 + _EV.loop() * 5; // lose more time each loop
            _EV.shake(8 + _EV.loop(), 20);
            _EV.sparks(_EV.px(), _EV.py(), 15 + _EV.loop() * 3);
        }
    },

    // ── ENTITY — AZATHIEL ────────────────────────────────────────

    {
        id: "entity_pulse",
        weight: 4, minLoop: 3,
        rooms: ["basement","ritual_chamber","void_chamber","catacombs","underground_lake"],
        cooldown: 600,
        _stage: 0,
        _lines: [
            ["AZATHIEL", "I   S E E   Y O U"],
            ["AZATHIEL", "Y O U   C A N N O T   H I D E   I N   T I M E"],
            ["AZATHIEL", "E V E R Y   L O O P   Y O U   F E E D   M E"],
            ["AZATHIEL", "S O O N   Y O U   W I L L   N O T   W A N T   T O   L E A V E"],
            ["AZATHIEL", "W E   A R E   A L R E A D Y   O N E"],
            ["AZATHIEL", "Y O U   A R E   N O T   L O O K I N G   F O R   A   W A Y   O U T .   Y O U   A R E   L O O K I N G   F O R   M E ."],
            ["AZATHIEL", "I   A M   N O T   T R A P P E D   H E R E .   Y O U   A R E ."],
        ],
        action() {
            const [spk, txt] = this._lines[Math.min(this._stage, this._lines.length - 1)];
            this._stage++;
            _EV.dialog(spk, txt);
            _EV.drainSanity(15 + this._stage * 3);
            _EV.sound("scare");
            _EV.shake(10 + this._stage * 2, 30 + this._stage * 5);
            _EV.cam("scareZoom", 0.06 + this._stage * 0.01);
            for (let i = 0; i < 8 + this._stage * 3; i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 100,
                    _EV.py() + 30, 2 + this._stage
                );
            }
        }
    },

    {
        id: "entity_mimic",
        weight: 3, minLoop: 4,
        rooms: ["foyer","upstairs_hall","library","study","mirror_gallery"],
        cooldown: 900,
        _stage: 0,
        _lines: [
            ["ELEANORA?", "Help me. I am trapped in the walls. Please."],
            ["???", "I said please. Why won't you help me. Why won't you HELP ME."],
            ["AZATHIEL", "Did you know she asked for help too? Just like that. Just like you thought I was her."],
            ["AZATHIEL", "I wore her face better in the earlier loops. You are learning. So am I."],
            ["AZATHIEL", "I can be anyone. I can be the voice you trust most. I already have been."],
        ],
        action() {
            const [spk, txt] = this._lines[Math.min(this._stage, this._lines.length - 1)];
            this._stage++;
            _EV.dialog(spk, txt);
            _EV.drainSanity(12 + this._stage * 4);
            _EV.sound(this._stage > 2 ? "scare" : "ghost");
            if (this._stage > 1) _EV.cam("scareZoom", 0.04);
        }
    },

    {
        id: "entity_encroach",
        weight: 2, minLoop: 5,
        rooms: null, cooldown: 1200,
        _stage: 0,
        _lines: [
            ["AZATHIEL", "I am in the east wing now."],
            ["AZATHIEL", "I am outside this room."],
            ["AZATHIEL", "I am in this room."],
            ["AZATHIEL", "I am behind you."],
            ["AZATHIEL", "I am you."],
        ],
        action() {
            const [spk, txt] = this._lines[Math.min(this._stage, this._lines.length - 1)];
            this._stage++;
            _EV.dialog(spk, txt);
            _EV.drainSanity(20);
            _EV.sound("scare");
            _EV.shake(12, 40);
            _EV.cam("scareZoom", 0.08);
            for (let i = 0; i < 15; i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 200,
                    _EV.py() + (Math.random() - 0.5) * 200, 3
                );
            }
        }
    },

    // ── ELEANORA ─────────────────────────────────────────────────

    {
        id: "eleanora_warning",
        weight: 4, minLoop: 2,
        rooms: ["foyer","library","chapel","garden_path","master_bedroom","sanctuary"],
        cooldown: 900,
        _stage: 0,
        _lines: [
            ["ELEANORA", "I do not have much time. It knows when I appear. Find the seals. Please."],
            ["ELEANORA", "You are getting closer. But it is getting stronger too. Each loop feeds it. Hurry."],
            ["ELEANORA", "I tried to seal it myself. That is how I died. Do not make my mistake. Use the locket."],
            ["ELEANORA", "It will try to be me. It has learned my voice. If I say anything cruel — it is not me."],
            ["ELEANORA", "I am fading. Each loop costs me. If I disappear before you finish... the knowledge dies with me."],
        ],
        action() {
            const [spk, txt] = this._lines[Math.min(this._stage++, this._lines.length - 1)];
            _EV.dialog(spk, txt);
            _EV.restoreSanity(3);
            _EV.sound("ghost");
            _EV.spirit(_EV.px(), _EV.py() - 50, 8, { r: 100, g: 180, b: 255 });
        }
    },

    {
        id: "eleanora_lore",
        weight: 3, minLoop: 3,
        rooms: ["library","study","secret_room","chapel","observatory"],
        cooldown: 1000,
        _lines: [
            ["ELEANORA", "The house was built on a place between worlds. My husband knew. He invited it in deliberately."],
            ["ELEANORA", "Azathiel is not its name. That is just what it calls itself here. Its true name would break your mind."],
            ["ELEANORA", "The seals were my design. Five anchors in five rooms. Each one bound with a piece of my love for this house."],
            ["ELEANORA", "It cannot be killed. Only contained. The ritual chamber is the lock. You are the key."],
        ],
        _i: 0,
        action() {
            const [spk, txt] = this._lines[this._i % this._lines.length];
            this._i++;
            _EV.dialog(spk, txt);
            _EV.sound("ghost");
            _EV.clue(txt);
        }
    },

    // ── ROOM-SPECIFIC HORROR ──────────────────────────────────────

    {
        id: "nursery_horror",
        weight: 7, minLoop: 1,
        rooms: ["nursery","childrens_room"],
        cooldown: 500,
        _msgs: [
            "The rocking chair moves. Nothing sits in it. It rocks faster when you watch.",
            "The toys arrange themselves while you look away. They form an arrow. Pointing at the door you came in through.",
            "A cradle rocks violently. Inside — a child's drawing. Of you. Being watched. By something behind you right now.",
            "The dolls all turn their heads toward you simultaneously.",
            "A child's handprint appears on the dusty floor. Moving toward you. Step by step.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.sound("ghost");
            _EV.drainSanity(8 + _EV.loop() * 2);
            _EV.cam("scareZoom", 0.03);
        }
    },

    {
        id: "basement_presence",
        weight: 6, minLoop: 1,
        rooms: ["basement","coal_room","root_cellar","laundry"],
        cooldown: 450,
        _msgs: [
            "Something vast shifts in the dark beneath the floor. The stone cracks.",
            "The walls are wet. They were dry a moment ago. The moisture is warm.",
            "A hand reaches out of the coal pile. It withdraws before you can react.",
            "The drain in the floor gurgles. Something pushes up against it from below.",
            "Every light source dims at once. In the absolute dark, something breathes close to your face.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.sound("scare");
            _EV.drainSanity(9 + _EV.loop() * 2);
            _EV.shake(6, 20);
            for (let i = 0; i < 5; i++) {
                _EV.tendril(_EV.px() + (Math.random() - 0.5) * 60, _EV.py() + 30, 1);
            }
        }
    },

    {
        id: "graveyard_dead",
        weight: 6, minLoop: 1,
        rooms: ["graveyard","garden_path","well"],
        cooldown: 500,
        _msgs: [
            "A grave marker has fallen. The name on it is yours.",
            "The ground ripples like water. Something beneath it moves toward you.",
            "The well is full of hands. They wave slowly. Like they are greeting you.",
            "A figure stands at the far end of the graveyard. In previous loops it was closer each time.",
            "Every grave has the same date of death. Tonight. This loop.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.sound("ghost");
            _EV.drainSanity(7 + _EV.loop() * 2);
            _EV.fog(_EV.px(), _EV.py(), 12);
        }
    },

    {
        id: "attic_memory",
        weight: 5, minLoop: 2,
        rooms: ["attic","attic_stairs"],
        cooldown: 600,
        _msgs: [
            "Someone lived up here. The dust shows footprints that are not yours. Recent.",
            "A trunk is open. Inside — letters addressed to you. You have never been here before.",
            "The roof beams are covered in tally marks. Hundreds. Someone counted the loops before you.",
            "A mirror up here shows the room from a different angle. From the perspective of something in the rafters.",
            "A photograph. You. In this attic. But you have never been photographed here. The photo is old.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(8 + _EV.loop() * 2);
            _EV.sound("whisper");
            _EV.dust(_EV.px(), _EV.py() - 30, 8);
        }
    },

    {
        id: "void_unravel",
        weight: 4, minLoop: 4,
        rooms: ["void_chamber","tower_peak","sanctuary"],
        cooldown: 700,
        _msgs: [
            "The room has no walls here. Just darkness pretending to be walls.",
            "You can see through your own hands. The room is visible through your palm.",
            "The floor is made of frozen moments. Each tile is a different version of this loop.",
            "There is no ceiling. There never was. The darkness above is not sky. It is attention.",
            "You realize you have been in this room before. Not in a previous loop. Right now. Simultaneously.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(15 + _EV.loop() * 3);
            _EV.sound("scare");
            _EV.shake(12, 30);
            _EV.cam("scareZoom", 0.07);
            for (let i = 0; i < 12; i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 150,
                    _EV.py() + (Math.random() - 0.5) * 150, 3
                );
            }
        }
    },

    {
        id: "chapel_divine",
        weight: 4, minLoop: 2,
        rooms: ["chapel","sanctuary"],
        cooldown: 700,
        _msgs: [
            "Something holy was here once. You can feel its absence like a wound in the air.",
            "The altar is wrong. The icon faces the wrong way. Something has been worshipping here. Not God.",
            "Candles light themselves. Then all blow out simultaneously. A single voice says 'Amen.'",
            "The stained glass shows a different scene depending on the angle. From the door: salvation. From the altar: consumption.",
            "You pray instinctively. Something answers. It is not what you prayed to.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(6 + _EV.loop());
            _EV.sound("bell_ring");
            _EV.spirit(_EV.px(), _EV.py() - 40, 6, { r: 255, g: 220, b: 100 });
        }
    },

    {
        id: "library_knowledge",
        weight: 5, minLoop: 1,
        rooms: ["library","study"],
        cooldown: 600,
        _msgs: [
            "Every book on the shelf is titled the same: 'What You Did To Deserve This.'",
            "A book falls open. The text rearranges itself as you read. It describes this exact moment.",
            "The books are arranged in a specific order. You read the first letter of each spine. A message.",
            "One book has no title. Inside: your biography. Events that haven't happened yet. The last page is blank.",
            "You find Eleanora's research notes. She discovered what lived under the house. The last entry just says: 'It saw me reading this.'",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(5 + _EV.loop());
            _EV.sound("book_open");
            _EV.clue(msg.substring(0, 60) + "...");
        }
    },

    {
        id: "observatory_stars",
        weight: 4, minLoop: 2,
        rooms: ["observatory","tower_peak","bell_tower"],
        cooldown: 700,
        _msgs: [
            "The stars through the telescope are wrong. The constellations don't match any known configuration.",
            "One star is moving. Toward the house. It has been moving since loop one.",
            "The telescope is pointed at the floor. Through it you see the ritual chamber from above. Something is in it.",
            "The night sky ripples like a reflection. Something beneath it moves.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(7 + _EV.loop());
            _EV.sound("scare");
        }
    },

    {
        id: "ritual_hunger",
        weight: 5, minLoop: 3,
        rooms: ["ritual_chamber","catacombs","underground_lake"],
        cooldown: 500,
        _msgs: [
            "The ritual circle pulses. It is hungry. You can feel it wanting.",
            "The markings on the floor are not carved. They are grown. Like roots. They are still growing.",
            "Something lives in the ritual circle. Small. Fast. It retreats when you shine light on it.",
            "You feel the ritual circle pulling at your sanity like a current. Stand here too long and you will forget yourself.",
            "The circle is complete. It has been complete since loop three. Whatever it was meant to summon — was already here.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(10 + _EV.loop() * 3);
            _EV.sound("scare");
            _EV.shake(8, 25);
            for (let i = 0; i < 6 + _EV.loop(); i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 80,
                    _EV.py() + (Math.random() - 0.5) * 80, 2
                );
            }
        }
    },

    {
        id: "underground_lake_depth",
        weight: 5, minLoop: 2,
        rooms: ["underground_lake"],
        cooldown: 500,
        _msgs: [
            "The lake has no bottom. The light disappears long before it should.",
            "Something moves beneath the surface. Large. Patient.",
            "A hand breaks the surface of the water. It holds a seal fragment. Then it withdraws.",
            "Your reflection in the water does not match you. It is already standing on the other side.",
            "The water is not water. It is too thick. Too dark. Too warm. And it is rising.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(9 + _EV.loop() * 2);
            _EV.sound("ghost");
            _EV.fog(_EV.px(), _EV.py() + 30, 15);
        }
    },

    // ── PSYCHOLOGICAL ────────────────────────────────────────────

    {
        id: "identity_crack",
        weight: 3, minLoop: 4, cooldown: 1000, rooms: null,
        _msgs: [
            "You cannot remember your name. For three seconds. Then it comes back. But you aren't certain it's right.",
            "You have a memory of this loop going differently. Better. Then you remember — that was a different you.",
            "You look at your hands. They are not the hands you remember having. When did they change?",
            "You have the sudden, certain knowledge that you died in this house. In loop two. What is walking around now?",
            "You feel yourself being observed — not by the Entity, not by a ghost. By yourself. From inside.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(12 + _EV.loop() * 3);
            _EV.sound("scare");
            _EV.cam("scareZoom", 0.06);
            _EV.shake(5, 15);
        }
    },

    {
        id: "false_exit",
        weight: 2, minLoop: 5, cooldown: 1500, rooms: null,
        _stage: 0,
        _lines: [
            ["NARRATOR", "You find a door you've never seen. It leads outside. Fresh air. Moonlight. You are free."],
            ["NARRATOR", "You wake up in the foyer. You never left. The door is gone. The moonlight was wrong anyway — there is no moon tonight."],
            ["AZATHIEL", "That was my favorite one to show them. The exit that isn't."],
        ],
        action() {
            // This fires as a sequence across three calls
            const line = this._lines[Math.min(this._stage, this._lines.length - 1)];
            this._stage++;
            _EV.dialog(line[0], line[1]);
            if (this._stage === 2) {
                _EV.drainSanity(20);
                _EV.shake(10, 30);
            }
            if (this._stage >= 3) {
                _EV.drainSanity(15);
                _EV.sound("scare");
                this._stage = 0; // reset for next time
            }
        }
    },

    {
        id: "loop_awareness",
        weight: 3, minLoop: 3, cooldown: 1100, rooms: null,
        _msgs: [
            "You have a sense of déjà vu so strong it is physically painful. You have been here. Exactly here. Forever.",
            "You remember solving this loop perfectly once. Sealing everything. Escaping. And then waking up in the foyer again.",
            "The loop is not a punishment. You understand that suddenly. It is a trap that was designed to feel like a challenge.",
            "Eleanora has been trying to help you for 40 loops. You are the first one who got this far.",
            "You stop counting loops. The number has become meaningless. The house is the number.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(10 + _EV.loop() * 2);
            _EV.sound("whisper");
            _EV.fog(_EV.px(), _EV.py(), 8);
        }
    },

    // ── ENVIRONMENTAL ────────────────────────────────────────────

    {
        id: "object_move",
        weight: 7, minLoop: 1, cooldown: 450, rooms: null,
        _msgs: [
            "A chair scrapes across the floor by itself. It stops facing you.",
            "The painting on the wall has turned to face the opposite direction. You did not touch it.",
            "A cup falls off the table with no cause. It does not break. It lands right-side up.",
            "The rug in this room has moved. The furniture has moved with it. The indentations in the floor show the old positions.",
            "Every clock in the house shows a different time. None of them show the right time.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(4 + _EV.loop());
            _EV.sound("step");
        }
    },

    {
        id: "smell_horror",
        weight: 6, minLoop: 1, cooldown: 500, rooms: null,
        _msgs: [
            "Something smells wrong. Like earth and copper and something older than both.",
            "The smell of roses where there are no roses. Eleanora's perfume. Strong.",
            "A smell you cannot name. Animal. Ancient. Getting stronger.",
            "The smell of burning, but nothing burns. Your hair. Your clothes. Your skin. Fine. For now.",
            "The air tastes like the inside of something that should be closed.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(3 + _EV.loop());
        }
    },

    {
        id: "sound_wrong",
        weight: 7, minLoop: 1, cooldown: 400, rooms: null,
        _msgs: [
            "Your footsteps echo differently. As if the room is larger than it appears.",
            "You hear something being dragged. Heavy. Wet. Getting closer. It stops just outside.",
            "A sound like a record skipping — but it is a voice. Repeating one syllable. Your name, cut short.",
            "The silence becomes loud. A specific, directional silence. Like something nearby is holding very still.",
            "Knocking from inside the walls. Three knocks. Pause. Three knocks. Pause. Every 33 seconds.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(4 + _EV.loop());
            _EV.sound("whisper");
        }
    },

    {
        id: "blood_trail",
        weight: 4, minLoop: 2,
        rooms: ["upstairs_hall","master_bedroom","servants_tunnel","basement","kitchen"],
        cooldown: 700,
        _msgs: [
            "A blood trail leads from the room you just entered. Following your path. It was not there when you walked it.",
            "The blood trail leads to a mirror. Stops. The mirror is clean.",
            "Fresh blood on the banister. A handprint. Smaller than yours. Child-sized.",
            "The blood trail leads in a circle. Around you. You are in the center.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(8 + _EV.loop() * 2);
            _EV.sound("scare");
            _EV.blood(_EV.px() + (Math.random() - 0.5) * 80, _EV.py() - 20, 6);
            _EV.blood(_EV.px() + (Math.random() - 0.5) * 40, _EV.py() + 20, 4);
        }
    },

    {
        id: "portrait_eyes",
        weight: 5, minLoop: 1,
        rooms: ["gallery","foyer","library","upstairs_hall","dining_room","master_bedroom"],
        cooldown: 550,
        _msgs: [
            "The portrait eyes follow you. Every one. Simultaneously.",
            "One portrait has no face. It gains one as you watch. It is your face.",
            "The portraits are weeping. Silently. The tears are black.",
            "Every portrait in the gallery has been turned to face the wall. When you turn them back — they are all portraits of the same woman. She is screaming.",
            "The oldest portrait in the house blinks.",
        ],
        _i: 0,
        action() {
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(5 + _EV.loop());
            _EV.sound("ghost");
        }
    },

    // ── HIGH-LOOP RARE EVENTS ─────────────────────────────────────

    {
        id: "house_speaks",
        weight: 2, minLoop: 6, cooldown: 1800, rooms: null,
        _lines: [
            ["THE HOUSE", "You keep coming back."],
            ["THE HOUSE", "We like that you keep coming back."],
            ["THE HOUSE", "You may not leave. But you already knew that."],
            ["THE HOUSE", "You are part of us now. Like Eleanora. Like the others."],
            ["THE HOUSE", "There are no others anymore. Only you. Only us."],
        ],
        _i: 0,
        action() {
            const [spk, txt] = this._lines[this._i % this._lines.length];
            this._i++;
            _EV.dialog(spk, txt);
            _EV.drainSanity(18);
            _EV.sound("scare");
            _EV.shake(15, 45);
            _EV.cam("scareZoom", 0.09);
            for (let i = 0; i < 20; i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 200,
                    _EV.py() + (Math.random() - 0.5) * 200, 3
                );
            }
        }
    },

    {
        id: "other_player",
        weight: 2, minLoop: 7, cooldown: 2000, rooms: null,
        _lines: [
            ["NARRATOR", "You see footprints in the dust ahead. Fresh. Someone was here moments ago."],
            ["NARRATOR", "You find an item you haven't picked up yet sitting in an open location. It wasn't there before."],
            ["STRANGER", "Don't go to the ritual chamber. I tried. It doesn't work. Nothing works."],
            ["NARRATOR", "A figure ahead turns a corner. You follow. The corridor is empty. But it is warm where they stood."],
            ["STRANGER", "Loop eight. I'm on loop eight. If you find a letter in the library — it's from me. Read it."],
        ],
        _i: 0,
        action() {
            const [spk, txt] = this._lines[this._i % this._lines.length];
            this._i++;
            _EV.dialog(spk, txt);
            if (this._i === 3) _EV.clue("A stranger is trapped in the loops with you — or was.");
            _EV.drainSanity(5);
            _EV.sound("whisper");
            _EV.spirit(
                _EV.px() + (Math.random() - 0.5) * 100,
                _EV.py() - 20, 4, { r: 150, g: 150, b: 200 }
            );
        }
    },

    {
        id: "sanity_vision",
        weight: 2, minLoop: 5, cooldown: 1200,
        rooms: null,
        _msgs: [
            "The walls breathe. Visibly. In and out. You can see it clearly.",
            "The floor is not there. You look down: void. But your feet find purchase on something.",
            "Every shadow in the room peels itself off the wall and stands upright. They watch you.",
            "The room extends infinitely in one direction. You take 10 steps. Look back. The door is at normal distance.",
            "You see your body from outside it. Standing still. Looking terrified. Then you are back inside it.",
        ],
        _i: 0,
        action() {
            const g = _EV.game();
            if (!g) return;
            // Only fires at very low sanity
            if ((g.sanity ?? 100) > 25) return;
            const msg = this._msgs[this._i % this._msgs.length];
            this._i++;
            _EV.dialog("NARRATOR", msg);
            _EV.drainSanity(15);
            _EV.sound("scare");
            _EV.cam("scareZoom", 0.10);
            _EV.shake(18, 50);
            for (let i = 0; i < 20; i++) {
                _EV.spirit(
                    _EV.px() + (Math.random() - 0.5) * 250,
                    _EV.py() + (Math.random() - 0.5) * 250,
                    2, { r: 0, g: 0, b: 0 }
                );
            }
        }
    },
];

// ═════════════════════════════════════════════════════════════════
//  EVENT SCHEDULER
// ═════════════════════════════════════════════════════════════════
const eventCooldowns    = {};
let _eventTick          = 0;
let _lastEventTick      = 0;
let _scareRecoveryUntil = 0;  // quiet period after intense scare

const MIN_EVENT_INTERVAL = 300;
const BASE_EVENT_CHANCE  = 0.002;
const SCARE_RECOVERY     = 480; // ticks of calm after a big scare

function updateRandomEvents() {
    if (typeof game        === "undefined") return;
    if (typeof dialogActive !== "undefined" && dialogActive) return;
    if (typeof journalOpen  !== "undefined" && journalOpen)  return;
    if (typeof transitionState !== "undefined" && transitionState !== "none") return;

    _eventTick++;

    if (_eventTick < _scareRecoveryUntil)            return;
    if (_eventTick - _lastEventTick < MIN_EVENT_INTERVAL) return;

    const g          = _EV.game();
    const sanityMult = 1 + (1 - _EV.sanityRatio()) * 2.5;
    const loopMult   = 1 + (g?.loop ?? 0) * 0.35;
    const chance     = BASE_EVENT_CHANCE * sanityMult * loopMult;

    if (Math.random() > chance) return;

    const loop = _EV.loop();

    const eligible = SCARE_EVENTS.filter(e => {
        if (loop < e.minLoop) return false;
        if (e.rooms && !e.rooms.includes(g?.currentRoom)) return false;
        const cd = eventCooldowns[e.id];
        if (cd && _eventTick - cd < e.cooldown) return false;
        return true;
    });

    if (eligible.length === 0) return;

    const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
    let roll          = Math.random() * totalWeight;
    let selected      = eligible[0];
    for (const e of eligible) {
        roll -= e.weight;
        if (roll <= 0) { selected = e; break; }
    }

    const room = (typeof ROOMS !== "undefined") ? ROOMS[g?.currentRoom] : null;
    try { selected.action(room); } catch(_) {}

    eventCooldowns[selected.id] = _eventTick;
    _lastEventTick              = _eventTick;

    // Intense events trigger a quiet recovery period
    if (selected.weight <= 4 || (g?.loop ?? 0) >= 4) {
        _scareRecoveryUntil = _eventTick + SCARE_RECOVERY;
    }
}

// ═════════════════════════════════════════════════════════════════
//  STORY EVENTS — scripted, once-per-loop or once-ever
// ═════════════════════════════════════════════════════════════════
const STORY_EVENTS = [

    {
        id: "first_minute_warning",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loopTime > 60 && g.loopTime < 65 && g.loop === 0;
        },
        once: true,
        action: () => {
            _EV.dialog("NARRATOR", "One minute has passed. You feel a subtle pressure. The house is aware of you now.");
        }
    },

    {
        id: "loop1_awakening",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop === 1 && g.loopTime > 10 && g.loopTime < 15;
        },
        once: true,
        action: () => {
            _EV.dialog("NARRATOR", "The loop resets. But you remember. That is new. That has not happened before.");
            setTimeout(() => {
                _EV.dialog("ELEANORA", "You remember. Good. Hold onto that. Memory is the only weapon that survives the reset.");
            }, 3000);
            _EV.sound("ghost");
            _EV.spirit(_EV.px(), _EV.py() - 50, 8, { r: 100, g: 180, b: 255 });
        }
    },

    {
        id: "halfway_warning",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            const half = g.maxLoopTime / 2;
            return g.loopTime > half && g.loopTime < half + 5;
        },
        once: true,
        action: () => {
            _EV.dialog("NARRATOR", "Halfway. The air grows heavier. Shadows deepen. Something is counting down with you.");
            _EV.sound("clock");
            _EV.shake(3, 10);
        }
    },

    {
        id: "one_minute_left",
        condition: () => {
            const left = _EV.timeLeft();
            return left < 60 && left > 55;
        },
        once: true,
        action: () => {
            _EV.dialog("⏰ WARNING", "ONE MINUTE REMAINING. The walls pulse. The clock ticks louder. FIND SHELTER.");
            _EV.sound("heartbeat");
            _EV.shake(3, 60);
        }
    },

    {
        id: "thirty_seconds",
        condition: () => {
            const left = _EV.timeLeft();
            return left < 30 && left > 25;
        },
        once: true,
        action: () => {
            _EV.dialog("⏰", "Thirty seconds. The house tightens around you.");
            _EV.sound("clock");
            _EV.shake(6, 30);
            _EV.cam("scareZoom", 0.04);
        }
    },

    {
        id: "ten_seconds",
        condition: () => {
            const left = _EV.timeLeft();
            return left < 10 && left > 5;
        },
        once: true,
        action: () => {
            _EV.dialog("⏰", "10... 9... 8...");
            _EV.shake(8, 60);
            _EV.cam("scareZoom", 0.06);
        }
    },

    {
        id: "loop2_basement_rumble",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop >= 2 &&
                   g.currentRoom === "foyer" &&
                   g.loopTime > 30 && g.loopTime < 35 &&
                   !g.permanentFlags?.basementUnlocked;
        },
        once: true,
        action: () => {
            _EV.dialog("NARRATOR", "The floor trembles. Something MASSIVE moves beneath the house. You need to find a way down.");
            _EV.shake(6, 30);
            _EV.sound("scare");
        }
    },

    {
        id: "loop3_entity_speaks",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop >= 3 && g.loopTime > 120 && g.loopTime < 125;
        },
        once: true,
        action: () => {
            _EV.dialog("AZATHIEL", "Each loop you grow stronger. So do I. We are connected now, you and I. Will you free me... or cage me forever?");
            _EV.drainSanity(10);
            _EV.sound("ghost");
            _EV.shake(8, 20);
        }
    },

    {
        id: "loop4_azathiel_offer",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop >= 4 && g.loopTime > 60 && g.loopTime < 65;
        },
        once: true,
        action: () => {
            _EV.dialog("AZATHIEL", "Seal me and you escape. Or join me and the loop ends differently. I will show you a third door. Think about it.");
            _EV.drainSanity(8);
            _EV.sound("scare");
            _EV.clue("Azathiel mentioned a third door. What does that mean?");
        }
    },

    {
        id: "loop5_eleanora_fading",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop >= 5 && g.loopTime > 20 && g.loopTime < 25;
        },
        once: true,
        action: () => {
            _EV.dialog("ELEANORA", "I am... less than I was. Each loop costs me something. I may not be here much longer. Please. The ritual chamber. Before I am gone entirely.");
            _EV.sound("ghost");
            _EV.spirit(_EV.px(), _EV.py() - 40, 4, { r: 100, g: 180, b: 255 });
        }
    },

    {
        id: "eleanora_guidance",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return g.loop >= 2 &&
                   _EV.seals() >= 2 && _EV.seals() < 5 &&
                   g.loopTime > 90 && g.loopTime < 95;
        },
        once: true,
        action: () => {
            _EV.dialog("ELEANORA", "You're finding the seals. Good. But remember — do not break them. Restore them. Use my locket. Love is the key.");
            _EV.restoreSanity(5);
            _EV.sound("ghost");
            _EV.spirit(_EV.px(), _EV.py() - 50, 10, { r: 100, g: 180, b: 255 });
        }
    },

    {
        id: "all_seals_celebration",
        condition: () => {
            const g = _EV.game(); if (!g) return false;
            return _EV.seals() >= 5 && !g.permanentFlags?.allSealsEvent;
        },
        once: false, // fires each loop once all seals found
        action: () => {
            const g = _EV.game(); if (!g) return;
            g.permanentFlags.allSealsEvent = true;
            _EV.dialog("NARRATOR", "You feel a surge of power. All five seal fragments resonate. The house trembles. Both the Entity and Eleanora react — one with hunger, one with hope.");
            _EV.sound("unlock");
            _EV.shake(10, 40);
            _EV.sparks(_EV.px(), _EV.py(), 20);
            _EV.xp(50);
        }
    },

    {
        id: "combat_first_encounter",
        condition: () => {
            if (typeof combat === "undefined" || !combat) return false;
            const g = _EV.game(); if (!g) return false;
            return combat.active && g.loop === 0 && !g.flags?.firstCombatSeen;
        },
        once: true,
        action: () => {
            const g = _EV.game(); if (!g) return;
            g.flags = g.flags || {};
            g.flags.firstCombatSeen = true;
            _EV.subtitle("SYSTEM", "Press Q to attack. SHIFT to dodge.", 240);
        }
    },

    {
        id: "seal_first_found",
        condition: () => {
            return _EV.seals() === 1;
        },
        once: true,
        action: () => {
            _EV.dialog("ELEANORA", "The first seal. Yes. Four more. Each one in a place that mattered to me. Find them.");
            _EV.sound("seal_found");
            _EV.xp(20);
        }
    },

    {
        id: "low_sanity_vision_threshold",
        condition: () => {
            return _EV.sanityRatio() < 0.15;
        },
        once: true,
        action: () => {
            _EV.dialog("NARRATOR", "Your mind begins to fracture. Reality is losing its edges. You cannot trust what you see.");
            _EV.sound("scare");
            _EV.shake(10, 30);
            _EV.cam("scareZoom", 0.07);
        }
    },
];

const firedStoryEvents    = new Set();
let   _pendingStoryEvent  = null;

function updateStoryEvents() {
    if (typeof game === "undefined") return;

    // Flush a pending event if dialog just cleared
    if (_pendingStoryEvent &&
        (typeof dialogActive === "undefined" || !dialogActive)) {
        const e = _pendingStoryEvent;
        _pendingStoryEvent = null;
        try { e.action(); } catch(_) {}
        if (e.once) firedStoryEvents.add(e.id);
        return;
    }

    if (typeof dialogActive !== "undefined" && dialogActive) return;

    for (const e of STORY_EVENTS) {
        if (e.once && firedStoryEvents.has(e.id)) continue;
        try {
            if (e.condition()) {
                if (typeof dialogActive !== "undefined" && dialogActive) {
                    if (!_pendingStoryEvent) _pendingStoryEvent = e;
                } else {
                    e.action();
                    if (e.once) firedStoryEvents.add(e.id);
                }
                break; // one story event per frame max
            }
        } catch(_) {}
    }
}

// ═════════════════════════════════════════════════════════════════
//  ENTITY PRESENCE SYSTEM
// ═════════════════════════════════════════════════════════════════
let entityPresence = 0;
let _entityTick    = 0;

const ENTITY_ROOMS = [
    "basement","ritual_chamber","void_chamber",
    "catacombs","underground_lake","coal_room",
];

function updateEntityPresence() {
    if (typeof game === "undefined") return;

    _entityTick++;

    const g      = _EV.game();
    const loop   = _EV.loop();
    const sanity = _EV.sanityRatio();

    const target = Math.min(1, loop * 0.12 + (1 - sanity) * 0.5);
    entityPresence += (target - entityPresence) * 0.008;
    entityPresence  = Math.max(0, Math.min(1, entityPresence));

    if (ENTITY_ROOMS.includes(g?.currentRoom)) {

        // Tendrils at medium-high presence
        if (entityPresence > 0.3 && _entityTick % 60 === 0) {
            const room = (typeof ROOMS !== "undefined") ? ROOMS[g.currentRoom] : null;
            if (room) {
                _EV.tendril(Math.random() * room.width, Math.random() * room.height, 1);
            }
        }

        // Sanity drain at high presence
        if (entityPresence > 0.6 && _entityTick % 120 === 0) {
            _EV.drainSanity(0.5 + entityPresence);
        }

        // Full presence — intense effects
        if (entityPresence > 0.85 && _entityTick % 180 === 0) {
            _EV.cam("scareZoom", 0.04);
            _EV.shake(5, 15);
            for (let i = 0; i < 8; i++) {
                _EV.tendril(
                    _EV.px() + (Math.random() - 0.5) * 120,
                    _EV.py() + (Math.random() - 0.5) * 120, 2
                );
            }
        }
    }
}

// ═════════════════════════════════════════════════════════════════
//  HEARTBEAT SYSTEM
// ═════════════════════════════════════════════════════════════════
let heartbeatInterval = 0;

function updateHeartbeat() {
    if (typeof game === "undefined") return;

    // Defer to AudioWiring if active — prevents double heartbeat
    if (typeof AudioWiring !== "undefined" && AudioWiring._tick > 0) return;

    const ratio = _EV.sanityRatio();
    const target = ratio > 0.6  ? 0
                 : ratio > 0.4  ? 180
                 : ratio > 0.2  ? 90
                 :                45;

    if (target > 0) {
        heartbeatInterval++;
        if (heartbeatInterval >= target) {
            heartbeatInterval = 0;
            _EV.sound("heartbeat");
        }
    } else {
        heartbeatInterval = 0;
    }
}

// ═════════════════════════════════════════════════════════════════
//  MASTER UPDATE
// ═════════════════════════════════════════════════════════════════
function updateEvents() {
    try { updateRandomEvents();    } catch(_) {}
    try { updateStoryEvents();     } catch(_) {}
    try { updateEntityPresence();  } catch(_) {}
    try { updateHeartbeat();       } catch(_) {}
}

// ═════════════════════════════════════════════════════════════════
//  RESET — per loop
// ═════════════════════════════════════════════════════════════════
function resetEventState() {
    firedStoryEvents.clear();
    heartbeatInterval    = 0;
    _pendingStoryEvent   = null;
    _lastEventTick       = _eventTick;
    _scareRecoveryUntil  = _eventTick + 300; // grace period at loop start

    // Reset staged/indexed events so escalation restarts each loop
    for (const e of SCARE_EVENTS) {
        if (typeof e._stage !== "undefined") e._stage = 0;
        if (typeof e._i     !== "undefined") e._i     = 0;
    }

    // Push cooldowns forward so no burst on frame 1
    for (const id of Object.keys(eventCooldowns)) {
        eventCooldowns[id] = _eventTick;
    }

    // Nudge entity tick past a modulo boundary
    _entityTick = Math.ceil(_entityTick / 120) * 120 + 1;

    // entityPresence persists — intentional
}

// ═════════════════════════════════════════════════════════════════
//  FULL RESET — new game only (not loop reset)
// ═════════════════════════════════════════════════════════════════
function fullResetEventState() {
    resetEventState();
    entityPresence = 0;
    _entityTick    = 0;
    _eventTick     = 0;
    _lastEventTick = 0;
    for (const id of Object.keys(eventCooldowns)) {
        delete eventCooldowns[id];
    }
    for (const e of SCARE_EVENTS) {
        if (typeof e._stage !== "undefined") e._stage = 0;
        if (typeof e._i     !== "undefined") e._i     = 0;
    }
}