const SpatialGrid = require('./SpatialGrid');
const Player = require('./Player');
const Bot = require('./Bot');
const Projectile = require('./Projectile');
const { Zeppelin, FlakTower } = require('./Zeppelin');
const { PLANE_CLASSES } = require('./planeConfig');

let nextCrateId = 1;

class GameRoom {
  constructor(options = {}) {
    this.worldWidth = options.worldWidth || 6000;
    this.worldHeight = options.worldHeight || 6000;
    this.maxBots = options.maxBots || 14;

    this.players = new Map(); // id -> Player or Bot
    this.projectiles = [];
    this.crates = [];
    this.zeppelins = [];
    this.flakTowers = [];
    this.clouds = [];
    this.islands = [];

    this.spatialGrid = new SpatialGrid(this.worldWidth, this.worldHeight, 400);

    this.killFeed = [];
    this.events = []; // transient events like explosions, level ups, medals

    this.initWorld();

    this.lastTickTime = Date.now();
    this.tickInterval = 1000 / 45; // ~45 TPS
    this.gameLoopTimer = setInterval(() => this.tick(), this.tickInterval);
  }

  initWorld() {
    // Generate Volumetric Clouds (18-24 cloud clusters)
    for (let i = 0; i < 22; i++) {
      this.clouds.push({
        id: `cloud_${i}`,
        x: 400 + Math.random() * (this.worldWidth - 800),
        y: 400 + Math.random() * (this.worldHeight - 800),
        radius: 120 + Math.random() * 80,
        puffCount: 5 + Math.floor(Math.random() * 4)
      });
    }

    // Generate Islands with Flak Towers
    const islandPositions = [
      { x: 1200, y: 1200 },
      { x: 4800, y: 1200 },
      { x: 3000, y: 3000 },
      { x: 1200, y: 4800 },
      { x: 4800, y: 4800 }
    ];

    islandPositions.forEach((pos, idx) => {
      this.islands.push({
        id: `island_${idx}`,
        x: pos.x,
        y: pos.y,
        radius: 140
      });

      this.flakTowers.push(new FlakTower(`flak_${idx}`, pos.x, pos.y));
    });

    // Spawn initial Dreadnought Zeppelins
    for (let i = 0; i < 2; i++) {
      this.spawnZeppelin(i + 1);
    }

    // Spawn initial supply crates
    for (let i = 0; i < 35; i++) {
      this.spawnCrate();
    }
  }

  spawnZeppelin(level = 1) {
    const x = 800 + Math.random() * (this.worldWidth - 1600);
    const y = 800 + Math.random() * (this.worldHeight - 1600);
    this.zeppelins.push(new Zeppelin(x, y, level));
  }

  spawnCrate(type = null, x = null, y = null) {
    const types = ['repair', 'ammo', 'gold', 'fuel'];
    const weights = [0.35, 0.25, 0.25, 0.15];
    let chosenType = type;

    if (!chosenType) {
      const r = Math.random();
      let sum = 0;
      for (let i = 0; i < types.length; i++) {
        sum += weights[i];
        if (r <= sum) {
          chosenType = types[i];
          break;
        }
      }
    }

    this.crates.push({
      id: `crate_${nextCrateId++}`,
      type: chosenType || 'gold',
      x: x !== null ? x : 200 + Math.random() * (this.worldWidth - 400),
      y: y !== null ? y : 200 + Math.random() * (this.worldHeight - 400),
      radius: 18,
      xpValue: chosenType === 'gold' ? 80 : 30
    });
  }

  addPlayer(id, name, planeClass = 'biplane_scout') {
    const player = new Player(id, name, false, planeClass);
    const spawnPos = this.getRandomSpawnPoint();
    player.spawn(spawnPos.x, spawnPos.y);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  getRandomSpawnPoint() {
    return {
      x: 400 + Math.random() * (this.worldWidth - 800),
      y: 400 + Math.random() * (this.worldHeight - 800)
    };
  }

  handlePlayerInput(id, inputData) {
    const player = this.players.get(id);
    if (!player || player.isDead) return;

    if (typeof inputData.targetAngle === 'number') {
      player.input.targetAngle = inputData.targetAngle;
    }
    if (typeof inputData.shooting === 'boolean') {
      player.input.shooting = inputData.shooting;
    }
    if (typeof inputData.boosting === 'boolean') {
      player.input.boosting = inputData.boosting;
    }
    if (typeof inputData.braking === 'boolean') {
      player.input.braking = inputData.braking;
    }
    if (typeof inputData.special === 'boolean') {
      player.input.special = inputData.special;
    }
  }

  handleUpgradeRequest(id, statKey) {
    const player = this.players.get(id);
    if (player && !player.isDead) {
      player.applyUpgrade(statKey);
    }
  }

  handleEvolveRequest(id, classKey) {
    const player = this.players.get(id);
    if (player && !player.isDead) {
      const evolved = player.evolve(classKey);
      if (evolved) {
        this.events.push({
          type: 'evolve',
          playerId: player.id,
          name: player.name,
          newClass: classKey,
          x: player.x,
          y: player.y
        });
      }
    }
  }

  handleRespawnRequest(id, planeClass = 'biplane_scout') {
    const player = this.players.get(id);
    if (player && player.isDead) {
      player.planeClassKey = planeClass;
      player.planeClass = PLANE_CLASSES[planeClass] || PLANE_CLASSES.biplane_scout;
      player.level = 1;
      player.xp = 0;
      player.score = Math.floor(player.score * 0.4); // retain 40% score
      player.availableUpgradePoints = 0;
      Object.keys(player.upgrades).forEach(k => (player.upgrades[k] = 0));
      player.recalculateStats();
      const pos = this.getRandomSpawnPoint();
      player.spawn(pos.x, pos.y);
    }
  }

  maintainBotSquadron() {
    let humanCount = 0;
    let botCount = 0;

    for (let p of this.players.values()) {
      if (p.isBot) botCount++;
      else humanCount++;
    }

    const desiredBots = Math.max(8, this.maxBots - humanCount);

    if (botCount < desiredBots) {
      const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const bot = new Bot(botId);
      const pos = this.getRandomSpawnPoint();
      bot.spawn(pos.x, pos.y);
      this.players.set(botId, bot);
    }
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    this.maintainBotSquadron();

    const onShoot = (projOptions) => {
      this.projectiles.push(new Projectile(projOptions));
    };

    const onSpecialEffect = (player, effectType) => {
      this.events.push({
        type: 'special_fx',
        effect: effectType,
        x: player.x,
        y: player.y,
        angle: player.angle,
        id: player.id
      });
    };

    const playerList = Array.from(this.players.values());

    // 1. Update Clouds & Stealth Check
    for (let p of playerList) {
      if (p.isDead) continue;
      let inside = false;
      for (let c of this.clouds) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < c.radius) {
          inside = true;
          break;
        }
      }
      p.inCloud = inside;
    }

    // 2. Update Bots AI
    for (let p of playerList) {
      if (p.isBot && !p.isDead) {
        p.aiUpdate(dt, this.worldWidth, this.worldHeight, playerList, this.crates, this.zeppelins);
      }
    }

    // 3. Update Players & Physics
    for (let p of playerList) {
      p.update(dt, this.worldWidth, this.worldHeight, onShoot, onSpecialEffect);
    }

    // 4. Update Zeppelins
    for (let z of this.zeppelins) {
      if (!z.isDead) {
        z.update(dt, this.worldWidth, this.worldHeight, playerList, onShoot);
      }
    }

    // 5. Update Flak Towers
    for (let f of this.flakTowers) {
      f.update(dt, playerList, onShoot);
    }

    // 6. Update Projectiles
    for (let proj of this.projectiles) {
      proj.update(dt);
    }

    // 7. Broadphase Spatial Grid Insertion
    this.spatialGrid.clear();
    for (let p of playerList) {
      if (!p.isDead) this.spatialGrid.insert(p);
    }

    // 8. Projectile Collisions & Explosions
    for (let proj of this.projectiles) {
      if (proj.isDead) continue;

      // Projectile vs Planes
      const nearbyPlanes = this.spatialGrid.getNearby(proj.x, proj.y, proj.radius + 60);

      for (let plane of nearbyPlanes) {
        if (plane.id === proj.shooterId || plane.isDead || plane.isInvulnerable) continue;

        const dist = Math.hypot(plane.x - proj.x, plane.y - proj.y);
        const hitRadius = plane.planeClass.stats.radius + proj.radius;

        if (dist < hitRadius) {
          proj.isDead = true;

          const shooter = this.players.get(proj.shooterId);
          const shooterName = shooter ? shooter.name : 'Unknown';
          const killed = plane.takeDamage(proj.damage, proj.shooterId, shooterName);

          this.events.push({
            type: 'hit',
            x: proj.x,
            y: proj.y,
            damage: proj.damage,
            targetId: plane.id
          });

          if (shooter) {
            shooter.addXp(Math.round(proj.damage * 1.5));
          }

          if (killed) {
            this.handleKill(shooter, plane);
          }
          break;
        }
      }

      // Projectile vs Zeppelins
      if (!proj.isDead && proj.shooterTeam !== 'boss') {
        for (let z of this.zeppelins) {
          if (z.isDead) continue;
          const dist = Math.hypot(z.x - proj.x, z.y - proj.y);
          if (dist < z.radius + proj.radius) {
            proj.isDead = true;
            z.takeDamage(proj.damage, proj.shooterId);

            const shooter = this.players.get(proj.shooterId);
            if (shooter) {
              shooter.addXp(Math.round(proj.damage * 2.0));
            }

            if (z.isDead) {
              this.handleZeppelinDestroyed(z, shooter);
            }
            break;
          }
        }
      }
    }

    // 9. Area of Effect Explosions (Rockets, Bombs, Flak)
    for (let proj of this.projectiles) {
      if (proj.isDead && proj.splashRadius > 0) {
        this.events.push({
          type: 'explosion',
          x: proj.x,
          y: proj.y,
          radius: proj.splashRadius,
          projType: proj.type
        });

        // Damage nearby planes in splash radius
        const nearby = this.spatialGrid.getNearby(proj.x, proj.y, proj.splashRadius + 40);
        for (let p of nearby) {
          if (p.isDead || p.isInvulnerable) continue;
          const d = Math.hypot(p.x - proj.x, p.y - proj.y);
          if (d < proj.splashRadius + p.planeClass.stats.radius) {
            const factor = 1 - (d / (proj.splashRadius + p.planeClass.stats.radius));
            const splashDmg = Math.round(proj.damage * factor);
            const shooter = this.players.get(proj.shooterId);
            const shooterName = shooter ? shooter.name : 'Heavy Fire';
            const killed = p.takeDamage(splashDmg, proj.shooterId, shooterName);
            if (shooter) shooter.addXp(splashDmg);
            if (killed) this.handleKill(shooter, p);
          }
        }
      }
    }

    // Filter dead projectiles
    this.projectiles = this.projectiles.filter(p => !p.isDead);

    // 10. Plane vs Crate Collection
    for (let p of playerList) {
      if (p.isDead) continue;
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const crate = this.crates[i];
        const dist = Math.hypot(p.x - crate.x, p.y - crate.y);
        if (dist < p.planeClass.stats.radius + crate.radius) {
          // Collect crate
          this.applyCrateEffect(p, crate);
          this.events.push({
            type: 'crate_pickup',
            x: crate.x,
            y: crate.y,
            crateType: crate.type,
            playerId: p.id
          });
          this.crates.splice(i, 1);
        }
      }
    }

    // Maintain crate count
    while (this.crates.length < 35) {
      this.spawnCrate();
    }

    // Respawn destroyed zeppelins after a delay
    for (let i = this.zeppelins.length - 1; i >= 0; i--) {
      if (this.zeppelins[i].isDead) {
        this.zeppelins.splice(i, 1);
        setTimeout(() => this.spawnZeppelin(Math.min(3, Math.floor(Math.random() * 3 + 1))), 12000);
      }
    }

    // Clean up dead bots after short respawn
    for (let p of playerList) {
      if (p.isBot && p.isDead) {
        this.players.delete(p.id);
      }
    }
  }

  applyCrateEffect(player, crate) {
    player.addXp(crate.xpValue || 40);
    if (crate.type === 'repair') {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.45);
    } else if (crate.type === 'ammo') {
      player.boost = player.boostMax;
      player.heat = 0;
      player.isOverheated = false;
    } else if (crate.type === 'fuel') {
      player.boost = player.boostMax;
      player.speed += 80;
    } else if (crate.type === 'gold') {
      player.addXp(120);
    }
  }

  handleKill(killer, victim) {
    if (killer) {
      killer.kills++;
      killer.addXp(250 + victim.level * 50);

      // Killfeed event
      this.killFeed.unshift({
        killer: killer.name,
        victim: victim.name,
        killerClass: killer.planeClassKey,
        victimClass: victim.planeClassKey,
        time: Date.now()
      });
      if (this.killFeed.length > 8) this.killFeed.pop();

      // Medal check
      if (killer.kills === 1) {
        this.events.push({ type: 'medal', playerId: killer.id, medal: 'First Blood' });
      } else if (killer.kills % 5 === 0) {
        this.events.push({ type: 'medal', playerId: killer.id, medal: `Ace x${killer.kills}` });
      }
    }

    // Drop loot crates where plane crashed
    for (let i = 0; i < 3; i++) {
      this.spawnCrate('gold', victim.x + (Math.random() - 0.5) * 60, victim.y + (Math.random() - 0.5) * 60);
    }
    this.spawnCrate('repair', victim.x, victim.y);

    this.events.push({
      type: 'plane_crash',
      x: victim.x,
      y: victim.y,
      victimId: victim.id,
      victimName: victim.name
    });
  }

  handleZeppelinDestroyed(zeppelin, killer) {
    if (killer) {
      killer.addXp(1000);
      this.events.push({ type: 'medal', playerId: killer.id, medal: 'Zeppelin Slayer' });
    }

    this.killFeed.unshift({
      killer: killer ? killer.name : 'Allies',
      victim: 'Dreadnought Zeppelin',
      killerClass: killer ? killer.planeClassKey : 'flak',
      victimClass: 'zeppelin',
      time: Date.now()
    });

    // Drop massive loot cluster
    for (let i = 0; i < 8; i++) {
      this.spawnCrate('gold', zeppelin.x + (Math.random() - 0.5) * 160, zeppelin.y + (Math.random() - 0.5) * 160);
      this.spawnCrate('repair', zeppelin.x + (Math.random() - 0.5) * 120, zeppelin.y + (Math.random() - 0.5) * 120);
    }

    this.events.push({
      type: 'zeppelin_explosion',
      x: zeppelin.x,
      y: zeppelin.y
    });
  }

  getLeaderboard() {
    const list = Array.from(this.players.values())
      .filter(p => !p.isDead)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        name: p.name,
        score: p.score,
        kills: p.kills,
        level: p.level,
        isKing: idx === 0
      }));
    return list;
  }

  getClientState(playerId) {
    const selfPlayer = this.players.get(playerId);
    const viewRadiusX = 1400;
    const viewRadiusY = 900;
    const px = selfPlayer ? selfPlayer.x : this.worldWidth / 2;
    const py = selfPlayer ? selfPlayer.y : this.worldHeight / 2;

    // Filter visible planes
    const visiblePlanes = [];
    for (let p of this.players.values()) {
      if (p.isDead) continue;
      const dx = Math.abs(p.x - px);
      const dy = Math.abs(p.y - py);
      if (dx < viewRadiusX && dy < viewRadiusY) {
        visiblePlanes.push(p.serialize(p.id === playerId));
      }
    }

    // Filter visible projectiles
    const visibleProjectiles = [];
    for (let proj of this.projectiles) {
      if (Math.abs(proj.x - px) < viewRadiusX && Math.abs(proj.y - py) < viewRadiusY) {
        visibleProjectiles.push(proj.serialize());
      }
    }

    // Filter visible crates
    const visibleCrates = [];
    for (let c of this.crates) {
      if (Math.abs(c.x - px) < viewRadiusX && Math.abs(c.y - py) < viewRadiusY) {
        visibleCrates.push(c);
      }
    }

    // Filter visible zeppelins
    const visibleZeppelins = [];
    for (let z of this.zeppelins) {
      if (!z.isDead && Math.abs(z.x - px) < viewRadiusX + 400 && Math.abs(z.y - py) < viewRadiusY + 400) {
        visibleZeppelins.push(z.serialize());
      }
    }

    // Flak towers
    const flakData = this.flakTowers.map(f => f.serialize());

    return {
      self: selfPlayer ? selfPlayer.serialize(true) : null,
      planes: visiblePlanes,
      projectiles: visibleProjectiles,
      crates: visibleCrates,
      zeppelins: visibleZeppelins,
      flakTowers: flakData,
      clouds: this.clouds,
      islands: this.islands,
      leaderboard: this.getLeaderboard(),
      killFeed: this.killFeed,
      events: this.events,
      world: { width: this.worldWidth, height: this.worldHeight }
    };
  }

  flushEvents() {
    this.events = [];
  }
}

module.exports = GameRoom;
