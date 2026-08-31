/**
 * Zeppelin Dreadnought boss entity and Island Flak Turrets.
 */
let nextBossId = 1;

class Zeppelin {
  constructor(x, y, level = 1) {
    this.id = `zep_${nextBossId++}`;
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.speed = 70;
    this.radius = 70; // large collision hull
    this.level = level;
    this.maxHp = 2200 + level * 600;
    this.hp = this.maxHp;
    this.isDead = false;

    // Turrets: 3 turrets (Nose, Mid, Tail)
    this.turrets = [
      { offsetDist: -45, offsetAngle: 0, angle: 0, cooldown: 0, fireRate: 2.2, range: 450, damage: 5.0 },
      { offsetDist: 0, offsetAngle: 0, angle: 0, cooldown: 0, fireRate: 2.5, range: 480, damage: 6.0 },
      { offsetDist: 45, offsetAngle: 0, angle: 0, cooldown: 0, fireRate: 2.2, range: 450, damage: 5.0 }
    ];

    this.turnTimer = 0;
    this.damageMap = new Map(); // tracks player damage for XP distribution
  }

  update(dt, worldWidth, worldHeight, players, onShoot) {
    // Wander slowly and avoid world boundaries
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = 4 + Math.random() * 4;
      this.targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
    }

    // Boundary repulsion
    const margin = 500;
    if (this.x < margin) this.targetAngle = 0;
    else if (this.x > worldWidth - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI / 2;
    else if (this.y > worldHeight - margin) this.targetAngle = -Math.PI / 2;

    // Smooth turn
    let diff = this.targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.angle += diff * Math.min(1, dt * 0.8);

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Turrets target closest enemy planes
    for (let t = 0; t < this.turrets.length; t++) {
      const turret = this.turrets[t];
      turret.cooldown -= dt;

      // Turret world position
      const tx = this.x + Math.cos(this.angle) * turret.offsetDist;
      const ty = this.y + Math.sin(this.angle) * turret.offsetDist;

      // Find closest alive player within range
      let closestPlayer = null;
      let minDist = turret.range;

      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.isDead || p.inCloud) continue;
        const d = Math.hypot(p.x - tx, p.y - ty);
        if (d < minDist) {
          minDist = d;
          closestPlayer = p;
        }
      }

      if (closestPlayer) {
        turret.angle = Math.atan2(closestPlayer.y - ty, closestPlayer.x - tx);
        if (turret.cooldown <= 0) {
          turret.cooldown = 1.0 / turret.fireRate;
          onShoot({
            shooterId: this.id,
            shooterTeam: 'boss',
            type: 'bullet',
            x: tx,
            y: ty,
            angle: turret.angle + (Math.random() - 0.5) * 0.08,
            speed: 620,
            damage: turret.damage,
            radius: 4,
            range: turret.range + 50
          });
        }
      } else {
        turret.angle = this.angle;
      }
    }
  }

  takeDamage(amount, attackerId) {
    this.hp -= amount;
    if (attackerId) {
      this.damageMap.set(attackerId, (this.damageMap.get(attackerId) || 0) + amount);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      a: Number(this.angle.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      r: this.radius,
      turrets: this.turrets.map(t => Number(t.angle.toFixed(2)))
    };
  }
}

class FlakTower {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = 35;
    this.range = 650;
    this.cooldown = 0;
    this.fireRate = 0.7; // fires heavy flak bursts
    this.angle = 0;
    this.hp = 700;
    this.maxHp = 700;
    this.isDead = false;
  }

  update(dt, players, onShootFlak) {
    if (this.isDead) return;
    this.cooldown -= dt;

    let target = null;
    let minDist = this.range;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isDead || p.inCloud) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }

    if (target) {
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      if (this.cooldown <= 0) {
        this.cooldown = 1.0 / this.fireRate;
        const targetDist = Math.hypot(target.x - this.x, target.y - this.y);
        onShootFlak({
          shooterId: this.id,
          type: 'flak',
          x: this.x,
          y: this.y,
          angle: this.angle + (Math.random() - 0.5) * 0.1,
          speed: 550,
          damage: 18,
          targetDist: targetDist,
          splashRadius: 80
        });
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      a: Number(this.angle.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      dead: this.isDead
    };
  }
}

module.exports = { Zeppelin, FlakTower };
