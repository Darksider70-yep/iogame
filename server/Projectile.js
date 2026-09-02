/**
 * Projectile entity handling bullets, heavy cannon rounds, rockets, bombs, and flak shells.
 */
let nextProjId = 1;

class Projectile {
  constructor(options) {
    this.id = `proj_${nextProjId++}`;
    this.shooterId = options.shooterId || null;
    this.shooterTeam = options.shooterTeam || null;
    this.type = options.type || 'bullet'; // 'bullet', 'heavy_cannon', 'rocket', 'bomb', 'flak', 'rear_bullet'
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.angle = options.angle || 0;
    this.speed = options.speed || 700;
    this.vx = Math.cos(this.angle) * this.speed + (options.inheritedVx || 0) * 0.3;
    this.vy = Math.sin(this.angle) * this.speed + (options.inheritedVy || 0) * 0.3;
    this.damage = options.damage || 15;
    this.radius = options.radius || 4;
    this.range = options.range || 1200;
    this.distanceTraveled = 0;
    this.maxLifeTime = options.maxLifeTime || 2.0; // seconds
    this.lifeTime = 0;
    this.isDead = false;

    // Special properties
    this.isRocket = this.type === 'rocket';
    this.isBomb = this.type === 'bomb';
    this.isFlak = this.type === 'flak';
    this.isHeavy = this.type === 'heavy_cannon';
    this.splashRadius = options.splashRadius || (this.isBomb ? 90 : this.isRocket ? 60 : this.isFlak ? 75 : this.isHeavy ? 30 : 0);
    
    // Rocket acceleration
    this.accel = this.isRocket ? 500 : 0;
    // Bomb deceleration / drag
    this.drag = this.isBomb ? 0.96 : 1.0;

    // Flak target explosion range
    this.targetDist = options.targetDist || 800;
  }

  update(dt) {
    this.lifeTime += dt;

    if (this.isRocket) {
      this.speed += this.accel * dt;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    } else if (this.isBomb) {
      this.vx *= this.drag;
      this.vy *= this.drag;
    }

    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x += dx;
    this.y += dy;

    const stepDist = Math.hypot(dx, dy);
    this.distanceTraveled += stepDist;

    if (this.lifeTime >= this.maxLifeTime || this.distanceTraveled >= this.range) {
      this.isDead = true;
    }

    if (this.isFlak && this.distanceTraveled >= this.targetDist) {
      this.isDead = true;
    }
  }

  serialize() {
    return {
      id: this.id,
      t: this.type,
      x: (this.x + 0.5) | 0,
      y: (this.y + 0.5) | 0,
      a: Math.round(this.angle * 100) / 100,
      s: this.shooterId,
      r: this.radius
    };
  }
}

module.exports = Projectile;
