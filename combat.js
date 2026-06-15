// ═════════════════════════════════════════════════════════════════
//  COMBAT.JS — Combat Engine
//  Enemies, weapons, dodge, boss fights, damage system
//  Load BEFORE game.js
// ═════════════════════════════════════════════════════════════════

// ─── COMBAT STATE ───────────────────────────────────────────────
const combat = {
    active: false,
    enemies: [],
    projectiles: [],
    playerHP: 100,
    maxHP: 100,
    playerDamageFlash: 0,
    dodgeCooldown: 0,
    dodgeActive: false,
    dodgeTimer: 0,
    dodgeDir: { x: 0, y: 0 },
    attackCooldown: 0,
    comboCount: 0,
    comboTimer: 0,
    equippedWeapon: "fists",
    bossActive: null,
    killCount: 0,
    totalKills: 0,
    waveNumber: 0,
    waveTimer: 0,
    invincibleTimer: 0,
};

// ─── WEAPON DEFINITIONS ─────────────────────────────────────────
const WEAPONS = {
    fists: {
        name: "Fists",
        icon: "👊",
        damage: 8,
        range: 35,
        cooldown: 20,
        knockback: 3,
        type: "melee",
        description: "Your bare hands. Desperate but effective.",
    },
    crucifix_weapon: {
        name: "Holy Crucifix",
        icon: "✝️",
        damage: 25,
        range: 50,
        cooldown: 30,
        knockback: 8,
        type: "melee",
        description: "Burns unholy creatures. Extra damage to Entity spawns.",
        bonusVsUndead: 2.0,
    },
    candelabra: {
        name: "Candelabra",
        icon: "🕯️",
        damage: 15,
        range: 45,
        cooldown: 25,
        knockback: 5,
        type: "melee",
        description: "Heavy brass. Good reach.",
    },
    fire_poker: {
        name: "Fire Poker",
        icon: "🔥",
        damage: 18,
        range: 55,
        cooldown: 28,
        knockback: 6,
        type: "melee",
        description: "Iron poker from the fireplace. Strong and long.",
    },
    holy_water: {
        name: "Holy Water",
        icon: "💧",
        damage: 30,
        range: 120,
        cooldown: 60,
        knockback: 2,
        type: "ranged",
        projectileSpeed: 5,
        description: "Splash damage. Burns the unholy.",
        bonusVsUndead: 2.5,
        ammo: 5,
        maxAmmo: 5,
    },
    salt_circle: {
        name: "Salt",
        icon: "⚪",
        damage: 0,
        range: 60,
        cooldown: 90,
        knockback: 0,
        type: "trap",
        duration: 300,
        description: "Creates a protective circle. Enemies cannot enter.",
    },
    seal_blast: {
        name: "Seal Blast",
        icon: "🔮",
        damage: 50,
        range: 150,
        cooldown: 120,
        knockback: 15,
        type: "ranged",
        projectileSpeed: 7,
        description: "Channel seal energy. Devastating but slow.",
        requiresSeals: 3,
    },
};

// ─── ENEMY DEFINITIONS ─────────────────────────────────────────
const ENEMY_TYPES = {
    shadow: {
        name: "Shadow",
        hp: 30,
        speed: 1.2,
        damage: 8,
        attackRange: 30,
        attackCooldown: 60,
        xp: 15,
        color: { r: 30, g: 20, b: 50 },
        size: 12,
        behavior: "chase",
        undead: true,
    },
    wraith: {
        name: "Wraith",
        hp: 50,
        speed: 1.8,
        damage: 12,
        attackRange: 35,
        attackCooldown: 45,
        xp: 25,
        color: { r: 60, g: 40, b: 80 },
        size: 14,
        behavior: "flank",
        undead: true,
        phaseThrough: true,
    },
    poltergeist: {
        name: "Poltergeist",
        hp: 25,
        speed: 0.8,
        damage: 15,
        attackRange: 100,
        attackCooldown: 90,
        xp: 20,
        color: { r: 80, g: 80, b: 100 },
        size: 10,
        behavior: "ranged",
        undead: true,
        projectileSpeed: 3,
    },
    crawler: {
        name: "Crawler",
        hp: 40,
        speed: 2.2,
        damage: 10,
        attackRange: 25,
        attackCooldown: 30,
        xp: 20,
        color: { r: 50, g: 30, b: 20 },
        size: 10,
        behavior: "swarm",
        undead: false,
    },
    cursed_armor: {
        name: "Cursed Armor",
        hp: 100,
        speed: 0.6,
        damage: 20,
        attackRange: 40,
        attackCooldown: 60,
        xp: 40,
        color: { r: 60, g: 60, b: 70 },
        size: 18,
        behavior: "patrol",
        undead: false,
        armor: 5,
    },
    blood_wisp: {
        name: "Blood Wisp",
        hp: 20,
        speed: 2.5,
        damage: 5,
        attackRange: 20,
        attackCooldown: 20,
        xp: 10,
        color: { r: 150, g: 0, b: 0 },
        size: 8,
        behavior: "erratic",
        undead: true,
        healsOthers: true,
    },
    void_tendril: {
        name: "Void Tendril",
        hp: 60,
        speed: 0.5,
        damage: 18,
        attackRange: 80,
        attackCooldown: 50,
        xp: 30,
        color: { r: 20, g: 0, b: 40 },
        size: 16,
        behavior: "anchor",
        undead: true,
        pullStrength: 0.5,
    },
};

// ─── BOSS DEFINITIONS ───────────────────────────────────────────
const BOSSES = {
    victor_shade: {
        name: "Victor's Shade",
        hp: 500,
        maxHP: 500,
        speed: 1.0,
        damage: 25,
        attackRange: 60,
        attackCooldown: 40,
        xp: 200,
        color: { r: 80, g: 20, b: 20 },
        size: 25,
        undead: true,
        phases: [
            { hpThreshold: 1.0, behavior: "chase", spawnType: "shadow", spawnRate: 300 },
            { hpThreshold: 0.6, behavior: "teleport", spawnType: "wraith", spawnRate: 200, attackSpeed: 1.5 },
            { hpThreshold: 0.3, behavior: "rage", spawnType: "blood_wisp", spawnRate: 120, attackSpeed: 2.0, damage: 35 },
        ],
        dialog: {
            intro: "Victor materializes, eyes burning red. 'You dare disturb my work?!'",
            phase2: "Victor screams. His form destabilizes. 'I WAS SO CLOSE TO FREEDOM!'",
            phase3: "Victor's shade splits and reforms. 'IF I CANNOT BE FREE, NEITHER CAN YOU!'",
            defeat: "Victor's shade dissolves. 'Eleanora... forgive me...'",
        },
        drops: ["fire_poker"],
        room: "study",
    },
    entity_fragment: {
        name: "Azathiel Fragment",
        hp: 800,
        maxHP: 800,
        speed: 0.7,
        damage: 35,
        attackRange: 100,
        attackCooldown: 30,
        xp: 400,
        color: { r: 40, g: 0, b: 60 },
        size: 35,
        undead: true,
        phases: [
            { hpThreshold: 1.0, behavior: "anchor", spawnType: "void_tendril", spawnRate: 250, pullStrength: 0.3 },
            { hpThreshold: 0.5, behavior: "pulse", spawnType: "shadow", spawnRate: 150, aoeRadius: 120, aoeDamage: 15 },
            { hpThreshold: 0.2, behavior: "consume", spawnType: "crawler", spawnRate: 90, drainRate: 0.5 },
        ],
        dialog: {
            intro: "A piece of Azathiel tears free from the binding. It has no face, only hunger.",
            phase2: "The fragment PULSES. Dark energy ripples outward. Reality bends.",
            phase3: "The fragment screams without sound. It tries to consume everything.",
            defeat: "The fragment shatters into motes of dark light. But the Entity still lives...",
        },
        drops: ["holy_water"],
        room: "ritual_chamber",
    },
    guardian: {
        name: "Eleanora's Guardian",
        hp: 600,
        maxHP: 600,
        speed: 1.2,
        damage: 15,
        attackRange: 50,
        attackCooldown: 50,
        xp: 300,
        color: { r: 50, g: 100, b: 150 },
        size: 28,
        undead: true,
        phases: [
            { hpThreshold: 1.0, behavior: "test", spawnType: null, spawnRate: 0 },
            { hpThreshold: 0.5, behavior: "challenge", spawnType: "cursed_armor", spawnRate: 300 },
            { hpThreshold: 0.2, behavior: "accept", spawnType: null, spawnRate: 0, peaceful: true },
        ],
        dialog: {
            intro: "A shining figure blocks your path. 'Prove your worth to wield the seals.'",
            phase2: "The guardian nods. 'Your strength grows. But can you show mercy?'",
            phase3: "The guardian lowers its weapon. 'You have proven yourself. Take what you need.'",
            defeat: "The guardian bows. 'Eleanora chose wisely. You are the one.'",
        },
        drops: ["seal_blast_scroll"],
        room: "void_chamber",
    },
};

// ─── ENEMY CLASS ────────────────────────────────────────────────
class Enemy {
    constructor(type, x, y) {
        const def = ENEMY_TYPES[type];
        this.type = type;
        this.x = x;
        this.y = y;
        this.hp = def.hp;
        this.maxHP = def.hp;
        this.speed = def.speed;
        this.damage = def.damage;
        this.attackRange = def.attackRange;
        this.attackCooldown = def.attackCooldown;
        this.currentCooldown = 0;
        this.xp = def.xp;
        this.color = { ...def.color };
        this.size = def.size;
        this.behavior = def.behavior;
        this.undead = def.undead || false;
        this.armor = def.armor || 0;
        this.phaseThrough = def.phaseThrough || false;
        this.pullStrength = def.pullStrength || 0;
        this.healsOthers = def.healsOthers || false;
        this.projectileSpeed = def.projectileSpeed || 0;
        this.alive = true;
        this.damageFlash = 0;
        this.angle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.spawnAnim = 30;
        this.deathAnim = 0;
        this.stunTimer = 0;
    }

    update(playerX, playerY, room, allEnemies) {
        if (!this.alive) {
            this.deathAnim--;
            return this.deathAnim > 0;
        }

        if (this.spawnAnim > 0) { this.spawnAnim--; return true; }
        if (this.stunTimer > 0) { this.stunTimer--; return true; }
        if (this.damageFlash > 0) this.damageFlash--;
        if (this.currentCooldown > 0) this.currentCooldown--;

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);
        const toPlayer = { x: dx / (dist || 1), y: dy / (dist || 1) };

        switch (this.behavior) {
            case "chase":
                this.moveToward(toPlayer, this.speed, room);
                break;
            case "flank":
                const flankAngle = Math.atan2(dy, dx) + (Math.sin(frame * 0.02) > 0 ? 0.8 : -0.8);
                this.moveToward({
                    x: Math.cos(flankAngle),
                    y: Math.sin(flankAngle)
                }, this.speed, room);
                break;
            case "ranged":
                if (dist > 80) {
                    this.moveToward(toPlayer, this.speed * 0.5, room);
                } else if (dist < 60) {
                    this.moveToward({ x: -toPlayer.x, y: -toPlayer.y }, this.speed * 0.7, room);
                }
                if (this.currentCooldown <= 0 && dist < this.attackRange * 1.5) {
                    this.shootProjectile(toPlayer);
                    this.currentCooldown = this.attackCooldown;
                }
                break;
            case "swarm":
                // Move toward player but also toward other swarm members
                let avgX = playerX, avgY = playerY, count = 1;
                for (let e of allEnemies) {
                    if (e !== this && e.alive && e.behavior === "swarm" && Math.hypot(e.x - this.x, e.y - this.y) < 80) {
                        avgX += e.x; avgY += e.y; count++;
                    }
                }
                avgX /= count; avgY /= count;
                const swarmDir = { x: (avgX - this.x), y: (avgY - this.y) };
                const swarmDist = Math.hypot(swarmDir.x, swarmDir.y) || 1;
                this.moveToward({
                    x: swarmDir.x / swarmDist * 0.6 + toPlayer.x * 0.4,
                    y: swarmDir.y / swarmDist * 0.6 + toPlayer.y * 0.4
                }, this.speed, room);
                break;
            case "patrol":
                this.wanderTimer++;
                if (this.wanderTimer > 120) {
                    this.wanderAngle = Math.random() * Math.PI * 2;
                    this.wanderTimer = 0;
                }
                if (dist < 120) {
                    this.moveToward(toPlayer, this.speed, room);
                } else {
                    this.moveToward({
                        x: Math.cos(this.wanderAngle),
                        y: Math.sin(this.wanderAngle)
                    }, this.speed * 0.5, room);
                }
                break;
            case "erratic":
                if (frame % 30 === 0) this.wanderAngle = Math.random() * Math.PI * 2;
                const erDir = dist < 60 ? toPlayer : {
                    x: Math.cos(this.wanderAngle),
                    y: Math.sin(this.wanderAngle)
                };
                this.moveToward(erDir, this.speed, room);
                // Heal nearby
                if (this.healsOthers && frame % 60 === 0) {
                    for (let e of allEnemies) {
                        if (e !== this && e.alive && Math.hypot(e.x - this.x, e.y - this.y) < 50) {
                            e.hp = Math.min(e.maxHP, e.hp + 5);
                        }
                    }
                }
                break;
            case "anchor":
                // Doesn't move much but pulls player
                if (dist < 120 && this.pullStrength) {
                    // Pull effect handled in combat update
                }
                this.wanderTimer++;
                if (this.wanderTimer > 200) {
                    this.x += (Math.random() - 0.5) * 20;
                    this.y += (Math.random() - 0.5) * 20;
                    this.wanderTimer = 0;
                }
                break;
        }

        // Melee attack
        if (dist < this.attackRange && this.currentCooldown <= 0 && this.behavior !== "ranged") {
            this.currentCooldown = this.attackCooldown;
            return { attack: true, damage: this.damage };
        }

        this.angle = Math.atan2(dy, dx);
        return true;
    }

    moveToward(dir, speed, room) {
        const nx = this.x + dir.x * speed;
        const ny = this.y + dir.y * speed;

        if (!this.phaseThrough && room) {
            const passTypes = ["rug", "runner_rug", "pentagram", "candle_circle", "bones", "fence"];
            for (let f of room.furniture) {
                if (passTypes.includes(f.type)) continue;
                const hw = f.w / 2 + this.size;
                const hh = f.h / 2 + this.size;
                if (nx > f.x - hw && nx < f.x + hw && ny > f.y - hh && ny < f.y + hh) {
                    return;
                }
            }
        }

        if (room) {
            this.x = Math.max(this.size, Math.min(room.width - this.size, nx));
            this.y = Math.max(this.size, Math.min(room.height - this.size, ny));
        } else {
            this.x = nx;
            this.y = ny;
        }
    }

    shootProjectile(dir) {
        combat.projectiles.push({
            x: this.x,
            y: this.y,
            vx: dir.x * (this.projectileSpeed || 3),
            vy: dir.y * (this.projectileSpeed || 3),
            damage: this.damage,
            fromEnemy: true,
            life: 120,
            size: 4,
            color: this.color,
        });
    }

    takeDamage(amount, knockDir, knockForce) {
        const actualDmg = Math.max(1, amount - this.armor);
        this.hp -= actualDmg;
        this.damageFlash = 8;
        this.stunTimer = 5;

        if (knockDir && knockForce) {
            this.x += knockDir.x * knockForce;
            this.y += knockDir.y * knockForce;
        }

        if (this.hp <= 0) {
            this.alive = false;
            this.deathAnim = 30;
            combat.killCount++;
            combat.totalKills++;
            if (typeof giveXP === "function") giveXP(this.xp);
            if (typeof emitSpirit === "function") {
                emitSpirit(this.x, this.y, 5, this.color);
            }
            if (typeof playSound === "function") playSound("ghost");
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (this.spawnAnim > 0) {
            const progress = 1 - this.spawnAnim / 30;
            ctx.globalAlpha = progress * 0.5;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.scale(progress, progress);
            ctx.fillStyle = `rgb(${this.color.r},${this.color.g},${this.color.b})`;
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            return;
        }

        if (!this.alive) {
            const progress = this.deathAnim / 30;
            ctx.globalAlpha = progress * 0.6;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.scale(1 + (1 - progress) * 0.5, 1 + (1 - progress) * 0.5);
            ctx.fillStyle = `rgb(${this.color.r},${this.color.g},${this.color.b})`;
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(0, this.size * 0.8, this.size * 0.7, this.size * 0.3, 0, 0, Math.PI * 2); ctx.fill();

        // Body
        const flashMod = this.damageFlash > 0 ? 100 : 0;
        ctx.fillStyle = `rgb(${Math.min(255, this.color.r + flashMod)},${Math.min(255, this.color.g + flashMod)},${Math.min(255, this.color.b + flashMod)})`;
        const wobble = Math.sin(frame * 0.05 + this.x * 0.1) * 2;

        ctx.beginPath();
        ctx.ellipse(0, wobble, this.size, this.size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = this.undead ? "#ff3333" : "#ffaa00";
        const eyeX = Math.cos(this.angle) * this.size * 0.3;
        const eyeY = Math.sin(this.angle) * this.size * 0.3 + wobble - this.size * 0.3;
        ctx.beginPath(); ctx.arc(eyeX - 3, eyeY, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 3, eyeY, 2, 0, Math.PI * 2); ctx.fill();

        // HP bar
        if (this.hp < this.maxHP) {
            const barW = this.size * 2;
            const barH = 3;
            const barY = -this.size - 8;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(-barW / 2, barY, barW, barH);
            ctx.fillStyle = this.hp / this.maxHP > 0.5 ? "#4a4" : this.hp / this.maxHP > 0.25 ? "#aa4" : "#a44";
            ctx.fillRect(-barW / 2, barY, barW * (this.hp / this.maxHP), barH);
        }

        // Stunned indicator
        if (this.stunTimer > 0) {
            ctx.fillStyle = "#ffff00";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText("💫", 0, -this.size - 12);
        }

        ctx.restore();
    }
}

// ─── BOSS CLASS ─────────────────────────────────────────────────
class Boss {
    constructor(type) {
        const def = BOSSES[type];
        this.type = type;
        this.def = def;
        this.x = 0;
        this.y = 0;
        this.hp = def.hp;
        this.maxHP = def.maxHP;
        this.speed = def.speed;
        this.damage = def.damage;
        this.attackRange = def.attackRange;
        this.attackCooldown = def.attackCooldown;
        this.currentCooldown = 0;
        this.color = { ...def.color };
        this.size = def.size;
        this.undead = def.undead;
        this.alive = true;
        this.currentPhase = 0;
        this.phaseTriggered = [false, false, false];
        this.spawnTimer = 0;
        this.damageFlash = 0;
        this.angle = 0;
        this.teleportCooldown = 0;
        this.aoeTimer = 0;
    }

    getCurrentPhase() {
        const ratio = this.hp / this.maxHP;
        for (let i = this.def.phases.length - 1; i >= 0; i--) {
            if (ratio <= this.def.phases[i].hpThreshold) {
                return i;
            }
        }
        return 0;
    }

    update(playerX, playerY, room) {
        if (!this.alive) return false;
        if (this.damageFlash > 0) this.damageFlash--;
        if (this.currentCooldown > 0) this.currentCooldown--;
        if (this.teleportCooldown > 0) this.teleportCooldown--;

        const phaseIdx = this.getCurrentPhase();
        const phase = this.def.phases[phaseIdx];

        // Phase transition dialog
        if (phaseIdx !== this.currentPhase) {
            this.currentPhase = phaseIdx;
            if (phaseIdx === 1 && this.def.dialog.phase2) {
                showDialog("NARRATOR", this.def.dialog.phase2);
                if (typeof triggerShake === "function") triggerShake(10, 30);
            }
            if (phaseIdx === 2 && this.def.dialog.phase3) {
                showDialog("NARRATOR", this.def.dialog.phase3);
                if (typeof triggerShake === "function") triggerShake(15, 40);
            }
        }

        // Peaceful phase (guardian boss)
        if (phase.peaceful) {
            return true;
        }

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);
        const toPlayer = { x: dx / (dist || 1), y: dy / (dist || 1) };
        this.angle = Math.atan2(dy, dx);

        const speedMult = phase.attackSpeed || 1;

        switch (phase.behavior) {
            case "chase":
            case "test":
            case "challenge":
                if (dist > this.attackRange * 0.8) {
                    this.x += toPlayer.x * this.speed * speedMult;
                    this.y += toPlayer.y * this.speed * speedMult;
                }
                break;
            case "teleport":
                if (this.teleportCooldown <= 0 && dist > 100) {
                    // Teleport near player
                    const tAngle = Math.random() * Math.PI * 2;
                    this.x = playerX + Math.cos(tAngle) * 60;
                    this.y = playerY + Math.sin(tAngle) * 60;
                    this.teleportCooldown = 120;
                    if (typeof emitSparks === "function") emitSparks(this.x, this.y, 10);
                    if (typeof playSound === "function") playSound("scare");
                } else {
                    this.x += toPlayer.x * this.speed * speedMult * 0.5;
                    this.y += toPlayer.y * this.speed * speedMult * 0.5;
                }
                break;
            case "rage":
                this.x += toPlayer.x * this.speed * speedMult * 1.5;
                this.y += toPlayer.y * this.speed * speedMult * 1.5;
                break;
            case "anchor":
                // Pull player
                if (phase.pullStrength && dist < 150) {
                    // handled externally
                }
                break;
            case "pulse":
                this.aoeTimer++;
                if (this.aoeTimer >= 90) {
                    this.aoeTimer = 0;
                    if (dist < (phase.aoeRadius || 100)) {
                        return { attack: true, damage: phase.aoeDamage || 15, aoe: true };
                    }
                    if (typeof triggerShake === "function") triggerShake(5, 15);
                    if (typeof emitSparks === "function") emitSparks(this.x, this.y, 15);
                }
                break;
            case "consume":
                this.x += toPlayer.x * this.speed * 0.3;
                this.y += toPlayer.y * this.speed * 0.3;
                if (phase.drainRate && dist < 100) {
                    this.hp = Math.min(this.maxHP, this.hp + phase.drainRate);
                }
                break;
            case "accept":
                // Move away from player
                this.x -= toPlayer.x * this.speed * 0.3;
                this.y -= toPlayer.y * this.speed * 0.3;
                break;
        }

        // Spawn minions
        if (phase.spawnType && phase.spawnRate) {
            this.spawnTimer++;
            if (this.spawnTimer >= phase.spawnRate && combat.enemies.length < 8) {
                this.spawnTimer = 0;
                const sAngle = Math.random() * Math.PI * 2;
                const enemy = new Enemy(
                    phase.spawnType,
                    this.x + Math.cos(sAngle) * 40,
                    this.y + Math.sin(sAngle) * 40
                );
                combat.enemies.push(enemy);
            }
        }

        // Melee attack
        if (dist < this.attackRange && this.currentCooldown <= 0) {
            this.currentCooldown = Math.floor(this.attackCooldown / speedMult);
            return { attack: true, damage: phase.damage || this.damage };
        }

        // Keep in room bounds
        if (room) {
            this.x = Math.max(this.size + 20, Math.min(room.width - this.size - 20, this.x));
            this.y = Math.max(this.size + 20, Math.min(room.height - this.size - 20, this.y));
        }

        return true;
    }

    takeDamage(amount, knockDir) {
        const phase = this.def.phases[this.getCurrentPhase()];
        if (phase.peaceful) {
            // Taking damage in peaceful phase ends the fight
            this.alive = false;
            return true;
        }

        this.hp -= amount;
        this.damageFlash = 10;
        if (knockDir) {
            this.x += knockDir.x * 3;
            this.y += knockDir.y * 3;
        }

        if (this.hp <= 0) {
            this.alive = false;
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Aura
        const auraPulse = Math.sin(frame * 0.05) * 0.15 + 0.25;
        ctx.fillStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},${auraPulse})`;
        ctx.beginPath(); ctx.arc(0, 0, this.size * 2, 0, Math.PI * 2); ctx.fill();

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.ellipse(0, this.size, this.size * 0.9, this.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();

        // Body
        const flash = this.damageFlash > 0 ? 150 : 0;
        ctx.fillStyle = `rgb(${Math.min(255, this.color.r + flash)},${Math.min(255, this.color.g + flash)},${Math.min(255, this.color.b + flash)})`;
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();

        // Inner pattern
        ctx.strokeStyle = `rgba(255,255,255,0.1)`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const pa = (i / 5) * Math.PI * 2 + frame * 0.02;
            ctx.beginPath();
            ctx.arc(Math.cos(pa) * this.size * 0.4, Math.sin(pa) * this.size * 0.4, 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Eyes
        ctx.fillStyle = "#ff0000";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(-6, -6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, -6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Boss name + HP bar
        const barW = this.size * 3;
        const barH = 5;
        const barY = -this.size - 15;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(-barW / 2, barY, barW, barH);
        const hpRatio = this.hp / this.maxHP;
        ctx.fillStyle = hpRatio > 0.5 ? "#c44" : hpRatio > 0.25 ? "#ca4" : "#c22";
        ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText(this.def.name, 0, barY - 4);

        ctx.restore();
    }
}

// ─── COMBAT ROOM ENCOUNTERS ────────────────────────────────────
const ROOM_ENCOUNTERS = {
    basement: {
        minLoop: 2,
        minLevel: 3,
        enemies: [
            { type: "shadow", count: 2 },
            { type: "crawler", count: 1 },
        ],
        chance: 0.3,
        cooldown: 600,
    },
    ritual_chamber: {
        minLoop: 3,
        minLevel: 5,
        enemies: [
            { type: "void_tendril", count: 1 },
            { type: "shadow", count: 2 },
        ],
        chance: 0.4,
        cooldown: 500,
    },
    catacombs: {
        minLoop: 3,
        minLevel: 4,
        enemies: [
            { type: "wraith", count: 2 },
            { type: "blood_wisp", count: 1 },
        ],
        chance: 0.35,
        cooldown: 550,
    },
    void_chamber: {
        minLoop: 4,
        minLevel: 6,
        enemies: [
            { type: "void_tendril", count: 2 },
            { type: "poltergeist", count: 1 },
            { type: "shadow", count: 2 },
        ],
        chance: 0.5,
        cooldown: 400,
    },
    underground_lake: {
        minLoop: 4,
        minLevel: 5,
        enemies: [
            { type: "wraith", count: 2 },
            { type: "crawler", count: 3 },
        ],
        chance: 0.3,
        cooldown: 600,
    },
    attic: {
        minLoop: 2,
        minLevel: 3,
        enemies: [
            { type: "poltergeist", count: 2 },
        ],
        chance: 0.25,
        cooldown: 700,
    },
    upstairs_hall: {
        minLoop: 2,
        minLevel: 2,
        enemies: [
            { type: "shadow", count: 3 },
        ],
        chance: 0.2,
        cooldown: 800,
    },
    study: {
        minLoop: 3,
        minLevel: 4,
        enemies: [
            { type: "cursed_armor", count: 1 },
            { type: "shadow", count: 1 },
        ],
        chance: 0.3,
        cooldown: 600,
    },
};

const encounterCooldowns = {};

// ─── SALT CIRCLE TRAPS ─────────────────────────────────────────
const saltCircles = [];

class SaltCircle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 60;
        this.life = 300;
        this.maxLife = 300;
    }

    update() {
        this.life--;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = Math.min(0.5, this.life / this.maxLife);
        ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rune marks
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + frame * 0.01;
            ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;
            ctx.font = "12px Georgia";
            ctx.textAlign = "center";
            ctx.fillText("✦", this.x + Math.cos(a) * this.radius, this.y + Math.sin(a) * this.radius);
        }
    }

    containsPoint(x, y) {
        return Math.hypot(x - this.x, y - this.y) < this.radius;
    }
}

// ─── MAIN COMBAT UPDATE ─────────────────────────────────────────
function updateCombat() {
    if (typeof game === "undefined" || typeof gameState === "undefined") return;
    if (gameState !== "playing") return;
    if (typeof dialogActive !== "undefined" && dialogActive) return;

    // Update cooldowns
    if (combat.dodgeCooldown > 0) combat.dodgeCooldown--;
    if (combat.attackCooldown > 0) combat.attackCooldown--;
    if (combat.comboTimer > 0) combat.comboTimer--;
    if (combat.invincibleTimer > 0) combat.invincibleTimer--;
    if (combat.playerDamageFlash > 0) combat.playerDamageFlash--;
    if (combat.comboTimer <= 0) combat.comboCount = 0;

    // Sync HP with game
    combat.maxHP = 80 + game.level * 10;
    if (combat.playerHP > combat.maxHP) combat.playerHP = combat.maxHP;

    const room = typeof getCurrentRoom === "function" ? getCurrentRoom() : null;

    // Check for random encounters on room enter
    checkEncounter();

    // Dodge mechanic (Shift key)
    if (combat.dodgeActive) {
        combat.dodgeTimer--;
        game.playerX += combat.dodgeDir.x * 8;
        game.playerY += combat.dodgeDir.y * 8;
        if (room) {
            game.playerX = Math.max(30, Math.min(room.width - 30, game.playerX));
            game.playerY = Math.max(30, Math.min(room.height - 30, game.playerY));
        }
        if (combat.dodgeTimer <= 0) {
            combat.dodgeActive = false;
        }
    }

    if (typeof keysJustPressed !== "undefined" && keysJustPressed["ShiftLeft"] && combat.dodgeCooldown <= 0 && !combat.dodgeActive) {
        const dx = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
        const dy = (keys["KeyS"] ? 1 : 0) - (keys["KeyW"] ? 1 : 0);
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            combat.dodgeDir = { x: dx / len, y: dy / len };
        } else {
            combat.dodgeDir = { x: Math.cos(game.playerAngle), y: Math.sin(game.playerAngle) };
        }
        combat.dodgeActive = true;
        combat.dodgeTimer = 8;
        combat.dodgeCooldown = 30;
        combat.invincibleTimer = 10;
        if (typeof emitDust === "function") emitDust(game.playerX, game.playerY, 5);
    }

    // Attack (Q key or left mouse click tracked via flag)
    if (typeof keysJustPressed !== "undefined" && keysJustPressed["KeyQ"] && combat.attackCooldown <= 0) {
        performAttack();
        keysJustPressed["KeyQ"] = false;
    }

    // Weapon switch (1-4 number keys when not in dialog choices)
    if (typeof keysJustPressed !== "undefined" && !dialogActive) {
        const weaponSlots = getAvailableWeapons();
        for (let i = 0; i < Math.min(4, weaponSlots.length); i++) {
            // Use numpad or hold Ctrl+number
            if (keysJustPressed[`Numpad${i + 1}`]) {
                combat.equippedWeapon = weaponSlots[i];
                if (typeof showDialog === "function") {
                    showDialog("SYSTEM", `Equipped: ${WEAPONS[weaponSlots[i]].icon} ${WEAPONS[weaponSlots[i]].name}`);
                }
                keysJustPressed[`Numpad${i + 1}`] = false;
            }
        }
    }

    // Update enemies
    for (let i = combat.enemies.length - 1; i >= 0; i--) {
        const enemy = combat.enemies[i];
        const result = enemy.update(game.playerX, game.playerY, room, combat.enemies);

        if (result === false) {
            combat.enemies.splice(i, 1);
            continue;
        }

        // Enemy attacked player
        if (result && typeof result === "object" && result.attack) {
            if (combat.invincibleTimer <= 0 && !combat.dodgeActive) {
                takeCombatDamage(result.damage);
            }
        }

        // Pull effect
        if (enemy.alive && enemy.pullStrength) {
            const dx = enemy.x - game.playerX;
            const dy = enemy.y - game.playerY;
            const dist = Math.hypot(dx, dy);
            if (dist < 150 && dist > 20) {
                game.playerX += (dx / dist) * enemy.pullStrength;
                game.playerY += (dy / dist) * enemy.pullStrength;
            }
        }

        // Salt circle repulsion
        for (let sc of saltCircles) {
            if (sc.containsPoint(enemy.x, enemy.y) && enemy.alive) {
                const sdx = enemy.x - sc.x;
                const sdy = enemy.y - sc.y;
                const sdist = Math.hypot(sdx, sdy) || 1;
                enemy.x += (sdx / sdist) * 3;
                enemy.y += (sdy / sdist) * 3;
            }
        }
    }

    // Update boss
    if (combat.bossActive) {
        const result = combat.bossActive.update(game.playerX, game.playerY, room);
        if (result === false || !combat.bossActive.alive) {
            onBossDefeated(combat.bossActive);
            combat.bossActive = null;
        } else if (result && typeof result === "object" && result.attack) {
            if (combat.invincibleTimer <= 0 && !combat.dodgeActive) {
                takeCombatDamage(result.damage);
            }
        }

        // Boss pull effect
        if (combat.bossActive) {
            const phase = combat.bossActive.def.phases[combat.bossActive.getCurrentPhase()];
            if (phase.pullStrength) {
                const dx = combat.bossActive.x - game.playerX;
                const dy = combat.bossActive.y - game.playerY;
                const dist = Math.hypot(dx, dy);
                if (dist < 150 && dist > 30) {
                    game.playerX += (dx / dist) * phase.pullStrength;
                    game.playerY += (dy / dist) * phase.pullStrength;
                }
            }
        }
    }

    // Update projectiles
    for (let i = combat.projectiles.length - 1; i >= 0; i--) {
        const p = combat.projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) { combat.projectiles.splice(i, 1); continue; }
        if (room && (p.x < 0 || p.x > room.width || p.y < 0 || p.y > room.height)) {
            combat.projectiles.splice(i, 1); continue;
        }

        if (p.fromEnemy) {
            // Hit player?
            if (Math.hypot(p.x - game.playerX, p.y - game.playerY) < 15 && combat.invincibleTimer <= 0 && !combat.dodgeActive) {
                takeCombatDamage(p.damage);
                combat.projectiles.splice(i, 1);
            }
        } else {
            // Hit enemy?
            for (let enemy of combat.enemies) {
                if (enemy.alive && Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.size + p.size) {
                    let dmg = p.damage;
                    if (p.bonusVsUndead && enemy.undead) dmg *= p.bonusVsUndead;
                    const dir = { x: p.vx / (Math.hypot(p.vx, p.vy) || 1), y: p.vy / (Math.hypot(p.vx, p.vy) || 1) };
                    enemy.takeDamage(dmg, dir, 5);
                    combat.projectiles.splice(i, 1);
                    break;
                }
            }
            // Hit boss?
            if (combat.bossActive && combat.bossActive.alive) {
                if (Math.hypot(p.x - combat.bossActive.x, p.y - combat.bossActive.y) < combat.bossActive.size + p.size) {
                    let dmg = p.damage;
                    if (p.bonusVsUndead && combat.bossActive.undead) dmg *= p.bonusVsUndead;
                    const dir = { x: p.vx / (Math.hypot(p.vx, p.vy) || 1), y: p.vy / (Math.hypot(p.vx, p.vy) || 1) };
                    combat.bossActive.takeDamage(dmg, dir);
                    combat.projectiles.splice(i, 1);
                }
            }
        }
    }

    // Update salt circles
    for (let i = saltCircles.length - 1; i >= 0; i--) {
        if (!saltCircles[i].update()) saltCircles.splice(i, 1);
    }

    // Combat active flag
    combat.active = combat.enemies.some(e => e.alive) || (combat.bossActive && combat.bossActive.alive);
}

function getAvailableWeapons() {
    const available = ["fists"];
    if (typeof hasItem === "function") {
        if (hasItem("crucifix")) available.push("crucifix_weapon");
        if (hasItem("fire_poker_item")) available.push("fire_poker");
    }
    if (typeof game !== "undefined") {
        if (game.flags.hasCandelabra) available.push("candelabra");
        if (game.permanentFlags.hasHolyWater) available.push("holy_water");
        if (countSeals() >= 3) available.push("seal_blast");
    }
    return available;
}

function performAttack() {
    const weapon = WEAPONS[combat.equippedWeapon] || WEAPONS.fists;
    combat.attackCooldown = weapon.cooldown;

    // Combo
    combat.comboCount++;
    combat.comboTimer = 45;
    const comboMult = 1 + (combat.comboCount - 1) * 0.15;

    if (typeof playSound === "function") playSound("step");

    if (weapon.type === "melee") {
        // Hit enemies in range
        const atkAngle = game.playerAngle;
        const atkRange = weapon.range;

        for (let enemy of combat.enemies) {
            if (!enemy.alive) continue;
            const dist = Math.hypot(enemy.x - game.playerX, enemy.y - game.playerY);
            if (dist > atkRange) continue;

            const angleToEnemy = Math.atan2(enemy.y - game.playerY, enemy.x - game.playerX);
            let angleDiff = Math.abs(angleToEnemy - atkAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff > 0.8) continue;

            let dmg = Math.floor(weapon.damage * comboMult);
            if (weapon.bonusVsUndead && enemy.undead) dmg = Math.floor(dmg * weapon.bonusVsUndead);

            const knockDir = { x: Math.cos(angleToEnemy), y: Math.sin(angleToEnemy) };
            enemy.takeDamage(dmg, knockDir, weapon.knockback);

            if (typeof emitSparks === "function") emitSparks(enemy.x, enemy.y, 3);
        }

        // Hit boss
        if (combat.bossActive && combat.bossActive.alive) {
            const dist = Math.hypot(combat.bossActive.x - game.playerX, combat.bossActive.y - game.playerY);
            if (dist <= atkRange) {
                let dmg = Math.floor(weapon.damage * comboMult);
                if (weapon.bonusVsUndead && combat.bossActive.undead) dmg = Math.floor(dmg * weapon.bonusVsUndead);
                const dir = { x: Math.cos(game.playerAngle), y: Math.sin(game.playerAngle) };
                combat.bossActive.takeDamage(dmg, dir);
                if (typeof emitSparks === "function") emitSparks(combat.bossActive.x, combat.bossActive.y, 5);
            }
        }

        // Visual swing
        if (typeof emitDust === "function") {
            emitDust(
                game.playerX + Math.cos(atkAngle) * 20,
                game.playerY + Math.sin(atkAngle) * 20,
                3
            );
        }
    } else if (weapon.type === "ranged") {
        if (weapon.ammo !== undefined && weapon.ammo <= 0) {
            if (typeof showDialog === "function") showDialog("SYSTEM", `${weapon.name} is out of ammo!`);
            return;
        }
        if (weapon.ammo !== undefined) weapon.ammo--;

        if (weapon.requiresSeals && typeof countSeals === "function" && countSeals() < weapon.requiresSeals) {
            if (typeof showDialog === "function") showDialog("SYSTEM", `Need ${weapon.requiresSeals} seals to use ${weapon.name}!`);
            return;
        }

        combat.projectiles.push({
            x: game.playerX,
            y: game.playerY,
            vx: Math.cos(game.playerAngle) * weapon.projectileSpeed,
            vy: Math.sin(game.playerAngle) * weapon.projectileSpeed,
            damage: Math.floor(weapon.damage * comboMult),
            fromEnemy: false,
            life: 90,
            size: 6,
            color: { r: 200, g: 200, b: 100 },
            bonusVsUndead: weapon.bonusVsUndead || 0,
        });
    } else if (weapon.type === "trap") {
        saltCircles.push(new SaltCircle(game.playerX, game.playerY));
        if (typeof showDialog === "function") showDialog("SYSTEM", "Salt circle placed!");
    }
}

function takeCombatDamage(amount) {
    const levelReduction = game.level * 0.5;
    const actual = Math.max(1, Math.floor(amount - levelReduction));
    combat.playerHP -= actual;
    combat.playerDamageFlash = 15;
    combat.invincibleTimer = 20;

    game.sanity -= actual * 0.3;

    if (typeof triggerShake === "function") triggerShake(actual * 0.5, 10);
    if (typeof playSound === "function") playSound("scare");
    if (typeof emitBlood === "function") emitBlood(game.playerX, game.playerY, 3);

    if (combat.playerHP <= 0) {
        combat.playerHP = 0;
        game.sanity -= 30;
        if (typeof showDialog === "function") {
            showDialog("NARRATOR", "The darkness overwhelms you. Your vision fades...");
        }
        // Don't kill — let sanity system handle loop reset
    }
}

function checkEncounter() {
    if (typeof game === "undefined") return;
    if (combat.active) return;

    const enc = ROOM_ENCOUNTERS[game.currentRoom];
    if (!enc) return;
    if (game.loop < enc.minLoop) return;
    if (game.level < enc.minLevel) return;

    const cooldownKey = `enc_${game.currentRoom}`;
    if (encounterCooldowns[cooldownKey] && frame - encounterCooldowns[cooldownKey] < enc.cooldown * 60) return;

    if (Math.random() > enc.chance) {
        encounterCooldowns[cooldownKey] = frame;
        return;
    }

    // Spawn encounter
    encounterCooldowns[cooldownKey] = frame;
    spawnEncounter(enc.enemies);
}

function spawnEncounter(enemyDefs) {
    if (typeof showDialog === "function") {
        showDialog("⚔️ COMBAT", "Hostile entities materialize! Press Q to attack, Shift to dodge!");
    }
    if (typeof playSound === "function") playSound("scare");
    if (typeof triggerShake === "function") triggerShake(5, 20);

    const room = typeof getCurrentRoom === "function" ? getCurrentRoom() : null;

    for (let def of enemyDefs) {
        for (let i = 0; i < def.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 60;
            const ex = game.playerX + Math.cos(angle) * dist;
            const ey = game.playerY + Math.sin(angle) * dist;
            const enemy = new Enemy(def.type, ex, ey);
            if (room) {
                enemy.x = Math.max(enemy.size + 20, Math.min(room.width - enemy.size - 20, enemy.x));
                enemy.y = Math.max(enemy.size + 20, Math.min(room.height - enemy.size - 20, enemy.y));
            }
            combat.enemies.push(enemy);
        }
    }

    combat.waveNumber++;
}

function startBossFight(bossType) {
    const def = BOSSES[bossType];
    if (!def) return;

    combat.bossActive = new Boss(bossType);
    const room = typeof getCurrentRoom === "function" ? getCurrentRoom() : null;
    if (room) {
        combat.bossActive.x = room.width / 2;
        combat.bossActive.y = room.height / 3;
    }

    if (typeof showDialog === "function") showDialog("⚔️ BOSS", def.dialog.intro);
    if (typeof playSound === "function") playSound("scare");
    if (typeof triggerShake === "function") triggerShake(10, 40);
}

function onBossDefeated(boss) {
    if (typeof showDialog === "function") showDialog("🏆 VICTORY", boss.def.dialog.defeat);
    if (typeof giveXP === "function") giveXP(boss.def.xp);
    if (typeof playSound === "function") playSound("unlock");
    if (typeof triggerShake === "function") triggerShake(8, 30);
    if (typeof emitLevelUpParticles === "function") emitLevelUpParticles(boss.x, boss.y);

    // Drop items
    if (boss.def.drops) {
        for (let drop of boss.def.drops) {
            if (drop === "fire_poker") {
                if (typeof addItem === "function") addItem("fire_poker_item", "🔥", "Fire Poker");
            } else if (drop === "holy_water") {
                game.permanentFlags.hasHolyWater = true;
                if (typeof addItem === "function") addItem("holy_water_item", "💧", "Holy Water Vial");
            } else if (drop === "seal_blast_scroll") {
                if (typeof addItem === "function") addItem("seal_scroll", "📜", "Seal Blast Scroll");
            }
        }
    }

    game.permanentFlags[`boss_${boss.type}_defeated`] = true;

    // Clear remaining minions
    combat.enemies = [];
    combat.projectiles = [];
}

// ─── DRAW COMBAT ────────────────────────────────────────────────
function drawCombat(ctx) {
    // Salt circles
    for (let sc of saltCircles) sc.draw(ctx);

    // Enemies
    for (let enemy of combat.enemies) enemy.draw(ctx);

    // Boss
    if (combat.bossActive) combat.bossActive.draw(ctx);

    // Projectiles
    for (let p of combat.projectiles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        const alpha = Math.min(1, p.life / 30);
        if (p.fromEnemy) {
            ctx.fillStyle = `rgba(${p.color.r + 100},${p.color.g},${p.color.b},${alpha})`;
        } else {
            ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
            ctx.shadowColor = "#ffdd44";
            ctx.shadowBlur = 8;
        }
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Attack swing visual
    if (combat.attackCooldown > 0) {
        const weapon = WEAPONS[combat.equippedWeapon] || WEAPONS.fists;
        const progress = combat.attackCooldown / weapon.cooldown;
        if (progress > 0.7 && weapon.type === "melee") {
            const swingAngle = game.playerAngle + (1 - progress) * 2 - 1;
            ctx.strokeStyle = `rgba(255, 255, 200, ${progress})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(game.playerX, game.playerY, weapon.range, swingAngle - 0.3, swingAngle + 0.3);
            ctx.stroke();
        }
    }

    // Dodge afterimage
    if (combat.dodgeActive) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#445566";
        ctx.beginPath();
        ctx.arc(
            game.playerX - combat.dodgeDir.x * 15,
            game.playerY - combat.dodgeDir.y * 15,
            10, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Player damage flash
    if (combat.playerDamageFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${combat.playerDamageFlash / 30})`;
        ctx.beginPath();
        ctx.arc(game.playerX, game.playerY, 18, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCombatHUD(ctx, cw, ch) {
    if (!combat.active && combat.enemies.length === 0 && !combat.bossActive) return;

    // HP bar
    const barW = 150, barH = 10;
    const barX = cw / 2 - barW / 2;
    const barY = 60;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const hpRatio = combat.playerHP / combat.maxHP;
    ctx.fillStyle = hpRatio > 0.5 ? "#4a4" : hpRatio > 0.25 ? "#aa4" : "#a44";
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.fillStyle = "#fff";
    ctx.font = "10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText(`HP ${Math.floor(combat.playerHP)}/${combat.maxHP}`, cw / 2, barY - 4);

    // Weapon info
    const weapon = WEAPONS[combat.equippedWeapon] || WEAPONS.fists;
    ctx.fillStyle = "rgba(200,200,200,0.7)";
    ctx.font = "12px 'Courier New'";
    ctx.textAlign = "left";
    ctx.fillText(`${weapon.icon} ${weapon.name} [Q]atk [Shift]dodge`, 15, barY + 5);

    // Combo
    if (combat.comboCount > 1) {
        ctx.fillStyle = "#ffcc44";
        ctx.font = `bold ${14 + combat.comboCount}px Georgia`;
        ctx.textAlign = "center";
        ctx.fillText(`${combat.comboCount}x COMBO!`, cw / 2, barY + 30);
    }

    // Dodge cooldown
    if (combat.dodgeCooldown > 0) {
        ctx.fillStyle = "rgba(100,100,100,0.5)";
        ctx.font = "10px 'Courier New'";
        ctx.textAlign = "right";
        ctx.fillText(`Dodge: ${Math.ceil(combat.dodgeCooldown / 60)}s`, cw - 15, barY + 5);
    }

    // Enemy count
    const aliveCount = combat.enemies.filter(e => e.alive).length;
    if (aliveCount > 0) {
        ctx.fillStyle = "rgba(200,100,100,0.7)";
        ctx.font = "11px 'Courier New'";
        ctx.textAlign = "right";
        ctx.fillText(`Enemies: ${aliveCount}`, cw - 15, barY - 4);
    }

    // Boss HP bar (large, at top)
    if (combat.bossActive && combat.bossActive.alive) {
        const bBarW = 300, bBarH = 14;
        const bBarX = cw / 2 - bBarW / 2;
        const bBarY = 90;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(bBarX - 2, bBarY - 2, bBarW + 4, bBarH + 4);

        const bRatio = combat.bossActive.hp / combat.bossActive.maxHP;
        ctx.fillStyle = bRatio > 0.5 ? "#c44" : bRatio > 0.25 ? "#ca4" : "#c22";
        ctx.fillRect(bBarX, bBarY, bBarW * bRatio, bBarH);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText(`${combat.bossActive.def.name} — ${Math.floor(combat.bossActive.hp)}/${combat.bossActive.maxHP}`, cw / 2, bBarY - 4);
    }
}

// ─── RESET COMBAT ON LOOP ──────────────────────────────────────
function resetCombat() {
    combat.enemies = [];
    combat.projectiles = [];
    combat.bossActive = null;
    combat.active = false;
    combat.playerHP = combat.maxHP;
    combat.playerDamageFlash = 0;
    combat.dodgeCooldown = 0;
    combat.dodgeActive = false;
    combat.attackCooldown = 0;
    combat.comboCount = 0;
    combat.comboTimer = 0;
    combat.killCount = 0;
    combat.waveNumber = 0;
    combat.invincibleTimer = 0;
    saltCircles.length = 0;
}