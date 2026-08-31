const { PLANE_CLASSES, UPGRADE_TYPES, UPGRADE_INCREMENTS, MAX_UPGRADE_POINTS_PER_STAT, getXpForLevel } = require('./planeConfig');

class Player {
  constructor(id, name, isBot = false, initialClass = 'biplane_scout') {
    this.id = id;
    this.name = name || (isBot ? `Ace_${Math.floor(Math.random() * 900 + 100)}` : 'Pilot');
    this.isBot = isBot;

    // Plane Class & Evolutions
    this.planeClassKey = initialClass;
    this.planeClass = PLANE_CLASSES[this.planeClassKey] || PLANE_CLASSES.biplane_scout;

    // Level & XP
    this.level = 1;
    this.xp = 0;
    this.xpForNextLevel = getXpForLevel(this.level);
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    this.availableUpgradePoints = 0;
    this.availableEvolutions = [];

    // Upgrades allocated
    this.upgrades = {
      [UPGRADE_TYPES.MAX_HP]: 0,
      [UPGRADE_TYPES.HP_REGEN]: 0,
      [UPGRADE_TYPES.SPEED]: 0,
      [UPGRADE_TYPES.TURN_RATE]: 0,
      [UPGRADE_TYPES.BULLET_DAMAGE]: 0,
      [UPGRADE_TYPES.BULLET_SPEED]: 0,
      [UPGRADE_TYPES.FIRE_RATE]: 0,
      [UPGRADE_TYPES.BOOST_CAPACITY]: 0
    };

    // Position & Kinematics
    this.x = 0;
    this.y = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.speed = this.getBaseStat('speed');
    this.vx = 0;
    this.vy = 0;
    this.bankAngle = 0; // -1 to 1 (left to right)

    // Health
    this.maxHp = this.getBaseStat('maxHp');
    this.hp = this.maxHp;
    this.isDead = false;
    this.inCloud = false;

    // Boost & Energy
    this.boostMax = this.getBaseStat('boostMax');
    this.boost = this.boostMax;
    this.isBoosting = false;
    this.isBraking = false;

    // Weapons & Overheat
    this.heat = 0;
    this.isOverheated = false;
    this.shootCooldown = 0;
    this.rearTurretCooldown = 0;
    this.specialCooldown = 0;
    this.specialActiveTimer = 0;
    this.isInvulnerable = false;

    // Secondary weapons
    this.secondaryCooldown = 0;

    // Input States
    this.input = {
      targetAngle: 0,
      shooting: false,
      boosting: false,
      braking: false,
      special: false,
      secondary: false
    };

    // Damage & Kill Tracking
    this.lastAttackerId = null;
    this.lastAttackerName = null;
    this.lastAttackedTime = 0;

    this.recalculateStats();
  }

  getBaseStat(statKey) {
    const base = this.planeClass.stats[statKey] || 0;
    const upgradeLvl = this.upgrades[statKey] || 0;
    const inc = UPGRADE_INCREMENTS[statKey] || 0;
    return base + upgradeLvl * inc;
  }

  recalculateStats() {
    const oldMaxHp = this.maxHp;
    this.maxHp = this.getBaseStat('maxHp');
    if (this.hp > 0 && oldMaxHp > 0) {
      this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMaxHp));
    } else {
      this.hp = this.maxHp;
    }
    this.boostMax = this.getBaseStat('boostMax');
    this.boost = Math.min(this.boostMax, this.boost);
  }

  spawn(spawnX, spawnY) {
    this.x = spawnX;
    this.y = spawnY;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.hp = this.maxHp;
    this.boost = this.boostMax;
    this.heat = 0;
    this.isOverheated = false;
    this.isDead = false;
    this.isInvulnerable = true;
    this.invulnerableTimer = 2.0; // 2 seconds spawn shield
    this.specialCooldown = 0;
    this.specialActiveTimer = 0;
  }

  applyUpgrade(statKey) {
    if (this.availableUpgradePoints <= 0) return false;
    if (!UPGRADE_INCREMENTS[statKey]) return false;
    if ((this.upgrades[statKey] || 0) >= MAX_UPGRADE_POINTS_PER_STAT) return false;

    this.upgrades[statKey] = (this.upgrades[statKey] || 0) + 1;
    this.availableUpgradePoints--;
    this.recalculateStats();
    return true;
  }

  addXp(amount) {
    this.xp += amount;
    this.score += amount;

    while (this.xp >= this.xpForNextLevel) {
      this.xp -= this.xpForNextLevel;
      this.level++;
      this.availableUpgradePoints++;
      this.xpForNextLevel = getXpForLevel(this.level);

      // Check evolution availability
      this.checkEvolutions();
    }
  }

  checkEvolutions() {
    this.availableEvolutions = [];
    const possible = this.planeClass.evolutions || [];
    for (const nextKey of possible) {
      const cls = PLANE_CLASSES[nextKey];
      if (cls && this.level >= cls.minLevel) {
        this.availableEvolutions.push(nextKey);
      }
    }
  }

  evolve(nextClassKey) {
    if (!this.availableEvolutions.includes(nextClassKey)) return false;
    const newClass = PLANE_CLASSES[nextClassKey];
    if (!newClass) return false;

    this.planeClassKey = nextClassKey;
    this.planeClass = newClass;
    this.recalculateStats();
    this.checkEvolutions();
    return true;
  }

  update(dt, worldWidth, worldHeight, onShoot, onSpecialEffect) {
    if (this.isDead) return;

    const stats = this.planeClass.stats;
    const baseSpeed = this.getBaseStat('speed');
    const turnRate = this.getBaseStat('turnRate');
    const hpRegen = this.getBaseStat('hpRegen');
    const fireRate = this.getBaseStat('fireRate');

    // Spawn Invulnerability Timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Special Active Timer
    if (this.specialActiveTimer > 0) {
      this.specialActiveTimer -= dt;
      if (this.specialActiveTimer <= 0) {
        this.isInvulnerable = false;
      }
    }
    if (this.specialCooldown > 0) {
      this.specialCooldown -= dt;
    }
    if (this.secondaryCooldown > 0) {
      this.secondaryCooldown -= dt;
    }

    // Health Regen (if not damaged in last 3s)
    if (Date.now() - this.lastAttackedTime > 3000 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + hpRegen * dt * (this.inCloud ? 1.5 : 1.0));
    }

    // Overheat Recovery
    if (this.isOverheated) {
      this.heat -= 40 * dt;
      if (this.heat <= 0) {
        this.heat = 0;
        this.isOverheated = false;
      }
    } else {
      if (this.heat > 0) {
        this.heat = Math.max(0, this.heat - 25 * dt);
      }
    }

    // Boost & Brake Handling
    this.isBoosting = this.input.boosting && this.boost > 5;
    this.isBraking = this.input.braking;

    let targetSpeed = baseSpeed;
    if (this.isBoosting) {
      this.boost -= stats.boostDrain * dt;
      targetSpeed = baseSpeed * stats.boostSpeedMultiplier;
      if (this.boost <= 0) {
        this.boost = 0;
        this.isBoosting = false;
      }
    } else {
      this.boost = Math.min(this.boostMax, this.boost + stats.boostRegen * dt);
    }

    if (this.isBraking) {
      targetSpeed = baseSpeed * 0.55;
    }

    // Acceleration towards target speed
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4.5);

    // Smooth Turning & Angle Steering
    let angleDiff = this.input.targetAngle - this.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const maxTurn = turnRate * dt;
    const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    this.angle += actualTurn;

    // Banking visual tilt (-1 to 1) with smooth deadzone
    let targetBank = 0;
    if (Math.abs(angleDiff) > 0.04) {
      targetBank = Math.max(-1, Math.min(1, actualTurn / (turnRate * dt + 0.0001)));
    }
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1, dt * 7.0);

    // Aerodynamic flight dynamics with realistic inertia and lateral grip
    const thrustX = Math.cos(this.angle) * this.speed;
    const thrustY = Math.sin(this.angle) * this.speed;
    const aeroGrip = Math.min(1, dt * 7.5);
    this.vx += (thrustX - this.vx) * aeroGrip;
    this.vy += (thrustY - this.vy) * aeroGrip;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Soft Boundary constraints with smooth inward nudge
    const pad = 120;
    if (this.x < pad) { this.x = pad; this.vx = Math.max(0, this.vx); }
    if (this.x > worldWidth - pad) { this.x = worldWidth - pad; this.vx = Math.min(0, this.vx); }
    if (this.y < pad) { this.y = pad; this.vy = Math.max(0, this.vy); }
    if (this.y > worldHeight - pad) { this.y = worldHeight - pad; this.vy = Math.min(0, this.vy); }

    // Gun Shooting
    this.shootCooldown -= dt;
    if (this.input.shooting && !this.isOverheated && this.shootCooldown <= 0) {
      this.shootCooldown = 1.0 / fireRate;
      this.heat += 12;
      if (this.heat >= 100) {
        this.heat = 100;
        this.isOverheated = true;
      }

      this.firePrimaryGuns(onShoot);
    }

    // Special Ability Trigger
    if (this.input.special && this.specialCooldown <= 0) {
      this.triggerSpecial(onShoot, onSpecialEffect);
    }
  }

  firePrimaryGuns(onShoot) {
    const stats = this.planeClass.stats;
    const bulletDmg = this.getBaseStat('bulletDamage');
    const bulletSpd = this.getBaseStat('bulletSpeed');
    const count = stats.bulletCount || 2;
    const offset = stats.gunOffset || 14;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    // Perpendicular vector for wing guns
    const perpX = -sin;
    const perpY = cos;

    if (count === 1) {
      // Single centerline heavy cannon
      onShoot({
        shooterId: this.id,
        type: stats.hasHeavyCenter ? 'heavy_cannon' : 'bullet',
        x: this.x + cos * 25,
        y: this.y + sin * 25,
        angle: this.angle + (Math.random() - 0.5) * stats.bulletSpread,
        speed: bulletSpd,
        damage: bulletDmg,
        inheritedVx: this.vx,
        inheritedVy: this.vy,
        radius: stats.hasHeavyCenter ? 5 : 4
      });
    } else if (count === 2) {
      // Dual wing guns
      [-1, 1].forEach(side => {
        const gx = this.x + cos * 15 + perpX * (offset * side);
        const gy = this.y + sin * 15 + perpY * (offset * side);
        onShoot({
          shooterId: this.id,
          type: 'bullet',
          x: gx,
          y: gy,
          angle: this.angle + (Math.random() - 0.5) * stats.bulletSpread,
          speed: bulletSpd,
          damage: bulletDmg,
          inheritedVx: this.vx,
          inheritedVy: this.vy,
          radius: 4
        });
      });
    } else if (count >= 4) {
      // Quad guns
      [-1.5, -0.6, 0.6, 1.5].forEach(mult => {
        const gx = this.x + cos * 15 + perpX * (offset * mult);
        const gy = this.y + sin * 15 + perpY * (offset * mult);
        onShoot({
          shooterId: this.id,
          type: stats.isJet ? 'heavy_cannon' : 'bullet',
          x: gx,
          y: gy,
          angle: this.angle + (Math.random() - 0.5) * stats.bulletSpread,
          speed: bulletSpd,
          damage: bulletDmg * 0.8,
          inheritedVx: this.vx,
          inheritedVy: this.vy,
          radius: stats.isJet ? 5 : 4
        });
      });
    }
  }

  triggerSpecial(onShoot, onSpecialEffect) {
    const special = this.planeClass.special;
    if (!special) return;

    this.specialCooldown = special.cooldown;

    if (special.type === 'barrel_roll') {
      this.isInvulnerable = true;
      this.specialActiveTimer = 0.65;
      if (onSpecialEffect) onSpecialEffect(this, 'barrel_roll');
    } else if (special.type === 'afterburner') {
      this.speed += 280;
      this.boost = this.boostMax;
      if (onSpecialEffect) onSpecialEffect(this, 'afterburner');
    } else if (special.type === 'snap_turn') {
      this.angle += Math.PI;
      if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
      this.input.targetAngle = this.angle;
      if (onSpecialEffect) onSpecialEffect(this, 'snap_turn');
    } else if (special.type === 'cannon_burst') {
      onShoot({
        shooterId: this.id,
        type: 'heavy_cannon',
        x: this.x + Math.cos(this.angle) * 30,
        y: this.y + Math.sin(this.angle) * 30,
        angle: this.angle,
        speed: 950,
        damage: 35,
        radius: 7,
        splashRadius: 40
      });
    } else if (special.type === 'carpet_bomb') {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (this.isDead) return;
          onShoot({
            shooterId: this.id,
            type: 'bomb',
            x: this.x - Math.cos(this.angle) * 20,
            y: this.y - Math.sin(this.angle) * 20,
            angle: this.angle + Math.PI + (Math.random() - 0.5) * 0.3,
            speed: 120,
            damage: 48,
            maxLifeTime: 1.2,
            radius: 8,
            splashRadius: 100
          });
        }, i * 180);
      }
      if (onSpecialEffect) onSpecialEffect(this, 'carpet_bomb');
    } else if (special.type === 'heavy_rockets') {
      [-1, 1].forEach(side => {
        const perpX = -Math.sin(this.angle);
        const perpY = Math.cos(this.angle);
        onShoot({
          shooterId: this.id,
          type: 'rocket',
          x: this.x + perpX * (side * 22),
          y: this.y + perpY * (side * 22),
          angle: this.angle,
          speed: 450,
          damage: 42,
          range: 1400,
          radius: 6,
          splashRadius: 75
        });
      });
      if (onSpecialEffect) onSpecialEffect(this, 'heavy_rockets');
    } else if (special.type === 'turbo_ramjet') {
      this.speed += 360;
      this.isInvulnerable = true;
      this.specialActiveTimer = 0.8;
      if (onSpecialEffect) onSpecialEffect(this, 'turbo_ramjet');
    } else if (special.type === 'quad_burst') {
      this.boost = this.boostMax;
      this.heat = 0;
      this.isOverheated = false;
      if (onSpecialEffect) onSpecialEffect(this, 'quad_burst');
    }
  }

  takeDamage(amount, attackerId, attackerName) {
    if (this.isDead || this.isInvulnerable) return false;

    this.hp -= amount;
    this.lastAttackedTime = Date.now();
    if (attackerId) {
      this.lastAttackerId = attackerId;
      this.lastAttackerName = attackerName;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.deaths++;
      return true; // was killed
    }
    return false;
  }

  serialize(isSelf = false) {
    const data = {
      id: this.id,
      n: this.name,
      cls: this.planeClassKey,
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.vx),
      vy: Math.round(this.vy),
      a: Number(this.angle.toFixed(2)),
      bk: Number(this.bankAngle.toFixed(2)),
      hp: Math.round(this.hp),
      mhp: this.maxHp,
      lvl: this.level,
      sc: this.score,
      k: this.kills,
      bst: this.isBoosting,
      cld: this.inCloud,
      inv: this.isInvulnerable || this.specialActiveTimer > 0,
      r: this.planeClass.stats.radius || 24,
      bot: this.isBot
    };

    if (isSelf) {
      data.xp = this.xp;
      data.nxp = this.xpForNextLevel;
      data.bstVal = Math.round(this.boost);
      data.bstMax = this.boostMax;
      data.heat = Math.round(this.heat);
      data.ovh = this.isOverheated;
      data.pts = this.availableUpgradePoints;
      data.upg = this.upgrades;
      data.evos = this.availableEvolutions;
      data.spCd = Number(Math.max(0, this.specialCooldown).toFixed(1));
    }

    return data;
  }
}

module.exports = Player;
